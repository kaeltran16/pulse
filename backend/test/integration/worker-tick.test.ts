import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import { encryptCredential } from "../../src/lib/crypto/credentials.js";
import { AccountBackoffState } from "../../src/worker/backoff.js";
import { runTick } from "../../src/worker/index.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapClient } from "../../src/worker/imap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");
const KEY = "a".repeat(64);

let db: Db;
beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

function llmReturning(text: string): LlmClient {
  return {
    async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

function fakeClientReturning(uids: number[], from: string, body: string): ImapClient {
  return {
    connect: vi.fn(async () => {}),
    mailboxOpen: vi.fn(async () => {}),
    search: vi.fn(async () => uids),
    fetchOne: vi.fn(async (uid: number) => ({
      uid,
      envelope: { from: [{ address: from }], subject: "s", date: new Date() },
      source: Buffer.from(
        `From: x\r\nSubject: s\r\nContent-Type: text/plain\r\n\r\n${body}`,
        "utf8",
      ),
    })),
    logout: vi.fn(async () => {}),
  };
}

describe("runTick", () => {
  it("no accounts → no-op, no errors", async () => {
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => Date.now()),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: () => fakeClientReturning([], "x", ""),
      now: Date.now(),
    });
    expect(result.processed).toBe(0);
  });

  it("one active eligible account is processed; rows land in synced_entries", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: JSON.stringify(["chase.com"]),
      createdAt: now,
      updatedAt: now,
    });

    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1.0, currency: "USD", merchant: "M" },
        confidence: "high",
        raw: "x",
      }),
    );

    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm,
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: () => fakeClientReturning([1], "alerts@chase.com", "x"),
      now,
    });

    expect(result.processed).toBe(1);
    expect(syncedEntriesQ.listSinceCursor(db, id, 0, 100)).toHaveLength(1);
  });

  it("account with status='error' is skipped", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: "[]",
      createdAt: now,
      updatedAt: now,
    });
    imapAccountsQ.updateStatus(db, id, "error");

    const factory = vi.fn(() => fakeClientReturning([], "x", ""));
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: factory,
      now,
    });
    expect(result.processed).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });

  it("account in backoff (not eligible) is skipped", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: "[]",
      lastPolledAt: now - 10_000, // 10s ago, interval is 300s
      createdAt: now,
      updatedAt: now,
    });

    const factory = vi.fn(() => fakeClientReturning([], "x", ""));
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: factory,
      now,
    });
    expect(result.processed).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });
});
