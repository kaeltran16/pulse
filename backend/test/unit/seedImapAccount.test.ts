import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import { decryptCredential } from "../../src/lib/crypto/credentials.js";
import { seedImapAccount, type ImapValidator } from "../../src/lib/seedImapAccount.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");

const KEY = "a".repeat(64);

let db: Db;
beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

describe("seedImapAccount", () => {
  it("happy path: validates with IMAP, encrypts, inserts; ciphertext round-trips", async () => {
    const validator: ImapValidator = vi.fn(async () => {});
    const { id } = await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1234 },
      { email: "kael@gmail.com", password: "abcd-efgh", allowlist: ["chase.com"] },
    );

    const row = imapAccountsQ.getImapAccount(db, id)!;
    expect(row.emailAddress).toBe("kael@gmail.com");
    expect(JSON.parse(row.senderAllowlist)).toEqual(["chase.com"]);
    expect(decryptCredential(row.credentialsCiphertext, KEY)).toBe("abcd-efgh");
    expect(validator).toHaveBeenCalledWith({ email: "kael@gmail.com", password: "abcd-efgh" });
  });

  it("validator failure → no row written, error propagates", async () => {
    const validator: ImapValidator = vi.fn(async () => { throw new Error("AUTHENTICATIONFAILED"); });
    await expect(
      seedImapAccount(
        { db, encryptionKey: KEY, validator, now: () => 1 },
        { email: "kael@gmail.com", password: "wrong", allowlist: [] },
      ),
    ).rejects.toThrow(/AUTHENTICATIONFAILED/);

    expect(imapAccountsQ.listImapAccounts(db)).toHaveLength(0);
  });

  it("rejects duplicate email_address", async () => {
    const validator: ImapValidator = async () => {};
    await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1 },
      { email: "kael@gmail.com", password: "p1", allowlist: [] },
    );
    await expect(
      seedImapAccount(
        { db, encryptionKey: KEY, validator, now: () => 2 },
        { email: "kael@gmail.com", password: "p2", allowlist: [] },
      ),
    ).rejects.toThrow(/already.*exists|UNIQUE/i);
  });

  it("empty allowlist is permitted but stored as `[]`", async () => {
    const validator: ImapValidator = async () => {};
    const { id } = await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1 },
      { email: "kael@gmail.com", password: "p", allowlist: [] },
    );
    expect(imapAccountsQ.getImapAccount(db, id)!.senderAllowlist).toBe("[]");
  });
});
