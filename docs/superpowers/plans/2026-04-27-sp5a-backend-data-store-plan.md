# SP5a — Backend Data Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Stand up the backend SQLite data layer (schema, migrations, query modules, tests) and replace the existing rsync+systemd deploy with a Docker+Compose deploy at `/opt/pulse/`. End state: live droplet running the Docker-ized backend with three empty new tables (`imap_accounts`, `synced_entries`, `imap_uids`) ready for SP5b.

**Architecture:** Drizzle ORM + `better-sqlite3` for the data layer; multi-stage `node:22-slim` Docker image pushed to GHCR; compose stack at `/opt/pulse/` with bind-mounted SQLite at `/opt/pulse/data/pulse.db`; `migrator` compose service runs migrations at deploy time before `backend` starts. SP2's existing `/health`/`/chat`/`/parse`/`/review`/`/generate-routine` routes are unchanged — only the deploy primitive shifts.

**Tech Stack:** Node.js 22, TypeScript (strict), Express (existing), Drizzle ORM, `better-sqlite3`, Vitest (existing), Docker + Compose v2, GitHub Container Registry, systemd timers/units on Ubuntu droplet.

**Spec:** [`docs/superpowers/specs/2026-04-27-sp5a-backend-data-store-design.md`](../specs/2026-04-27-sp5a-backend-data-store-design.md) — read it first; this plan implements it task-by-task.

---

## File map

**Create:**
- `backend/drizzle.config.ts`
- `backend/src/db/schema.ts`
- `backend/src/db/client.ts`
- `backend/src/db/migrate.ts`
- `backend/src/db/cli/migrate.ts`
- `backend/src/db/migrations/0000_*.sql` (generated)
- `backend/src/db/migrations/meta/_journal.json` (generated)
- `backend/src/db/migrations/meta/0000_snapshot.json` (generated)
- `backend/src/db/queries/imapAccounts.ts`
- `backend/src/db/queries/syncedEntries.ts`
- `backend/src/db/queries/imapUids.ts`
- `backend/src/db/__tests__/schema.test.ts`
- `backend/src/db/__tests__/migrate.test.ts`
- `backend/src/db/__tests__/queries.test.ts`
- `backend/Dockerfile`
- `backend/.dockerignore`
- `backend/deploy/compose.yml`
- `backend/deploy/systemd/pulse-stack.service`
- `backend/deploy/systemd/pulse-backup.service`
- `backend/deploy/systemd/pulse-backup.timer`
- `backend/deploy/cutover.md` — checklist for human-driven SSH cutover

**Modify:**
- `backend/package.json` — add deps + scripts
- `backend/vitest.config.ts` — include `src/**/__tests__/`
- `backend/.gitignore` — add `*.db`, `*.db-wal`, `*.db-shm` if not present
- `.github/workflows/deploy-backend.yml` — full rewrite for Docker + GHCR
- `docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md` — §6 amendment
- `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md` — §2 row 8 + §4 row 3 amendments + §3 sub-slice status

**Delete (after successful cutover):**
- `backend/deploy/pulse-backend.service` (replaced by `pulse-stack.service`)
- `backend/deploy/bootstrap.md` (replaced by `cutover.md`) — keep if it has SP2-specific reference content; otherwise replace

---

## Phase 1: Data layer code

### Task 1: Install Drizzle deps and add scripts

**Files:**
- Modify: `backend/package.json`

- [x] **Step 1: Install runtime + dev deps**

Run from `backend/`:

```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
```

Expected: `package.json` updated with `drizzle-orm`, `better-sqlite3` in `dependencies`, `drizzle-kit`, `@types/better-sqlite3` in `devDependencies`. `package-lock.json` updated.

- [x] **Step 2: Add db:generate script**

Edit `backend/package.json` `"scripts"` section to add:

```json
{
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/backend/src/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx src/db/cli/migrate.ts"
  }
}
```

`db:generate` produces SQL migrations from schema changes. `db:migrate` is for local/dev runs against a real file.

- [x] **Step 3: Verify install**

```bash
npm test
```

Expected: existing 56 SP2 tests still pass. No new tests yet.

- [x] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "chore(backend): add drizzle + better-sqlite3 deps"
```

---

### Task 2: Drizzle config + schema

**Files:**
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/db/schema.ts`

- [x] **Step 1: Write `drizzle.config.ts`**

```ts
// backend/drizzle.config.ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
});
```

- [x] **Step 2: Write `schema.ts`**

```ts
// backend/src/db/schema.ts
import { sqliteTable, integer, text, primaryKey, index } from "drizzle-orm/sqlite-core";

export const imapAccounts = sqliteTable("imap_accounts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  emailAddress: text("email_address").notNull().unique(),
  credentialsCiphertext: text("credentials_ciphertext").notNull(),
  senderAllowlist: text("sender_allowlist").notNull().default("[]"),
  pollIntervalSeconds: integer("poll_interval_seconds").notNull().default(300),
  status: text("status").notNull().default("active"),
  lastPolledAt: integer("last_polled_at"),
  lastError: text("last_error"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const syncedEntries = sqliteTable(
  "synced_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    accountId: integer("account_id")
      .notNull()
      .references(() => imapAccounts.id, { onDelete: "cascade" }),
    imapUid: integer("imap_uid").notNull(),
    contentHash: text("content_hash").notNull(),
    cents: integer("cents").notNull(),
    currency: text("currency").notNull(),
    merchant: text("merchant"),
    category: text("category"),
    occurredAt: integer("occurred_at").notNull(),
    recurring: integer("recurring").notNull().default(0),
    rawParseResponse: text("raw_parse_response").notNull(),
    emailSubject: text("email_subject"),
    emailFrom: text("email_from"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => ({
    accountCreated: index("idx_synced_entries_account_created").on(t.accountId, t.id),
    accountMerchantOccurred: index("idx_synced_entries_account_merchant_occurred").on(
      t.accountId,
      t.merchant,
      t.occurredAt,
    ),
  }),
);

export const imapUids = sqliteTable(
  "imap_uids",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => imapAccounts.id, { onDelete: "cascade" }),
    uid: integer("uid").notNull(),
    firstSeenAt: integer("first_seen_at").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.accountId, t.uid] }),
  }),
);

export type ImapAccount = typeof imapAccounts.$inferSelect;
export type NewImapAccount = typeof imapAccounts.$inferInsert;
export type SyncedEntry = typeof syncedEntries.$inferSelect;
export type NewSyncedEntry = typeof syncedEntries.$inferInsert;
export type ImapUid = typeof imapUids.$inferSelect;
export type NewImapUid = typeof imapUids.$inferInsert;
```

- [x] **Step 3: Generate migration**

```bash
cd backend && npm run db:generate
```

Expected: creates `backend/src/db/migrations/0000_*.sql` and `backend/src/db/migrations/meta/{_journal.json, 0000_snapshot.json}`.

- [x] **Step 4: Inspect generated SQL**

Open `backend/src/db/migrations/0000_*.sql` and confirm:
- `CREATE TABLE imap_accounts` with all 10 columns
- `CREATE TABLE synced_entries` with FK to `imap_accounts(id)` and `ON DELETE CASCADE`
- `CREATE TABLE imap_uids` with composite PK `(account_id, uid)` and FK cascade
- `CREATE INDEX idx_synced_entries_account_created`
- `CREATE INDEX idx_synced_entries_account_merchant_occurred`
- `CREATE UNIQUE INDEX` on `imap_accounts.email_address`

If any are missing, fix the schema and re-run `db:generate`.

- [x] **Step 5: Commit**

```bash
git add backend/drizzle.config.ts backend/src/db/schema.ts backend/src/db/migrations
git commit -m "feat(backend): add SP5a schema + initial migration"
```

---

### Task 3: createDb client (with PRAGMAs)

**Files:**
- Create: `backend/src/db/client.ts`

- [x] **Step 1: Write `client.ts`**

```ts
// backend/src/db/client.ts
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof createDb>["db"];

export function createDb(path: string) {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("synchronous = NORMAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
```

`Db` is the typed Drizzle instance; query modules accept `Db` as their first arg so tests can pass `:memory:` instances.

- [x] **Step 2: Commit**

```bash
git add backend/src/db/client.ts
git commit -m "feat(backend): add db client with PRAGMAs"
```

---

### Task 4: runMigrations + CLI entrypoint

**Files:**
- Create: `backend/src/db/migrate.ts`
- Create: `backend/src/db/cli/migrate.ts`

- [x] **Step 1: Write `migrate.ts`**

```ts
// backend/src/db/migrate.ts
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "./client.js";

export function runMigrations(db: Db, migrationsFolder: string): void {
  migrate(db, { migrationsFolder });
}
```

- [x] **Step 2: Write `cli/migrate.ts`**

```ts
// backend/src/db/cli/migrate.ts
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../client.js";
import { runMigrations } from "../migrate.js";

const dbPath = process.env.DB_PATH;
if (!dbPath) {
  console.error("DB_PATH env var required");
  process.exit(2);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

const { db, sqlite } = createDb(dbPath);
try {
  runMigrations(db, migrationsFolder);
  console.log(`migrations applied to ${dbPath}`);
} finally {
  sqlite.close();
}
```

- [x] **Step 3: Smoke test the CLI locally**

```bash
cd backend && DB_PATH=/tmp/pulse-test.db npm run db:migrate
```

Expected: exits 0; `sqlite3 /tmp/pulse-test.db '.schema'` shows three tables.

```bash
sqlite3 /tmp/pulse-test.db '.tables'
```

Expected output: `__drizzle_migrations imap_accounts imap_uids synced_entries`

- [x] **Step 4: Clean up and commit**

```bash
rm /tmp/pulse-test.db
git add backend/src/db/migrate.ts backend/src/db/cli/migrate.ts
git commit -m "feat(backend): add migration runner + CLI"
```

---

### Task 5: Configure vitest to find new tests

**Files:**
- Modify: `backend/vitest.config.ts`
- Modify: `backend/.gitignore`

- [x] **Step 1: Update `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts", "src/**/__tests__/**/*.test.ts"],
    pool: "forks",
    testTimeout: 10000,
  },
});
```

- [x] **Step 2: Update `.gitignore` if not present**

Check `backend/.gitignore` for SQLite artifacts. If missing, append:

```
# SQLite local files
*.db
*.db-wal
*.db-shm
```

(Exclude path `src/db/migrations/**` from this — those are SQL files we want.)

- [x] **Step 3: Verify existing tests still discoverable**

```bash
cd backend && npm test
```

Expected: 56 existing tests still pass.

- [x] **Step 4: Commit**

```bash
git add backend/vitest.config.ts backend/.gitignore
git commit -m "chore(backend): include __tests__ in vitest discovery"
```

---

### Task 6: Schema integrity tests (TDD)

**Files:**
- Create: `backend/src/db/__tests__/schema.test.ts`

- [x] **Step 1: Write the failing tests**

```ts
// backend/src/db/__tests__/schema.test.ts
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
    expect(byName.account_id).toMatchObject({ type: "INTEGER", notnull: 1 });
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

  it("has FK to imap_accounts(id) ON DELETE CASCADE", () => {
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
    expect(fk!.on_delete).toBe("CASCADE");
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
    // SQLite uses 'memory' for in-memory DBs even when WAL is requested
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
```

- [x] **Step 2: Run and verify it passes**

```bash
cd backend && npm test -- src/db/__tests__/schema.test.ts
```

Expected: all schema tests pass on the first run (the schema and migration already exist from Task 2).

If anything fails, fix the schema (and re-run `db:generate`) until green.

- [x] **Step 3: Commit**

```bash
git add backend/src/db/__tests__/schema.test.ts
git commit -m "test(backend): SP5a schema integrity"
```

---

### Task 7: Migration tests (TDD)

**Files:**
- Create: `backend/src/db/__tests__/migrate.test.ts`

- [x] **Step 1: Write the tests**

```ts
// backend/src/db/__tests__/migrate.test.ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../client.js";
import { runMigrations } from "../migrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");

describe("runMigrations", () => {
  it("creates all three tables on a fresh DB", () => {
    const { db, sqlite } = createDb(":memory:");
    runMigrations(db, migrationsFolder);

    const tables = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>;
    const names = tables.map((t) => t.name);

    expect(names).toContain("imap_accounts");
    expect(names).toContain("synced_entries");
    expect(names).toContain("imap_uids");
    expect(names).toContain("__drizzle_migrations");
  });

  it("is idempotent — running twice leaves one migration row", () => {
    const { db, sqlite } = createDb(":memory:");
    runMigrations(db, migrationsFolder);
    runMigrations(db, migrationsFolder);

    const rows = sqlite
      .prepare("SELECT count(*) as count FROM __drizzle_migrations")
      .get() as { count: number };

    expect(rows.count).toBe(1);
  });
});
```

- [x] **Step 2: Run and verify it passes**

```bash
cd backend && npm test -- src/db/__tests__/migrate.test.ts
```

Expected: PASS — both tests green.

- [x] **Step 3: Commit**

```bash
git add backend/src/db/__tests__/migrate.test.ts
git commit -m "test(backend): SP5a migration runner"
```

---

### Task 8: imapAccounts query module + tests (TDD)

**Files:**
- Create: `backend/src/db/queries/imapAccounts.ts`
- Modify: `backend/src/db/__tests__/queries.test.ts` (created here, extended in later tasks)

- [x] **Step 1: Write the failing tests**

```ts
// backend/src/db/__tests__/queries.test.ts
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
```

- [x] **Step 2: Verify the tests fail**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: FAIL — module `../queries/imapAccounts.js` not found.

- [x] **Step 3: Implement `queries/imapAccounts.ts`**

```ts
// backend/src/db/queries/imapAccounts.ts
import { eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { imapAccounts, type ImapAccount, type NewImapAccount } from "../schema.js";

export function createImapAccount(db: Db, input: NewImapAccount): { id: number } {
  const [row] = db
    .insert(imapAccounts)
    .values(input)
    .returning({ id: imapAccounts.id })
    .all();
  return { id: row.id };
}

export function getImapAccount(db: Db, id: number): ImapAccount | undefined {
  return db.select().from(imapAccounts).where(eq(imapAccounts.id, id)).get();
}

export function listImapAccounts(db: Db): ImapAccount[] {
  return db.select().from(imapAccounts).all();
}

export function updateLastPolled(db: Db, id: number, at: number): void {
  db.update(imapAccounts)
    .set({ lastPolledAt: at, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}

export function updateStatus(
  db: Db,
  id: number,
  status: "active" | "paused" | "error",
): void {
  db.update(imapAccounts)
    .set({ status, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}

export function updateError(db: Db, id: number, error: string | null): void {
  db.update(imapAccounts)
    .set({ lastError: error, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: PASS — all four `imapAccounts queries` tests green.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/queries/imapAccounts.ts backend/src/db/__tests__/queries.test.ts
git commit -m "feat(backend): SP5a imapAccounts queries"
```

---

### Task 9: syncedEntries query module + tests (TDD)

**Files:**
- Create: `backend/src/db/queries/syncedEntries.ts`
- Modify: `backend/src/db/__tests__/queries.test.ts`

- [x] **Step 1: Add failing tests to `queries.test.ts`**

Append to `queries.test.ts` (after the imapAccounts describe block):

```ts
import * as syncedEntriesQ from "../queries/syncedEntries.js";

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

    // matching merchant, recent — included
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
    // matching merchant, > 60 days ago — excluded
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
    // different merchant — excluded
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
```

- [x] **Step 2: Verify tests fail**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: FAIL — module `../queries/syncedEntries.js` not found.

- [x] **Step 3: Implement `queries/syncedEntries.ts`**

```ts
// backend/src/db/queries/syncedEntries.ts
import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import type { Db } from "../client.js";
import { syncedEntries, type SyncedEntry, type NewSyncedEntry } from "../schema.js";

const SIXTY_DAYS_MS = 60 * 86_400_000;

export function insertSyncedEntry(db: Db, input: NewSyncedEntry): { id: number } {
  const [row] = db
    .insert(syncedEntries)
    .values(input)
    .returning({ id: syncedEntries.id })
    .all();
  return { id: row.id };
}

export function listSinceCursor(
  db: Db,
  accountId: number,
  sinceId: number,
  limit: number,
): SyncedEntry[] {
  return db
    .select()
    .from(syncedEntries)
    .where(and(eq(syncedEntries.accountId, accountId), gt(syncedEntries.id, sinceId)))
    .orderBy(asc(syncedEntries.id))
    .limit(limit)
    .all();
}

export function findRecurringCandidates(
  db: Db,
  accountId: number,
  merchant: string,
  occurredAt: number,
): SyncedEntry[] {
  const lowerBound = occurredAt - SIXTY_DAYS_MS;
  return db
    .select()
    .from(syncedEntries)
    .where(
      and(
        eq(syncedEntries.accountId, accountId),
        eq(syncedEntries.merchant, merchant),
        gte(syncedEntries.occurredAt, lowerBound),
        lte(syncedEntries.occurredAt, occurredAt),
      ),
    )
    .all();
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: PASS — both `imapAccounts queries` and `syncedEntries queries` describe blocks green.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/queries/syncedEntries.ts backend/src/db/__tests__/queries.test.ts
git commit -m "feat(backend): SP5a syncedEntries queries"
```

---

### Task 10: imapUids query module + tests (TDD)

**Files:**
- Create: `backend/src/db/queries/imapUids.ts`
- Modify: `backend/src/db/__tests__/queries.test.ts`

- [x] **Step 1: Add failing tests**

Append to `queries.test.ts`:

```ts
import * as imapUidsQ from "../queries/imapUids.js";

describe("imapUids queries", () => {
  it("markUidSeen + hasSeen", () => {
    const accountId = seedAccount(db);

    expect(imapUidsQ.hasSeen(db, accountId, 42)).toBe(false);
    imapUidsQ.markUidSeen(db, accountId, 42, Date.now());
    expect(imapUidsQ.hasSeen(db, accountId, 42)).toBe(true);
  });

  it("markUidSeen is idempotent", () => {
    const accountId = seedAccount(db);
    imapUidsQ.markUidSeen(db, accountId, 42, Date.now());
    expect(() => imapUidsQ.markUidSeen(db, accountId, 42, Date.now())).not.toThrow();

    const uids = imapUidsQ.listSeenUidsForAccount(db, accountId);
    expect(uids).toEqual([42]);
  });

  it("listSeenUidsForAccount with sinceUid filters", () => {
    const accountId = seedAccount(db);
    [10, 20, 30].forEach((u) => imapUidsQ.markUidSeen(db, accountId, u, Date.now()));

    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toEqual([10, 20, 30]);
    expect(imapUidsQ.listSeenUidsForAccount(db, accountId, 15)).toEqual([20, 30]);
  });
});
```

- [x] **Step 2: Verify it fails**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Implement `queries/imapUids.ts`**

```ts
// backend/src/db/queries/imapUids.ts
import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "../client.js";
import { imapUids } from "../schema.js";

export function markUidSeen(
  db: Db,
  accountId: number,
  uid: number,
  firstSeenAt: number,
): void {
  db.insert(imapUids)
    .values({ accountId, uid, firstSeenAt })
    .onConflictDoNothing()
    .run();
}

export function hasSeen(db: Db, accountId: number, uid: number): boolean {
  const row = db
    .select({ uid: imapUids.uid })
    .from(imapUids)
    .where(and(eq(imapUids.accountId, accountId), eq(imapUids.uid, uid)))
    .get();
  return row !== undefined;
}

export function listSeenUidsForAccount(
  db: Db,
  accountId: number,
  sinceUid?: number,
): number[] {
  const where = sinceUid !== undefined
    ? and(eq(imapUids.accountId, accountId), gt(imapUids.uid, sinceUid))
    : eq(imapUids.accountId, accountId);

  const rows = db
    .select({ uid: imapUids.uid })
    .from(imapUids)
    .where(where)
    .orderBy(asc(imapUids.uid))
    .all();

  return rows.map((r) => r.uid);
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: PASS — all three query module describe blocks green.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/queries/imapUids.ts backend/src/db/__tests__/queries.test.ts
git commit -m "feat(backend): SP5a imapUids queries"
```

---

### Task 11: FK cascade test (TDD)

**Files:**
- Modify: `backend/src/db/__tests__/queries.test.ts`

- [x] **Step 1: Add the cascade test**

Append to `queries.test.ts`:

```ts
import { sql } from "drizzle-orm";

describe("FK cascade", () => {
  it("deleting an imap_account cascades to synced_entries and imap_uids", () => {
    const accountId = seedAccount(db);
    const now = Date.now();

    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 1,
      contentHash: "h",
      cents: 100,
      currency: "USD",
      occurredAt: now,
      rawParseResponse: "{}",
      createdAt: now,
    });
    imapUidsQ.markUidSeen(db, accountId, 1, now);

    // sanity
    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(1);
    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toHaveLength(1);

    // delete the parent
    db.run(sql`DELETE FROM imap_accounts WHERE id = ${accountId}`);

    // children gone
    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toEqual([]);
    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toEqual([]);
  });
});
```

- [x] **Step 2: Run tests to verify it passes**

```bash
cd backend && npm test -- src/db/__tests__/queries.test.ts
```

Expected: PASS — cascade test green (FK enforcement is on via PRAGMA from `createDb`).

- [x] **Step 3: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: 56 prior SP2 tests + new SP5a tests all green.

- [x] **Step 4: Commit**

```bash
git add backend/src/db/__tests__/queries.test.ts
git commit -m "test(backend): SP5a FK cascade"
```

---

## Phase 2: Docker

### Task 12: Dockerfile + .dockerignore

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/.dockerignore`

- [x] **Step 1: Write `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-slim AS builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
COPY lib/api-types.ts ./lib/api-types.ts
WORKDIR /app/backend
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
RUN groupadd -g 1500 pulse-backend \
 && useradd -u 1500 -g 1500 -r -s /usr/sbin/nologin pulse-backend
WORKDIR /app
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/node_modules ./node_modules
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/package.json ./
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/dist ./dist
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/src/db/migrations ./dist/backend/src/db/migrations
USER pulse-backend
EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]
```

**Why builder copies `lib/api-types.ts`:** the existing tsconfig has `rootDir: ".."` and references `../lib/api-types.ts` — the build needs that file at build time.

**Why migrations copied separately:** `tsc` does not copy `.sql` files to `dist/`; we copy them manually so the migrator can find them at `dist/backend/src/db/migrations/`.

- [x] **Step 2: Write `.dockerignore`**

```
**/node_modules
**/dist
**/.env
**/.env.local
backend/test
backend/src/db/__tests__
**/.git
**/.github
**/*.db
**/*.db-wal
**/*.db-shm
docs
design_handoff
app
components
lib/db
lib/sync
lib/pal
```

`lib/api-types.ts` is the one file under `lib/` the build needs (per the existing `tsconfig.json`'s `include`); iOS-only directories `lib/db/`, `lib/sync/`, `lib/pal/` are excluded so Docker doesn't ship the React Native code.

- [x] **Step 3: Build the image locally**

From repo root:

```bash
docker build -f backend/Dockerfile -t pulse-backend:dev .
```

Expected: image builds successfully. Image size around 200-250 MB.

- [x] **Step 4: Run image locally to confirm it boots**

```bash
docker run --rm -p 3000:3000 -e JWT_SECRET=dev -e OPENROUTER_API_KEY=fake -e DB_PATH=/tmp/test.db pulse-backend:dev
```

Expected: container starts, Express listens on 3000. `curl http://localhost:3000/health` returns 200. `Ctrl-C` to stop. (DB never opened in this run because no route uses it; `DB_PATH=/tmp/test.db` is a no-op until 5b's worker reads it.)

- [x] **Step 5: Run migrator command in image**

```bash
mkdir -p /tmp/pulse-test-data
docker run --rm \
  -v /tmp/pulse-test-data:/data \
  -e DB_PATH=/data/pulse.db \
  --user 1500:1500 \
  pulse-backend:dev \
  node dist/backend/src/db/cli/migrate.js
```

Expected: prints `migrations applied to /data/pulse.db`. **Note:** the host directory `/tmp/pulse-test-data` must be writable by UID 1500 — `chown 1500:1500 /tmp/pulse-test-data` first if running on a host without that user.

`sqlite3 /tmp/pulse-test-data/pulse.db '.tables'` → expects `__drizzle_migrations imap_accounts imap_uids synced_entries`.

Clean up: `rm -rf /tmp/pulse-test-data`.

- [x] **Step 6: Commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "feat(backend): Dockerfile (multi-stage, non-root)"
```

---

### Task 13: compose.yml

**Files:**
- Create: `backend/deploy/compose.yml`

- [x] **Step 1: Write `compose.yml`**

Replace `<gh-user>` with the user's GitHub username (an open item — confirmed before starting Task 17).

```yaml
# backend/deploy/compose.yml — deployed to /opt/pulse/compose.yml
services:
  migrator:
    image: ghcr.io/<gh-user>/pulse-backend:${IMAGE_TAG:-latest}
    command: node dist/backend/src/db/cli/migrate.js
    user: "1500:1500"
    env_file: .env
    environment:
      DB_PATH: /data/pulse.db
    volumes:
      - ./data:/data
    restart: "no"

  backend:
    image: ghcr.io/<gh-user>/pulse-backend:${IMAGE_TAG:-latest}
    user: "1500:1500"
    env_file: .env
    environment:
      DB_PATH: /data/pulse.db
    volumes:
      - ./data:/data
    ports:
      - "3000:3000"
    depends_on:
      migrator:
        condition: service_completed_successfully
    restart: unless-stopped
```

- [x] **Step 2: Test compose locally (optional but recommended)**

From `backend/deploy/`:

```bash
mkdir -p data
chown 1500:1500 data    # may need sudo
echo 'JWT_SECRET=dev' > .env
echo 'OPENROUTER_API_KEY=fake' >> .env
echo 'IMAGE_TAG=dev' >> .env

# tag local image as the GHCR name compose expects
docker tag pulse-backend:dev ghcr.io/<gh-user>/pulse-backend:dev

docker compose run --rm migrator
docker compose up -d backend
curl http://localhost:3000/health    # expect 200
docker compose logs backend
docker compose down
rm -rf data .env
```

Skip if you're running on Windows where `chown 1500:1500` is awkward — Task 19's droplet test covers it.

- [x] **Step 3: Commit**

```bash
git add backend/deploy/compose.yml
git commit -m "feat(backend): compose.yml with migrator + backend services"
```

---

### Task 14: systemd unit files

**Files:**
- Create: `backend/deploy/systemd/pulse-stack.service`
- Create: `backend/deploy/systemd/pulse-backup.service`
- Create: `backend/deploy/systemd/pulse-backup.timer`

- [x] **Step 1: Write `pulse-stack.service`**

```ini
# backend/deploy/systemd/pulse-stack.service — installed at /etc/systemd/system/pulse-stack.service
[Unit]
Description=Pulse stack (compose)
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/pulse
ExecStart=/usr/bin/docker compose up -d
ExecStop=/usr/bin/docker compose down

[Install]
WantedBy=multi-user.target
```

- [x] **Step 2: Write `pulse-backup.service`**

```ini
# backend/deploy/systemd/pulse-backup.service — installed at /etc/systemd/system/pulse-backup.service
[Unit]
Description=Pulse backend daily backup

[Service]
Type=oneshot
User=pulse-backend
Group=pulse-backend
ExecStart=/bin/bash -c '/usr/bin/sqlite3 /opt/pulse/data/pulse.db ".backup /opt/pulse/data/backups/pulse-$(date +%%F).db"'
ExecStartPost=/usr/bin/find /opt/pulse/data/backups -name 'pulse-*.db' -mtime +14 -delete
```

- [x] **Step 3: Write `pulse-backup.timer`**

```ini
# backend/deploy/systemd/pulse-backup.timer — installed at /etc/systemd/system/pulse-backup.timer
[Unit]
Description=Daily Pulse backend backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
Unit=pulse-backup.service

[Install]
WantedBy=timers.target
```

- [x] **Step 4: Commit**

```bash
git add backend/deploy/systemd
git commit -m "feat(backend): systemd units for compose stack + daily backup"
```

---

## Phase 3: GH Action rewrite

### Task 15: Confirm GitHub username + write cutover doc

**Files:**
- Create: `backend/deploy/cutover.md`

The cutover script captures the §9 process. Bake the username in once it's known; pause and ask the user if not yet confirmed.

- [x] **Step 1: Confirm GitHub username**

Ask the user: *"What's the GitHub username/org that owns this repo? It will be the GHCR namespace: `ghcr.io/<gh-user>/pulse-backend`."*

Record it; replace `<gh-user>` in `backend/deploy/compose.yml` from Task 13 with the real value (use Edit; commit the change with a `chore(backend): pin GHCR namespace` message).

- [x] **Step 2: Write `backend/deploy/cutover.md`**

```markdown
# SP5a cutover — `/srv/pulse-backend` → `/opt/pulse`

Run as root via SSH against the droplet (`root@178.128.81.14`). All steps idempotent except step 6, which is the actual cutover.

## Pre-flight

- [x] Confirm Docker installed: `docker --version` (need v24+ for compose v2 syntax)
  - If absent: `apt-get update && apt-get install -y docker.io docker-compose-plugin`
- [x] Confirm outbound to ghcr.io: `curl -sI https://ghcr.io/v2/`
- [x] Note current `/etc/pulse-backend.env` contents:
  ```
  cat /etc/pulse-backend.env
  ```
  Save the values somewhere local — these get copied to `/opt/pulse/.env` in step 3.

## 1. Create user + directories

```
useradd -u 1500 -r -s /usr/sbin/nologin pulse-backend 2>/dev/null || true
mkdir -p /opt/pulse/data/backups
chown -R pulse-backend:pulse-backend /opt/pulse/data
chmod 0700 /opt/pulse/data
chmod 0700 /opt/pulse/data/backups
```

## 2. Configure GHCR pull credentials

Generate a fine-grained PAT on GitHub:
- Scope: `read:packages`
- Expiration: 1 year
- Save the token; you'll never see it again

On the droplet:
```
docker login ghcr.io -u <gh-user> --password-stdin <<< 'ghp_xxxxxxxxxxxx'
```

This writes credentials to `/root/.docker/config.json` (root pulls images on behalf of compose).

## 3. Move env file

```
cp /etc/pulse-backend.env /opt/pulse/.env
chmod 0600 /opt/pulse/.env
echo 'IMAGE_TAG=latest' >> /opt/pulse/.env
```

(`IMAGE_TAG=latest` is a placeholder; real deploys overwrite this with the git SHA via the GH Action.)

## 4. Drop compose.yml + systemd units onto droplet

From your local checkout:

```
scp backend/deploy/compose.yml root@178.128.81.14:/opt/pulse/compose.yml
scp backend/deploy/systemd/pulse-stack.service root@178.128.81.14:/etc/systemd/system/
scp backend/deploy/systemd/pulse-backup.service root@178.128.81.14:/etc/systemd/system/
scp backend/deploy/systemd/pulse-backup.timer root@178.128.81.14:/etc/systemd/system/
ssh root@178.128.81.14 'systemctl daemon-reload'
```

## 5. Manually pull a known-good image (tagged `:latest`)

The first GH Action deploy hasn't run yet, so `:latest` doesn't exist on GHCR. Choose ONE of:

- **Option A (recommended): Run the GH Action manually first via `workflow_dispatch`** (after Task 18 lands), then come back to step 6.
- **Option B: Build + push manually from your local checkout:**
  ```
  docker build -f backend/Dockerfile -t ghcr.io/<gh-user>/pulse-backend:latest .
  docker push ghcr.io/<gh-user>/pulse-backend:latest
  ```

## 6. Cut over (the actual switch)

⚠️ This stops SP2's running backend briefly. ~30 seconds of downtime.

```
systemctl stop pulse-backend.service
systemctl disable pulse-backend.service
rm /etc/systemd/system/pulse-backend.service
systemctl daemon-reload
systemctl enable --now pulse-stack.service
systemctl enable --now pulse-backup.timer
```

## 7. Verify

```
curl -fsS http://localhost:3000/health        # expect 200 with body
docker compose -f /opt/pulse/compose.yml ps   # expect backend "running"
ls -la /opt/pulse/data/pulse.db               # expect 1500:1500 ownership
sqlite3 /opt/pulse/data/pulse.db '.tables'    # expect 4 tables incl __drizzle_migrations
systemctl status pulse-backup.timer           # expect "active (waiting)"
```

## 8. Trigger first backup manually (smoke test)

```
systemctl start pulse-backup.service
ls /opt/pulse/data/backups/                   # expect pulse-YYYY-MM-DD.db
```

## 9. Clean up old artifacts (do this LAST — only after verified happy)

```
rm -rf /srv/pulse-backend
rm /etc/pulse-backend.env
```

## Rollback (if anything in 1–7 fails)

The old artifacts aren't removed until step 9. Recovery:

```
systemctl stop pulse-stack.service
systemctl disable pulse-stack.service
# pulse-backend.service unit file is gone after step 6 — restore from git:
scp deploy/pulse-backend.service root@178.128.81.14:/etc/systemd/system/
systemctl daemon-reload
systemctl enable --now pulse-backend.service
```

(Then debug the failure and try again later.)
```

- [x] **Step 3: Commit**

```bash
git add backend/deploy/cutover.md
# only commit compose.yml change if username substitution was done
git commit -m "docs(backend): SP5a cutover checklist"
```

---

### Task 16: Add GitHub Action secrets

This is a manual step the user does on github.com. Document for posterity.

- [x] **Step 1: Confirm or add `DEPLOY_SSH_KEY` secret**

Already exists from SP2. Confirm via repo Settings → Secrets and variables → Actions.

- [x] **Step 2: Confirm or add `DEV_JWT` secret**

Already exists from SP2.

- [x] **Step 3: No new secrets needed for GHCR push**

The default `GITHUB_TOKEN` available in the action has package write permissions when the workflow declares them — see Task 17.

---

### Task 17: Rewrite `deploy-backend.yml`

**Files:**
- Modify: `.github/workflows/deploy-backend.yml`

- [x] **Step 1: Rewrite the workflow**

Replace the entire file with:

```yaml
name: Deploy backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'
      - 'lib/api-types.ts'
      - '.github/workflows/deploy-backend.yml'
  workflow_dispatch:

concurrency:
  group: deploy-backend
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

env:
  IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/pulse-backend

jobs:
  test-and-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: npm
          cache-dependency-path: backend/package-lock.json

      - name: Install deps
        working-directory: backend
        run: npm ci

      - name: Test
        working-directory: backend
        run: npm test

      - name: Build TS
        working-directory: backend
        run: npm run build

      - name: Set up Docker buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build + push image
        uses: docker/build-push-action@v6
        with:
          context: .
          file: backend/Dockerfile
          push: true
          tags: |
            ${{ env.IMAGE_NAME }}:${{ github.sha }}
            ${{ env.IMAGE_NAME }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: test-and-build
    runs-on: ubuntu-latest
    env:
      DEPLOY_HOST: root@178.128.81.14
      DEPLOY_PATH: /opt/pulse
      DROPLET_IP: 178.128.81.14
    steps:
      - uses: actions/checkout@v4

      - name: Configure SSH
        run: |
          mkdir -p ~/.ssh
          chmod 700 ~/.ssh
          printf '%s\n' "${{ secrets.DEPLOY_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          ssh-keyscan -H "$DROPLET_IP" >> ~/.ssh/known_hosts

      - name: Update compose.yml on droplet
        run: |
          scp backend/deploy/compose.yml "$DEPLOY_HOST:$DEPLOY_PATH/compose.yml"

      - name: Set IMAGE_TAG in remote .env
        run: |
          ssh "$DEPLOY_HOST" "sed -i '/^IMAGE_TAG=/d' $DEPLOY_PATH/.env && echo 'IMAGE_TAG=${{ github.sha }}' >> $DEPLOY_PATH/.env"

      - name: Pull image on droplet
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose pull"

      - name: Run migrator
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose run --rm migrator"

      - name: Up backend
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d backend && docker compose ps"

      - name: Smoke test
        env:
          BASE_URL: http://178.128.81.14:3000
          DEV_JWT: ${{ secrets.DEV_JWT }}
        run: bash backend/scripts/smoke.sh
```

**Why two jobs (`test-and-build` then `deploy`):** if test or image push fails, deploy never runs and the droplet keeps running the prior image. Single-job alternative would still work since the bash steps short-circuit, but two jobs make the dependency explicit and fail faster on the GH side.

- [x] **Step 2: Confirm `backend/scripts/smoke.sh` still works against the new path**

The smoke script hits `BASE_URL/health` etc. Since 5a doesn't change SP2's routes, the smoke script should pass unchanged. Read it to confirm:

```bash
cat backend/scripts/smoke.sh
```

If it expected the old `/srv/pulse-backend` path or any local file in CI, adjust. Likely it's just `curl` against the public URL, which doesn't care about the deploy primitive.

- [x] **Step 3: Commit**

```bash
git add .github/workflows/deploy-backend.yml
git commit -m "ci(backend): Docker + GHCR deploy pipeline"
```

---

## Phase 4: Droplet cutover

These tasks involve **live SSH actions against production**. Pause before each `ssh` step and confirm with the user. The cutover script in `backend/deploy/cutover.md` is the source of truth.

### Task 18: Pre-cutover dry run

**Files:** none modified.

- [x] **Step 1: Pre-flight checks**

Ask the user to SSH to the droplet (`! ssh root@178.128.81.14` from this session, or directly) and run:

```
docker --version
curl -sI https://ghcr.io/v2/
cat /etc/pulse-backend.env
systemctl status pulse-backend.service
```

Record the output. Confirm:
- Docker is v24+ (else install via `apt-get install -y docker.io docker-compose-plugin`)
- ghcr.io is reachable
- Env file has the SP2 secrets (write them down for step 3 of cutover)
- `pulse-backend.service` is `active (running)` — the cutover replaces this

- [x] **Step 2: Trigger initial GH Action manually**

The cutover step 5 needs a `:latest` image to exist on GHCR. Trigger one without merging anything:

- Push a no-op commit (e.g., a whitespace tweak in this plan) OR
- `gh workflow run deploy-backend.yml` with `workflow_dispatch`

The first run will:
- Build + push `ghcr.io/<gh-user>/pulse-backend:<sha>` and `:latest` ✅
- Fail at the deploy job because `/opt/pulse/` doesn't exist on the droplet yet ❌

That's expected. We're using the action to populate GHCR; the cutover happens next.

Verify in the GH Actions UI that the `test-and-build` job completed and the image is visible at `https://github.com/<gh-user>/pulse-backend/pkgs/container/pulse-backend`.

---

### Task 19: Execute cutover (live droplet)

**Files:** none modified in repo. Real SSH actions.

- [x] **Step 1: Walk through `backend/deploy/cutover.md` steps 1–6 with the user**

Read `backend/deploy/cutover.md` aloud. For each block, run the SSH command and confirm output before proceeding to the next.

⚠️ Step 6 stops the running SP2 backend. Expect ~30s downtime while compose pulls and starts.

- [x] **Step 2: Run verify (cutover.md step 7)**

```
ssh root@178.128.81.14 'curl -fsS http://localhost:3000/health'
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml ps'
ssh root@178.128.81.14 'ls -la /opt/pulse/data/pulse.db'
ssh root@178.128.81.14 "sqlite3 /opt/pulse/data/pulse.db '.tables'"
ssh root@178.128.81.14 'systemctl status pulse-backup.timer'
```

Each command must succeed. If any fail, run rollback (cutover.md "Rollback" section) and debug.

- [x] **Step 3: Trigger first backup (cutover.md step 8)**

```
ssh root@178.128.81.14 'systemctl start pulse-backup.service'
ssh root@178.128.81.14 'ls /opt/pulse/data/backups/'
```

Expect: a file named `pulse-YYYY-MM-DD.db`.

- [x] **Step 4: Clean up old artifacts (cutover.md step 9)**

Only after verify succeeds:

```
ssh root@178.128.81.14 'rm -rf /srv/pulse-backend'
ssh root@178.128.81.14 'rm /etc/pulse-backend.env'
```

- [x] **Step 5: Re-run the GH Action to verify end-to-end deploy**

```bash
gh workflow run deploy-backend.yml
```

This time both jobs should succeed: image rebuilds (cache hit on layers), migrator runs (no-op since schema is already applied), backend stays up.

If anything fails: debug, do not proceed.

---

### Task 20: Remove obsolete files from repo

**Files:**
- Delete: `backend/deploy/pulse-backend.service`
- Delete or rewrite: `backend/deploy/bootstrap.md`

- [x] **Step 1: Inspect bootstrap.md**

```bash
cat backend/deploy/bootstrap.md
```

If it contains useful SP2-era reference content (firewall rules, droplet setup), preserve it as `backend/deploy/bootstrap-historical.md` or fold the still-relevant parts into `cutover.md`. If it's all stale, delete.

- [x] **Step 2: Delete obsolete files**

```bash
git rm backend/deploy/pulse-backend.service
git rm backend/deploy/bootstrap.md   # only if confirmed obsolete in step 1
```

- [x] **Step 3: Commit**

```bash
git commit -m "chore(backend): remove rsync-era deploy files (replaced by cutover.md)"
```

---

## Phase 5: Meta-spec amendments

### Task 21: Patch parent meta-spec §6

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md`

- [x] **Step 1: Edit §6 "Backend deploy" subsection**

Replace this paragraph:

```markdown
### Backend deploy
- Plain `rsync` + `systemd` service unit. No Docker for v1 (YAGNI).
- TLS via Cloudflare Tunnel (no port-forwarding, no cert management) — re-evaluated in backend spec if user prefers Caddy.
```

With:

```markdown
### Backend deploy
- **Docker + Compose** (switched in SP5a). Image hosted on GHCR; deploy root at `/opt/pulse/`. Single `pulse-stack.service` systemd unit on the droplet runs `docker compose up -d` at boot. Compose handles per-service `restart: unless-stopped`. Bind-mount at `/opt/pulse/data/` holds the SQLite file.
- TLS via Cloudflare Tunnel (no port-forwarding, no cert management) — re-evaluated in backend spec if user prefers Caddy.
```

- [x] **Step 2: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md
git commit -m "docs(meta): patch §6 — Docker deploy (SP5a)"
```

---

### Task 22: Patch SP5 child meta-spec §2 row 8 + §4 row 3

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`

- [x] **Step 1: Edit §2 "Locked decisions" row 8 (Process model)**

Find this row:

```markdown
| Process model | **Two systemd units** on the droplet: `pulse-backend.service` (HTTP) and `pulse-worker.service` (poller). Same SQLite file (worker is the only writer of `synced_entries`). | Crash isolation; cleanly bounded units. |
```

Replace with:

```markdown
| Process model | **Two compose services** on a shared bind-mounted volume: `backend` (HTTP) and `worker` (poller, added in 5b). Both run as the `pulse-backend` OS user (UID 1500) inside the container. Same SQLite file (worker is the only writer of `synced_entries`). One `pulse-stack.service` systemd unit on the droplet brings up the compose stack at boot. (Updated in SP5a.) | Crash isolation; cleanly bounded compose services; one OS user keeps file ownership simple at one-user scale. |
```

- [x] **Step 2: Edit §4 row 3 (DO droplet)**

Find this row:

```markdown
| DO droplet, root access | 5a (initial SQLite + Drizzle install), 5b (new systemd unit) | Already provisioned (`root@178.128.81.14`). 5a's plan adds `/var/lib/pulse-backend/` and a `pulse-worker` user; 5b's plan adds `pulse-worker.service`. |
```

Replace with:

```markdown
| DO droplet, root access | 5a (initial SQLite + Drizzle install + Docker cutover), 5b (new compose service) | Already provisioned (`root@178.128.81.14`). 5a's plan stands up `/opt/pulse/`, the `pulse-backend` user (UID 1500), and the Docker-based deploy; 5b's plan adds the `worker` compose service alongside `backend`. |
```

- [x] **Step 3: Edit §3 sub-slice status — mark 5a code-complete**

Find this line:

```markdown
- **5a** Not started.
```

Replace with (substitute today's date and verify the smoke-test sentence reflects what actually ran):

```markdown
- **5a** ✅ Code complete YYYY-MM-DD — three new tables (`imap_accounts`, `synced_entries`, `imap_uids`) via Drizzle + `better-sqlite3`; query modules + cascade tests; multi-stage Dockerfile (`node:22-slim`, `USER 1500`); compose stack at `/opt/pulse/` with `migrator` + `backend` services; daily `sqlite3 .backup` via systemd timer; GH Action rebuilt for GHCR + Docker. Cutover from `/srv/pulse-backend` rsync deploy to `/opt/pulse/` Docker deploy executed live. Parent meta-spec §6 amended; this spec's §2 row 8 + §4 row 3 amended. `npm test` green (56 SP2 + new SP5a tests).
```

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5a): mark 5a complete + amend §2/§4 (Docker)"
```

---

## Phase 6: Verification

### Task 23: Final end-to-end verification

**Files:** none modified.

- [x] **Step 1: Run full backend test suite**

```bash
cd backend && npm test
```

Expected: 56 SP2 tests + new SP5a tests (~15-20 new) all pass.

- [x] **Step 2: Verify the live deploy via the droplet URL**

```bash
curl -fsS http://178.128.81.14:3000/health
```

Expected: 200 OK. (This matches the smoke step's `BASE_URL` in the GH Action — Cloudflare Tunnel, if configured, points at the same backend; setting up Tunnel is out of scope for SP5a.)

- [x] **Step 3: Verify the DB file exists and is readable**

```bash
ssh root@178.128.81.14 "sqlite3 /opt/pulse/data/pulse.db '.schema imap_accounts'"
```

Expected: `CREATE TABLE imap_accounts (...)` printed.

- [x] **Step 4: Verify the next-day backup ran**

(If you do this verification 24h+ after cutover.)

```bash
ssh root@178.128.81.14 'ls /opt/pulse/data/backups/'
```

Expected: at least one `pulse-YYYY-MM-DD.db` file dated after the cutover. If the timer hasn't fired yet, manually trigger and verify (already done in Task 19 step 3).

- [x] **Step 5: Verify `git status` is clean and CI is green on `main`**

```bash
git status
gh run list --branch main --limit 5
```

Expected: clean working tree; the most recent `Deploy backend` run succeeded.

---

## Self-review checklist

Before declaring 5a complete, verify each spec section maps to at least one task:

- [x] §1 What 5a ships → Tasks 1–22 (everything)
- [x] §2 Locked decisions → resolved during brainstorm; Tasks 21–22 amend the parent specs
- [x] §3 Tables → Task 2 (schema + migration)
- [x] §4 Code structure → Tasks 2–11
- [x] §5 Dockerfile → Task 12
- [x] §6 compose.yml → Task 13
- [x] §7 Filesystem layout → Tasks 14, 19
- [x] §8 GH Action rewrite → Task 17
- [x] §9 Cutover plan → Tasks 15, 18, 19
- [x] §10 Error handling → built in via failure-fast at every step (test → build → push → migrate → up)
- [x] §11 Testing → Tasks 6–11
- [x] §12 What 5a is NOT → enforced by absence (no IMAP, no encryption, no `worker` service in compose, etc.)
- [x] §13 Meta-spec amendments → Tasks 21, 22
- [x] §14 Open items → resolved at Task 15 (GitHub username) and Task 18 (env file contents)

If during execution you find a spec requirement with no task, add the task and update this checklist.
