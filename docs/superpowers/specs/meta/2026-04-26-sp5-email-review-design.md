# Pulse — iOS v3 (Email + Reviews) Meta-Spec

**Date:** 2026-04-26
**Status:** Draft, pending user review
**Parent:** [`./2026-04-25-implementation-process-design.md`](./2026-04-25-implementation-process-design.md) §3 row 5
**Scope:** Defines the decomposition of sub-project 5 (Backend v2 + iOS v3 — email + review) into child sub-projects. This is a *map*, not a product spec. Each child below gets its own spec → plan → execute → review cycle.

---

## 1. What SP5 ships

End-to-end **Gmail-driven spending capture**: connect a Gmail app password → backend `pulse-worker` polls IMAP → bank-alert emails are deduped (IMAP UID + content) → parsed via the existing `/parse` endpoint → written to a backend `synced_entries` table → iOS pulls them on foreground / pull-to-refresh and writes them into the local `spending_entries` table.

Plus the full **Rituals + Reviews + Celebrations** product surface that's been deferred since SP3a:

- **Rituals tab** lands (removes the `<StubTab title="Rituals" comingIn="SP5" />` placeholder), with a **Rituals Builder** for adding/editing/reordering rituals.
- **Streak surface** (Today, Rituals tab, or both — picked in 5f) verifies the existing `streakForRitual` math live.
- **Streak Celebration** modal fires on app foreground when the user's longest streak ticks up.
- **Evening Close-Out** sheet auto-presents on Today after a local-time threshold when the ritual ring isn't closed.
- **Weekly Review** + **Monthly Review** screens consume `POST /review` with a new `period` field.
- **Subscriptions** screen lists merchants tagged `recurring=true` by the email parser.

Design handoff sources:

- `design_handoff/src/email-sync.jsx` — Empty / Connect / Dashboard
- `design_handoff/src/new-screens.jsx` — WeeklyReview / Subscriptions / StreakCelebration / EveningCloseOut
- `design_handoff/src/ai-screens.jsx` — MonthlyReview, RitualsBuilder
- `design_handoff/src/tab-landings.jsx` — Rituals tab landing

---

## 2. Locked decisions

These are settled inputs to the child specs and **not** open for relitigation in those specs.

| Decision | Choice | Reason |
|---|---|---|
| Verification posture | Each slice closes when its backend code is **live and exercised** (worker running on DO; HTTP routes hit by curl). iOS visual smoke deferred to a single end-of-SP5 pass. | Mirrors SP4 §7 carryover; the email pipeline is the high-risk surface and it can be exercised from Windows without an iPhone. |
| Polling location | **Server-side.** `pulse-worker` runs on DO, holds encrypted IMAP credentials, polls IMAP on a `setInterval` cadence. iOS is a pure consumer of `synced_entries`. | "Background sync" is the actual product value; iOS-keychain-only would force foreground-only sync, killing the value prop. |
| Credential storage | Encrypted at rest in backend SQLite. Per-account IV; AES-GCM via Node `crypto` or libsodium (exact primitive picked in 5b's spec). Keys never logged. | The marketing copy in `email-sync.jsx:91` ("encrypted in the iOS keychain") is amended in 5d to read "encrypted at rest." |
| Provider scope | **Gmail only** for SP5. Hardcode `imap.gmail.com:993`. App-password input only — no OAuth. | One-user app; the secondary CTA "iCloud, Outlook, any IMAP coming" is a deferral, not a v3 promise. |
| Receipt parser | LLM via existing `POST /parse`. Sender allowlist + IMAP-UID dedupe gate `/parse` calls so cost is ~½¢ × *novel* emails only. | Reuses SP2's pipeline; per-bank regex extractors are cut as YAGNI for a single user with 1–3 banks. |
| Sync model | Backend writes `synced_entries` rows; iOS pulls via `GET /sync/entries?since=<cursor>`, inserts into local `spending_entries`, persists cursor. Server-side rows retained as the canonical record (not pruned after ack). | Idempotent cursors give clean replay/recovery. |
| Backend datastore | **SQLite on the droplet.** Drizzle + `better-sqlite3`. Schema lives in `backend/src/db/`. Daily file-copy backup. | Single-user volume; matches parent meta-spec §6 YAGNI posture. |
| Process model | **Two compose services** on a shared bind-mounted volume: `backend` (HTTP) and `worker` (poller, added in 5b). Both run as the `pulse-backend` OS user (UID 1500) inside the container. Same SQLite file (worker is the only writer of `synced_entries`). One `pulse-stack.service` systemd unit on the droplet brings up the compose stack at boot. (Updated in SP5a.) | Crash isolation; cleanly bounded compose services; one OS user keeps file ownership simple at one-user scale. |
| Scope | Full design handoff for v3. | Maximalist read of the parent meta-spec's "iOS v3" line. |
| Triggers | All Reviews / Celebrations / Close-Out triggers are **app-foreground checks** comparing local DB state to last-seen value. **No `expo-notifications`, no permission prompts, no push.** | Notifications are a separate product surface; bundling them inflates SP5 ~2×. |

---

## 3. Decomposition

Seven child sub-projects. Order is dependency-driven; each from 5b onward consumes earlier slices.

| # | Slice | Surface | TDD applies to | Smoke test |
|---|---|---|---|---|
| **5a** | **Backend data store** | New `backend/src/db/` (Drizzle + `better-sqlite3`): tables `imap_accounts`, `synced_entries`, `imap_uids`. Schema, migration bundle, query modules. No worker, no new HTTP routes that read these tables yet. | Schema integrity tests, query-shape tests, migration applies cleanly to a fresh file. | `npm test` green in `backend/`; running the migration script against `:memory:` creates all tables; queries return expected shapes from a Node test runner. |
| **5b** | **`pulse-worker` service** | New entrypoint `backend/src/worker/index.ts` driven by `setInterval`. IMAP client (`imapflow` or `node-imap`), sender allowlist (per-account list of bank domains), UID-based dedupe against `imap_uids`, content-hash dedupe within UID, hand-off to existing `/parse` (internal call, not over HTTP), write `synced_entries` rows including a `recurring` flag derived from prior history. New `pulse-worker.service` systemd unit + matching `deploy-backend.yml` change. **Also ships the credential-encryption primitive** (Node `crypto` AES-GCM or libsodium — picked in 5b's spec) **and a one-off `scripts/seed-imap-account.ts` admin seeder** so the worker can be smoke-tested before 5c's HTTP route exists. | Receipt-parse hand-off contract, UID dedupe, content dedupe, sender-allowlist filtering, recurring-detection heuristic, parse-failure backoff, encrypt/decrypt round-trip. | Seed your Gmail app password via the admin script; worker connects, pulls a recent week, logs show dedupe; new rows appear in `synced_entries` via `sqlite3` CLI on the droplet. |
| **5c** | **HTTP sync routes + iOS sync client** | Backend: `POST /imap/connect` (validates creds against IMAP, encrypts, persists), `GET /sync/entries?since=<cursor>`, `DELETE /imap/disconnect`. New JWT scope `"sync"`. iOS: `lib/sync/` module, cursor persistence in local SQLite (new `sync_cursor` table or AsyncStorage — picked in spec), inserts into local `spending_entries` via existing query module. | Cursor advancement, idempotent re-pull, conflict handling, `/imap/connect` validation, scope-auth on the new routes. | From web target: `connect` accepts your Gmail app password and stores; subsequent `GET /sync/entries` returns the rows the worker has produced; rows appear in local SQLite via the dev seed log; second pull with same cursor returns empty. |
| **5d** | **iOS Email Sync flow + Subscriptions** | Three screens wired to the sync client: **Intro** (`email-sync.jsx` `EmailSyncEmptyScreen`), **Connect** (`EmailSyncConnectScreen`, with copy amended per §2 row 3), **Dashboard** (synced-dashboard). **Subscriptions** screen (`new-screens.jsx` `SubscriptionsScreen`) filters local entries flagged `recurring=true`. Settings entry point. | None (UI; visual verification on web + iPhone smoke deferred). | Open Email Sync from Settings → enter creds → Dashboard populates → Subscriptions lists recurring merchants. |
| **5e** | **Rituals tab + Builder** | `app/(tabs)/rituals.tsx` replaces stub with the landing from `tab-landings.jsx`. New `app/(tabs)/rituals/builder.tsx` (`ai-screens.jsx` `RitualsBuilderScreen`). Reads existing `rituals` + `ritual_entries` via `useLiveQuery`. Add/edit/reorder/active-toggle persists via new query module. | Reorder semantics (position math, gap-handling), active-toggle behavior, validation. | Tab opens with rituals from seed; tap rituals to log entries → counts update live; Builder adds, renames, reorders, toggles active; survives reload. |
| **5f** | **Streak surface + Celebration + Evening Close-Out** | Streak section on Today (or Rituals tab — picked in spec) surfaces `streakForRitual` via `useLiveQuery`. **Streak Celebration** modal (`new-screens.jsx` `StreakCelebrationScreen`) fires on app-foreground when current streak > stored high-water-mark; storage is a new local-iOS surface (`last_seen_streaks` table or AsyncStorage — picked in spec). **Evening Close-Out** sheet (`EveningCloseOutScreen`) presents when local time ≥ threshold (default 21:00) and today's ritual count < goal; dismissal persistence storage same choice. | High-water-mark comparison, threshold-time check (DST-safe), once-per-day dismissal persistence, ring-incomplete predicate. | Force-set high-water-mark below current streak → foreground app → celebration appears once. Force-set system clock to 22:00 with rituals incomplete → foreground → close-out sheet. |
| **5g** | **Weekly + Monthly Review** | `app/reviews/weekly.tsx` + `app/reviews/monthly.tsx`. New aggregate computation modules in `lib/db/queries/` (weekly + monthly stat assembly: ritual-day correlation, top categories, move totals). Backend `/review` schema extended with `period: 'weekly' \| 'monthly'`; prompt builder branched. iOS posts aggregates, renders returned markdown. | Weekly/monthly aggregate math, prompt branch on `period`, response schema. | Open Weekly Review → aggregates render from local data → tap "Generate" → backend round-trip → markdown renders. Same for Monthly. |

### Why this order

- **5a first.** Same reasoning as SP4's 4a: schema + query tests against zero downstream consumers means the data layer is right before any worker or route reads from it.
- **5b second.** Highest-novelty piece (IMAP + credential encryption + parse hand-off) on a thin shell. Mirrors SP4's 4b — surface toolchain risk early. Verification is a real Gmail polling against a real droplet, no iOS in the loop.
- **5c before 5d.** Same pattern as SP4's 4c→4d: prove the contract before the UI consumes it.
- **5d closes the email chain.** iOS Email Sync is "render JSON" once 5c's contract works.
- **5e–5g** run on the rituals/reviews track. Independent of 5a–5d (no shared backend changes); ordered by lift: Builder is the heaviest *new* surface, then event-driven foreground triggers, then the lowest-novelty Reviews.
- **5g last.** Reviews depend on no other slice and have the lowest novelty — safest to slip if SP5 runs long.

### Sub-slice status

- **5a** ✅ Code complete 2026-04-27 — three new tables (`imap_accounts`, `synced_entries`, `imap_uids`) via Drizzle + `better-sqlite3`; query modules + cascade tests; multi-stage Dockerfile (`node:22-slim`, `USER 1500`); compose stack at `/opt/pulse/` with `migrator` + `backend` services; daily `sqlite3 .backup` via systemd timer; GH Action rebuilt for GHCR + Docker. Cutover from `/srv/pulse-backend` rsync deploy to `/opt/pulse/` Docker deploy executed live. Parent meta-spec §6 amended; this spec's §2 row 8 + §4 row 3 amended. `npm test` green (102 SP2 + 25 SP5a tests).
- **5b** Code complete 2026-04-27 (Tasks 1–13 of [`../../plans/2026-04-27-sp5b-pulse-worker-plan.md`](../../plans/2026-04-27-sp5b-pulse-worker-plan.md)) — AES-256-GCM credential encryption module, mailparser-based plaintext extraction, recurring-detection heuristic (±10%, prior-anchored), per-account exponential backoff state machine, in-process `parseEntry()` lib refactor (route is now a thin wrapper), HTTP/worker config split with `PULSE_IMAP_ENCRYPTION_KEY` validation, IMAP poll wrapper (UID-range search + 50-UID cap + sender allowlist filter), per-account orchestrator with transaction-wrapped insert + UID dedupe, seeder lib + admin CLI (hidden-stdin password prompt), worker entrypoint with `runTick()` loop and graceful SIGTERM, and `worker` compose service + GH Action `Up worker` step. `npm test` green (183 total: 127 SP2/SP5a + 56 new SP5b). One plan deviation noted: `isRecurring` tolerance anchored to each prior (not candidate) so the test's "+11% returns false" passes. **Tasks 14 (set `PULSE_IMAP_ENCRYPTION_KEY` in `/opt/pulse/.env`) + 15 (live droplet smoke test) are user-run and pending — slice closes once those land.**
- **5c** Code complete 2026-04-27 (Tasks 1–21 of [`../../plans/2026-04-27-sp5c-http-sync-routes-plan.md`](../../plans/2026-04-27-sp5c-http-sync-routes-plan.md)) — new `"sync"` JWT scope; backend migration `0001_rich_callisto.sql` relaxes `synced_entries.account_id` FK to `SET NULL` (preserves history on disconnect); `realImapValidator` extracted to `backend/src/lib/imap/`; `getActiveAccount` + `deleteImapAccount` query helpers; `AppDeps` threaded with `db`/`encryptionKey`/`imapValidator`; `HttpError` + four new error codes (`invalid_request`, `imap_auth_failed`, `already_connected`, `server_misconfig`) wired into `errorHandler`; four routes mounted under `"sync"` scope (`POST /imap/connect`, `GET /imap/status`, `DELETE /imap/disconnect`, `GET /sync/entries` with cursor pagination via the `+1` trick). iOS migration `0004_icy_sage.sql` adds `merchant`/`currency`/`recurring`/`synced_entry_id` columns + partial unique index on `spending_entries`, plus single-row `sync_cursor` table with `CHECK (id = 1)`. New `lib/sync/` module: `client.ts` (4 fetch wrappers, mapped error taxonomy), `syncNow.ts` orchestrator (re-entrance guard via module-level promise; account-id mismatch resets cursor; paginates until `hasMore=false`; bails on mid-loop account swap). `app/_layout.tsx` triggers `syncNow` on initial mount + every `AppState` `'active'` transition; `app/(tabs)/today/spending.tsx` gains `RefreshControl` for manual-sync. `npm test` green (backend 205 / iOS 331 — 44 new tests vs. plan's ~28 estimate; backend `npx tsc --noEmit` clean). One plan deviation noted: drizzle-kit assigned migration `0001_*` (the SP5b baseline only had `0000_*`), not `0002_*` as the plan called it; content matches the plan's intent. **Task 22 (push, regen JWT with `sync` scope on droplet, end-to-end live smoke against real Gmail, then re-edit this status line) is user-run and pending — slice closes once that lands.**
- **5d** ✅ Code complete 2026-04-27 — You-tab settings hub (`app/(tabs)/you/index.tsx`) with sectioned-list landing replaces the SP3b stub; functional Email-sync + Subscriptions rows, 8 disabled scaffolding rows. Three Email Sync screens (Intro, Connect, Dashboard) + AllowlistScreen + SubscriptionsScreen wired to existing SP5c `lib/sync/` client. New: `lib/db/queries/syncedEntries.ts` (`recentSynced` / `syncedStats` / `subscriptionList`), `lib/sync/useImapStatus.ts` (mount + AppState foreground + on-demand), `lib/sync/useRelativeTime.ts`, `lib/sync/categoryColor.ts`. No backend changes; no schema delta. ~16 new query tests on top of SP5c's suite. Live end-to-end smoke + iPhone Expo Go visual verification carry over to the SP5-wide deferred pass — gated on SP5b/SP5c live deploy tasks. Manual web smoke green.
- **5e** Not started.
- **5f** Not started.
- **5g** Not started.

---

## 4. Cross-cutting dependencies

| Dependency | Where consumed | Status |
|---|---|---|
| Backend `/parse` endpoint | 5b only (worker calls in-process; not over HTTP) | Deployed in SP2; live deploy still gated on `OPENROUTER_API_KEY` per parent §8a row 2. **5b is blocked on a live `/parse` deploy.** 5a / 5e / 5f / 5g are not blocked. |
| Backend `/review` endpoint | 5g — needs `period: 'weekly' \| 'monthly'` extension and a branched prompt builder | Deployed in SP2; same `OPENROUTER_API_KEY` gate as `/parse`. |
| DO droplet, root access | 5a (initial SQLite + Drizzle install + Docker cutover), 5b (new compose service) | Already provisioned (`root@178.128.81.14`). 5a's plan stands up `/opt/pulse/`, the `pulse-backend` user (UID 1500), and the Docker-based deploy; 5b's plan adds the `worker` compose service alongside `backend`. |
| `deploy-backend.yml` GH Action | Extended in 5a (rsync `db/` artifacts, run migrations) and 5b (start/restart `pulse-worker.service`) | Wired in SP2. |
| Drizzle on backend (new) | 5a sets it up; 5b/5c consume | New stack addition. Same Drizzle SDK as iOS, different driver (`better-sqlite3` instead of `expo-sqlite`). |
| Credential encryption primitive (Node `crypto` AES-GCM, or libsodium via `sodium-native`) | **Established in 5b** (worker reads, decrypts to poll IMAP); **reused by 5c**'s `POST /imap/connect` (writes, encrypts after IMAP-validation) | Picked in 5b's spec. Key derivation from a backend env secret + per-account salt; key never logged, never returned via any HTTP route. |
| IMAP library choice (`imapflow` vs. `node-imap` vs. `emailjs-imap-client`) | 5b only | Picked in 5b's spec. `imapflow` is the modern default; `node-imap` is older but battle-tested. |
| JWT scopes | 5c adds `"sync"` (used by `/imap/*`, `/sync/*`); 5g extends `"review"` (already exists) to cover the new `period` field | Existing JWT helper covers it. |
| Existing local schema (`rituals`, `ritual_entries`, `goals`) | 5e (read+write entries), 5f (compute streaks via `streakForRitual`) | Built in SP3a; no schema delta needed. |
| Existing `streakForRitual` math | 5f only | TDD'd in SP3a; verifying live in 5f satisfies the parent meta-spec's "Rituals streak logic verified" line. |
| `useLiveQuery` (Drizzle hook on iOS) | 5d (Email Sync Dashboard counts), 5e (Rituals tab + Builder), 5f (streak surface), 5g (Review aggregates) | In use since SP3a. |
| `expo-notifications` | None — explicitly cut per §2 row 10 | Not added in SP5. |

---

## 5. Verification posture for SP5

The parent meta-spec's "C" cadence (build whole sub-project, then verify) applies to **each child**, not to SP5 as a whole. Each of 5a–5g has its own smoke test (§3). Carry-over rules:

- **Backend slices (5a, 5b, 5c)** close on **live verification on the DO droplet**: tests green on Windows + the systemd unit running + the smoke test exercised over the wire (curl from Windows for HTTP, `sqlite3` CLI on the droplet for worker-written rows).
- **iOS slices (5d, 5e, 5f, 5g)** close on **typecheck clean + unit tests green + web target sanity-check** where the surface is web-renderable. iPhone Expo Go / dev-client visual verification is **deferred to a single end-of-SP5 pass**, consistent with SP4.
- **No new dev-client native modules** in SP5 (no `expo-notifications`, no new HealthKit work). Expo Go is sufficient for iOS smoke wherever the user wants to run it mid-flight; the existing dev client built in SP4 still satisfies any remaining native-module needs.
- **Backend live deploys** for 5b, 5c, and 5g require `OPENROUTER_API_KEY` set on the droplet. 5a, 5d, 5e, 5f have **no backend gate** beyond the existing JWT secret.

SP5 closes when 5a–5g all pass their smoke tests and the deferred iPhone visual pass is done (carrying over the same SP4-era backlog of "all deferred iPhone smoke" into one combined session, at the user's discretion).

---

## 6. Scope cuts

Explicitly cut from SP5, even though plausible:

| Item | Reason |
|---|---|
| OAuth (Google / Apple sign-in) | App-password / IMAP only. OAuth doubles backend complexity (token refresh, Google API quotas, OAuth client registration) for zero added value at one user. |
| iCloud, Outlook, generic IMAP UI | Gmail-only per §2 row 4. Secondary CTA in `email-sync.jsx` becomes a coming-soon affordance. |
| Per-bank regex extractors | LLM via `/parse` per §2 row 5. With 1–3 banks, hand-rolled regex is YAGNI. |
| Postgres / managed DB | SQLite-on-droplet per §2 row 7. Single-user volume. |
| Server-side pruning of synced rows after ack | Rows retained as the canonical record; storage cost is trivial at single-user scale and replay is free. |
| Local notifications (`expo-notifications`) | Per §2 row 10. All triggers are app-foreground checks. Notifications are a separate product surface. |
| Background fetch / `BGAppRefreshTask` | iOS pulls only when foregrounded or pull-to-refresh'd. The DO worker is what makes sync feel "live." |
| iOS-side IMAP polling | Server-side polling per §2 row 2. Credentials never leave the backend after `/imap/connect`. |
| Multi-inbox / multi-account | One inbox per user. The `imap_accounts` table allows multiple rows but the iOS UI exposes a single connect flow. |
| Snooze / quiet-hours settings for Close-Out and Celebration | Defaults-only in SP5: 21:00 local for Close-Out, immediate for Celebration. Tunable in SP6 Polish if it's a real friction. |
| Editing rituals' icon/color picker beyond the seeded set | The Builder lets you edit name and active-state and reorder. Icon picker uses a fixed shortlist of `expo-symbols` names — no custom uploads. |
| Receipt re-categorization UI | Categories come from `/parse`; user can edit via the existing per-entry edit sheet shipped in 3b. No bulk re-categorize tool. |
| Recurring-detection UI tuning | The `recurring` flag is set heuristically by 5b; there's no "mark as recurring / not recurring" toggle in 5d. Add in SP6 if it's a real friction. |

---

## 7. Open items requiring user input before 5a starts

These are inputs to the child specs and are **not** blockers for *this* meta-spec.

- **Sender allowlist seed.** Which bank domains to seed for *your* inbox? E.g. `notify@chase.com`, `alerts@discover.com`, `noreply@capitalone.com`. Resolves in 5b's spec — likely a per-account `sender_allowlist` JSON column on `imap_accounts`, seeded by the Connect screen with sensible defaults plus an "add domain" affordance.
- **Polling cadence.** 5 minutes? 15? Configurable per-account? Resolves in 5b's spec. Default proposal: 5-min `setInterval`, with exponential backoff on IMAP connect failures.
- **Encryption key source.** A new env var (`PULSE_IMAP_ENCRYPTION_KEY`) on the droplet, or derive from the existing JWT secret? Resolves in 5b's spec. Recommendation: separate env var so JWT-secret rotation doesn't invalidate stored credentials.
- **Recurring-detection heuristic.** What counts as "recurring"? Tentative: same merchant string + amount within ±10% with ≥2 occurrences in the prior 60 days. Resolves in 5b's spec.
- **iOS sync trigger model.** Foreground-only? Foreground + pull-to-refresh? Foreground + while-app-is-open `setInterval`? Resolves in 5c's spec. Default proposal: foreground + pull-to-refresh.
- **Streak surface placement.** Today (more visible) or Rituals tab (more focused) or both? Resolves in 5f's spec.
- **Once-per-day dismissal storage.** Local DB table (`dismissed_close_outs(date_key)`) or AsyncStorage? Resolves in 5f's spec.
- **Weekly Review aggregate window.** Sun→Sat or Mon→Sun? Resolves in 5g's spec. Default proposal: Mon→Sun (ISO week).
- **`/parse` hint field.** Does the worker call `/parse` with a `kind: 'spending'` hint, or rely on auto-detection? Resolves in 5b's spec — recommend explicit hint to keep parser branches simple.

---

## 8. What this spec is NOT

- Not a product spec for any of 5a–5g. Each child gets its own spec.
- Not an implementation plan. The next step is invoking `superpowers:writing-plans` to produce **the plan for 5a** (backend data store). Each subsequent child gets its own spec → plan cycle.
- Not a schedule. Pace is unknown.
- Not a redesign of existing surfaces. Today, the entry sheet, Pal Composer, Spending Detail, and the Move tab from SP3a/3b/4 are unchanged in SP5.
- Not a CloudKit or multi-device sync feature. SP5 introduces server-side state for the email pipeline only; spending entries still write to local SQLite as their primary store on iOS.
