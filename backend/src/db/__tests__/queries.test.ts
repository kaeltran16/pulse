import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../client.js";
import { runMigrations } from "../migrate.js";
import * as imapAccountsQ from "../queries/imapAccounts.js";
import * as syncedEntriesQ from "../queries/syncedEntries.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

let db: Db;
beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

describe("imapAccounts queries", () => {
  it("createImapAccount returns id and is retrievable via getImapAccount", () => {
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "user@example.com",
      credentialsCiphertext: "cipher",
      senderAllowlist: '["chase.com"]',
      createdAt: now,
      updatedAt: now,
    });

    const row = imapAccountsQ.getImapAccount(db, id);
    expect(row).toBeDefined();
    expect(row!.emailAddress).toBe("user@example.com");
    expect(row!.status).toBe("active");
    expect(row!.pollIntervalSeconds).toBe(300);
  });

  it("listImapAccounts returns all rows", () => {
    const now = Date.now();
    imapAccountsQ.createImapAccount(db, {
      emailAddress: "a@example.com",
      credentialsCiphertext: "c1",
      createdAt: now,
      updatedAt: now,
    });
    imapAccountsQ.createImapAccount(db, {
      emailAddress: "b@example.com",
      credentialsCiphertext: "c2",
      createdAt: now,
      updatedAt: now,
    });

    const rows = imapAccountsQ.listImapAccounts(db);
    expect(rows).toHaveLength(2);
  });

  it("updateLastPolled changes last_polled_at", () => {
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@example.com",
      credentialsCiphertext: "c",
      createdAt: now,
      updatedAt: now,
    });

    const polledAt = now + 1000;
    imapAccountsQ.updateLastPolled(db, id, polledAt);

    const row = imapAccountsQ.getImapAccount(db, id);
    expect(row!.lastPolledAt).toBe(polledAt);
  });

  it("updateStatus and updateError reflect in subsequent reads", () => {
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@example.com",
      credentialsCiphertext: "c",
      createdAt: now,
      updatedAt: now,
    });

    imapAccountsQ.updateStatus(db, id, "error");
    imapAccountsQ.updateError(db, id, "imap timeout");
    let row = imapAccountsQ.getImapAccount(db, id);
    expect(row!.status).toBe("error");
    expect(row!.lastError).toBe("imap timeout");

    imapAccountsQ.updateError(db, id, null);
    row = imapAccountsQ.getImapAccount(db, id);
    expect(row!.lastError).toBeNull();
  });
});

function seedAccount(db: Db, email = "u@example.com"): number {
  const now = Date.now();
  const { id } = imapAccountsQ.createImapAccount(db, {
    emailAddress: email,
    credentialsCiphertext: "c",
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe("syncedEntries queries", () => {
  it("insertSyncedEntry returns id; listSinceCursor returns rows in ascending id order", () => {
    const accountId = seedAccount(db);
    const now = Date.now();

    const { id: id1 } = syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 1,
      contentHash: "h1",
      cents: 1234,
      currency: "USD",
      occurredAt: now,
      rawParseResponse: "{}",
      createdAt: now,
    });
    const { id: id2 } = syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 2,
      contentHash: "h2",
      cents: 5678,
      currency: "USD",
      occurredAt: now + 1,
      rawParseResponse: "{}",
      createdAt: now + 1,
    });

    expect(id2).toBeGreaterThan(id1);

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 0, 100);
    expect(rows).toHaveLength(2);
    expect(rows[0].id).toBe(id1);
    expect(rows[1].id).toBe(id2);
  });

  it("listSinceCursor returns [] when sinceId is the latest id", () => {
    const accountId = seedAccount(db);
    const now = Date.now();
    const { id } = syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 1,
      contentHash: "h",
      cents: 100,
      currency: "USD",
      occurredAt: now,
      rawParseResponse: "{}",
      createdAt: now,
    });

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, id, 100);
    expect(rows).toEqual([]);
  });

  it("listSinceCursor respects limit", () => {
    const accountId = seedAccount(db);
    const now = Date.now();
    for (let i = 0; i < 5; i++) {
      syncedEntriesQ.insertSyncedEntry(db, {
        accountId,
        imapUid: i,
        contentHash: `h${i}`,
        cents: 100,
        currency: "USD",
        occurredAt: now + i,
        rawParseResponse: "{}",
        createdAt: now + i,
      });
    }

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 0, 3);
    expect(rows).toHaveLength(3);
  });

  it("findRecurringCandidates returns prior-60-day rows for matching merchant only", () => {
    const accountId = seedAccount(db);
    const now = Date.now();
    const day = 86_400_000;

    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 1,
      contentHash: "h1",
      cents: 1000,
      currency: "USD",
      merchant: "Netflix",
      occurredAt: now - 30 * day,
      rawParseResponse: "{}",
      createdAt: now - 30 * day,
    });
    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 2,
      contentHash: "h2",
      cents: 1000,
      currency: "USD",
      merchant: "Netflix",
      occurredAt: now - 90 * day,
      rawParseResponse: "{}",
      createdAt: now - 90 * day,
    });
    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 3,
      contentHash: "h3",
      cents: 1000,
      currency: "USD",
      merchant: "Spotify",
      occurredAt: now - 5 * day,
      rawParseResponse: "{}",
      createdAt: now - 5 * day,
    });

    const candidates = syncedEntriesQ.findRecurringCandidates(db, accountId, "Netflix", now);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].imapUid).toBe(1);
  });

  it("findRecurringCandidates is scoped per account", () => {
    const accountA = seedAccount(db, "a@example.com");
    const accountB = seedAccount(db, "b@example.com");
    const now = Date.now();
    const day = 86_400_000;

    syncedEntriesQ.insertSyncedEntry(db, {
      accountId: accountB,
      imapUid: 1,
      contentHash: "h",
      cents: 1000,
      currency: "USD",
      merchant: "Netflix",
      occurredAt: now - 5 * day,
      rawParseResponse: "{}",
      createdAt: now - 5 * day,
    });

    const candidates = syncedEntriesQ.findRecurringCandidates(db, accountA, "Netflix", now);
    expect(candidates).toEqual([]);
  });
});
