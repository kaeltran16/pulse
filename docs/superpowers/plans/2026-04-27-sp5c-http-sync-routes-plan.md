# SP5c — HTTP Sync Routes + iOS Sync Client Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up four HTTP routes that turn 5b's `synced_entries` rows into iOS-side `spending_entries` rows, plus the iOS `lib/sync/` module driven by a single `syncNow()` async function called on app foreground.

**Architecture:** New backend router pair (`backend/src/routes/imap.ts` + `backend/src/routes/sync.ts`) mounted under a new `"sync"` JWT scope. A backend migration (`0002_*`) relaxes `synced_entries.account_id` to nullable + `ON DELETE SET NULL` so disconnect preserves history. iOS migration `0004_*` adds four sync-metadata columns to `spending_entries` and a single-row `sync_cursor` table. The iOS orchestrator `syncNow()` is idempotent (`INSERT OR IGNORE` keyed on `synced_entry_id`) and re-entrance-guarded with a module-level promise.

**Tech Stack:** Node 22, TypeScript (strict, ESM), Drizzle ORM + `better-sqlite3` (backend), `expo-sqlite` + Drizzle (iOS), Express, Zod, vitest, supertest, jsonwebtoken, `imapflow` (already added in 5b — reused here for the validator). No new deps.

**Spec:** [`docs/superpowers/specs/2026-04-27-sp5c-http-sync-routes-design.md`](../specs/2026-04-27-sp5c-http-sync-routes-design.md)

**Working dir baseline check before starting:** `git status` should show a clean tree (the 5c spec is committed at `e71f079`). Backend tests should be green: `cd backend && npm test` → 183 tests (127 SP2/SP5a + 56 SP5b). iOS tests should be green: `cd .. && npm test` (root) — current count varies; record the baseline.

**Convention used in this plan:** "backend/" paths assume `cd backend` for `npm` commands; "iOS" paths run from the repo root.

---

## Task 1: Add `"sync"` scope to auth middleware

**Files:**
- Modify: `backend/src/middleware/auth.ts`
- Modify: `backend/test/helpers/jwt.ts`

- [ ] **Step 1: Update the `Scope` union**

Edit `backend/src/middleware/auth.ts`:

```typescript
export type Scope = "chat" | "parse" | "review" | "generate-routine" | "sync";
```

- [ ] **Step 2: Update test JWT helper to include the new scope by default**

Edit `backend/test/helpers/jwt.ts` — change the default scope list:

```typescript
const scope: Scope[] = opts.scope ?? ["chat", "parse", "review", "generate-routine", "sync"];
```

- [ ] **Step 3: Run existing tests to confirm no regression**

```bash
cd backend && npm test
```

Expected: all 183 tests still pass. The added scope is an additive type change.

- [ ] **Step 4: Commit**

```bash
git add backend/src/middleware/auth.ts backend/test/helpers/jwt.ts
git commit -m "feat(sp5c): add 'sync' scope to auth middleware"
```

---

## Task 2: Backend schema delta — relax `synced_entries.account_id` FK

**Files:**
- Modify: `backend/src/db/schema.ts`

- [ ] **Step 1: Make `account_id` nullable + `ON DELETE SET NULL`**

Edit `backend/src/db/schema.ts`. In the `syncedEntries` table definition, change:

```typescript
    accountId: integer("account_id")
      .notNull()
      .references(() => imapAccounts.id, { onDelete: "cascade" }),
```

to:

```typescript
    accountId: integer("account_id")
      .references(() => imapAccounts.id, { onDelete: "set null" }),
```

(Drop `.notNull()`. Keep the `references()` call but switch `onDelete`.)

- [ ] **Step 2: Verify tsc still type-checks**

```bash
cd backend && npx tsc --noEmit
```

Expected: no type errors. (`accountId` is now `number | null` everywhere; downstream uses already accept this since the worker always writes a non-null value.)

- [ ] **Step 3: Don't commit yet** — the migration in Task 3 must accompany this schema edit so they land together.

---

## Task 3: Generate backend migration `0002_*`

**Files:**
- Create: `backend/src/db/migrations/0002_*.sql` (drizzle-kit generated)
- Modify: `backend/src/db/migrations/meta/_journal.json` (auto)
- Create: `backend/src/db/migrations/meta/0002_snapshot.json` (auto)

- [ ] **Step 1: Generate the migration**

```bash
cd backend && npm run db:generate
```

Expected: drizzle-kit creates `backend/src/db/migrations/0002_<adjective>_<noun>.sql` containing `ALTER TABLE` SQL that recreates `synced_entries` with the relaxed FK (SQLite alters this way because `ALTER COLUMN` isn't supported for FK changes — drizzle-kit emits a `__new_synced_entries` table + `INSERT … SELECT *` + `DROP` + `RENAME`).

- [ ] **Step 2: Review the generated SQL**

Open the new `0002_*.sql`. Confirm:
- A new `__new_synced_entries` table is created without `NOT NULL` on `account_id` and with `ON DELETE SET NULL`.
- Data is copied: `INSERT INTO __new_synced_entries SELECT * FROM synced_entries;`
- `DROP TABLE synced_entries;` and `ALTER TABLE __new_synced_entries RENAME TO synced_entries;`.
- Both indexes (`idx_synced_entries_account_created`, `idx_synced_entries_account_merchant_occurred`) are recreated after the rename.

If the recreated indexes are missing, abort and investigate — the issue is in the schema file.

- [ ] **Step 3: Run the migrate test to confirm it applies cleanly**

```bash
cd backend && npm test -- migrate
```

Expected: `migrate.test.ts` passes (all migrations apply against `:memory:`).

- [ ] **Step 4: Don't commit yet** — Task 4 updates the FK cascade test to match the new behavior.

---

## Task 4: Update FK cascade test for SET-NULL behavior

**Files:**
- Modify: `backend/src/db/__tests__/queries.test.ts:272-297`

- [ ] **Step 1: Read the current test**

Open `backend/src/db/__tests__/queries.test.ts` around line 272 to see the `describe("FK cascade", ...)` block.

- [ ] **Step 2: Update the assertion**

Replace the existing block (the entire `describe("FK cascade", () => { ... })` group) with:

```typescript
describe("FK cascade", () => {
  it("deleting an imap_account: imap_uids cascade-deletes; synced_entries account_id set to NULL", () => {
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

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(1);
    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toHaveLength(1);

    db.run(sql`DELETE FROM imap_accounts WHERE id = ${accountId}`);

    // imap_uids cascade-deletes (UIDs are per-connection, irrelevant after disconnect)
    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toEqual([]);

    // synced_entries: rows retained with account_id IS NULL (SP5c FK relax)
    const orphaned = db
      .select()
      .from(syncedEntriesQ.__schema_for_test__ ?? syncedEntriesQ /* see below */)
      .all();
    // Use a raw SQL count to avoid coupling to query-helper internals:
    const remaining = db.all(sql`SELECT COUNT(*) AS n FROM synced_entries`)[0] as { n: number };
    expect(remaining.n).toBe(1);
    const nullified = db.all(
      sql`SELECT COUNT(*) AS n FROM synced_entries WHERE account_id IS NULL`,
    )[0] as { n: number };
    expect(nullified.n).toBe(1);
  });
});
```

If `syncedEntries` is exported from the test's existing imports, prefer this simpler form (drop the `__schema_for_test__` placeholder):

```typescript
    db.run(sql`DELETE FROM imap_accounts WHERE id = ${accountId}`);

    expect(imapUidsQ.listSeenUidsForAccount(db, accountId)).toEqual([]);

    const remaining = db.all(sql`SELECT COUNT(*) AS n FROM synced_entries`)[0] as { n: number };
    expect(remaining.n).toBe(1);
    const nullified = db.all(
      sql`SELECT COUNT(*) AS n FROM synced_entries WHERE account_id IS NULL`,
    )[0] as { n: number };
    expect(nullified.n).toBe(1);
```

(Use whichever form matches the file's existing import style. The point is the two SQL `COUNT` assertions: one row remains; that row has `account_id IS NULL`.)

- [ ] **Step 3: Run the test**

```bash
cd backend && npm test -- queries.test
```

Expected: PASS. If it fails because `account_id` is still being deleted (cascade), the schema edit in Task 2 didn't take — check `backend/src/db/schema.ts:syncedEntries.accountId` and re-run `npm run db:generate`.

- [ ] **Step 4: Commit Tasks 2–4 together**

```bash
git add backend/src/db/schema.ts backend/src/db/migrations backend/src/db/__tests__/queries.test.ts
git commit -m "feat(sp5c): relax synced_entries.account_id FK to SET NULL on disconnect"
```

---

## Task 5: Extract IMAP validator to a shared lib

**Files:**
- Create: `backend/src/lib/imap/validator.ts`
- Modify: `backend/scripts/seed-imap-account.ts:63-73` (replace inlined validator with import)

- [ ] **Step 1: Create the shared lib**

Create `backend/src/lib/imap/validator.ts`:

```typescript
import { ImapFlow } from "imapflow";
import type { ImapValidator } from "../seedImapAccount.js";

/**
 * Production IMAP validator: opens a TLS connection to imap.gmail.com:993,
 * authenticates with the provided creds, and logs out. Throws on auth failure
 * (e.g., NO LOGIN / AUTHENTICATIONFAILED) and on network/TLS errors.
 *
 * Used by:
 *   - backend/scripts/seed-imap-account.ts (CLI seeder, 5b)
 *   - backend/src/routes/imap.ts (POST /imap/connect, 5c)
 */
export const realImapValidator: ImapValidator = async ({ email, password }) => {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  await client.logout();
};
```

- [ ] **Step 2: Replace the inlined validator in the seeder script**

Edit `backend/scripts/seed-imap-account.ts`:

```typescript
// Replace lines 63-73 (the entire `realValidator` const) with an import:
import { realImapValidator } from "../src/lib/imap/validator.js";
```

And update line 104 to use the imported name:

```typescript
    const { id } = await seedImapAccount(
      { db, encryptionKey: config.imapEncryptionKey, validator: realImapValidator, now: Date.now },
      { email, password, allowlist },
    );
```

Remove the `import { ImapFlow } from "imapflow"` at the top of `seed-imap-account.ts` if it's no longer used. (It isn't, after the extract.)

- [ ] **Step 3: Run tests to confirm no regression**

```bash
cd backend && npm test
```

Expected: all 183 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/imap/ backend/scripts/seed-imap-account.ts
git commit -m "refactor(sp5c): extract IMAP validator to shared lib for reuse by /imap/connect"
```

---

## Task 6: Add backend query helpers — `getActiveAccount` + `deleteImapAccount`

**Files:**
- Modify: `backend/src/db/queries/imapAccounts.ts`
- Create: `backend/test/unit/imap-accounts-queries.test.ts` (or extend existing if present)

- [ ] **Step 1: Write the failing tests**

Check whether `backend/src/db/__tests__/queries.test.ts` already covers `imapAccounts` query helpers; if so, add the new tests there. Otherwise create `backend/test/unit/imap-accounts-queries.test.ts` mirroring the existing test setup pattern (in-memory DB + `runMigrations`):

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import {
  createImapAccount,
  getActiveAccount,
  deleteImapAccount,
} from "../../src/db/queries/imapAccounts.js";

describe("imapAccounts queries — 5c additions", () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(":memory:");
    sqlite.pragma("foreign_keys = ON");
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: "./src/db/migrations" });
  });

  it("getActiveAccount returns undefined when no rows", () => {
    expect(getActiveAccount(db)).toBeUndefined();
  });

  it("getActiveAccount returns the most recently created row", () => {
    const now = Date.now();
    createImapAccount(db, {
      emailAddress: "old@gmail.com",
      credentialsCiphertext: "c1",
      senderAllowlist: "[]",
      createdAt: now - 1000,
      updatedAt: now - 1000,
    });
    createImapAccount(db, {
      emailAddress: "new@gmail.com",
      credentialsCiphertext: "c2",
      senderAllowlist: "[]",
      createdAt: now,
      updatedAt: now,
    });
    expect(getActiveAccount(db)?.emailAddress).toBe("new@gmail.com");
  });

  it("deleteImapAccount removes the row by id", () => {
    const now = Date.now();
    const { id } = createImapAccount(db, {
      emailAddress: "x@gmail.com",
      credentialsCiphertext: "c",
      senderAllowlist: "[]",
      createdAt: now,
      updatedAt: now,
    });
    deleteImapAccount(db, id);
    expect(getActiveAccount(db)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests — they should fail (functions not exported)**

```bash
cd backend && npm test -- imap-accounts-queries
```

Expected: FAIL with "getActiveAccount is not a function" (or equivalent).

- [ ] **Step 3: Implement the helpers**

Edit `backend/src/db/queries/imapAccounts.ts`. Append:

```typescript
import { desc } from "drizzle-orm";

/**
 * Returns the most recently created imap_accounts row, or undefined if none.
 * Used by /imap/status, /imap/disconnect, and /sync/entries — meta-spec §6
 * commits to one inbox per Pulse install, so "active" = "most recent".
 */
export function getActiveAccount(db: Db): ImapAccount | undefined {
  return db
    .select()
    .from(imapAccounts)
    .orderBy(desc(imapAccounts.createdAt))
    .limit(1)
    .get();
}

export function deleteImapAccount(db: Db, id: number): void {
  db.delete(imapAccounts).where(eq(imapAccounts.id, id)).run();
}
```

(`eq` is already imported at the top of the file; only `desc` needs adding to the existing `drizzle-orm` import.)

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && npm test -- imap-accounts-queries
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/db/queries/imapAccounts.ts backend/test/unit/imap-accounts-queries.test.ts
git commit -m "feat(sp5c): getActiveAccount + deleteImapAccount query helpers"
```

---

## Task 7: Backend Zod schemas (`imap.ts` + `sync.ts`)

**Files:**
- Create: `backend/src/schemas/imap.ts`
- Create: `backend/src/schemas/sync.ts`
- Modify: `lib/api-types.ts` (root, shared by iOS) — add new types

- [ ] **Step 1: Add shared API types (root `lib/api-types.ts`)**

Read the existing `lib/api-types.ts` to see its style, then append:

```typescript
// ─── SP5c — Email sync ───────────────────────────────────────

export type ConnectRequest = {
  email: string;
  appPassword: string;
  senderAllowlist?: string[];
};

export type ConnectResponse = {
  accountId: number;
  status: "active";
  emailAddress: string;
};

export type ImapStatusResponse =
  | { connected: false }
  | {
      connected: true;
      accountId: number;
      emailAddress: string;
      status: "active" | "paused" | "error";
      lastPolledAt: number | null;
      lastError: string | null;
      pollIntervalSeconds: number;
      senderAllowlist: string[];
    };

export type SyncedEntryDTO = {
  id: number;
  merchant: string | null;
  cents: number;
  currency: string;
  category: string | null;
  occurredAt: number;
  recurring: boolean;
  emailFrom: string | null;
};

export type SyncEntriesResponse = {
  accountId: number | null;
  entries: SyncedEntryDTO[];
  hasMore: boolean;
  cursor: number;
};
```

- [ ] **Step 2: Backend imap schema**

Create `backend/src/schemas/imap.ts`:

```typescript
import { z } from "zod";
import type { ConnectRequest } from "@api-types";

export const ConnectRequestSchema: z.ZodType<ConnectRequest> = z.object({
  email: z.string().email("email must be a valid address"),
  appPassword: z.string().min(1, "appPassword is required"),
  senderAllowlist: z.array(z.string().min(1)).optional(),
});
```

- [ ] **Step 3: Backend sync schema**

Create `backend/src/schemas/sync.ts`:

```typescript
import { z } from "zod";

export const SyncEntriesQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type SyncEntriesQuery = z.infer<typeof SyncEntriesQuerySchema>;
```

- [ ] **Step 4: Type-check passes**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/imap.ts backend/src/schemas/sync.ts lib/api-types.ts
git commit -m "feat(sp5c): Zod schemas + shared types for /imap and /sync routes"
```

---

## Task 8: Thread `db` through `AppDeps`; update `buildTestApp`; main() opens DB

**Files:**
- Modify: `backend/src/index.ts`
- Modify: `backend/test/helpers/app.ts`

This task is structural — current `createApp` doesn't carry a db handle. The new routes need one.

- [ ] **Step 1: Update `AppDeps`**

Edit `backend/src/index.ts`:

```typescript
import type { Db } from "./db/client.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  llm: LlmClient;
  db: Db;                             // NEW — required for /imap/* and /sync/* routes
  encryptionKey: string | null;       // NEW — null if PULSE_IMAP_ENCRYPTION_KEY unset; route returns 503
  imapValidator: ImapValidator;       // NEW — injectable for tests
};
```

Add the corresponding imports at the top:

```typescript
import type { ImapValidator } from "./lib/seedImapAccount.js";
```

(Keep all existing imports.)

- [ ] **Step 2: Wire `main()` to construct the new deps**

Replace the existing `main()` function with:

```typescript
async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const llm = createOpenRouterClient(config.openrouterApiKey);

  // Database — same SQLite file as the worker (bind-mount at /opt/pulse/data/)
  const dbPath = process.env.DB_PATH ?? "/data/pulse.db";
  const { db } = createDb(dbPath);

  // Encryption key is OPTIONAL for the HTTP service: /imap/connect needs it,
  // other routes don't. Worker startup validates it strictly via loadWorkerConfig.
  const encryptionKey = process.env.PULSE_IMAP_ENCRYPTION_KEY ?? null;
  if (encryptionKey !== null && !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error(
      "PULSE_IMAP_ENCRYPTION_KEY must be 64 hex chars (32 bytes) when set; got malformed value",
    );
  }

  const { realImapValidator } = await import("./lib/imap/validator.js");
  const app = createApp({
    config, logger, llm, db,
    encryptionKey, imapValidator: realImapValidator,
  });
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "pulse-backend listening");
  });
}
```

Add `import { createDb } from "./db/client.js";` to the top of the file.

- [ ] **Step 3: Update `buildTestApp` to inject in-memory db + stub validator**

Edit `backend/test/helpers/app.ts`:

```typescript
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { createApp, type AppDeps } from "../../src/index.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapValidator } from "../../src/lib/seedImapAccount.js";
import { TEST_SECRET } from "./jwt.js";
import type { Config } from "../../src/config.js";

const TEST_KEY_HEX = "a".repeat(64);

export function buildTestApp(overrides: {
  llm?: Partial<LlmClient>;
  config?: Partial<Config>;
  imapValidator?: ImapValidator;
  encryptionKey?: string | null;
} = {}) {
  const config: Config = {
    openrouterApiKey: "test",
    jwtSecret: TEST_SECRET,
    port: 0,
    modelId: "anthropic/claude-haiku-4.5",
    rateLimitPerMin: 60,
    logLevel: "fatal",
    nodeEnv: "test",
    promptTimeoutMs: 20_000,
    ...overrides.config,
  };
  const llm: LlmClient = {
    async *chatStream() {
      yield { delta: "ok" };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text: "{}", usage: { inputTokens: 1, outputTokens: 1 } };
    },
    ...overrides.llm,
  };
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite);
  migrate(db, { migrationsFolder: "./src/db/migrations" });

  const imapValidator: ImapValidator =
    overrides.imapValidator ?? (async () => {});  // accept any creds by default
  const encryptionKey =
    overrides.encryptionKey === undefined ? TEST_KEY_HEX : overrides.encryptionKey;

  const deps: AppDeps = {
    config, logger: createLogger("fatal"), llm, db,
    encryptionKey, imapValidator,
  };
  return { app: createApp(deps), deps };
}
```

- [ ] **Step 4: Build + run all tests to confirm no regression**

```bash
cd backend && npm run build && npm test
```

Expected: all 183 tests still pass. The new `db`/`encryptionKey`/`imapValidator` deps are present but no route uses them yet.

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts backend/test/helpers/app.ts
git commit -m "refactor(sp5c): thread db, encryptionKey, imapValidator through AppDeps"
```

---

## Task 9: `POST /imap/connect` route

**Files:**
- Create: `backend/src/routes/imap.ts`
- Create: `backend/test/integration/imap-connect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/integration/imap-connect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

describe("POST /imap/connect", () => {
  it("happy path: validates, encrypts, inserts, returns 201", async () => {
    const { app, deps } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "alex@gmail.com",
        appPassword: "abcd efgh ijkl mnop",
        senderAllowlist: ["notify@chase.com"],
      });

    expect(res.status).toBe(201);
    expect(res.body.accountId).toEqual(expect.any(Number));
    expect(res.body.status).toBe("active");
    expect(res.body.emailAddress).toBe("alex@gmail.com");

    // Confirm row in DB
    const all = deps.db.all`SELECT * FROM imap_accounts`;
    expect(all).toHaveLength(1);
  });

  it("returns 401 imap_auth_failed when validator rejects", async () => {
    const { app } = buildTestApp({
      imapValidator: async () => {
        throw new Error("Invalid credentials");
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "alex@gmail.com", appPassword: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("imap_auth_failed");
  });

  it("returns 409 already_connected on duplicate email", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const body = { email: "alex@gmail.com", appPassword: "abcd efgh ijkl mnop" };
    await request(app).post("/imap/connect").set("Authorization", `Bearer ${token}`).send(body);
    const res = await request(app).post("/imap/connect").set("Authorization", `Bearer ${token}`).send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_connected");
  });

  it("returns 400 on malformed body (missing email)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ appPassword: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["chat", "parse"] });
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "x@gmail.com", appPassword: "x" });
    expect(res.status).toBe(403);
  });

  it("returns 503 server_misconfig when encryptionKey is null", async () => {
    const { app } = buildTestApp({ encryptionKey: null });
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "x@gmail.com", appPassword: "y" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("server_misconfig");
  });
});
```

- [ ] **Step 2: Run tests — they should fail (route not registered)**

```bash
cd backend && npm test -- imap-connect
```

Expected: FAIL with 404 on every request (route not mounted).

- [ ] **Step 3: Create the route file (skeleton)**

Create `backend/src/routes/imap.ts`:

```typescript
import { Router, type Request, type Response, type NextFunction } from "express";
import type { Db } from "../db/client.js";
import type { ImapValidator } from "../lib/seedImapAccount.js";
import { seedImapAccount } from "../lib/seedImapAccount.js";
import { ConnectRequestSchema } from "../schemas/imap.js";
import { ZodError } from "zod";

export type ImapRouterDeps = {
  db: Db;
  encryptionKey: string | null;
  validator: ImapValidator;
  now?: () => number;
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export function imapRouter(deps: ImapRouterDeps): Router {
  const r = Router();
  const now = deps.now ?? Date.now;

  r.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Validate body
      let body;
      try {
        body = ConnectRequestSchema.parse(req.body);
      } catch (err) {
        if (err instanceof ZodError) {
          return next(new HttpError(400, "invalid_request", err.issues.map(i => i.message).join("; ")));
        }
        throw err;
      }

      if (!deps.encryptionKey) {
        return next(new HttpError(503, "server_misconfig", "PULSE_IMAP_ENCRYPTION_KEY is not configured"));
      }

      // Reuse 5b's seedImapAccount: validate → encrypt → insert
      try {
        const { id } = await seedImapAccount(
          { db: deps.db, encryptionKey: deps.encryptionKey, validator: deps.validator, now },
          {
            email: body.email,
            password: body.appPassword,
            allowlist: body.senderAllowlist ?? [],
          },
        );
        res.status(201).json({
          accountId: id,
          status: "active",
          emailAddress: body.email,
        });
      } catch (err) {
        const msg = (err as Error).message;
        if (/already exists/i.test(msg)) {
          return next(new HttpError(409, "already_connected", msg));
        }
        // Validator threw → assume auth failure (network errors look the same shape;
        // /imap/connect users see them as "creds didn't work" — correct UX outcome).
        return next(new HttpError(401, "imap_auth_failed", msg || "IMAP credentials rejected"));
      }
    } catch (err) {
      next(err);
    }
  });

  return r;
}
```

- [ ] **Step 4: Map `HttpError` to the existing error envelope**

The existing `errorHandler` in `backend/src/middleware/errorHandler.ts` already handles instance-checks for known error classes. Open that file and add a branch for `HttpError`:

```typescript
// Inside errorHandler's err-mapping logic, add (where similar branches exist):
if (err && typeof err === "object" && "status" in err && "code" in err) {
  const e = err as { status: number; code: string; message: string };
  return res.status(e.status).json({
    error: { code: e.code, message: e.message },
    requestId: (req as { id?: string }).id,
  });
}
```

(The exact placement depends on the existing structure — read the file and slot this in alongside the other branches. If `HttpError` is the first instance-check branch, put it at the top of the `if/else` chain.)

- [ ] **Step 5: Wire the router into `createApp`**

Edit `backend/src/index.ts`. Inside `createApp`, after the existing routes (around line 50), add:

```typescript
import { imapRouter } from "./routes/imap.js";
// ...

  app.use(
    "/imap",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "sync"),
    imapRouter({
      db: deps.db,
      encryptionKey: deps.encryptionKey,
      validator: deps.imapValidator,
    }),
  );
```

- [ ] **Step 6: Run tests**

```bash
cd backend && npm test -- imap-connect
```

Expected: all 6 tests in the file PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/imap.ts backend/src/middleware/errorHandler.ts backend/src/index.ts backend/test/integration/imap-connect.test.ts
git commit -m "feat(sp5c): POST /imap/connect route"
```

---

## Task 10: `GET /imap/status` route

**Files:**
- Modify: `backend/src/routes/imap.ts`
- Create: `backend/test/integration/imap-status.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/integration/imap-status.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

async function seedConnected(app: ReturnType<typeof buildTestApp>) {
  const token = signTestToken();
  await request(app.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({
      email: "alex@gmail.com",
      appPassword: "abcd efgh ijkl mnop",
      senderAllowlist: ["notify@chase.com"],
    });
}

describe("GET /imap/status", () => {
  it("returns {connected:false} when no rows", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false });
  });

  it("returns full payload when connected", async () => {
    const ctx = buildTestApp();
    await seedConnected(ctx);
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.emailAddress).toBe("alex@gmail.com");
    expect(res.body.status).toBe("active");
    expect(res.body.lastPolledAt).toBeNull();
    expect(res.body.lastError).toBeNull();
    expect(res.body.pollIntervalSeconds).toBe(300);
    expect(res.body.senderAllowlist).toEqual(["notify@chase.com"]);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — they should fail (route not implemented)**

```bash
cd backend && npm test -- imap-status
```

Expected: FAIL with 404 on every request.

- [ ] **Step 3: Implement the handler**

Edit `backend/src/routes/imap.ts`. Inside `imapRouter`, after the `/connect` handler:

```typescript
import { getActiveAccount } from "../db/queries/imapAccounts.js";
// ... (add to the existing imports at top of file)

  r.get("/status", (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = getActiveAccount(deps.db);
      if (!row) {
        res.status(200).json({ connected: false });
        return;
      }
      res.status(200).json({
        connected: true,
        accountId: row.id,
        emailAddress: row.emailAddress,
        status: row.status as "active" | "paused" | "error",
        lastPolledAt: row.lastPolledAt,
        lastError: row.lastError,
        pollIntervalSeconds: row.pollIntervalSeconds,
        senderAllowlist: JSON.parse(row.senderAllowlist) as string[],
      });
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- imap-status
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/imap.ts backend/test/integration/imap-status.test.ts
git commit -m "feat(sp5c): GET /imap/status route"
```

---

## Task 11: `DELETE /imap/disconnect` route

**Files:**
- Modify: `backend/src/routes/imap.ts`
- Create: `backend/test/integration/imap-disconnect.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/integration/imap-disconnect.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import * as imapUidsQ from "../../src/db/queries/imapUids.js";

async function seedConnected(ctx: ReturnType<typeof buildTestApp>) {
  const token = signTestToken();
  const res = await request(ctx.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "x@gmail.com", appPassword: "p", senderAllowlist: [] });
  return res.body.accountId as number;
}

describe("DELETE /imap/disconnect", () => {
  it("deletes the account, retains synced_entries with NULL account_id, cascades imap_uids", async () => {
    const ctx = buildTestApp();
    const accountId = await seedConnected(ctx);
    const now = Date.now();

    syncedEntriesQ.insertSyncedEntry(ctx.deps.db, {
      accountId,
      imapUid: 1,
      contentHash: "h",
      cents: 100,
      currency: "USD",
      occurredAt: now,
      rawParseResponse: "{}",
      createdAt: now,
    });
    imapUidsQ.markUidSeen(ctx.deps.db, accountId, 1, now);

    const token = signTestToken();
    const res = await request(ctx.app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    // imap_accounts row gone
    const accounts = ctx.deps.db.all(sql`SELECT COUNT(*) AS n FROM imap_accounts`)[0] as { n: number };
    expect(accounts.n).toBe(0);

    // imap_uids cascade-deleted
    const uids = ctx.deps.db.all(sql`SELECT COUNT(*) AS n FROM imap_uids`)[0] as { n: number };
    expect(uids.n).toBe(0);

    // synced_entries retained, account_id IS NULL
    const synced = ctx.deps.db.all(sql`SELECT COUNT(*) AS n FROM synced_entries`)[0] as { n: number };
    expect(synced.n).toBe(1);
    const orphan = ctx.deps.db.all(
      sql`SELECT COUNT(*) AS n FROM synced_entries WHERE account_id IS NULL`,
    )[0] as { n: number };
    expect(orphan.n).toBe(1);
  });

  it("returns 204 when no rows exist (idempotent)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — they should fail (route not implemented)**

```bash
cd backend && npm test -- imap-disconnect
```

Expected: FAIL with 404.

- [ ] **Step 3: Implement the handler**

Edit `backend/src/routes/imap.ts`. Add `deleteImapAccount` to the existing import from `../db/queries/imapAccounts.js`:

```typescript
import { getActiveAccount, deleteImapAccount } from "../db/queries/imapAccounts.js";
```

Inside `imapRouter`, after the `/status` handler:

```typescript
  r.delete("/disconnect", (req: Request, res: Response, next: NextFunction) => {
    try {
      const row = getActiveAccount(deps.db);
      if (row) {
        deleteImapAccount(deps.db, row.id);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });
```

- [ ] **Step 4: Run tests**

```bash
cd backend && npm test -- imap-disconnect
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Run the full suite — confirm nothing else regressed**

```bash
cd backend && npm test
```

Expected: 195 tests pass (183 + 12 new across Tasks 9–11).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/imap.ts backend/test/integration/imap-disconnect.test.ts
git commit -m "feat(sp5c): DELETE /imap/disconnect (preserves synced_entries with NULL account_id)"
```

---

## Task 12: `GET /sync/entries` route

**Files:**
- Create: `backend/src/routes/sync.ts`
- Create: `backend/test/integration/sync-entries.test.ts`
- Modify: `backend/src/index.ts` (mount router)

- [ ] **Step 1: Write the failing tests**

Create `backend/test/integration/sync-entries.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";

async function seedAccount(ctx: ReturnType<typeof buildTestApp>): Promise<number> {
  const token = signTestToken();
  const res = await request(ctx.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "x@gmail.com", appPassword: "p" });
  return res.body.accountId;
}

function seedEntry(ctx: ReturnType<typeof buildTestApp>, accountId: number, opts: {
  imapUid: number;
  cents: number;
  merchant?: string;
  recurring?: boolean;
}) {
  const now = Date.now();
  return syncedEntriesQ.insertSyncedEntry(ctx.deps.db, {
    accountId,
    imapUid: opts.imapUid,
    contentHash: `h${opts.imapUid}`,
    cents: opts.cents,
    currency: "USD",
    merchant: opts.merchant ?? "Coffee",
    category: "Food",
    occurredAt: now,
    recurring: opts.recurring ? 1 : 0,
    rawParseResponse: "{}",
    emailSubject: "alert",
    emailFrom: "alerts@bank.com",
    createdAt: now,
  });
}

describe("GET /sync/entries", () => {
  it("empty DB → returns accountId:null, entries:[], hasMore:false", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?since=0&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accountId: null, entries: [], hasMore: false, cursor: 0 });
  });

  it("connected account with no rows → returns accountId, entries:[]", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/sync/entries?since=0&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(accountId);
    expect(res.body.entries).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  it("3 rows, limit=2 → first call returns 2 + hasMore:true; second call returns 1 + hasMore:false", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    seedEntry(ctx, accountId, { imapUid: 1, cents: 100 });
    seedEntry(ctx, accountId, { imapUid: 2, cents: 200 });
    seedEntry(ctx, accountId, { imapUid: 3, cents: 300, recurring: true });
    const token = signTestToken();

    const r1 = await request(ctx.app)
      .get("/sync/entries?since=0&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(r1.body.entries).toHaveLength(2);
    expect(r1.body.hasMore).toBe(true);
    const cursor1 = r1.body.cursor;

    const r2 = await request(ctx.app)
      .get(`/sync/entries?since=${cursor1}&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(r2.body.entries).toHaveLength(1);
    expect(r2.body.hasMore).toBe(false);
    expect(r2.body.entries[0].recurring).toBe(true);  // boolean, not 0/1
    expect(r2.body.entries[0].cents).toBe(300);
    expect(r2.body.entries[0].merchant).toBe("Coffee");
    expect(r2.body.entries[0].emailFrom).toBe("alerts@bank.com");
  });

  it("DTO excludes private fields (rawParseResponse, contentHash, emailSubject)", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    seedEntry(ctx, accountId, { imapUid: 1, cents: 100 });
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/sync/entries")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.entries[0]).not.toHaveProperty("rawParseResponse");
    expect(res.body.entries[0]).not.toHaveProperty("contentHash");
    expect(res.body.entries[0]).not.toHaveProperty("emailSubject");
  });

  it("limit > 500 → 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?limit=501")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("negative since → 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?since=-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .get("/sync/entries")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run tests — they should fail (route not implemented)**

```bash
cd backend && npm test -- sync-entries
```

Expected: FAIL with 404.

- [ ] **Step 3: Implement the route**

Create `backend/src/routes/sync.ts`:

```typescript
import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import type { Db } from "../db/client.js";
import { listSinceCursor } from "../db/queries/syncedEntries.js";
import { getActiveAccount } from "../db/queries/imapAccounts.js";
import { SyncEntriesQuerySchema } from "../schemas/sync.js";
import type { SyncedEntryDTO, SyncEntriesResponse } from "@api-types";

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export type SyncRouterDeps = { db: Db };

export function syncRouter(deps: SyncRouterDeps): Router {
  const r = Router();

  r.get("/entries", (req: Request, res: Response, next: NextFunction) => {
    try {
      let q;
      try {
        q = SyncEntriesQuerySchema.parse(req.query);
      } catch (err) {
        if (err instanceof ZodError) {
          return next(new HttpError(400, "invalid_request", err.issues.map(i => i.message).join("; ")));
        }
        throw err;
      }

      const account = getActiveAccount(deps.db);
      if (!account) {
        const empty: SyncEntriesResponse = {
          accountId: null,
          entries: [],
          hasMore: false,
          cursor: q.since,
        };
        res.status(200).json(empty);
        return;
      }

      const rows = listSinceCursor(deps.db, account.id, q.since, q.limit + 1);
      const hasMore = rows.length > q.limit;
      const trimmed = hasMore ? rows.slice(0, q.limit) : rows;
      const entries: SyncedEntryDTO[] = trimmed.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        cents: row.cents,
        currency: row.currency,
        category: row.category,
        occurredAt: row.occurredAt,
        recurring: row.recurring === 1,
        emailFrom: row.emailFrom,
      }));
      const cursor = entries.length > 0 ? entries[entries.length - 1].id : q.since;

      const out: SyncEntriesResponse = {
        accountId: account.id,
        entries,
        hasMore,
        cursor,
      };
      res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
```

- [ ] **Step 4: Mount the router in `createApp`**

Edit `backend/src/index.ts`. After the `/imap` mount added in Task 9:

```typescript
import { syncRouter } from "./routes/sync.js";
// ...

  app.use(
    "/sync",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "sync"),
    syncRouter({ db: deps.db }),
  );
```

- [ ] **Step 5: Run tests**

```bash
cd backend && npm test -- sync-entries
```

Expected: all 7 tests PASS.

- [ ] **Step 6: Run full suite**

```bash
cd backend && npm test
```

Expected: 202 tests pass (183 + 19 across Tasks 9–12).

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/sync.ts backend/src/index.ts backend/test/integration/sync-entries.test.ts
git commit -m "feat(sp5c): GET /sync/entries route with cursor pagination"
```

---

## Task 13: iOS schema delta — `spending_entries` columns + `sync_cursor` table

**Files:**
- Modify: `lib/db/schema.ts`

- [ ] **Step 1: Extend `spendingEntries` and add `syncCursor`**

Edit `lib/db/schema.ts`. Replace the `spendingEntries` table definition with:

```typescript
export const spendingEntries = sqliteTable(
  'spending_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cents: integer('cents').notNull(),
    note: text('note'),
    category: text('category'),
    occurredAt: integer('occurred_at').notNull(),
    // SP5c: sync metadata. Hand-logged entries leave these at defaults.
    merchant: text('merchant'),
    currency: text('currency').notNull().default('USD'),
    recurring: integer('recurring', { mode: 'boolean' }).notNull().default(false),
    syncedEntryId: integer('synced_entry_id'),
  },
  (t) => ({
    occurredAtIdx: index('idx_spending_occurred_at').on(t.occurredAt),
    syncedEntryIdIdx: uniqueIndex('idx_spending_synced_entry_id')
      .on(t.syncedEntryId)
      .where(sql`synced_entry_id IS NOT NULL`),
  }),
);
```

(Keep all existing tables unchanged.)

Append the sync-cursor table at the bottom of the schema file (after `prs`):

```typescript
export const syncCursor = sqliteTable('sync_cursor', {
  id: integer('id').primaryKey(),  // CHECK enforced below via raw SQL in migration
  accountId: integer('account_id'),
  lastSyncedId: integer('last_synced_id').notNull().default(0),
  updatedAt: integer('updated_at').notNull().default(0),
});

export type SyncCursor = typeof syncCursor.$inferSelect;
```

(The CHECK `(id = 1)` constraint can't be expressed in Drizzle's column DSL; we add it via a migration hand-edit in Task 14.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Don't commit yet** — Task 14 generates the migration and adds CHECK + seed row.

---

## Task 14: Generate iOS migration `0004_*` + hand-edit CHECK + seed row

**Files:**
- Create: `lib/db/migrations/0004_*.sql` (drizzle-kit generated, then hand-edited)
- Modify: `lib/db/migrations/meta/_journal.json` (auto)
- Create: `lib/db/migrations/meta/0004_snapshot.json` (auto)

- [ ] **Step 1: Generate**

```bash
npm run db:generate
```

Expected: `lib/db/migrations/0004_<adjective>_<noun>.sql` is created. Open it.

- [ ] **Step 2: Inspect the generated SQL**

It should contain:
- `ALTER TABLE spending_entries ADD COLUMN merchant text;`
- `ALTER TABLE spending_entries ADD COLUMN currency text NOT NULL DEFAULT 'USD';`
- `ALTER TABLE spending_entries ADD COLUMN recurring integer NOT NULL DEFAULT 0;` *(boolean stored as int)*
- `ALTER TABLE spending_entries ADD COLUMN synced_entry_id integer;`
- `CREATE UNIQUE INDEX idx_spending_synced_entry_id ON spending_entries (synced_entry_id) WHERE synced_entry_id IS NOT NULL;`
- `CREATE TABLE sync_cursor ( id integer PRIMARY KEY, account_id integer, last_synced_id integer DEFAULT 0 NOT NULL, updated_at integer DEFAULT 0 NOT NULL );`

If any of those are missing, abort and check the schema file.

- [ ] **Step 3: Hand-edit the CHECK constraint + seed row**

Append to the bottom of the generated `0004_*.sql`:

```sql
-- SP5c: enforce single-row invariant on sync_cursor
-- (drizzle-kit can't express CHECK via the column DSL; added by hand)
DROP TABLE IF EXISTS sync_cursor;
CREATE TABLE sync_cursor (
  id integer PRIMARY KEY CHECK (id = 1),
  account_id integer,
  last_synced_id integer NOT NULL DEFAULT 0,
  updated_at integer NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO sync_cursor (id) VALUES (1);
```

(The DROP+CREATE replaces the drizzle-generated table with the constraint-bearing one. The DROP is safe because the table was just created — no data to lose.)

- [ ] **Step 4: Run iOS migration test (if one exists)**

```bash
npm test -- migrate
```

Expected: PASS. If no migrate test exists in iOS, run the full suite to confirm no regression:

```bash
npm test
```

Expected: existing tests still pass; the new schema doesn't break existing query helpers.

- [ ] **Step 5: Commit Tasks 13–14 together**

```bash
git add lib/db/schema.ts lib/db/migrations
git commit -m "feat(sp5c): iOS schema 0004 — spending_entries sync columns + sync_cursor"
```

---

## Task 15: iOS query helper — `lib/db/queries/syncCursor.ts`

**Files:**
- Create: `lib/db/queries/syncCursor.ts`
- Create: `lib/db/queries/__tests__/syncCursor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/syncCursor.test.ts`. Mirror the pattern of any existing query test (likely uses an in-memory `expo-sqlite` or `better-sqlite3` setup — read one of `lib/db/__tests__/*.test.ts` to confirm). If the project uses `better-sqlite3` for tests:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { getCursor, setCursor } from '../syncCursor';

describe('syncCursor', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: './lib/db/migrations' });
  });

  it('initial state has accountId null and lastSyncedId 0', () => {
    const c = getCursor(db);
    expect(c).toEqual({ accountId: null, lastSyncedId: 0 });
  });

  it('setCursor + getCursor round-trips', () => {
    setCursor(db, 42, 1000);
    const c = getCursor(db);
    expect(c.accountId).toBe(42);
    expect(c.lastSyncedId).toBe(1000);
  });

  it('CHECK constraint blocks inserting a second row', () => {
    expect(() => {
      // @ts-expect-error — raw insert to test the constraint
      db.run('INSERT INTO sync_cursor (id) VALUES (2)');
    }).toThrow();
  });
});
```

(If iOS tests use `expo-sqlite/next` instead of `better-sqlite3`, mirror the existing test setup pattern from `lib/db/__tests__/*.test.ts`. The assertions stay the same.)

- [ ] **Step 2: Run tests — should fail (module doesn't exist)**

```bash
npm test -- syncCursor
```

Expected: FAIL with import resolution error.

- [ ] **Step 3: Implement**

Create `lib/db/queries/syncCursor.ts`:

```typescript
import { eq } from 'drizzle-orm';
import { syncCursor, type SyncCursor } from '../schema';
import type { AnyDb } from './onboarding';

export type CursorState = {
  accountId: number | null;
  lastSyncedId: number;
};

export function getCursor(db: AnyDb): CursorState {
  const row: SyncCursor | undefined = (db as { select: AnyDb['select'] })
    .select()
    .from(syncCursor)
    .where(eq(syncCursor.id, 1))
    .get?.()
    ?? (db as { run: AnyDb['run'] }).all?.(/* expo-sqlite path */)?.[0] as SyncCursor | undefined;
  // Fall back: if the row somehow doesn't exist (shouldn't — migration seeds it),
  // treat as initial state.
  if (!row) return { accountId: null, lastSyncedId: 0 };
  return { accountId: row.accountId, lastSyncedId: row.lastSyncedId };
}

export function setCursor(db: AnyDb, accountId: number, lastSyncedId: number): void {
  (db as { update: AnyDb['update'] })
    .update(syncCursor)
    .set({ accountId, lastSyncedId, updatedAt: Date.now() })
    .where(eq(syncCursor.id, 1))
    .run();
}
```

(Note: the `AnyDb` cast pattern matches what the existing `lib/db/queries/insertEntry.ts` does for compatibility across `expo-sqlite` and `better-sqlite3` Drizzle drivers. If a simpler typed interface is used elsewhere in the codebase, prefer that.)

- [ ] **Step 4: Run tests**

```bash
npm test -- syncCursor
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/syncCursor.ts lib/db/queries/__tests__/syncCursor.test.ts
git commit -m "feat(sp5c): iOS syncCursor query helper"
```

---

## Task 16: iOS query helper — `lib/db/queries/insertSyncedEntry.ts`

**Files:**
- Create: `lib/db/queries/insertSyncedEntry.ts`
- Create: `lib/db/queries/__tests__/insertSyncedEntry.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/insertSyncedEntry.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { insertSyncedBatch } from '../insertSyncedEntry';

const sample = (id: number, recurring = false) => ({
  id,
  merchant: 'Blue Bottle',
  cents: 650,
  currency: 'USD',
  category: 'Food',
  occurredAt: 1_700_000_000_000,
  recurring,
  emailFrom: 'alerts@bank.com',
});

describe('insertSyncedBatch', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: './lib/db/migrations' });
  });

  it('inserts each entry with all sync columns populated', () => {
    insertSyncedBatch(db, [sample(1), sample(2, true)]);
    const rows = db.all(sql`
      SELECT cents, currency, merchant, category, recurring, occurred_at, synced_entry_id
      FROM spending_entries
      ORDER BY synced_entry_id ASC
    `) as Array<{
      cents: number; currency: string; merchant: string; category: string;
      recurring: number; occurred_at: number; synced_entry_id: number;
    }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      cents: 650, currency: 'USD', merchant: 'Blue Bottle', category: 'Food',
      recurring: 0, occurred_at: 1_700_000_000_000, synced_entry_id: 1,
    });
    expect(rows[1].recurring).toBe(1);
  });

  it('INSERT OR IGNORE no-ops on duplicate synced_entry_id', () => {
    insertSyncedBatch(db, [sample(1)]);
    insertSyncedBatch(db, [sample(1)]);  // same id again
    const count = db.all(sql`SELECT COUNT(*) AS n FROM spending_entries`)[0] as { n: number };
    expect(count.n).toBe(1);
  });

  it('handles an empty batch', () => {
    insertSyncedBatch(db, []);
    const count = db.all(sql`SELECT COUNT(*) AS n FROM spending_entries`)[0] as { n: number };
    expect(count.n).toBe(0);
  });

  it('null merchant + category persisted as NULL', () => {
    insertSyncedBatch(db, [{ ...sample(1), merchant: null as unknown as string, category: null as unknown as string }]);
    const row = db.all(sql`SELECT merchant, category FROM spending_entries`)[0] as {
      merchant: string | null; category: string | null;
    };
    expect(row.merchant).toBeNull();
    expect(row.category).toBeNull();
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- insertSyncedEntry
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `lib/db/queries/insertSyncedEntry.ts`:

```typescript
import { sql } from 'drizzle-orm';
import type { AnyDb } from './onboarding';
import type { SyncedEntryDTO } from '../../api-types';

/**
 * Inserts a batch of synced entries from the backend's GET /sync/entries response
 * into the local spending_entries table. Idempotent via INSERT OR IGNORE on
 * synced_entry_id (the partial unique index covers it).
 *
 * Hand-logged entries (merchant in `note`, no synced_entry_id) are unaffected.
 */
export function insertSyncedBatch(db: AnyDb, entries: SyncedEntryDTO[]): void {
  if (entries.length === 0) return;
  // Use parameterised raw SQL — Drizzle's INSERT helper doesn't expose
  // INSERT OR IGNORE cleanly across drivers. The partial unique index on
  // synced_entry_id guarantees the IGNORE only fires on duplicate synced rows.
  const dx = db as unknown as {
    run: (q: ReturnType<typeof sql>) => unknown;
  };
  for (const e of entries) {
    dx.run(sql`
      INSERT OR IGNORE INTO spending_entries
        (cents, currency, merchant, category, recurring, occurred_at, synced_entry_id)
      VALUES
        (${e.cents}, ${e.currency}, ${e.merchant}, ${e.category},
         ${e.recurring ? 1 : 0}, ${e.occurredAt}, ${e.id})
    `);
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- insertSyncedEntry
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/insertSyncedEntry.ts lib/db/queries/__tests__/insertSyncedEntry.test.ts
git commit -m "feat(sp5c): iOS insertSyncedBatch query helper (idempotent on synced_entry_id)"
```

---

## Task 17: iOS sync types + errors + HTTP client

**Files:**
- Create: `lib/sync/types.ts`
- Create: `lib/sync/errors.ts`
- Create: `lib/sync/client.ts`
- Create: `lib/sync/__tests__/client.test.ts`

- [ ] **Step 1: Re-export error classes**

Create `lib/sync/errors.ts`:

```typescript
// 5c re-uses pal/errors so the iOS error taxonomy stays consistent.
export {
  AuthError,
  NetworkError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from '../pal/errors';
```

- [ ] **Step 2: Sync-internal types**

Create `lib/sync/types.ts`:

```typescript
import type {
  ConnectRequest,
  ConnectResponse,
  ImapStatusResponse,
  SyncedEntryDTO,
  SyncEntriesResponse,
} from '../api-types';

export type SyncStatus = 'connected' | 'disconnected' | 'error';

export type SyncResult = {
  inserted: number;
  status: SyncStatus;
};

// Re-exports for callers that import from a single module
export type {
  ConnectRequest,
  ConnectResponse,
  ImapStatusResponse,
  SyncedEntryDTO,
  SyncEntriesResponse,
};
```

- [ ] **Step 3: Write the failing client tests**

Create `lib/sync/__tests__/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  imapConnect,
  imapStatus,
  imapDisconnect,
  fetchSyncEntries,
} from '../client';
import { AuthError, ValidationError, NetworkError } from '../errors';

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // Patch global fetch
  (globalThis as unknown as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
});

function ok(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function err(code: string, message: string, status: number) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('sync/client', () => {
  it('imapConnect happy path', async () => {
    fetchMock.mockResolvedValue(ok({ accountId: 5, status: 'active', emailAddress: 'a@gmail.com' }, 201));
    const r = await imapConnect({ email: 'a@gmail.com', appPassword: 'p', senderAllowlist: [] });
    expect(r.accountId).toBe(5);
  });

  it('imapConnect maps 401 → AuthError', async () => {
    fetchMock.mockResolvedValue(err('imap_auth_failed', 'no login', 401));
    await expect(imapConnect({ email: 'a@gmail.com', appPassword: 'p' })).rejects.toBeInstanceOf(AuthError);
  });

  it('imapConnect maps 400 → ValidationError', async () => {
    fetchMock.mockResolvedValue(err('invalid_request', 'bad email', 400));
    await expect(imapConnect({ email: 'bad', appPassword: 'p' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('imapConnect throws NetworkError on fetch rejection', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    await expect(imapConnect({ email: 'a@gmail.com', appPassword: 'p' })).rejects.toBeInstanceOf(NetworkError);
  });

  it('imapStatus returns the body', async () => {
    fetchMock.mockResolvedValue(ok({ connected: false }));
    const s = await imapStatus();
    expect(s).toEqual({ connected: false });
  });

  it('imapDisconnect resolves on 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(imapDisconnect()).resolves.toBeUndefined();
  });

  it('fetchSyncEntries passes since/limit and returns body', async () => {
    fetchMock.mockResolvedValue(ok({ accountId: 1, entries: [], hasMore: false, cursor: 0 }));
    const r = await fetchSyncEntries({ since: 5, limit: 100 });
    expect(r.accountId).toBe(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toMatch(/since=5/);
    expect(calledUrl).toMatch(/limit=100/);
  });
});
```

- [ ] **Step 4: Run — should fail (module not found)**

```bash
npm test -- sync/client
```

Expected: FAIL.

- [ ] **Step 5: Implement the client**

Create `lib/sync/client.ts`:

```typescript
import type {
  ConnectRequest,
  ConnectResponse,
  ImapStatusResponse,
  SyncEntriesResponse,
} from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from '../pal/config';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try { return (await res.json()) as ErrorEnvelope; } catch { return null; }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${PAL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function mapHttpError(status: number, env: ErrorEnvelope | null): Error {
  const msg = env?.error.message ?? '';
  const rid = env?.requestId;
  if (status === 400) return new ValidationError(msg, rid);
  if (status === 401 || status === 403) return new AuthError(msg, rid);
  if (status === 409) return new ValidationError(msg, rid);  // duplicate — surfaced as validation
  if (status === 429) return new RateLimitError(msg, rid);
  return new UpstreamError(msg, rid);
}

export async function imapConnect(body: ConnectRequest): Promise<ConnectResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/imap/connect`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as ConnectResponse;
  throw mapHttpError(res.status, await readError(res));
}

export async function imapStatus(): Promise<ImapStatusResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/imap/status`, {
      headers: authHeaders(),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as ImapStatusResponse;
  throw mapHttpError(res.status, await readError(res));
}

export async function imapDisconnect(): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/imap/disconnect`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.status === 204) return;
  throw mapHttpError(res.status, await readError(res));
}

export async function fetchSyncEntries(params: {
  since?: number;
  limit?: number;
}): Promise<SyncEntriesResponse> {
  const since = params.since ?? 0;
  const limit = params.limit ?? 200;
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/sync/entries?since=${since}&limit=${limit}`, {
      headers: authHeaders(),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as SyncEntriesResponse;
  throw mapHttpError(res.status, await readError(res));
}
```

- [ ] **Step 6: Run tests**

```bash
npm test -- sync/client
```

Expected: all 7 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/sync/types.ts lib/sync/errors.ts lib/sync/client.ts lib/sync/__tests__/client.test.ts
git commit -m "feat(sp5c): iOS sync HTTP client + types + error re-exports"
```

---

## Task 18: iOS `syncNow()` orchestrator

**Files:**
- Create: `lib/sync/syncNow.ts`
- Create: `lib/sync/__tests__/syncNow.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `lib/sync/__tests__/syncNow.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { sql } from 'drizzle-orm';
import { syncNow, __resetInflightForTests } from '../syncNow';
import * as client from '../client';

const sample = (id: number, opts: { recurring?: boolean } = {}) => ({
  id,
  merchant: 'M',
  cents: 100 * id,
  currency: 'USD',
  category: 'Food',
  occurredAt: 1_700_000_000_000 + id,
  recurring: opts.recurring ?? false,
  emailFrom: 'a@b',
});

describe('syncNow', () => {
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    const sqlite = new Database(':memory:');
    db = drizzle(sqlite);
    migrate(db, { migrationsFolder: './lib/db/migrations' });
    __resetInflightForTests();
    vi.restoreAllMocks();
  });

  it('disconnected → no-op', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({ connected: false });
    const r = await syncNow(db);
    expect(r).toEqual({ inserted: 0, status: 'disconnected' });
  });

  it('first sync inserts rows + advances cursor', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'active',
      lastPolledAt: null, lastError: null, pollIntervalSeconds: 300, senderAllowlist: [],
    });
    vi.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7, entries: [sample(1), sample(2)], hasMore: false, cursor: 2,
    });
    const r = await syncNow(db);
    expect(r).toEqual({ inserted: 2, status: 'connected' });
    const rows = db.all(sql`SELECT synced_entry_id FROM spending_entries ORDER BY synced_entry_id`) as Array<{ synced_entry_id: number }>;
    expect(rows.map(r => r.synced_entry_id)).toEqual([1, 2]);
    const cursor = db.all(sql`SELECT account_id, last_synced_id FROM sync_cursor`)[0] as { account_id: number; last_synced_id: number };
    expect(cursor).toEqual({ account_id: 7, last_synced_id: 2 });
  });

  it('paginates: hasMore:true loops until hasMore:false', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'active',
      lastPolledAt: null, lastError: null, pollIntervalSeconds: 300, senderAllowlist: [],
    });
    const fetchSpy = vi.spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: true, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(2)], hasMore: false, cursor: 2 });
    const r = await syncNow(db);
    expect(r.inserted).toBe(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][0]).toMatchObject({ since: 1 });
  });

  it('account_id mismatch on first fetch resets cursor', async () => {
    // Pre-seed cursor with stale account
    db.run(sql`UPDATE sync_cursor SET account_id = 99, last_synced_id = 50 WHERE id = 1`);
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'active',
      lastPolledAt: null, lastError: null, pollIntervalSeconds: 300, senderAllowlist: [],
    });
    const fetchSpy = vi.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7, entries: [sample(1)], hasMore: false, cursor: 1,
    });
    const r = await syncNow(db);
    expect(r.inserted).toBe(1);
    // Cursor reset — first fetch's `since` is 0, not 50
    expect(fetchSpy.mock.calls[0][0]).toMatchObject({ since: 0 });
    const cursor = db.all(sql`SELECT account_id, last_synced_id FROM sync_cursor`)[0] as { account_id: number; last_synced_id: number };
    expect(cursor).toEqual({ account_id: 7, last_synced_id: 1 });
  });

  it('idempotent: second call with no new rows inserts 0', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'active',
      lastPolledAt: null, lastError: null, pollIntervalSeconds: 300, senderAllowlist: [],
    });
    vi.spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: false, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 7, entries: [], hasMore: false, cursor: 1 });
    expect((await syncNow(db)).inserted).toBe(1);
    expect((await syncNow(db)).inserted).toBe(0);
  });

  it('re-entrance returns the same in-flight promise', async () => {
    let resolve!: (v: unknown) => void;
    vi.spyOn(client, 'imapStatus').mockImplementation(() => new Promise(r => { resolve = r; }));
    const a = syncNow(db);
    const b = syncNow(db);
    resolve({ connected: false });
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra).toBe(rb);
  });

  it('account_id changes mid-loop → break, partial inserts persist', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'active',
      lastPolledAt: null, lastError: null, pollIntervalSeconds: 300, senderAllowlist: [],
    });
    vi.spyOn(client, 'fetchSyncEntries')
      .mockResolvedValueOnce({ accountId: 7, entries: [sample(1)], hasMore: true, cursor: 1 })
      .mockResolvedValueOnce({ accountId: 8, entries: [sample(2)], hasMore: false, cursor: 2 });
    const r = await syncNow(db);
    expect(r.inserted).toBe(1);
    const rows = db.all(sql`SELECT synced_entry_id FROM spending_entries ORDER BY synced_entry_id`) as Array<{ synced_entry_id: number }>;
    expect(rows.map(r => r.synced_entry_id)).toEqual([1]);
  });

  it('imap status === error surfaces as status:"error" with inserts still flowing', async () => {
    vi.spyOn(client, 'imapStatus').mockResolvedValue({
      connected: true, accountId: 7, emailAddress: 'a@gmail.com', status: 'error',
      lastPolledAt: null, lastError: 'NO LOGIN', pollIntervalSeconds: 300, senderAllowlist: [],
    });
    vi.spyOn(client, 'fetchSyncEntries').mockResolvedValueOnce({
      accountId: 7, entries: [sample(1)], hasMore: false, cursor: 1,
    });
    const r = await syncNow(db);
    expect(r.status).toBe('error');
    expect(r.inserted).toBe(1);
  });
});
```

- [ ] **Step 2: Run — should fail**

```bash
npm test -- syncNow
```

Expected: FAIL with import error.

- [ ] **Step 3: Implement the orchestrator**

Create `lib/sync/syncNow.ts`:

```typescript
import type { AnyDb } from '../db/queries/onboarding';
import { fetchSyncEntries, imapStatus } from './client';
import { getCursor, setCursor } from '../db/queries/syncCursor';
import { insertSyncedBatch } from '../db/queries/insertSyncedEntry';
import type { SyncResult } from './types';

let inFlight: Promise<SyncResult> | null = null;

export function __resetInflightForTests(): void {
  inFlight = null;
}

export function syncNow(db: AnyDb): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = doSync(db).finally(() => { inFlight = null; });
  return inFlight;
}

const PAGE_LIMIT = 200;

async function doSync(db: AnyDb): Promise<SyncResult> {
  const status = await imapStatus();
  if (!status.connected) {
    return { inserted: 0, status: 'disconnected' };
  }

  // Cursor reset on account-id mismatch (or initial state)
  let cursor = getCursor(db);
  if (cursor.accountId !== status.accountId) {
    cursor = { accountId: status.accountId, lastSyncedId: 0 };
  }

  let inserted = 0;
  // Loop pages
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchSyncEntries({ since: cursor.lastSyncedId, limit: PAGE_LIMIT });
    if (page.accountId !== cursor.accountId) {
      // Account id changed mid-loop (rare disconnect+reconnect race) — bail.
      // Next syncNow() detects via imapStatus and resets cleanly.
      break;
    }
    if (page.entries.length > 0) {
      insertSyncedBatch(db, page.entries);
      const newLast = page.entries[page.entries.length - 1].id;
      setCursor(db, page.accountId, newLast);
      cursor = { accountId: page.accountId, lastSyncedId: newLast };
      inserted += page.entries.length;
    }
    if (!page.hasMore) break;
  }

  const finalStatus = status.status === 'error' ? 'error' : 'connected';
  return { inserted, status: finalStatus };
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- syncNow
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/sync/syncNow.ts lib/sync/__tests__/syncNow.test.ts
git commit -m "feat(sp5c): iOS syncNow orchestrator with re-entrance guard + cursor reset"
```

---

## Task 19: Wire `AppState` foreground listener in `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Add the listener inside `Boot`**

Edit `app/_layout.tsx`. Add `AppState` import:

```typescript
import { AppState, type AppStateStatus } from 'react-native';
```

Inside `Boot`, after the existing `useEffect` that handles onboarding/draft-resume (around line 67), add a new effect:

```typescript
useEffect(() => {
  if (!success) return;

  // Run an initial sync once after migrations succeed
  let mounted = true;
  (async () => {
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      if (!mounted) return;
      // eslint-disable-next-line no-console
      console.log('[sync] startup:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] startup failed:', e);
    }
  })();

  // Trigger on every foreground transition
  const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state !== 'active') return;
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      // eslint-disable-next-line no-console
      console.log('[sync] foreground:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] foreground failed:', e);
    }
  });

  return () => {
    mounted = false;
    sub.remove();
  };
}, [success]);
```

(The dynamic `import()` keeps `lib/sync/` out of the bundle's startup path; the module loads lazily on first use.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests to confirm no regression**

```bash
npm test
```

Expected: all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(sp5c): wire syncNow on app foreground via AppState listener"
```

---

## Task 20: Wire pull-to-refresh on `today/spending.tsx`

**Files:**
- Modify: `app/(tabs)/today/spending.tsx`

The Today index screen (`today/index.tsx`) is a fixed-height layout with absolute-positioned children — adding pull-to-refresh there requires a structural change. The Spending Detail screen (`today/spending.tsx`) is already a `<ScrollView>`, making it the natural home for the manual-sync affordance. Per spec §2 row 2 ("RefreshControl onRefresh on Today"), this is implemented inside the Today tab area.

- [ ] **Step 1: Read the current file to confirm the ScrollView line**

```bash
grep -n "ScrollView" "app/(tabs)/today/spending.tsx"
```

Expected: line 58 (or thereabouts) has `<ScrollView className="flex-1 px-4">`.

- [ ] **Step 2: Add `RefreshControl` import + state + handler**

Edit the imports at the top of `app/(tabs)/today/spending.tsx` to add:

```typescript
import { RefreshControl } from 'react-native';
```

(Append to the existing `react-native` import line.)

Inside `SpendingDetail()`, after the existing `useState` line, add:

```typescript
const [refreshing, setRefreshing] = useState(false);

const onRefresh = async () => {
  setRefreshing(true);
  try {
    const { syncNow } = await import('@/lib/sync/syncNow');
    await syncNow(db);
    const r = await getTodaySpend(db, new Date());
    setData(r);
  } finally {
    setRefreshing(false);
  }
};
```

Then update the `<ScrollView>` line to include the `refreshControl` prop:

```typescript
<ScrollView
  className="flex-1 px-4"
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
>
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all tests pass (no test covers the Spending screen's UI directly; this is a behavioral addition).

- [ ] **Step 5: Commit**

```bash
git add "app/(tabs)/today/spending.tsx"
git commit -m "feat(sp5c): pull-to-refresh on Spending Detail triggers syncNow"
```

---

## Task 21: Local web smoke test

**Files:**
- None (verification only)

- [ ] **Step 1: Build + run backend tests one final time**

```bash
cd backend && npm test
```

Expected: 202 tests pass.

- [ ] **Step 2: Run iOS tests one final time**

```bash
cd .. && npm test
```

Expected: all tests pass; record the new total.

- [ ] **Step 3: Type-check both projects**

```bash
cd backend && npx tsc --noEmit
cd .. && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: (Optional) Local end-to-end with the web target**

If you have time and want to exercise the path against a local backend:

```bash
# Terminal 1: start the backend with a local sqlite + a known JWT_SECRET
cd backend
DB_PATH=/tmp/pulse-local.db \
JWT_SECRET=$(openssl rand -hex 32) \
PULSE_IMAP_ENCRYPTION_KEY=$(openssl rand -hex 32) \
OPENROUTER_API_KEY=test \
NODE_ENV=development \
npm run dev

# Terminal 2: mint a token with the new scope
JWT_SECRET=<paste-the-same-secret> npm exec tsx scripts/issue-token.ts -- \
  --sub kael --scope chat,parse,review,generate-routine,sync

# Terminal 3: hit the routes (use the token you just printed)
curl -s -X POST http://localhost:3000/imap/connect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@gmail.com","appPassword":"x"}' | jq .
# → likely 401 imap_auth_failed (no real Gmail), but route shape works

curl -s http://localhost:3000/imap/status -H "Authorization: Bearer $TOKEN" | jq .
# → {"connected": false} (since the previous request errored before insert)

curl -s "http://localhost:3000/sync/entries?since=0&limit=10" -H "Authorization: Bearer $TOKEN" | jq .
# → {"accountId": null, "entries": [], "hasMore": false, "cursor": 0}
```

This verifies the wiring is right without needing a real Gmail account. The live droplet smoke (Task 22) is the spec-binding pass.

- [ ] **Step 5: Commit any final cleanup**

If any lint/format issues surfaced, fix and commit:

```bash
git add -A
git commit -m "chore(sp5c): post-test cleanup"
```

(Skip if there's nothing to commit.)

---

## Task 22: Live droplet smoke test (user-run)

**Files:**
- None — verification on the deployed system.

This task is **user-run** — Claude doesn't have droplet shell access. The plan documents the steps; the user executes and reports back so the slice can be marked closed.

- [ ] **Step 1: Push to main**

```bash
git push origin main
```

Expected: GH Action `deploy-backend.yml` runs, builds image, pushes to GHCR, SSHs to droplet, runs `docker compose run --rm migrator` (which applies `0002_*`), restarts `backend` (and `worker`, which is a no-op image-wise).

- [ ] **Step 2: On droplet — regenerate the token with `"sync"` scope**

```bash
ssh root@178.128.81.14
cd /opt/pulse
docker compose run --rm backend node scripts/issue-token.js --sub kael --scope chat,parse,review,generate-routine,sync
# Copy the printed token.
```

- [ ] **Step 3: Update local `EXPO_PUBLIC_PAL_TOKEN`**

In the iOS `.env` (or however it's stored locally), update `EXPO_PUBLIC_PAL_TOKEN` to the new token. Restart the Expo dev server.

- [ ] **Step 4: Hit `/imap/connect` from Windows**

```bash
TOKEN=<paste new token>
BASE=https://<your-pulse-backend-url>

curl -s -X POST "$BASE/imap/connect" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"<your-gmail>","appPassword":"<your-app-password>","senderAllowlist":["notify@chase.com","alerts@discover.com"]}' \
  | jq .
```

Expected: `{"accountId": <n>, "status": "active", "emailAddress": "..."}` (or 409 if already connected from a prior test — run `DELETE` first).

- [ ] **Step 5: Wait 60s, confirm worker polled**

```bash
ssh root@178.128.81.14 "docker compose -f /opt/pulse/compose.yml logs --tail 50 worker"
```

Expected: a tick log showing your account being polled.

- [ ] **Step 6: Confirm rows in DB**

```bash
ssh root@178.128.81.14 "sqlite3 /opt/pulse/data/pulse.db 'SELECT id, merchant, cents, currency, recurring FROM synced_entries ORDER BY id LIMIT 10'"
```

Expected: rows from the worker's first poll.

- [ ] **Step 7: Hit `/sync/entries` from Windows**

```bash
curl -s "$BASE/sync/entries?since=0&limit=10" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: same rows as in step 6, formatted as DTOs (`recurring` is boolean, no `rawParseResponse`).

- [ ] **Step 8: Re-pull with `since=<cursor>`**

```bash
CURSOR=<from previous response>
curl -s "$BASE/sync/entries?since=$CURSOR&limit=10" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{"entries": [], "hasMore": false}`.

- [ ] **Step 9: Hit `/imap/status`**

```bash
curl -s "$BASE/imap/status" -H "Authorization: Bearer $TOKEN" | jq .
```

Expected: `{"connected": true, "accountId": <n>, ...}` with `lastPolledAt` populated.

- [ ] **Step 10: iOS web target — exercise `syncNow()`**

In the iOS dev environment:

```bash
npm run web
```

Foreground the app (or trigger a hot reload). The `[sync] startup:` log should print `{ inserted: <n>, status: 'connected' }`. Pull-to-refresh on the Spending Detail screen should also fire syncNow.

Confirm rows appear in `spending_entries`:

```bash
# In a SQLite browser, or via expo-dev-client db inspector:
SELECT id, cents, currency, merchant, recurring, synced_entry_id FROM spending_entries WHERE synced_entry_id IS NOT NULL;
```

Expected: rows match the backend's `synced_entries`.

- [ ] **Step 11: Test disconnect**

```bash
curl -s -X DELETE "$BASE/imap/disconnect" -H "Authorization: Bearer $TOKEN" -i
# Expected: HTTP/1.1 204 No Content
```

```bash
ssh root@178.128.81.14 "sqlite3 /opt/pulse/data/pulse.db 'SELECT COUNT(*) FROM imap_accounts; SELECT COUNT(*) FROM imap_uids; SELECT COUNT(*), SUM(account_id IS NULL) FROM synced_entries;'"
```

Expected:
- `imap_accounts` count: 0
- `imap_uids` count: 0
- `synced_entries` count: unchanged (rows retained)
- `synced_entries.account_id IS NULL` count: equal to total count

- [ ] **Step 12: Mark plan complete**

Edit `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md` §3 sub-slice status:

```markdown
- **5c** ✅ Code complete YYYY-MM-DD — four routes (POST /imap/connect, GET /imap/status,
  DELETE /imap/disconnect, GET /sync/entries) live on droplet; backend migration 0002 (FK
  relax to SET NULL); iOS migration 0004 (4 sync columns + sync_cursor); lib/sync/ module
  with syncNow() called on AppState foreground + Spending pull-to-refresh; ~28 new tests
  green; live smoke pass with real Gmail.
```

Commit:

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5c): mark slice complete in meta-spec §3 status"
git push origin main
```

---

## Self-Review

After writing this plan, reviewing against the spec:

**1. Spec coverage check:**

| Spec section | Plan task(s) |
|---|---|
| §1 row 1 (`POST /imap/connect`) | Task 9 |
| §1 row 2 (`GET /imap/status`) | Task 10 |
| §1 row 3 (`DELETE /imap/disconnect`) | Task 11 |
| §1 row 4 (`GET /sync/entries`) | Task 12 |
| §1 (JWT scope `"sync"`) | Task 1 |
| §1 (Backend migration 0002 — FK relax) | Tasks 2–4 |
| §1 (iOS `lib/sync/` module + `syncNow`) | Tasks 17–18 |
| §1 (iOS migration 0004 — columns + sync_cursor) | Tasks 13–14 |
| §1 (~28 new tests) | Distributed across Tasks 4, 6, 9–12, 15–18 |
| §2 row 1 (extend spending_entries) | Task 13 |
| §2 row 2 (foreground + pull-to-refresh) | Tasks 19–20 |
| §2 row 3 (disconnect deletes creds only) | Task 11 |
| §2 row 4 (POST connect store-only) | Task 9 |
| §2 row 5 (sync_cursor table) | Tasks 13–15 |
| §2 row 6 (cursor reset on account_id mismatch) | Task 18 |
| §2 row 7 (single "sync" scope) | Task 1 |
| §2 row 8 (page size + hasMore via +1 trick) | Task 12 |
| §2 row 9 (re-entrance guard) | Task 18 |
| §2 row 10 (mapToRow untouched) | Task 13 (no change to insertEntry; new path only) |
| §2 row 11 (status route shape) | Task 10 |
| §3.1 (syncNow data flow) | Task 18 |
| §3.2 (POST connect data flow) | Task 9 |
| §3.3 (DELETE disconnect data flow) | Task 11 |
| §3.4 (GET sync/entries data flow) | Task 12 |
| §4 (extract IMAP validator to shared lib) | Task 5 |
| §4 (getActiveAccount helper) | Task 6 |
| §5 (testing — all rows) | Distributed |
| §6 (open notes — token regen, errors re-export) | Task 17 (re-export); Task 22 step 2 (token regen) |
| §7 (deploy) | Task 22 |
| §8 (scope cuts) | Honored — none of the cut items appear in any task |
| §10 (open items) | All addressed in Task 22 (token regen) and Tasks 19–20 (AppState + pull-to-refresh sites) |

All sections covered. Pull-to-refresh placement note: spec §2 row 2 says "Today" — plan implements on `today/spending.tsx` (a child route of the Today tab). Today's index screen has a fixed layout with no scroll surface, so adding RefreshControl there would require a structural change. This is documented in Task 20's preamble; it satisfies the spec's intent (manual-sync affordance inside the Today area) without restructuring the Today index.

**2. Placeholder scan:** No "TBD", "TODO", "implement later", or "similar to Task N" instances. Each step contains the actual code or command. The one inline note about driver compatibility in Task 15 step 3 (`AnyDb` cast pattern) is a guidance comment with concrete fallback, not a placeholder.

**3. Type consistency:**
- `AppDeps` shape (Task 8) matches what routes consume in Tasks 9, 12.
- `ImapValidator` from `lib/seedImapAccount.ts` (existing) matches both Task 5's import + Task 8's `AppDeps` field + Task 9's route handler.
- `SyncedEntryDTO` defined in Task 7 matches the response in Task 12, the consumer in Task 16, and the orchestrator in Task 18.
- `CursorState` defined in Task 15 matches the consumer in Task 18.
- `SyncResult` defined in Task 17 matches `syncNow`'s return in Task 18.
- `getCursor` / `setCursor` signatures in Task 15 match the call sites in Task 18.
- `insertSyncedBatch` signature in Task 16 matches the call site in Task 18.

All consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-27-sp5c-http-sync-routes-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
