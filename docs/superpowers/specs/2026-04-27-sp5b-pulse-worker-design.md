# SP5b — `pulse-worker` Service Design

**Date:** 2026-04-27
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) (SP5 meta-spec, slice 5b)
**Builds on:** [`./2026-04-27-sp5a-backend-data-store-design.md`](./2026-04-27-sp5a-backend-data-store-design.md) (data layer + Docker stack)
**Scope:** Stand up the IMAP-polling worker that turns `imap_accounts` rows into `synced_entries` rows. Adds a second compose service (`worker`) alongside `backend`, the encryption primitive that 5c will reuse, the admin seeder that gets a Gmail app password into the database, and a refactor of the existing `/parse` route into a shared library function so the worker can use it in-process. **No HTTP routes are added or modified in 5b** — `POST /imap/connect`, `GET /sync/entries`, etc. land in 5c.

---

## 1. What 5b ships

- **`worker` compose service** at `/opt/pulse/compose.yml`, peer to the existing `backend` service. Same image, different `command:` (`node dist/backend/src/worker/index.js`). No port mapping (no HTTP). Both services share the bind-mounted `/opt/pulse/data/` volume; the worker is the sole writer of `synced_entries` and `imap_uids`.
- **Worker entrypoint** (`backend/src/worker/index.ts`) running a single `setInterval` loop on a 60-second base tick. Each tick iterates `imap_accounts` rows sequentially and polls any account whose per-account `pollIntervalSeconds` has elapsed since `lastPolledAt`.
- **Per-account orchestrator** (`backend/src/worker/processAccount.ts`) implementing the §3 data flow: decrypt credentials → IMAP connect → search by `uid > maxSeen` (or by date on first poll) → allowlist filter → fetch body → extract plaintext → call `parseEntry()` → write `synced_entries` + `imap_uids` in a transaction → update `lastPolledAt`.
- **Encryption primitive** (`backend/src/lib/crypto/credentials.ts`): AES-256-GCM via Node `crypto`, ciphertext stored as base64(`iv ‖ ciphertext ‖ authTag`). Key sourced from a new env var `PULSE_IMAP_ENCRYPTION_KEY` (32 bytes hex). Reused unchanged by 5c.
- **Parse refactor** (`backend/src/lib/parse.ts`): the meat of the existing `routes/parse.ts` extracted into a pure function `parseEntry({ llm, modelId, logger }, { text, hint })`. The HTTP route becomes a thin wrapper. Existing parse-route tests migrate to the lib function.
- **Admin seeder** (`backend/scripts/seed-imap-account.ts`): one-off CLI invoked via `docker compose run --rm -it worker node …`. Takes `--email` and optional `--allowlist` as flags; prompts for the Gmail app password on hidden stdin. Validates against `imap.gmail.com:993` *before* insert; rejects duplicate `email_address`.
- **GH Action change**: one new step in `deploy-backend.yml` that brings up the `worker` service alongside `backend`.
- **Test coverage** (~35–40 new tests on top of 5a's 25): encryption round-trip, plaintext extraction, recurring heuristic, backoff state machine, IMAP wrapper allowlist + UID search, processAccount integration with mocked imapflow + LlmClient + in-memory SQLite, refactored parse lib, seeder lib.

**Smoke test (live, on droplet):** all conditions must pass.

1. `npm test` green in `backend/` — 5a's tests plus new 5b coverage.
2. Generate `PULSE_IMAP_ENCRYPTION_KEY=<32-byte hex>` locally; append to `/opt/pulse/.env`.
3. Push to `main`. GH Action builds, deploys, brings up `migrator` → `backend` → `worker`.
4. SSH to droplet. Run the seeder: `docker compose -f /opt/pulse/compose.yml run --rm -it worker node dist/backend/scripts/seed-imap-account.js --email <gmail> --allowlist <one bank domain>`. Enter app password at hidden prompt. Seeder exits 0.
5. `docker compose -f /opt/pulse/compose.yml logs -f worker` shows the next tick within ≤60s; first poll backfills the last 14 days; each parse logs its `kind` decision.
6. `sqlite3 /opt/pulse/data/pulse.db 'SELECT id, merchant, cents, currency, recurring, occurred_at FROM synced_entries ORDER BY id'` returns rows.
7. After tick #2 (~5 min later), logs show `0 new UIDs` and no row duplicates; `consecutiveFailures=0`.

**Negative smoke test (optional but recommended):** seed a wrong password (after manually deleting the previous row), watch the worker hit `IMAP NO LOGIN`, observe `status='error'` and `lastError` populated. Proves the auth-failure permanent path works end-to-end.

---

## 2. Locked decisions (resolved during brainstorming)

These are settled inputs to 5b's implementation plan and **not** open for relitigation.

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Encryption key source | New env var `PULSE_IMAP_ENCRYPTION_KEY` (32 bytes, hex-encoded). Validated at worker startup. | Separate from `JWT_SECRET` so a JWT rotation doesn't invalidate stored IMAP credentials. The cost of an extra env var is one line in `/opt/pulse/.env`; deriving from `JWT_SECRET` is a hidden footgun. |
| 2 | Encryption primitive | Node `crypto` AES-256-GCM. Wire format: base64(12-byte IV ‖ ciphertext ‖ 16-byte authTag) into the existing `imap_accounts.credentials_ciphertext` column. Per-encrypt random IV via `randomBytes(12)`. | Standard library, no native deps, well-understood. At one user, the marginal nonce-space gain from XChaCha20-Poly1305 isn't worth a `sodium-native` build dependency in the Docker image. |
| 3 | IMAP library | `imapflow` | Modern, promise-based, TypeScript-friendly, pure JS (no native deps). API maps cleanly to UID-based incremental polling. `node-imap` is older and callback-based; wrapping it in promises is unnecessary work. |
| 4 | Parse hand-off shape | Extract `parseEntry()` into `backend/src/lib/parse.ts` (pure function); both the HTTP route and the worker call it directly in-process. | Eliminates HTTP loopback, JWT plumbing inside the worker, and rate-limit concerns. ~30-line refactor; existing parse tests migrate to the lib and stay green. |
| 5 | Recurring-detection heuristic | A new entry is `recurring: true` iff there exists ≥1 prior `synced_entries` row in the last 60 days with the same `merchant`, the same `currency`, and `cents` within ±10%. The first occurrence is always `recurring: false`. | Same currency + ±10% rejects FX/USD-vs-EUR collisions on the same merchant string. ≥1 prior (so the 2nd hit flags) means a monthly subscription gets correctly flagged starting in month 2; ≥2 prior would delay flagging until month 3. |
| 6 | Error & backoff policy | **Tiered.** Auth failures (`IMAP NO LOGIN`, `AUTHENTICATIONFAILED`) → `status='error'`, `lastError` set, polling stops for that account until manually re-seeded. All other errors (network, TLS, fetch error, LLM upstream error) → in-memory `consecutiveFailures` counter, exponential backoff `5m → 10m → 20m → 40m → cap 1h`, `status` stays `'active'`. Reset to 0 on first success. | Auth failure is the only error class that's truly permanent; treating a 30-second Gmail blip as permanent would be the wrong default. The counter lives in worker process memory only; restart resets to 0, which is correct. |
| 7 | Parse input shape | Worker passes `text = "Subject: ${subject}\n\n${plaintextBody}"` truncated to 4 KB after HTML-strip; always `hint: 'spend'`. | Bank emails put the relevant data near the top; 4 KB ≈ 1000 tokens ≈ ⅓¢ per parse. The sender allowlist already filtered to bank emails, so `hint: 'spend'` is safe to hardcode. |
| 8 | Parse-result handling | `kind: 'spend'` (any confidence) → write row + mark UID seen. `kind: 'workout'` or `'chat'` → drop row + mark UID seen. `UpstreamError` from `parseEntry` → don't mark UID, count as transient, break out of per-UID loop for this tick. `ZodError` from `parseEntry` → mark UID seen, log raw output at warn (don't retry forever on malformed parses). | Trusts the LLM's `kind` decision (the allowlist already pre-filtered the candidate set). Confidence gating would silently drop transactions; per-UID retry counters are YAGNI at one user. |
| 9 | Worker process model | Single Node process, single `setInterval` on a 60-second base tick. Per-tick: `listImapAccounts(db).filter(active).filter(eligibleNow).forEach(await processAccount)`. Sequential, not concurrent. | At one user this is identical to concurrent. At N accounts it bounds memory + IMAP connection count without pooling. |
| 10 | First-poll backfill | On the first poll for an account (`max(uid)` NULL), search by date `since: now - 14 days` instead of UID-range. Fixed at 14 days for v1. | Keeps initial parse cost bounded (~⅓¢ × ≤30 messages); avoids pulling years of history. |
| 11 | Per-tick UID cap | Soft cap at 50 UIDs per tick. Above that, log a warning and process 50; the rest get picked up next tick. | Protects against a one-time backlog dump (e.g., user enables sync after a long absence) from stalling the worker. |
| 12 | Admin seeder UX | Email + allowlist on CLI flags; password prompted on hidden stdin (no command-line arg, no env var). Validates against `imap.gmail.com:993` before insert. Rejects duplicate `email_address` (would orphan dedupe state). Warns loudly if `--allowlist` is empty. | App password never on the command line, never in shell history, never in `ps`. The IMAP-validate-before-insert step doubles as a smoke test for the encryption + seeder integration. |
| 13 | Allowlist edits post-seed | Direct `UPDATE imap_accounts SET sender_allowlist = ? WHERE id = ?` via `sqlite3 /opt/pulse/data/pulse.db`. Worker re-reads `senderAllowlist` from DB on each tick, so changes propagate within ≤60s without restart. | 5b has no UI; the Connect screen in 5d will be the user-facing edit path. SQL edits are sufficient at single-user scale. |
| 14 | Worker config validation | Split `loadConfig()` in `backend/src/config.ts` into `loadHttpConfig()` and `loadWorkerConfig()`. Each entrypoint calls only the one it needs. The worker variant requires `PULSE_IMAP_ENCRYPTION_KEY`; the HTTP variant doesn't. | Avoids a `PULSE_ROLE` env-var-as-mode-flag (footgun). Lets the `backend` service keep starting cleanly on first deploy before `PULSE_IMAP_ENCRYPTION_KEY` is set; the `worker` service fails fast and loudly until the key is in `/opt/pulse/.env`. |

---

## 3. Data flow (one poll tick for one account)

```
1. Decrypt credentials
   credentials_ciphertext (text col) → AES-256-GCM-decrypt → app password
   Failure here = config rot or wrong PULSE_IMAP_ENCRYPTION_KEY.
   Treat as PERMANENT: set status='error', lastError='credentials decrypt failed', stop polling
   this account until manual re-seed.

2. Connect to imap.gmail.com:993
   imapflow.connect() with { user: emailAddress, pass: appPassword }
   Failure modes:
     - IMAP NO LOGIN / AUTHENTICATIONFAILED → PERMANENT (auth). status='error', lastError set.
       Skip the rest of the tick for this account.
     - Network/timeout/TLS error → TRANSIENT. Set tickError=true and skip to step 6
       (which calls backoffState.recordTransientFailure).

3. Open INBOX, fetch the high-water-mark UID we know about
   maxSeenUid := SELECT max(uid) FROM imap_uids WHERE account_id = ?
   (NULL on first-ever poll → fetch UIDs from the last 14 days only — bounded backfill.)

4. Search for new UIDs
   client.search({ uid: `${maxSeenUid + 1}:*` })  // or { since: 14daysAgo } for first poll
   Filter against allowlist:
     keep only UIDs whose envelope.from matches one of senderAllowlist
     (envelope is cheap; full body is not — fetch envelope first, body only for kept UIDs.)
   Apply per-tick soft cap of 50 (decision §2 row 11).

5. For each kept UID (sequential, await each):
   a. fetch envelope + body (text/plain preferred, text/html stripped if no plain part)
   b. plaintext := extractPlaintext(struct, body)  // lib/email/extract.ts
   c. truncated  := plaintext.slice(0, 4096)
   d. text := `Subject: ${envelope.subject}\n\n${truncated}`
   e. contentHash := sha256(envelope.subject + '\n' + plaintext)
      (Stored on the row; used by 5c+ for content-level dedupe.)
   f. parsed := await parseEntry({ llm, modelId, logger }, { text, hint: 'spend' })
   g. Per decision §2 row 8:
      - kind='spend' →
          BEGIN TRANSACTION
            // Recurring heuristic runs BEFORE insert so the new row doesn't count itself.
            const priors = findRecurringCandidates(db, account.id, parsed.data.merchant, occurredAt)
            const recurring = isRecurring(priors, { cents: round(parsed.data.amount*100),
                                                    currency: parsed.data.currency })
            INSERT synced_entries { account_id, imap_uid: uid, content_hash, cents,
              currency, merchant, category, occurred_at: envelope.date.getTime(),
              recurring: recurring ? 1 : 0,
              raw_parse_response: JSON.stringify(parsed),
              email_subject: envelope.subject, email_from: envelope.from[0].address,
              created_at: now }
            INSERT imap_uids { account_id, uid, first_seen_at: now }
              ON CONFLICT DO NOTHING
          COMMIT
      - kind='workout' | 'chat' →
          INSERT imap_uids { account_id, uid, first_seen_at: now } ON CONFLICT DO NOTHING
          logger.info({ uid, kind }, 'skipped non-spend email')
      - parseEntry threw UpstreamError →
          DON'T mark UID. Set tickError=true. Break out of per-UID loop.
          (Don't hammer OpenRouter if it's down; the loop resumes from this UID next tick.)
      - parseEntry threw ZodError →
          INSERT imap_uids (mark seen — don't retry forever on malformed output).
          logger.warn({ uid, modelOutput }, 'parse: model output failed schema')
          Continue to next UID.

6. After loop completes (all UIDs processed or broke on UpstreamError):
   updateLastPolled(account.id, now)
   if !tickError: backoffState.recordSuccess(account.id)
   else:          backoffState.recordTransientFailure(account.id)
   (recordTransientFailure increments consecutiveFailures and sets nextEligibleAt =
    now + min(pollInterval * 2^consecutiveFailures, 3_600_000). recordSuccess resets to 0.)

7. client.logout() / client.close()
   (Connect-per-tick: don't pool connections — single-account use doesn't need pooling state.)
```

**Specifics worth pinning:**

- **`occurredAt`** comes from the email envelope `date` (when the bank sent the alert), **not** `Date.now()`. Critical for the 60-day recurring window — using `now` would mis-bucket alerts about transactions that happened weeks ago.
- **Recurring heuristic runs inside the same transaction as the INSERT** (specifically: query `findRecurringCandidates` *before* the INSERT). SQLite's read-then-write inside a transaction makes this trivial.
- **Body extraction:** prefer `text/plain` MIME part; fall back to stripping `text/html` with `node-html-parser`. Truncate to 4 KB *after* strip.
- **Sequential per-UID processing:** an LLM error on UID 3 of 10 means we break out of the loop and retry the whole tick later. UIDs 1–2 already have rows + are marked seen, so the retry naturally resumes from UID 3 next tick.

---

## 4. Components

### New files

| Path | Responsibility |
|---|---|
| `backend/src/lib/parse.ts` | `parseEntry(deps, input): Promise<ParseResponse>`. Owns the model call + Zod validation + raw-output logging. Throws `UpstreamError` on LLM/network failure; throws `ZodError` on schema failure. Pure function; injectable `LlmClient` and `Logger`. |
| `backend/src/lib/crypto/credentials.ts` | `encryptCredential(plaintext, keyHex): string` and `decryptCredential(ciphertext, keyHex): string`. ~25 lines total. `keyHex` decoded from hex into a 32-byte Buffer. Decrypt throws on tag mismatch (fail closed). |
| `backend/src/lib/email/extract.ts` | `extractPlaintext(struct, body): string`. Picks `text/plain` if present; else strips `text/html` via `node-html-parser`; else returns empty string. **Untruncated** — caller truncates. Pure function, fixture-tested. |
| `backend/src/lib/seedImapAccount.ts` | The seeder's pure logic, extracted for testability: `seedImapAccount({ db, imapFactory, crypto }, { email, password, allowlist }): Promise<{ id: number }>`. Validates against IMAP, encrypts, inserts, returns id. Throws on auth failure or duplicate email. |
| `backend/src/worker/imap.ts` | `pollAccount(args)` — owns search-by-UID-range or search-by-date, allowlist filter on envelope, sequential body fetch, per-tick soft cap of 50. Mockable for unit tests via injected `client: ImapFlow`. |
| `backend/src/worker/recurring.ts` | `isRecurring(prior: SyncedEntry[], candidate: { cents; currency }): boolean`. Pure implementation of decision §2 row 5. Table-tested. |
| `backend/src/worker/backoff.ts` | `class AccountBackoffState { recordSuccess(); recordTransientFailure(); shouldPollNow(account, now): boolean }`. In-memory state holding `consecutiveFailures` and `nextEligibleAt` per account. Injectable clock for tests. |
| `backend/src/worker/processAccount.ts` | The §3 data-flow orchestration. Composes everything above for a single account. Returns `{ inserted, skipped, errors }` for logging. |
| `backend/src/worker/index.ts` | Worker entrypoint. Calls `loadWorkerConfig()`, builds `LlmClient` + `Db` + `Logger`, holds the `Map<accountId, AccountBackoffState>`, runs `setInterval(tick, 60_000)`. Graceful shutdown on SIGTERM (clears interval, awaits in-flight poll). |
| `backend/scripts/seed-imap-account.ts` | Thin CLI wrapper over `lib/seedImapAccount.ts`: parses `--email`/`--allowlist`, prompts for password on hidden stdin (`process.stdin.setRawMode(true)`), prints success/failure to stderr, exits with appropriate code. |

### Changed files

| Path | Change |
|---|---|
| `backend/src/routes/parse.ts` | Becomes a thin wrapper. New body: `body = ParseRequestSchema.parse(req.body); const out = await parseEntry(deps, body); res.json(out);` plus existing error-mapping for `UpstreamError` and `ZodError`. |
| `backend/src/config.ts` | Split `loadConfig()` into `loadHttpConfig()` (existing fields, keeps the existing exported `loadConfig` as an alias for backwards compat) and `loadWorkerConfig()` (HTTP fields minus `PORT`/`RATE_LIMIT_PER_MIN`, plus `PULSE_IMAP_ENCRYPTION_KEY: regex(/^[0-9a-fA-F]{64}$/)`). |
| `backend/deploy/compose.yml` | Add the `worker` service alongside `backend`. Same image, `command: node dist/backend/src/worker/index.js`. No port mapping. `depends_on: { migrator: { condition: service_completed_successfully } }`. `restart: unless-stopped`. |
| `.github/workflows/deploy-backend.yml` | After "Up backend", add a step: `ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d worker"`. Same `up -d` semantics — recreates if image changed, otherwise no-op. |
| `backend/package.json` | Add deps: `imapflow`, `node-html-parser`. No new devDeps. |

### Existing files unchanged

- `backend/src/db/schema.ts` — 5a's tables cover everything 5b needs. **No schema delta.**
- `backend/src/db/queries/{imapAccounts,imapUids,syncedEntries}.ts` — already cover the full read/write surface 5b needs.
- `backend/Dockerfile` — same image runs both services; no Dockerfile change.
- `backend/deploy/systemd/pulse-stack.service` — compose-up brings up *all* services; no systemd change.

---

## 5. Testing

### Unit (TDD)

| Module | Cases |
|---|---|
| `lib/crypto/credentials.ts` | round-trip; wrong key throws; tampered ciphertext throws on tag verification; 10k IVs all distinct (no collisions in the random source). |
| `lib/parse.ts` | returns `ParseResponse` for valid LLM JSON; throws `UpstreamError` on LLM failure; throws `ZodError` on schema mismatch; logs raw output at warn on validation failure. (Migrates the meat of the existing `routes/parse.test.ts`.) |
| `lib/email/extract.ts` | `text/plain` part wins; `text/html`-only is stripped; multipart/alternative picks `text/plain`; HTML entities decoded; missing body returns empty string. |
| `worker/recurring.ts` | 0 priors → false; 1 prior +0%/+9% → true; +11% → false; same amount different currency → false; same currency same amount → true. |
| `worker/backoff.ts` | first eligibility from `lastPolledAt + pollIntervalSeconds*1000`; success resets `consecutiveFailures`; transient bumps; 5+ failures hit the 1h cap (5m × 2⁵ = 160m → cap 60m); injected clock. |

### Integration

| Module | Cases |
|---|---|
| `worker/processAccount.ts` | in-memory SQLite + mocked imapflow + mocked `LlmClient`. (1) `kind:'spend'` → row inserted, UID marked, recurring computed; (2) `kind:'workout'` → no row, UID marked; (3) `UpstreamError` from `parseEntry` → no row, UID NOT marked, failure counted; (4) `ZodError` from `parseEntry` → no row, UID marked; (5) auth failure on connect → `status='error'`; (6) decrypt failure → `status='error'`, no IMAP connect attempted. |
| `routes/parse.ts` | shrinks to a thin HTTP-wiring smoke test (request/response shape, auth middleware, rate limit). Deep coverage moves to `lib/parse.ts`. |
| `lib/seedImapAccount.ts` | mocked IMAP `connect`/`logout` + in-memory DB. (1) happy path → row inserted, ciphertext decrypts back to original; (2) IMAP rejects creds → no row written; (3) duplicate email → throws, no row written. |

Targeting ~35–40 new tests on top of 5a's 25.

### Live smoke test on the droplet

Conditions in §1 above. Closing condition for 5b: all listed conditions pass; rows present in `synced_entries`; tick #2 shows zero duplicates and `consecutiveFailures=0`.

**Negative smoke test (recommended):** seed a wrong password (after `DELETE FROM imap_accounts WHERE email_address = ?` since the seeder rejects duplicates), watch the worker hit `IMAP NO LOGIN`, observe `status='error'` and `lastError` populated. Proves the auth-failure permanent path works end-to-end.

iPhone visual smoke does not apply (no iOS surface in this slice).

---

## 6. Deploy

**One-time droplet config (you do this once before the first 5b deploy):**

```sh
# On the droplet, generate the encryption key:
KEY_HEX=$(openssl rand -hex 32)
echo "PULSE_IMAP_ENCRYPTION_KEY=$KEY_HEX" >> /opt/pulse/.env

# Verify (should show one line):
grep PULSE_IMAP_ENCRYPTION_KEY /opt/pulse/.env
```

Backup `/opt/pulse/.env` somewhere safe (password manager). Losing this key means every stored IMAP credential becomes unrecoverable — you'd have to delete the affected `imap_accounts` rows and re-seed.

**Deploy flow** (no manual steps after the env var is set):

1. `git push origin main` triggers `deploy-backend.yml`.
2. GH Action: test → build image → push to GHCR (tagged `:<sha>` and `:latest`) → SSH droplet → `docker compose pull` → `docker compose run --rm migrator` (no-op for 5b — no new migrations) → `docker compose up -d backend` → `docker compose up -d worker`.
3. `worker` container starts. `loadWorkerConfig()` validates `PULSE_IMAP_ENCRYPTION_KEY`. Missing/malformed key → container exits non-zero, compose flags it as `restarting`, `docker compose logs worker` shows the validation error. Fix env, push again.
4. Once worker is `running`, no `imap_accounts` rows exist yet → first tick is a no-op; logs show `tick: 0 active accounts`.
5. Run the seeder (§1 step 4). Within ≤60s the next tick finds the new account and starts polling.

**Rollback:** `docker compose stop worker` on the droplet halts polling without affecting `backend`. The previous SP5a-only state is one `git revert` + redeploy away — `worker` is additive; reverting just removes the service from the compose file.

---

## 7. Scope cuts and deferrals

**Out of scope (closed by deferral or by parent meta-spec cuts):**

| Item | Where it lands |
|---|---|
| `POST /imap/connect`, `GET /sync/entries`, `DELETE /imap/disconnect`, JWT scope `"sync"` | 5c |
| iOS Email Sync screens, Subscriptions screen | 5d |
| Allowlist edit UI | 5d (Connect screen). For 5b, allowlist edits happen via `sqlite3 /opt/pulse/data/pulse.db`. |
| OAuth for Gmail | Cut by meta-spec §6 |
| Per-bank regex extractors | Cut by meta-spec §6 (LLM via `/parse` only) |
| Multi-inbox per user | Schema permits multiple `imap_accounts` rows; seeder rejects duplicate `email_address` (one inbox per Pulse install) |
| `expo-notifications` / push surface | Cut by meta-spec §2 row 10 |
| IMAP IDLE long-poll | Out — `setInterval` is sufficient at 5-min cadence and avoids stuck-IDLE failure modes |
| IMAP connection pooling | Out — connect-per-tick keeps state local |
| Per-UID retry counter (bounded retries on bad emails) | Cut by decision §2 row 8 — mark UID seen on any non-network parse return |
| Encryption key rotation | Out — would require re-encrypting all stored creds; not worth it at one account |
| Worker `/health` HTTP probe | Out — `docker compose ps` + `docker compose logs` cover it |
| Metrics / Prometheus | Out — pino logs are sufficient |
| Worker SIGHUP config reload | Out — restart the container (~2s) |

**Deliberately *not* closed in this spec, because 5b doesn't need them:**

- iOS sync-trigger model (foreground-only, foreground+pull-to-refresh) — 5c's call.
- Once-per-day dismissal storage for Close-Out — 5f's call.
- Streak surface placement (Today vs Rituals tab vs both) — 5f's call.
- Weekly Review aggregate window (Sun→Sat vs Mon→Sun) — 5g's call.

**Explicitly closed open items from the parent meta-spec §7:**

| Meta-spec open item | Closed by |
|---|---|
| Sender allowlist seed | Runtime input via `--allowlist` to the seeder; no domains hardcoded in code. Edits post-seed via `UPDATE imap_accounts SET sender_allowlist = ?`; propagate within ≤60s (next tick re-reads). |
| Polling cadence | Per-account `pollIntervalSeconds`, default 300s (already locked by 5a's column default). |
| Encryption key source | Decision §2 row 1: separate env var `PULSE_IMAP_ENCRYPTION_KEY`. |
| Recurring heuristic | Decision §2 row 5: same merchant + same currency + ±10% + ≥1 prior in 60-day window. |
| `/parse` hint field | Decision §2 row 7: always `hint: 'spend'`. |

---

## 8. What this spec is NOT

- Not a product spec for any iOS surface. 5b has no UI.
- Not the HTTP surface for IMAP CRUD — that's 5c.
- Not an implementation plan. The next step is invoking `superpowers:writing-plans` to produce the plan for 5b.
- Not a schedule. Pace is unknown.

---

## 9. Open items requiring user input before 5b's plan starts

These are 5b-plan-level details, not blockers for *this* spec.

- **Generating `PULSE_IMAP_ENCRYPTION_KEY`** — recommended `openssl rand -hex 32` on the droplet (so the key never lands on a Windows clipboard). Confirm in 5b's plan or in §6 above as written.
- **Initial sender allowlist** — which bank domains do you want to seed? Examples to pick from: `notify@chase.com`, `alerts@discover.com`, `noreply@capitalone.com`, `online.banking@bofalerts.com`, `service@paypal.com`. You'll provide these at seed-time via `--allowlist`; no decision needed in the plan.
- **Smoke-test ownership** — confirmed during brainstorming: I write the seeder, you run it on the droplet (the Gmail app password never enters my session). 5b's plan reflects this in the verification step.
