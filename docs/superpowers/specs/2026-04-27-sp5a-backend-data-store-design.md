# SP5a — Backend Data Store Design

**Date:** 2026-04-27
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) (SP5 meta-spec, slice 5a)
**Scope:** Stand up the backend SQLite data layer (schema, migrations, query modules, tests) **and** Docker-ize the backend deploy. No IMAP, no encryption primitive, no new HTTP routes — those are 5b/5c. The end state of 5a is: a Docker-ized backend running on the droplet at `/opt/pulse/`, with three empty new tables (`imap_accounts`, `synced_entries`, `imap_uids`) ready for 5b to populate.

---

## 1. What 5a ships

- Three new tables added via Drizzle in a new `backend/src/db/` module: `imap_accounts`, `synced_entries`, `imap_uids`. No changes to existing backend logic — 5a is additive.
- Drizzle ORM + `better-sqlite3` set up in the backend (new stack addition; iOS already uses Drizzle with `expo-sqlite`).
- Generated migration bundle, checked in.
- Query modules wrapping the new tables, typed via `$inferSelect` / `$inferInsert`. Coverage is the union of what 5b (worker) and 5c (sync routes) will need.
- A `migrate.ts` CLI entrypoint that opens the DB at `process.env.DB_PATH`, runs migrations, exits. Used by the `migrator` compose service at deploy time.
- A `Dockerfile` for the backend (multi-stage, non-root `USER 1500`).
- A `compose.yml` at `/opt/pulse/compose.yml` describing two services: `migrator` (one-shot) and `backend` (long-running). A `worker` service is **not** added in 5a — that's 5b.
- A rewritten `deploy-backend.yml` that builds the image, pushes to GHCR, SSHs to the droplet, runs the migrator, and brings up backend.
- A one-time **cutover plan** that moves the live backend from the existing `/srv/pulse-backend/` rsync deploy to the new `/opt/pulse/` Docker deploy without losing the current SP2 deployment (no DB to migrate yet — SP2 has no persistent state).
- Daily backup via a host-side `pulse-backup.timer` calling `sqlite3 .backup` against the bind-mounted DB file. 14-day retention.

**Smoke test:** All conditions must pass.

1. `npm test` green in `backend/` — including the prior 56 SP2 tests plus the new schema/query/migrate tests.
2. Push to `main` → GH Action builds image, pushes to `ghcr.io/<user>/pulse-backend:<sha>`, SSHs to droplet, `docker compose run --rm migrator` exits 0, `docker compose up -d backend` succeeds.
3. `curl https://<droplet>/health` returns 200.
4. SSH check: `ls -la /opt/pulse/data/pulse.db` shows the file owned by `pulse-backend:pulse-backend` (UID 1500).
5. SSH check: `sqlite3 /opt/pulse/data/pulse.db '.schema'` shows three new tables and their indexes.
6. Manually trigger backup: `systemctl start pulse-backup.service` → `/opt/pulse/data/backups/pulse-YYYY-MM-DD.db` exists.

---

## 2. Locked decisions (resolved during brainstorming)

These are settled inputs to the implementation plan and **not** open for relitigation in 5a's plan.

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Slice scope | **Full droplet bootstrap** (data layer ships live, not just code) | Matches the §3 row 5a smoke test in the parent meta-spec; the plan needs to actually own the deploy delta |
| 2 | Service user model | **Single `pulse-backend` user, UID 1500.** Both `pulse-backend.service` (current) and the future `pulse-worker` (5b) run as the same OS user via separate compose services. | §2 row 8 of the parent meta-spec called for two systemd units; we keep the unit-level isolation via two compose services without buying a second OS user. Defense-in-depth via dual users is theater at one user. **Amends parent §4 row 3.** |
| 3 | Schema shape | Three tables (§3 below). `synced_entries.id` doubles as the 5c sync cursor. `recurring` is a denormalized boolean set at write time by 5b. | Cleanest possible cursor; recurring-detection heuristic is read-once at insert by the worker. |
| 4 | Deploy primitive | **Docker + Compose**, replacing the existing rsync + systemd deploy for the whole backend. | One compose file describes backend + future worker; reproducible build env; clean foundation for SP5's two-service shape. **Amends parent meta-spec §6** (drops "No Docker for v1 (YAGNI)"). |
| 5 | Filesystem | `/opt/pulse/` as the deploy root (replaces `/srv/pulse-backend/`). DB at `/opt/pulse/data/pulse.db`, bind-mounted into the container as `/data/pulse.db`. | `/opt/<package>` is FHS-conventional for custom-built application packages. Bind mount over named volume keeps the DB file directly inspectable from the host (`sqlite3` works without `docker exec`). |
| 6 | Image registry | **GHCR** (`ghcr.io/<gh-user>/pulse-backend`). | Free for private GitHub repos via `GITHUB_TOKEN`; tagged-by-sha images give a versioned audit trail. |
| 7 | Migration runner | Deploy-time `docker compose run --rm migrator`. Migration failures fail the GH Action; `backend` never starts on a broken migration. | Loud failure beats a service that crashes after rsync replaces the binary. |
| 8 | Backup | Daily `sqlite3 .backup` via systemd timer at 03:00 droplet-local. 14-day retention via `find -mtime +14 -delete`. | `sqlite3 .backup` is online-safe (no torn pages). 14 days fits trivially within droplet disk at single-user scale. Off-droplet copies deferred to SP6 polish (DO snapshots cover catastrophic loss). |
| 9 | UID alignment | **Pin `USER 1500`** in the Dockerfile. Bootstrap creates host user `pulse-backend` with `useradd -u 1500 -r -s /usr/sbin/nologin`, owning `/opt/pulse/data/`. | Predictable, no compose-time substitution, image is self-contained. UID 1500 is well above the typical user range and well below `nobody` (65534). |
| 10 | No-source-on-droplet | The droplet only holds `/opt/pulse/{compose.yml, .env, data/}`. The image is the source of truth for code. | Removes "is the rsynced source out of sync with the running build?" as a category of bug. |
| 11 | Boot integration | Single `pulse-stack.service` systemd unit on the droplet runs `docker compose -f /opt/pulse/compose.yml up -d` at boot, `down` at stop. Compose handles per-service `restart: unless-stopped`. | One systemd unit + compose's restart policy is the standard pattern for compose-on-systemd. |

---

## 3. Tables

All three tables are new and additive; no existing iOS schema is touched. No FK between this backend SQLite and the iOS-side SQLite — they're separate databases reconciled via the 5c sync route.

```
imap_accounts                   -- one row per connected inbox; SP5 uses 1, schema allows N
  id                       INTEGER PK AUTOINCREMENT
  email_address            TEXT UNIQUE NOT NULL                  -- 'piskael16@gmail.com'
  credentials_ciphertext   TEXT NOT NULL                         -- opaque blob; 5b decides format (AES-GCM)
  sender_allowlist         TEXT NOT NULL DEFAULT '[]'            -- JSON array of bank domains
  poll_interval_seconds    INTEGER NOT NULL DEFAULT 300
  status                   TEXT NOT NULL DEFAULT 'active'        -- 'active' | 'paused' | 'error'
  last_polled_at           INTEGER                               -- unix ms; NULL until first poll
  last_error               TEXT                                  -- 5b populates; 5d Dashboard surfaces
  created_at               INTEGER NOT NULL                      -- unix ms
  updated_at               INTEGER NOT NULL                      -- unix ms

synced_entries              -- one row per parsed bank-alert email
  id                       INTEGER PK AUTOINCREMENT              -- doubles as 5c sync cursor
  account_id               INTEGER NOT NULL  REFERENCES imap_accounts(id) ON DELETE CASCADE
  imap_uid                 INTEGER NOT NULL                      -- for human debugging; dedupe via imap_uids
  content_hash             TEXT NOT NULL                         -- sha256 of normalized body; secondary dedupe

  -- denormalized for worker recurring-detection + 5c response
  cents                    INTEGER NOT NULL                      -- /parse amount × 100
  currency                 TEXT NOT NULL                         -- 'USD'
  merchant                 TEXT                                  -- /parse's merchant
  category                 TEXT                                  -- /parse's category
  occurred_at              INTEGER NOT NULL                      -- unix ms, parsed from email Date header
  recurring                INTEGER NOT NULL DEFAULT 0            -- 0/1 boolean; 5b sets at insert

  -- audit / replay
  raw_parse_response       TEXT NOT NULL                         -- JSON of /parse's full response
  email_subject            TEXT
  email_from               TEXT
  created_at               INTEGER NOT NULL                      -- worker insert time; cursor ordering

  INDEX idx_synced_entries_account_created (account_id, id)
  INDEX idx_synced_entries_account_merchant_occurred (account_id, merchant, occurred_at)

imap_uids                   -- per-account UID dedupe state; INCLUDES UIDs we saw but skipped
  account_id               INTEGER NOT NULL  REFERENCES imap_accounts(id) ON DELETE CASCADE
  uid                      INTEGER NOT NULL
  first_seen_at            INTEGER NOT NULL                      -- unix ms

  PRIMARY KEY (account_id, uid)
```

**Why `imap_uids` is separate from `synced_entries`:** a UID seen but skipped (sender not on allowlist, or `/parse` returned `kind: 'chat'`) still needs to be remembered so we don't re-parse it next poll. `imap_uids` holds *all* seen UIDs; `synced_entries` holds only those we actually parsed and persisted.

**Why `recurring` is a column, not a query:** 5b's heuristic is "same merchant + ±10% amount + ≥2 occurrences in prior 60 days." Computing this at read time means every 5c sync route hit re-runs the heuristic across history — wasteful. Computing once at write-time and freezing it on the row is correct given that the heuristic only depends on data older than the row itself (the row can never change a *prior* row's recurring status). If the heuristic ever needs tuning, a backfill script handles it; that's a 5b/SP6 problem, not a schema issue.

**Why `synced_entries.id` doubles as the cursor:** SQLite `INTEGER PRIMARY KEY AUTOINCREMENT` guarantees monotonically increasing IDs. 5c's `GET /sync/entries?since=N` becomes a single `WHERE account_id = ? AND id > ? ORDER BY id ASC LIMIT 100`. No separate `cursor`/`sequence` column needed.

### PRAGMAs

`createDb()` applies these on every connection:

- `PRAGMA foreign_keys = ON;` — enforce FK cascades. Off by default in SQLite.
- `PRAGMA journal_mode = WAL;` — write-ahead logging. Lets readers (backend) and writers (future worker) coexist without blocking. Needs to be set on the database file once; persists.
- `PRAGMA synchronous = NORMAL;` — paired with WAL, gives durability on commit while reducing fsync overhead. (`FULL` is overkill at single-user scale; `OFF` is too risky.)

---

## 4. Code structure

```
backend/src/db/
  schema.ts                     # Drizzle schema: imapAccounts, syncedEntries, imapUids
  client.ts                     # createDb(path) — better-sqlite3 + drizzle wrapper, applies PRAGMAs
  migrate.ts                    # runMigrations(db) wrapping drizzle-orm/better-sqlite3/migrator
  cli/
    migrate.ts                  # CLI entrypoint: opens DB at process.env.DB_PATH, runs migrations, exits
  migrations/                   # generated by drizzle-kit, checked in
    0000_initial.sql
    meta/
      _journal.json
      0000_snapshot.json
  queries/
    imapAccounts.ts             # createImapAccount, getImapAccount, listImapAccounts,
                                #   updateLastPolled, updateStatus, updateError
    syncedEntries.ts            # insertSyncedEntry (returns id), listSinceCursor,
                                #   findRecurringCandidates
    imapUids.ts                 # markUidSeen, hasSeen, listSeenUidsForAccount
  __tests__/
    schema.test.ts              # column types, indexes, FKs, pragmas
    migrate.test.ts             # fresh-DB migration; idempotent
    queries.test.ts             # input/output shape per module + FK cascade behavior

backend/drizzle.config.ts       # NEW — points at src/db/schema.ts; output src/db/migrations/
```

**Query module surface** (the union of what 5b and 5c will need; 5a only ships these signatures and tests, not the consumers):

```ts
// imapAccounts.ts
createImapAccount(input: NewImapAccount): { id: number }
getImapAccount(id: number): ImapAccount | undefined
listImapAccounts(): ImapAccount[]
updateLastPolled(id: number, at: number): void
updateStatus(id: number, status: 'active' | 'paused' | 'error'): void
updateError(id: number, error: string | null): void

// syncedEntries.ts
insertSyncedEntry(input: NewSyncedEntry): { id: number }
listSinceCursor(accountId: number, sinceId: number, limit: number): SyncedEntry[]
findRecurringCandidates(
  accountId: number,
  merchant: string,
  occurredAt: number,    // upper bound; query looks back 60 days from this
): SyncedEntry[]

// imapUids.ts
markUidSeen(accountId: number, uid: number, firstSeenAt: number): void  // idempotent
hasSeen(accountId: number, uid: number): boolean
listSeenUidsForAccount(accountId: number, sinceUid?: number): number[]
```

`NewImapAccount` and `NewSyncedEntry` come from Drizzle's `$inferInsert`. The query modules are thin wrappers around Drizzle queries — no business logic, no validation beyond what Zod already enforces upstream. Heuristics (recurring detection, error categorization) live in 5b.

---

## 5. Dockerfile

Multi-stage: builder pulls dev deps and compiles TypeScript; runtime is a minimal slim image with prod deps and the compiled output.

```dockerfile
# syntax=docker/dockerfile:1.7
FROM node:22-slim AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
RUN groupadd -g 1500 pulse-backend \
 && useradd -u 1500 -g 1500 -r -s /usr/sbin/nologin pulse-backend
WORKDIR /app
COPY --from=builder --chown=pulse-backend:pulse-backend /app/node_modules ./node_modules
COPY --from=builder --chown=pulse-backend:pulse-backend /app/package.json ./
COPY --from=builder --chown=pulse-backend:pulse-backend /app/dist ./dist
COPY --from=builder --chown=pulse-backend:pulse-backend /app/src/db/migrations ./dist/backend/src/db/migrations
USER pulse-backend
EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]
```

**Notes:**
- `node:22-slim` (not `alpine`) because `better-sqlite3` ships prebuilt binaries for `linux-x64-gnu` only; alpine's musl breaks them. Slim is ~80 MB vs alpine's ~50 MB but avoids a recompile.
- The non-root `pulse-backend` user inside the image has UID 1500 to match the host user.
- Migrations live next to the compiled output (`dist/backend/src/db/migrations`) so the migrator entrypoint can reference them via a stable relative path.
- Same image, different `command:` for `migrator` vs `backend` — see `compose.yml` below.

---

## 6. compose.yml

Lives at `/opt/pulse/compose.yml` on the droplet, **not** in the repo. (The repo's source-of-truth `compose.yml` is at `backend/deploy/compose.yml` and gets `scp`-ed to the droplet by the deploy step.)

```yaml
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

**Notes:**
- `IMAGE_TAG` is set per-deploy to the git SHA via the `.env` file; defaults to `latest` for manual SSH operations.
- `service_completed_successfully` blocks `backend` from starting until `migrator` exits 0. If migrator fails, the deploy halts; previous `backend` stays running on the prior image.
- `worker` service is intentionally absent — slotted in by 5b alongside `backend`.
- No `:Z` SELinux relabel on the volume — the droplet is Ubuntu, not RHEL.

---

## 7. Filesystem layout on the droplet

The systemd unit files and the canonical `compose.yml` live in the repo at `backend/deploy/`. The cutover `scp`s them to the droplet; subsequent deploys via the GH Action also `scp` `compose.yml` (so backend changes can adjust env vars), but **not** the systemd units (changing those requires `daemon-reload` and is rare; bump them manually when needed).

```
backend/deploy/                              # source-of-truth in the repo
  compose.yml
  systemd/
    pulse-stack.service
    pulse-backup.service
    pulse-backup.timer

# On the droplet:
/opt/pulse/                                  # root:root 0755
  compose.yml                                # root:root 0644 — scp'd from backend/deploy/compose.yml each deploy
  .env                                       # root:root 0600 — secrets, includes IMAGE_TAG line
  data/                                      # pulse-backend:pulse-backend 0700
    pulse.db                                 # pulse-backend:pulse-backend 0600
    pulse.db-wal                             # WAL journal (created by SQLite)
    pulse.db-shm                             # WAL shared-memory file
    backups/                                 # pulse-backend:pulse-backend 0700
      pulse-2026-04-27.db
      pulse-2026-04-28.db
      ...

/etc/systemd/system/
  pulse-stack.service                        # NEW — runs `docker compose up -d` at boot
  pulse-backup.service                       # NEW — one-shot backup
  pulse-backup.timer                         # NEW — daily 03:00 trigger

# REMOVED by the cutover:
/etc/systemd/system/pulse-backend.service    # OLD — replaced by pulse-stack.service
/srv/pulse-backend/                          # OLD — replaced by /opt/pulse/
/etc/pulse-backend.env                       # OLD — moved to /opt/pulse/.env
```

### `pulse-stack.service`

```ini
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

### `pulse-backup.service`

```ini
[Unit]
Description=Pulse backend daily backup

[Service]
Type=oneshot
User=pulse-backend
Group=pulse-backend
ExecStart=/bin/bash -c '/usr/bin/sqlite3 /opt/pulse/data/pulse.db ".backup /opt/pulse/data/backups/pulse-$(date +%%F).db"'
ExecStartPost=/usr/bin/find /opt/pulse/data/backups -name 'pulse-*.db' -mtime +14 -delete
```

The `%%F` is the systemd-escape for a literal `%F`, which `bash` then expands at runtime via `date(1)` to a `YYYY-MM-DD` string.

### `pulse-backup.timer`

```ini
[Unit]
Description=Daily Pulse backend backup

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
Unit=pulse-backup.service

[Install]
WantedBy=timers.target
```

`Persistent=true` runs a missed backup at next boot if the droplet was down at 03:00.

---

## 8. GH Action rewrite

`.github/workflows/deploy-backend.yml`:

1. **Checkout, setup-node, npm ci.** (Existing.)
2. **Test.** `npm test` — fails the deploy on red tests including the new schema/query/migrate suites.
3. **Build TS.** `npm run build`. (Used by tests; image build is independent.)
4. **Set up Docker buildx.** `docker/setup-buildx-action`.
5. **Log in to GHCR.** `docker/login-action` with `GITHUB_TOKEN`.
6. **Build + push image.** `docker/build-push-action` builds `backend/Dockerfile` and pushes two tags: `ghcr.io/<user>/pulse-backend:${{ github.sha }}` and `:latest`. Layer cache via GH Actions cache.
7. **Configure SSH.** (Existing.)
8. **Push compose.yml + .env updates.**
   - `scp backend/deploy/compose.yml root@droplet:/opt/pulse/compose.yml`
   - SSH: append/update `IMAGE_TAG=${{ github.sha }}` in `/opt/pulse/.env`
9. **Pull image.** `ssh ... 'cd /opt/pulse && docker compose pull'`
10. **Run migrator.** `ssh ... 'cd /opt/pulse && docker compose run --rm migrator'` — fails the action on non-zero exit.
11. **Up backend.** `ssh ... 'cd /opt/pulse && docker compose up -d backend && docker compose ps'`
12. **Smoke test.** `curl /health`, expect 200 (existing pattern).

Concurrency group `deploy-backend` (existing) prevents two deploys racing.

**`GITHUB_TOKEN` for droplet pulls:** the droplet pulls images from a *private* GHCR repo. The setup writes a long-lived PAT (with `read:packages` scope only) to `/root/.docker/config.json` on the droplet during the cutover. This is a one-time bootstrap; the GH Action itself uses `GITHUB_TOKEN` for push only.

---

## 9. Cutover plan (one-time, executed during 5a's implementation)

The current SP2 backend has **no persistent state** — no SQLite, no DB. It only holds an in-memory rate-limit bucket. So cutover is "swap deploy primitives" rather than "migrate data."

Order on the droplet (run as root via SSH):

1. **Pre-flight**
   - Verify Docker installed: `docker --version`. If absent, `apt-get install docker.io docker-compose-plugin`.
   - Verify outbound access to `ghcr.io` (HTTPS).
2. **Prepare new layout**
   - `useradd -u 1500 -r -s /usr/sbin/nologin pulse-backend` (skip if exists).
   - `mkdir -p /opt/pulse/data/backups`
   - `chown -R pulse-backend:pulse-backend /opt/pulse/data`
   - `chmod 0700 /opt/pulse/data`
3. **Move env file**
   - `cp /etc/pulse-backend.env /opt/pulse/.env`
   - `chmod 0600 /opt/pulse/.env`
4. **Drop compose.yml + new systemd units**
   - First-time deploy via the GH Action does `scp compose.yml`; for the manual cutover, deposit it directly.
   - `cp pulse-stack.service pulse-backup.service pulse-backup.timer /etc/systemd/system/`
   - `systemctl daemon-reload`
5. **Configure GHCR pull credentials**
   - Generate a GH PAT (scope: `read:packages`); write to `/root/.docker/config.json` via `docker login ghcr.io`.
6. **Cut over**
   - `systemctl stop pulse-backend.service` (old)
   - `systemctl disable pulse-backend.service`
   - `rm /etc/systemd/system/pulse-backend.service`
   - `systemctl enable --now pulse-stack.service` — pulls image, runs migrator, starts backend
   - `systemctl enable --now pulse-backup.timer`
7. **Verify**
   - `curl http://localhost:3000/health` → 200
   - `docker compose -f /opt/pulse/compose.yml ps` → backend running
   - `ls /opt/pulse/data/pulse.db` → exists, owned 1500:1500
8. **Clean up old artifacts**
   - `rm -rf /srv/pulse-backend`
   - `rm /etc/pulse-backend.env`

**Rollback path (if cutover fails):**
- The cutover doesn't delete old artifacts until step 8. If anything in steps 1–7 fails, the old `pulse-backend.service` is still installed (just stopped); `systemctl start pulse-backend.service` brings it back. Old code is in `/srv/pulse-backend/` until step 8.

The first GH-Action-driven deploy after cutover should be a no-op redeploy (push an empty commit or `workflow_dispatch`) to verify the action's deploy path end-to-end against the new layout.

---

## 10. Error handling and operational concerns

5a's failure surfaces are all build/deploy/boot — there's no consumer of these tables until 5b/5c, so there are no user-facing error paths.

**Migration failure (CI side).** `docker compose run --rm migrator` exits non-zero → the GH Action step fails, the deploy halts before `up -d backend`. The previous `backend` container keeps running on the prior image. `--rm` removes the failed migrator container so subsequent runs start clean. Drizzle wraps each migration in a transaction, so a partial migration rolls back; the `__drizzle_migrations` table is the source of truth for "what's applied." Recovery: fix the migration, push again — no manual droplet intervention needed.

**Migration failure (local side).** `npm test` runs migrations against `:memory:` in CI before the image build step. A broken migration fails the test suite *before* the image is built or pushed.

**Backend boot, DB unreachable.** If `/data/pulse.db` is missing or unwritable (UID mismatch, bind-mount typo), `createDb()` throws on the first query and the container exits. `restart: unless-stopped` will retry — and keep failing until human intervention. That's correct: don't paper over a broken bind-mount with retry logic. The GH Action's smoke step (`curl /health`) catches it.

**Backup failure.** `pulse-backup.service` exits non-zero → systemd marks the unit failed; `journalctl -u pulse-backup.service` is the audit trail. No alerting wired up (single-user app); silent breakage is observable via `ls /opt/pulse/data/backups/`. Out-of-disk during a backup: `sqlite3 .backup` fails cleanly without corrupting the source DB. The retention prune runs as `ExecStartPost`, so a failed backup also doesn't trigger a prune.

**Out of scope for 5a:**
- Concurrent-writer arbitration — only one writer until 5b. WAL handles backend↔worker concurrency cleanly when 5b lands.
- DB corruption recovery — restore from a backup; SP6 polish if it ever bites.
- Schema drift detection at boot — Drizzle migrations are append-only and the migrator runs every deploy; drift would require manual table edits on the droplet, which is out of bounds.

---

## 11. Testing

All tests are **vitest** under `backend/src/db/__tests__/`. Backend already uses vitest; no new test runner.

**`schema.test.ts` — schema integrity (TDD-eligible per parent meta-spec).**
- Migrate against `:memory:`; introspect via `PRAGMA table_info(<table>)` and `PRAGMA index_list(<table>)`.
- For each table: assert column names + types match the Drizzle schema. Assert NOT NULL flags. Assert PRIMARY KEYs.
- For FKs: assert `imap_uids.account_id` and `synced_entries.account_id` reference `imap_accounts(id)` with `ON DELETE CASCADE`.
- Assert indexes exist by name: `idx_synced_entries_account_created`, `idx_synced_entries_account_merchant_occurred`. Assert `imap_uids` composite primary key.
- Assert `PRAGMA foreign_keys` is `1` after `createDb()`.
- Assert `sender_allowlist` round-trips a JSON array (insert with `JSON.stringify([...])`, select, `JSON.parse`).

**`migrate.test.ts` — migration applies and is idempotent.**
- `runMigrations(fresh memory DB)` → all three tables exist + `__drizzle_migrations` has one row.
- `runMigrations` called twice → still one row in `__drizzle_migrations`; no error.

**`queries.test.ts` — query module shapes (TDD-eligible).**
- For each query module:
  - `imapAccounts`: `createImapAccount` returns `{ id }`; `getImapAccount` round-trips; `updateLastPolled` updates `last_polled_at`; `updateStatus`/`updateError` reflect in subsequent reads.
  - `syncedEntries`: `insertSyncedEntry` returns `{ id }`; `listSinceCursor(accountId, 0, 100)` returns rows in ascending `id` order; `listSinceCursor(accountId, lastId, 100)` returns `[]` when no new rows; `findRecurringCandidates` returns rows from the prior 60 days for matching merchant, ignores other accounts.
  - `imapUids`: `markUidSeen` is idempotent (calling twice with same `(accountId, uid)` doesn't throw or duplicate); `hasSeen` returns `true` after `markUidSeen`, `false` before.
- **FK cascade test:** insert an account + a uid + a synced_entry, delete the account, assert both child rows gone.

---

## 12. What 5a is NOT

Explicit cuts so scope can't drift mid-implementation:

- **No IMAP code.** No `imapflow`, no `node-imap`, no polling loop. 5b.
- **No encryption primitive.** `imap_accounts.credentials_ciphertext` is just a TEXT column. 5b lands AES-GCM (or libsodium) encrypt/decrypt and decides the column's exact byte format.
- **No HTTP routes consuming the new tables.** No `POST /imap/connect`, no `GET /sync/entries`, no `DELETE /imap/disconnect`. 5c.
- **No `worker` compose service.** Slotted in by 5b alongside `backend`.
- **No JWT scope `"sync"`.** 5c.
- **No iOS changes.** No `lib/sync/`, no new screens. 5d.
- **No off-droplet backups.** Daily `sqlite3 .backup` to local disk only; DO snapshots cover catastrophic loss. SP6.
- **No alerting on backup failure.** Single-user app; `ls /opt/pulse/data/backups/` is the audit.
- **No DB-readiness check in `/health`.** Existing process-up check stays. 5c can extend it.
- **No recurring-detection heuristic.** `synced_entries.recurring` is a column; the heuristic lives in 5b.
- **No "down" migrations.** Drizzle is forward-only. Recovery from a bad migration = fix-forward + restore from a backup if needed.
- **No SP2 logic changes.** SP2's existing `/health`, `/chat`, `/parse`, `/review`, `/generate-routine` routes are untouched. 5a is purely additive on the code side; the deploy primitive change re-runs them but doesn't modify them.

---

## 13. Meta-spec amendments landed by 5a

Two parent specs need patches as part of 5a's implementation, applied in the same commit that introduces the Dockerfile:

**Parent meta-spec `meta/2026-04-25-implementation-process-design.md` §6 ("Backend deploy"):**
- Old: "Plain `rsync` + `systemd` service unit. No Docker for v1 (YAGNI)."
- New: "Docker + Compose. Image hosted on GHCR. Single-host bind mount for SQLite. Backend deploy root at `/opt/pulse/`. systemd unit `pulse-stack.service` brings up the compose stack at boot. (Switched in SP5a.)"

**SP5 child meta-spec `meta/2026-04-26-sp5-email-review-design.md`:**
- §2 row 8 ("Process model"): rephrase from "Two systemd units... `pulse-backend.service` (HTTP) and `pulse-worker.service` (poller)" to "Two compose services on a shared bind-mounted volume: `backend` (HTTP) and `worker` (poller, added in 5b). Both run as the `pulse-backend` OS user (UID 1500) inside the container. (Updated in SP5a.)"
- §4 row 3 ("DO droplet"): rephrase "5a's plan adds `/var/lib/pulse-backend/` and a `pulse-worker` user; 5b's plan adds `pulse-worker.service`" to "5a's plan stands up `/opt/pulse/`, the `pulse-backend` user (UID 1500), and the Docker-based deploy; 5b's plan adds the `worker` compose service alongside `backend`."

---

## 14. Open items requiring user input before plan starts

These resolve in the implementation plan (or the user's first PR review of it), not by relitigating this spec.

- **GitHub username** for `ghcr.io/<gh-user>/pulse-backend`. (Probably the user's existing GitHub account; need it to fill in the image name.)
- **PAT generation cadence** — the droplet's `read:packages` PAT should be a long-lived token attached to the user's GitHub account; its rotation policy is "rotate when it leaks." Plan will include a script to rotate it.
- **Existing `/etc/pulse-backend.env` contents** — confirm what's in there now (`OPENROUTER_API_KEY`, `JWT_SECRET`, anything else?) before the cutover step copies it to `/opt/pulse/.env`.
- **Droplet Docker version** — confirm `docker compose` (v2 plugin syntax) is available, not legacy `docker-compose` (v1, hyphenated). Adjust install step accordingly.

---

## 15. What this spec is NOT

- Not the implementation plan. Next step is invoking `superpowers:writing-plans` to produce 5a's plan.
- Not a re-decomposition of SP5. SP5's seven slices remain 5a–5g per the parent meta-spec.
- Not a CloudKit or multi-device sync feature.
- Not a redesign of SP2's existing routes — they keep working through and after the deploy primitive change.
