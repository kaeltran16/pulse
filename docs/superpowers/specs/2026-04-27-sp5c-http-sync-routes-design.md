# SP5c — HTTP Sync Routes + iOS Sync Client Design

**Date:** 2026-04-27
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) (SP5 meta-spec, slice 5c)
**Builds on:** [`./2026-04-27-sp5a-backend-data-store-design.md`](./2026-04-27-sp5a-backend-data-store-design.md) (data layer + Docker stack), [`./2026-04-27-sp5b-pulse-worker-design.md`](./2026-04-27-sp5b-pulse-worker-design.md) (worker writes the rows 5c reads; encryption + seeder libs reused as-is)
**Scope:** Stand up the HTTP surface that turns 5b's `synced_entries` rows into iOS-side `spending_entries` rows. Adds four routes (`POST /imap/connect`, `GET /imap/status`, `DELETE /imap/disconnect`, `GET /sync/entries`), a new JWT scope `"sync"`, a backend migration that relaxes the `synced_entries.account_id` FK from cascade to set-null, and an iOS `lib/sync/` module driven by a single `syncNow()` async function called on app foreground and pull-to-refresh. Migration `0004_*` on iOS extends `spending_entries` with four sync-metadata columns and adds a single-row `sync_cursor` table. **No worker changes; no new shared deps; no new iOS screens** — the only iOS UI delta is wiring an `onRefresh` handler into Today's existing scroll surface. The Email Sync screens (Empty / Connect / Dashboard) and Subscriptions screen ship in 5d.

---

## 1. What 5c ships

- **`POST /imap/connect`** (backend route at `backend/src/routes/imap.ts`). Validates Gmail app-password against `imap.gmail.com:993`, encrypts via 5b's `lib/crypto/credentials.ts`, inserts an `imap_accounts` row. Reuses **5b's `lib/seedImapAccount.ts`** verbatim — the HTTP route is a ~15-line wrapper that maps the seeder's error classes to HTTP statuses.
- **`GET /imap/status`** (same router). Single-row response — one inbox per Pulse install per meta-spec §6 row 9. Returns connected/disconnected, `lastPolledAt`, `status` (`'active'` or `'error'`), `lastError`, `senderAllowlist`. Powers 5d's Dashboard without a second route.
- **`DELETE /imap/disconnect`** (same router). Hard-deletes the `imap_accounts` row. Per Q3, `synced_entries` rows are *retained* (FK relaxed to `SET NULL` in this slice's backend migration `0002_*`). `imap_uids` cascade-deletes (UIDs are per-connection, irrelevant after disconnect).
- **`GET /sync/entries?since=<id>&limit=<n>`** (new router at `backend/src/routes/sync.ts`). Returns rows with `id > since`, ordered by id ASC, limit-bounded (default 200, hard cap 500). Reuses 5a's `listSinceCursor` query.
- **JWT scope `"sync"`.** Added to the `Scope` union in `middleware/auth.ts`. All four routes mount under `authMiddleware(secret, "sync")`.
- **Backend migration `0002_*`.** Drizzle migration: `synced_entries.account_id` becomes nullable + `ON DELETE SET NULL` (was `NOT NULL` + cascade). 5a's existing FK cascade test is updated to assert SET-NULL behavior on disconnect. `imap_uids` keeps cascade.
- **iOS `lib/sync/` module.** `syncNow()` async fn driven by `AppState` foreground transition + `RefreshControl` pull-to-refresh on Today. Single re-entrance guard prevents double-runs. Idempotent (`INSERT OR IGNORE` keyed on `synced_entry_id`). Returns `{ inserted, status }` for the caller.
- **iOS migration `0004_*`.** Adds 4 columns to `spending_entries` (`merchant`, `currency`, `recurring`, `synced_entry_id`) and a single-row `sync_cursor` table. Hand-logged spending (the 3b PalComposer flow) is **untouched**: `mapToRow` keeps stuffing merchant into `note`; new fields stay NULL/'USD'/0/NULL on hand-logged rows.
- **Test coverage** (~28 new tests on top of 5b's totals): route-shape tests, FK behavior, syncNow orchestrator, cursor semantics, idempotency.

**Smoke test (live, on droplet + iOS web target):** all conditions must pass.

1. `npm test` green in `backend/` and root (iOS).
2. Push to `main`. GH Action builds, deploys, runs `0002_*` (synced_entries FK relax), brings up backend.
3. From Windows: `curl -X POST $BASE/imap/connect -H 'Authorization: Bearer $SYNC_TOKEN' -H 'Content-Type: application/json' -d '{"email":"…","appPassword":"…","senderAllowlist":["notify@chase.com"]}'` returns 201 with `accountId`.
4. Within ≤60s the worker (5b) ticks the new account; `synced_entries` rows appear (verified via `sqlite3 /opt/pulse/data/pulse.db`).
5. `curl $BASE/sync/entries?since=0&limit=10 -H 'Authorization: Bearer $SYNC_TOKEN'` returns the worker-written rows; `cursor` matches the last entry's `id`; `hasMore` is false (or true with continuation if >10 rows).
6. Re-pull with `?since=<cursor>` → `{entries:[], hasMore:false}`.
7. `curl $BASE/imap/status` returns `connected:true` with the `lastPolledAt` and `senderAllowlist` populated.
8. `curl -X DELETE $BASE/imap/disconnect` → 204. `sqlite3 … 'SELECT count(*) FROM imap_accounts'` → 0. `synced_entries` count unchanged. `imap_uids` count → 0.
9. iOS web target: `npm run web`, run a dev hook that calls `syncNow()` directly. Local `spending_entries` gains the rows with `synced_entry_id` set and `recurring`/`merchant`/`currency` populated. Re-running `syncNow()` is a no-op (no duplicate inserts).

iPhone visual smoke deferred to the end-of-SP5 pass per meta-spec §5.

---

## 2. Locked decisions (resolved during brainstorming)

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | iOS local storage shape | **Extend `spending_entries`** with `merchant`, `currency` (default `'USD'`), `recurring` (default 0), `synced_entry_id` (nullable, unique-when-non-null). Hand-logged entries leave new columns at defaults. Synced entries use a new `insertSyncedEntry` query path that fills the new columns and leaves `note` NULL. | Matches meta-spec §1 ("iOS pulls them … writes them into the local `spending_entries` table"). Single source of truth for "all spending today" in the existing `useLiveQuery` aggregations. Mirror-table alternative would force every Today/Spending Detail read to UNION two tables — opposite of low-churn. |
| 2 | Sync trigger model (iOS) | **Foreground + pull-to-refresh.** Single `syncNow()` async fn. Called on `AppState` `active` transition and from `RefreshControl onRefresh` on Today (and 5d's Dashboard once it ships). No `setInterval` while open. | Worker polls every 5 min server-side; the value of foreground+pull is "I just opened the app, give me the latest" not "be live while I scroll." Saves a timer + battery cost for marginal value. |
| 3 | Disconnect semantics | **Delete credentials only.** `imap_accounts` row deleted. `synced_entries` rows retained (FK relaxed to SET NULL in this slice's migration). `imap_uids` cascade-deletes. iOS local `spending_entries` rows with `synced_entry_id` set are kept untouched. | Past spending history is real data; no reason to wipe it on disconnect. Matches meta-spec §6 ("Server-side pruning of synced rows after ack" — cut). A separate "Wipe synced data" affordance can land in 5d Settings or SP6 Polish if user friction surfaces. |
| 4 | `POST /imap/connect` behavior | **Store-only.** Route validates IMAP creds, encrypts, inserts the row, returns. The 14-day backfill happens in the worker on its next tick (≤60s). | Boundary discipline — HTTP and worker stay separate processes with no shared in-process state. 5d's Dashboard already has "syncing… 0 entries" progress UI for the 60-second window before the first rows appear (per `email-sync.jsx:262–280`). |
| 5 | Cursor storage (iOS) | **New single-row `sync_cursor` table** (`id INTEGER PRIMARY KEY CHECK (id = 1)`, `account_id INTEGER`, `last_synced_id INTEGER`, `updated_at INTEGER`). | Same DB as the inserts, so cursor advance + insert wrap in one transaction. AsyncStorage would split state across two systems and lose transactional atomicity. CHECK constraint enforces the singleton. |
| 6 | Cursor reset on reconnect | **Compare `account_id` returned from `/sync/entries` to `sync_cursor.account_id`. If different (or local is NULL), reset `last_synced_id = 0` before applying the batch.** | Disconnect→reconnect creates a new `imap_accounts` row (per Q3 = hard-delete + re-insert). New accountId means previously-tracked `synced_entries.id` values are not comparable. Mismatch detection in the orchestrator avoids stale-cursor bugs without a server-issued reset signal. |
| 7 | JWT scope | **Single new scope `"sync"`** covers all four routes (`/imap/connect`, `/imap/status`, `/imap/disconnect`, `/sync/entries`). Added to `Scope` union; iOS issues tokens with `["sync", "parse", "chat", "review"]` etc. | Splitting into `imap` and `sync` adds claims-management cost with zero security benefit at one user. Matches the meta-spec §4 cross-cutting dependency line. |
| 8 | `/sync/entries` page size | **Default 200, hard cap 500, default-driven from query param.** `hasMore` returned via the `LIMIT (limit + 1)` trick — fetch one extra; if N+1 came back, drop the last and set `hasMore=true`. | 200 covers the typical "I haven't synced for a few days" backfill in one round-trip; 500 cap bounds the response payload. The +1 trick avoids a separate `COUNT(*)` query. |
| 9 | iOS re-entrance guard | **Module-level `let inFlight: Promise<…> \| null`.** Repeat calls return the existing promise; cleared in `finally`. | `AppState` foreground + manual pull-to-refresh can fire concurrently; doubling the work duplicates HTTP calls and risks racing the cursor write. Single guard at the module level is simpler than per-call locking. |
| 10 | Hand-logged column behavior | **`mapToRow` (3b) is untouched.** Hand-logged spending continues to put merchant in `note`; new columns stay at defaults. Synced inserts go through a separate `insertSyncedEntry` path. | Avoids a 3b regression. The schema gains the columns it needs for 5d's Subscriptions filter without rewriting the hand-log flow. Long-term cleanup (migrate `note` → `merchant` for old rows) is deferred — no functional gap. |
| 11 | Status route shape | **Single response covers connected + disconnected.** `{ connected: false }` when no row, `{ connected: true, accountId, emailAddress, status, lastPolledAt, lastError, pollIntervalSeconds, senderAllowlist }` when present. | One round-trip drives the 5d Dashboard's connection chip + "last sync" line + Settings allowlist row. Cuts a follow-up GET. |

---

## 3. Data flow

### 3.1 One `syncNow()` round (iOS)

```
1. Re-entrance guard
   if (inFlight) return inFlight
   inFlight = doSync()
   try return await inFlight finally inFlight = null

2. doSync():
   a. status = await fetchImapStatus()
      if (!status.connected) return { inserted: 0, status: 'disconnected' }

   b. cursor = getCursor()           // single row from sync_cursor
      if (cursor.accountId !== status.accountId)
        cursor = { accountId: status.accountId, lastSyncedId: 0 }
        // do not write yet — write after first successful insert

   c. inserted = 0
      loop:
        page = await fetchSyncEntries({ since: cursor.lastSyncedId, limit: 200 })
        // page.accountId may have changed mid-loop if user disconnected+reconnected
        // between pages. Bail out without applying — step (b) on the NEXT syncNow() call
        // detects the new accountId and resets cursor.lastSyncedId to 0 cleanly.
        if (page.accountId !== cursor.accountId) break

        BEGIN TRANSACTION (db.transaction)
          for each entry in page.entries:
            INSERT OR IGNORE INTO spending_entries
              (cents, currency, merchant, category, recurring, occurred_at, synced_entry_id)
              VALUES (entry.cents, entry.currency, entry.merchant, entry.category,
                      entry.recurring ? 1 : 0, entry.occurredAt, entry.id)
          inserted += page.entries.length
          if (page.entries.length > 0)
            UPSERT sync_cursor SET account_id = page.accountId,
                                   last_synced_id = page.cursor,
                                   updated_at = now WHERE id = 1
        COMMIT

        if (!page.hasMore) break
      end loop

   d. return { inserted, status: status.status === 'error' ? 'error' : 'connected' }
```

Notes:
- `INSERT OR IGNORE` on `synced_entry_id`'s partial unique index makes re-entry safe. If two `syncNow` calls race (despite the guard, e.g., across a hot-reload), the second call's inserts are no-ops on already-present rows.
- The transaction wraps the per-page batch *and* the cursor write — partial pages never advance the cursor without inserting their rows. A crash mid-page rolls back; next call re-pulls the same `since` and retries.
- Mismatch detection in step (c) handles the rare in-flight-disconnect case; the user's next `syncNow` picks up cleanly.

### 3.2 `POST /imap/connect` (backend)

```
1. Zod-validate body: { email, appPassword, senderAllowlist?: string[] }
2. Open IMAP connection to imap.gmail.com:993 with the supplied creds.
   - Auth failure → throw AuthError → 401 imap_auth_failed
   - Network/TLS error → throw NetworkError → 502 imap_unreachable
   - Success → close connection (we don't poll here — that's the worker's job)
3. encryptCredential(appPassword, env.PULSE_IMAP_ENCRYPTION_KEY) → ciphertext
   - PULSE_IMAP_ENCRYPTION_KEY missing → throw ConfigError → 503 server_misconfig
4. INSERT INTO imap_accounts (email_address, credentials_ciphertext, sender_allowlist,
                              poll_interval_seconds, status, created_at, updated_at)
   VALUES (?, ?, JSON.stringify(senderAllowlist ?? []), 300, 'active', now, now)
   ON CONFLICT email_address DO NOTHING RETURNING id
   - row not returned → email already taken → 409 already_connected
5. Return 201 { accountId, status: 'active', emailAddress }
```

Reuses `lib/seedImapAccount.ts` from 5b directly. The HTTP route is the caller; the seeder owns steps 2–4.

### 3.3 `DELETE /imap/disconnect` (backend)

```
1. Look up the single active row: SELECT id FROM imap_accounts ORDER BY created_at DESC LIMIT 1
   - none → 204 (idempotent)
2. DELETE FROM imap_accounts WHERE id = ?
   - FK on imap_uids cascades (UIDs gone)
   - FK on synced_entries set null (rows retained, account_id = NULL)
3. Return 204
```

After disconnect, `synced_entries` rows with `account_id IS NULL` are inert — `/sync/entries` filters by the *current* account, which is now absent, so subsequent reads return `accountId: null, entries: []`. iOS-side rows already pulled stay in `spending_entries`.

### 3.4 `GET /sync/entries` (backend)

```
1. Zod-validate query: { since: number = 0, limit: number = 200 (max 500) }
2. accountId = SELECT id FROM imap_accounts ORDER BY created_at DESC LIMIT 1
   - NULL → return { accountId: null, entries: [], hasMore: false, cursor: since }
3. rows = listSinceCursor(db, accountId, since, limit + 1)  // +1 for hasMore detection
4. hasMore = rows.length > limit
   if hasMore: rows = rows.slice(0, limit)
5. cursor = rows.length > 0 ? rows[rows.length-1].id : since
6. Return { accountId, entries: rows.map(toDTO), hasMore, cursor }
```

`toDTO` maps `SyncedEntry` (5a's row type) to `SyncedEntryDTO`: `recurring` → boolean, `occurredAt` stays ms-epoch number, `rawParseResponse`/`emailSubject`/`contentHash` are dropped from the DTO (private to the worker; iOS doesn't need them).

---

## 4. Components

### New files

| Path | Responsibility |
|---|---|
| `backend/src/routes/imap.ts` | Mounts `POST /connect`, `GET /status`, `DELETE /disconnect`. Each handler is ~10–25 lines. Composes `lib/seedImapAccount.ts` (connect), `db/queries/imapAccounts.ts` (status, disconnect), `lib/crypto/credentials.ts` (indirect via seeder). Maps `seedImapAccount`'s error classes (`AuthFailed`, `NetworkError`, `Duplicate`) to HTTP statuses. |
| `backend/src/routes/sync.ts` | Mounts `GET /entries`. Pure read-side: Zod-validate query, look up the active account, call 5a's `listSinceCursor` with `limit + 1`, slice + DTO-map, return. |
| `backend/src/schemas/imap.ts` | Zod for `ConnectRequest` (`email`, `appPassword`, `senderAllowlist?`) and `ConnectResponse` (mirrored types in `@api-types`). |
| `backend/src/schemas/sync.ts` | Zod for `SyncEntriesQuery` (`since: coerce.number().int().min(0).default(0)`, `limit: coerce.number().int().min(1).max(500).default(200)`) and `SyncedEntryDTO` shape. |
| `backend/src/db/migrations/0002_*` | Drizzle-generated migration: alter `synced_entries.account_id` to nullable + `ON DELETE SET NULL`. |
| `lib/sync/client.ts` | iOS HTTP wrappers: `imapConnect`, `imapStatus`, `imapDisconnect`, `fetchSyncEntries`. Same shape as `lib/pal/client.ts`: `Bearer $PAL_TOKEN`, error envelope mapping to typed error classes (`AuthError`, `NetworkError`, etc. — reuse `lib/pal/errors.ts` or duplicate? See §6 below). |
| `lib/sync/syncNow.ts` | The §3.1 orchestrator. Module-level `inFlight` guard. |
| `lib/sync/types.ts` | `SyncedEntryDTO`, `ImapStatus`, `SyncResult` shared types. |
| `lib/db/queries/syncCursor.ts` | `getCursor()` / `setCursor(accountId, lastSyncedId)`. Single-row UPSERT. |
| `lib/db/queries/insertSyncedEntry.ts` | `insertSyncedBatch(db, entries)`. Wraps the loop in `db.transaction`; uses `INSERT OR IGNORE` on `synced_entry_id`. |
| `lib/db/migrations/0004_*` | Drizzle-generated: ALTER TABLE spending_entries (4 columns), CREATE TABLE sync_cursor, CREATE INDEX, INSERT seed row. |

### Changed files

| Path | Change |
|---|---|
| `backend/src/middleware/auth.ts` | `Scope` union gains `"sync"`. |
| `backend/src/index.ts` | Mount the two new routers behind `authMiddleware(secret, "sync")`, with the same `rateLimitMw` as `/parse`. |
| `backend/src/db/schema.ts` | `syncedEntries.accountId` becomes nullable (`integer("account_id").references(…, { onDelete: "set null" })`). |
| `backend/src/db/queries/imapAccounts.ts` | Add `getActiveAccount(db)` — single-row helper used by `/imap/status`, `/sync/entries`, `/imap/disconnect`. |
| `backend/src/db/__tests__/cascade.test.ts` (5a's existing) | Update assertion: after `DELETE FROM imap_accounts`, `synced_entries.account_id IS NULL` (was: rows deleted). `imap_uids` cascade behavior unchanged. |
| `backend/src/lib/seedImapAccount.ts` (5b's) | No source change. Used as-is by `/imap/connect`. |
| `lib/db/schema.ts` | `spendingEntries` gains 4 columns; new `syncCursor` table. |
| `app/_layout.tsx` (or the existing `AppState` listener site) | Add `AppState.addEventListener('change', s => { if (s === 'active') void syncNow() })`. Existing teardown cleans up. |
| `app/(tabs)/today.tsx` | Wrap the scroll surface in `RefreshControl`; `onRefresh={async () => { await syncNow() }}`. If pull-to-refresh already exists, the handler composes (sync first, then existing refresh). |
| `lib/api-types.ts` | New shared types: `ConnectRequest`, `ConnectResponse`, `ImapStatus`, `SyncedEntryDTO`, `SyncEntriesResponse`. Mirrors backend Zod schemas. |
| `lib/pal/config.ts` | No change — same `PAL_BASE_URL` + `PAL_TOKEN`. The `"sync"` scope is in the bearer token. (If the token currently lacks `"sync"`, regenerate via existing helper; this is a one-line change in `backend/scripts/issue-token.ts` or equivalent if such a script exists.) |

### Reused unchanged

- `backend/src/lib/crypto/credentials.ts` (5b)
- `backend/src/lib/seedImapAccount.ts` (5b) — proves the abstraction was right; both worker and HTTP route consume it.
- `backend/src/db/queries/syncedEntries.ts::listSinceCursor` (5a) — the read query is already shaped for cursor pagination.
- `backend/src/middleware/{rateLimit,auth,requestId,errorHandler}.ts`
- `backend/Dockerfile`, `backend/deploy/compose.yml`, `backend/deploy/systemd/pulse-stack.service`
- `lib/db/client.ts`, `lib/db/migrate.ts` — migration `0004_*` runs through the existing migrator.

---

## 5. Testing

### Unit / route-shape (TDD)

| Module | Cases |
|---|---|
| `routes/imap.ts::POST /connect` | (a) happy path → 201, row inserted, ciphertext decrypts back to original; (b) IMAP rejects creds → 401 `imap_auth_failed`; (c) IMAP unreachable → 502 `imap_unreachable`; (d) duplicate email → 409 `already_connected`; (e) missing `"sync"` scope → 403; (f) malformed body → 400; (g) `PULSE_IMAP_ENCRYPTION_KEY` missing → 503. |
| `routes/imap.ts::GET /status` | (a) connected → returns full payload; (b) no row → `{connected:false}`; (c) `status='error'` row → returns it with `lastError`; (d) missing scope → 403. |
| `routes/imap.ts::DELETE /disconnect` | (a) row exists → 204, row deleted, `synced_entries` rows retained with `account_id=NULL`, `imap_uids` cascade-deleted; (b) no row → 204 (idempotent); (c) missing scope → 403. |
| `routes/sync.ts::GET /entries` | (a) empty DB → `{accountId:null, entries:[], hasMore:false}`; (b) 3 rows, `limit=2` → first call returns 2 rows + `hasMore:true` + correct cursor; second call with that cursor returns 1 row + `hasMore:false`; (c) `since=N` filters; (d) `limit > 500` → clamped or 400 (clamped, per decision §2 row 8); (e) negative `since` → 400; (f) missing scope → 403; (g) DTO shape excludes `rawParseResponse`/`contentHash`/`emailSubject`. |
| `db/__tests__/cascade.test.ts` (updated) | After `DELETE FROM imap_accounts`: `synced_entries.account_id IS NULL` (was: rows deleted); `imap_uids` row count drops to 0. |

### Integration (iOS, in-memory SQLite + mocked client)

| Module | Cases |
|---|---|
| `lib/sync/syncNow` | (a) status disconnected → no-op, returns `{inserted:0, status:'disconnected'}`; (b) first sync, single page → cursor advances, rows inserted with all sync columns populated; (c) pagination — 5 rows, page=2 → loop terminates after `hasMore:false`; (d) account_id mismatch on first fetch → cursor reset to 0 then advance; (e) re-entrance — call twice in parallel → both await the same in-flight promise; (f) idempotency — call twice sequentially with no new rows → second call inserts 0 rows; (g) network error mid-loop → throws, cursor at last successful page (rolled back if mid-page); (h) account_id changes mid-loop → break, return `{inserted:N, status:'error'}` (or just `connected` with partial), next call resets. |
| `lib/db/queries/syncCursor` | initial state `{accountId:null, lastSyncedId:0}`; set/get round-trip; only one row ever exists (CHECK constraint). |
| `lib/db/queries/insertSyncedEntry` | batch insert populates all 4 new columns; `INSERT OR IGNORE` on duplicate `synced_entry_id` no-ops; transaction rollback leaves table unchanged. |

Targeting **~28 new tests** (backend ~14, iOS ~14).

### Live smoke test

Conditions in §1. Closing condition for 5c: all 9 listed conditions pass.

iPhone visual smoke does not apply (no iOS UI surface in this slice — all UI lands in 5d).

---

## 6. Open notes for the plan

These are plan-time decisions, not blockers for *this* spec:

- **`lib/pal/errors.ts` reuse vs duplication.** The error classes (`AuthError`, `NetworkError`, `RateLimitError`, `UpstreamError`, `ValidationError`) match what 5c's sync client needs. Plan should decide: re-export from `lib/sync/errors.ts` to keep modules independently importable, or import directly. Recommendation: re-export to keep `lib/pal/` and `lib/sync/` decoupled at the type level.
- **Auth token regeneration.** The existing `backend/scripts/issue-token.ts` defaults `--scope` to `chat,parse,review` and currently does not include `"sync"`. Plan should reissue with `--scope chat,parse,review,sync,generate-routine` (or whatever the deployed token currently carries, plus `sync`) before live smoke step 3, then update `EXPO_PUBLIC_PAL_TOKEN` locally.
- **Drizzle migration generation.** Both the backend `0002_*` and iOS `0004_*` are produced via `drizzle-kit generate` against the schema deltas in `backend/src/db/schema.ts` and `lib/db/schema.ts`. Plan step orders the schema edit → migration generate → migration commit.
- **`AppState` listener placement.** `app/_layout.tsx` is the natural home (already mounted at app root). Plan should verify there's no existing `AppState` listener that needs composing, and if so, fold the `syncNow()` call into it rather than adding a second listener.
- **Today pull-to-refresh composition.** If `app/(tabs)/today.tsx` already has a `RefreshControl` (e.g., for re-running aggregations), 5c's plan threads `syncNow()` into the existing `onRefresh` rather than replacing it.

---

## 7. Deploy

- **Backend.** `git push origin main` triggers `deploy-backend.yml`. Migrator runs `0002_*` (alters `synced_entries.account_id` to nullable + SET NULL). Backend service restarts with the new routes mounted. Worker (5b) is unchanged — same image, no restart needed beyond compose's natural same-image no-op.
- **iOS.** Migration `0004_*` runs on next app launch via `migrate.ts`. No EAS rebuild required (no native module changes). Web target picks up the new routes immediately on `npm run web`.
- **Token regeneration.** Mint a new token via `JWT_SECRET=… npm exec tsx backend/scripts/issue-token.ts -- --sub kael --scope chat,parse,review,generate-routine,sync` (run on the droplet so `JWT_SECRET` doesn't leave it). Update `EXPO_PUBLIC_PAL_TOKEN` in the iOS `.env`. The backend doesn't whitelist scopes — verification happens per-route in `authMiddleware`, so adding the scope is sufficient.
- **Rollback.** Backend revert is one `git revert` away (drops the routes); the `0002_*` migration is forward-only but backwards-compatible (the FK relax doesn't break anything if the routes don't exist). iOS migration `0004_*` is similarly forward-only; if rolled back via app version, the new columns sit unread and the new table sits unused.

---

## 8. Scope cuts and deferrals

**Out of scope (closed by deferral or by parent meta-spec cuts):**

| Item | Where it lands |
|---|---|
| iOS Email Sync screens (Empty / Connect / Dashboard) | 5d |
| Subscriptions screen filtering on `recurring=true` | 5d (reads from columns 5c adds) |
| Allowlist edit UI | 5d (Connect screen). For 5c, allowlist edits go via `POST /imap/connect` re-call (which fails with 409) or direct SQL on the droplet. |
| "Wipe synced data" affordance in iOS Settings | 5d or SP6 polish |
| Multi-account UI on iOS | Cut by meta-spec §6 (one inbox per Pulse install) |
| Background fetch / `BGAppRefreshTask` | Cut by meta-spec §6 (foreground+pull only) |
| Server-push to iOS | Cut by meta-spec §2 row 10 (no `expo-notifications`) |
| Per-account cursor namespacing in iOS | Single-row cursor reset is sufficient at one-account-only |
| Conflict resolution between hand-logged and synced rows | Cut — `INSERT OR IGNORE` on `synced_entry_id` is sufficient; if user hand-logs the same Blue Bottle charge, it's a separate row (rare; deletable via existing per-entry edit sheet from 3b). |
| Migrating old `note`-stuffed merchant strings into the new `merchant` column | Cut — backfilling existing rows would force `mapToRow` rewrite + a one-shot data migration; functional gap at zero (Subscriptions only filters on `recurring`, not merchant column). |
| `PATCH /imap/account` for editing allowlist/poll-interval | Out — re-call `POST /imap/connect` after disconnect, or direct SQL. 5d's UI may want this; that's 5d's call. |
| Real-time sync via WebSocket / SSE | Cut — meta-spec §6 commits to polling-only. |

**Deliberately *not* closed in this spec, because 5c doesn't need them:**

- Streak surface placement (Today vs Rituals tab vs both) — 5f's call.
- Once-per-day dismissal storage for Close-Out — 5f's call.
- Weekly Review aggregate window (Sun→Sat vs Mon→Sun) — 5g's call.

**Explicitly closed open items from the parent meta-spec §7:**

| Meta-spec open item | Closed by |
|---|---|
| iOS sync trigger model | Decision §2 row 2: foreground + pull-to-refresh, single `syncNow()` async fn |

---

## 9. What this spec is NOT

- Not a product spec for any iOS UI surface. 5c has no UI.
- Not the worker — that's 5b. 5c is read-side HTTP routes plus an iOS module.
- Not an implementation plan. The next step is invoking `superpowers:writing-plans` to produce the plan for 5c.
- Not a schedule. Pace is unknown.

---

## 10. Open items requiring user input before 5c's plan starts

These are 5c-plan-level details, not blockers for *this* spec.

- **Token scope refresh.** `backend/scripts/issue-token.ts` exists and is the issuance path. Plan ships the regen command in the deploy step; user runs it on the droplet (since `JWT_SECRET` lives there).
- **`AppState` listener site.** Confirm `app/_layout.tsx` is the right home, or point to a different file if there's an existing listener to compose with.
- **Today pull-to-refresh composition.** Confirm whether `app/(tabs)/today.tsx` has an existing `onRefresh` that 5c's plan needs to thread into vs. replace.
