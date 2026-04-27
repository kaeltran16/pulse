import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import * as imapUidsQ from "../../src/db/queries/imapUids.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import { encryptCredential } from "../../src/lib/crypto/credentials.js";
import { AccountBackoffState } from "../../src/worker/backoff.js";
import { processAccount } from "../../src/worker/processAccount.js";
import { UpstreamError } from "../../src/middleware/errorHandler.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapClient } from "../../src/worker/imap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");

const KEY = "a".repeat(64);
const APP_PASSWORD = "abcd-efgh-ijkl-mnop";

let db: Db;
const logger = createLogger("fatal");

function fakeImapClient(args: {
  searchResult: number[];
  message: (uid: number) => { source: Buffer; from: string; subject: string; date: Date };
  connectFails?: Error;
}): ImapClient {
  const search = vi.fn(async () => args.searchResult);
  const fetchOne = vi.fn(async (uid: number) => {
    const m = args.message(uid);
    return {
      uid,
      envelope: { from: [{ address: m.from }], subject: m.subject, date: m.date },
      source: m.source,
    };
  });
  return {
    connect: vi.fn(async () => {
      if (args.connectFails) throw args.connectFails;
    }),
    mailboxOpen: vi.fn(async () => {}),
    search,
    fetchOne,
    logout: vi.fn(async () => {}),
  };
}

function llmReturning(text: string | (() => string) | (() => never)): LlmClient {
  return {
    async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      const t = typeof text === "function" ? text() : text;
      return { text: t, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

function rfc822(subject: string, body: string): Buffer {
  return Buffer.from(
    `From: x@y.z\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
    "utf8",
  );
}

beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

function seedAccount(): number {
  const now = Date.now();
  const ct = encryptCredential(APP_PASSWORD, KEY);
  const { id } = imapAccountsQ.createImapAccount(db, {
    emailAddress: "kael@gmail.com",
    credentialsCiphertext: ct,
    senderAllowlist: JSON.stringify(["chase.com"]),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe("processAccount", () => {
  it("kind:spend → row inserted, UID marked, recurring=false on first occurrence", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "You spent $5.75 at Verve."),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(1_700_000_000_000),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "x",
      }),
    );
    const backoff = new AccountBackoffState(() => Date.now());

    await processAccount({
      db,
      account,
      backoff,
      logger,
      llm,
      modelId: "anthropic/claude-haiku-4.5",
      encryptionKey: KEY,
      imapClientFactory: () => client,
      now: Date.now(),
    });

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 0, 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].cents).toBe(575);
    expect(rows[0].currency).toBe("USD");
    expect(rows[0].merchant).toBe("Verve");
    expect(rows[0].recurring).toBe(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
    expect(backoff.consecutiveFailures(accountId)).toBe(0);
  });

  it("kind:spend with prior match → recurring=1", async () => {
    const accountId = seedAccount();
    const now = Date.now();
    // Pre-seed a prior recurring candidate
    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 50,
      contentHash: "h",
      cents: 575,
      currency: "USD",
      merchant: "Verve",
      occurredAt: now - 30 * 86_400_000,
      rawParseResponse: "{}",
      createdAt: now - 30 * 86_400_000,
    });
    imapUidsQ.markUidSeen(db, accountId, 50, now);

    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "x"),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(now),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "x",
      }),
    );

    await processAccount({
      db,
      account,
      backoff: new AccountBackoffState(() => now),
      logger,
      llm,
      modelId: "anthropic/claude-haiku-4.5",
      encryptionKey: KEY,
      imapClientFactory: () => client,
      now,
    });

    // Prior row has auto-id=1; the new row from processing has auto-id=2.
    // Use sinceId=1 to get only the new row (skipping the pre-seeded prior).
    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 1, 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].recurring).toBe(1);
  });

  it("kind:workout → no synced row, UID still marked seen", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "x"),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({ kind: "chat", confidence: "high", raw: "x" }),
    );

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
  });

  it("UpstreamError from parseEntry → no row, UID NOT marked, transient failure recorded", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101, 102],
      message: (uid) => ({
        source: rfc822(`s${uid}`, "x"),
        from: "alerts@chase.com",
        subject: `s${uid}`,
        date: new Date(),
      }),
    });
    const llm: LlmClient = {
      async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
      async chatJson() { throw new UpstreamError("network down"); },
    };
    const backoff = new AccountBackoffState(() => Date.now());

    await processAccount({
      db, account, backoff, logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(false);
    expect(imapUidsQ.hasSeen(db, accountId, 102)).toBe(false);
    expect(backoff.consecutiveFailures(accountId)).toBe(1);
    // status remains 'active' (not permanent)
    expect(imapAccountsQ.getImapAccount(db, accountId)!.status).toBe("active");
  });

  it("ZodError from parseEntry → no row but UID marked seen (don't retry forever)", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("s", "x"),
        from: "alerts@chase.com",
        subject: "s",
        date: new Date(),
      }),
    });
    const llm = llmReturning("not json at all");

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
  });

  it("auth failure on connect → status='error', no IMAP work after", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const authErr = new Error("Invalid credentials");
    (authErr as Error & { authenticationFailed?: boolean }).authenticationFailed = true;
    const client = fakeImapClient({
      searchResult: [],
      message: () => { throw new Error("unreachable"); },
      connectFails: authErr,
    });
    const llm = llmReturning("{}");

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    const updated = imapAccountsQ.getImapAccount(db, accountId)!;
    expect(updated.status).toBe("error");
    expect(updated.lastError).toMatch(/auth/i);
    expect(client.search).not.toHaveBeenCalled();
  });

  it("decrypt failure → status='error', no IMAP attempted", async () => {
    const accountId = seedAccount();
    // Corrupt the ciphertext (drizzle sql tag handles parameter binding)
    db.run(sql`UPDATE imap_accounts SET credentials_ciphertext = ${"AAAA"} WHERE id = ${accountId}`);
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({ searchResult: [], message: () => ({ source: Buffer.from(""), from: "", subject: "", date: new Date() }) });

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger,
      llm: llmReturning("{}"),
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(imapAccountsQ.getImapAccount(db, accountId)!.status).toBe("error");
    expect(client.connect).not.toHaveBeenCalled();
  });
});
