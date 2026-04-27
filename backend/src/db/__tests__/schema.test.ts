import { describe, it, expect, beforeEach } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../client.js";
import { runMigrations } from "../migrate.js";
import type Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
  dflt_value: string | null;
}

interface IndexInfo {
  name: string;
  unique: number;
}

let db: Db;
let sqlite: Database.Database;

beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  sqlite = created.sqlite;
  runMigrations(db, migrationsFolder);
});

describe("imap_accounts schema", () => {
  it("has expected columns with correct types", () => {
    const cols = sqlite.prepare("PRAGMA table_info(imap_accounts)").all() as ColumnInfo[];
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));

    expect(byName.id).toMatchObject({ type: "INTEGER", pk: 1 });
    expect(byName.email_address).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.credentials_ciphertext).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.sender_allowlist).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.poll_interval_seconds).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.status).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.last_polled_at).toMatchObject({ type: "INTEGER", notnull: 0 });
    expect(byName.last_error).toMatchObject({ type: "TEXT", notnull: 0 });
    expect(byName.created_at).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.updated_at).toMatchObject({ type: "INTEGER", notnull: 1 });
  });

  it("has unique index on email_address", () => {
    const indexes = sqlite.prepare("PRAGMA index_list(imap_accounts)").all() as IndexInfo[];
    const unique = indexes.find((i) => i.unique === 1);
    expect(unique).toBeDefined();
  });
});

describe("synced_entries schema", () => {
  it("has expected columns with correct types", () => {
    const cols = sqlite.prepare("PRAGMA table_info(synced_entries)").all() as ColumnInfo[];
    const byName = Object.fromEntries(cols.map((c) => [c.name, c]));

    expect(byName.id).toMatchObject({ type: "INTEGER", pk: 1 });
    expect(byName.account_id).toMatchObject({ type: "INTEGER", notnull: 0 });
    expect(byName.imap_uid).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.content_hash).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.cents).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.currency).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.merchant).toMatchObject({ type: "TEXT", notnull: 0 });
    expect(byName.category).toMatchObject({ type: "TEXT", notnull: 0 });
    expect(byName.occurred_at).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.recurring).toMatchObject({ type: "INTEGER", notnull: 1 });
    expect(byName.raw_parse_response).toMatchObject({ type: "TEXT", notnull: 1 });
    expect(byName.created_at).toMatchObject({ type: "INTEGER", notnull: 1 });
  });

  it("has indexes idx_synced_entries_account_created and idx_synced_entries_account_merchant_occurred", () => {
    const indexes = sqlite.prepare("PRAGMA index_list(synced_entries)").all() as IndexInfo[];
    const names = indexes.map((i) => i.name);
    expect(names).toContain("idx_synced_entries_account_created");
    expect(names).toContain("idx_synced_entries_account_merchant_occurred");
  });

  it("has FK to imap_accounts(id) ON DELETE SET NULL", () => {
    const fks = sqlite.prepare("PRAGMA foreign_key_list(synced_entries)").all() as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    const fk = fks.find((f) => f.table === "imap_accounts");
    expect(fk).toBeDefined();
    expect(fk!.from).toBe("account_id");
    expect(fk!.to).toBe("id");
    expect(fk!.on_delete).toBe("SET NULL");
  });
});

describe("imap_uids schema", () => {
  it("has composite primary key (account_id, uid)", () => {
    const cols = sqlite.prepare("PRAGMA table_info(imap_uids)").all() as ColumnInfo[];
    const pkCols = cols.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk);
    expect(pkCols.map((c) => c.name)).toEqual(["account_id", "uid"]);
  });

  it("has FK to imap_accounts(id) ON DELETE CASCADE", () => {
    const fks = sqlite.prepare("PRAGMA foreign_key_list(imap_uids)").all() as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    const fk = fks.find((f) => f.table === "imap_accounts");
    expect(fk).toBeDefined();
    expect(fk!.from).toBe("account_id");
    expect(fk!.on_delete).toBe("CASCADE");
  });
});

describe("PRAGMAs", () => {
  it("foreign_keys is ON", () => {
    const result = sqlite.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(result.foreign_keys).toBe(1);
  });

  it("journal_mode is WAL (or memory in :memory: mode)", () => {
    const result = sqlite.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    expect(["wal", "memory"]).toContain(result.journal_mode);
  });
});

describe("sender_allowlist round-trip", () => {
  it("stores and retrieves a JSON array", () => {
    const allowlist = ["chase.com", "discover.com"];
    sqlite
      .prepare(
        `INSERT INTO imap_accounts
        (email_address, credentials_ciphertext, sender_allowlist, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run("a@example.com", "cipher", JSON.stringify(allowlist), Date.now(), Date.now());

    const row = sqlite
      .prepare("SELECT sender_allowlist FROM imap_accounts WHERE email_address = ?")
      .get("a@example.com") as { sender_allowlist: string };

    expect(JSON.parse(row.sender_allowlist)).toEqual(allowlist);
  });
});
