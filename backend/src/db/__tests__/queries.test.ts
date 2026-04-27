import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../client.js";
import { runMigrations } from "../migrate.js";
import * as imapAccountsQ from "../queries/imapAccounts.js";

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
