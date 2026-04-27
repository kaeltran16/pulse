# SP5d — iOS Email Sync UI + Subscriptions Design

**Date:** 2026-04-27
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) (SP5 meta-spec, slice 5d)
**Builds on:** [`./2026-04-27-sp5c-http-sync-routes-design.md`](./2026-04-27-sp5c-http-sync-routes-design.md) (HTTP routes 5d consumes), [`./2026-04-27-sp5b-pulse-worker-design.md`](./2026-04-27-sp5b-pulse-worker-design.md) (worker that produces the rows 5d displays)
**Scope:** Stand up the iOS surface that closes the email-sync chain. Replaces the `You` tab stub with a sectioned Settings landing. Ships three Email Sync screens (Intro, Connect, Dashboard), an Allowlist screen, and a Subscriptions screen. Adds one new query module (`lib/db/queries/syncedEntries.ts`) and one new hook (`lib/sync/useImapStatus.ts`). **No backend changes.** All four iOS client methods (`imapConnect`, `imapStatus`, `imapDisconnect`, `fetchSyncEntries`) and the `syncNow()` orchestrator already exist from SP5c — 5d only adds UI on top.

---

## 1. What 5d ships

- **You tab as Settings hub.** `app/(tabs)/you.tsx` (currently `<StubTab>`) becomes a sectioned list landing matching `design_handoff/src/tab-landings.jsx:458–490`. Two rows are functional in 5d: **Email sync** (status pill + tap routing) and **Subscriptions**. Other handoff rows (Reviews, Bills, All stats, Export, Notifications, Settings sub-row, Help) are rendered with their handoff icons + greyed `value="Coming soon"` and `disabled` press handlers — visible scaffolding for SP5e/g/SP6 to fill in.
- **Three Email Sync screens** under `app/(tabs)/you/email-sync/`:
  - **Intro** — `email-sync.jsx:5–115` verbatim, with copy amendment per meta-spec §2 row 3 ("encrypted in the iOS keychain" → **"encrypted at rest on our server"** at `:91`).
  - **Connect** — adapted from `email-sync.jsx:117–254`. Single "Save" button (no separate "Test connection" intermediate). Inline red banner above the form maps backend error codes to user-facing copy. The "Advanced IMAP server" disclosure (`:215–251`) is rendered as **read-only** (host `imap.gmail.com`, port `993`, encryption SSL/TLS) — the handoff's editable fields are dropped because the SP5b worker hardcodes Gmail per parent meta-spec §2 row 4.
  - **Dashboard** — adapted from `email-sync.jsx:257–505`. Sync card + stats tiles + Pal-noticed card + Recently synced list + Sync settings list + Disconnect button. Four data states: connected-with-entries / connected-empty / error-or-paused / disconnected (auto-bounces to Intro).
- **Allowlist screen** under `email-sync/senders.tsx`. Read-only list pulled from `imapStatus().senderAllowlist`. Footer: "To edit, disconnect and reconnect with a different list." Reachable only from the Dashboard's "Detected senders" row.
- **Subscriptions screen** at `app/(tabs)/you/subscriptions.tsx`, from `design_handoff/src/new-screens.jsx:188–326`. Monthly total card + stacked-bar by category + sorted-by-next-charge upcoming list. Pure local-data screen; queries `spending_entries` where `recurring=1`. Empty state when no recurring merchants yet.
- **One new query module** `lib/db/queries/syncedEntries.ts` exposing `recentSynced(db, limit)`, `syncedStats(db)` (returns `{ thisMonth, allTime, recurringMerchants }`), and `subscriptionList(db)` (returns merchants grouped with `predictedNextChargeAt` + `monthlyAmountCents`).
- **One new hook** `lib/sync/useImapStatus.ts` — fetches `/imap/status` on mount, on `AppState 'active'` transitions, and after `syncNow()` resolves; exposes `{ status, isLoading, error, refetch }`. The "N min ago" relative-time string uses a separate `useRelativeTime(timestamp)` hook driven by a 60s `setInterval` (no network).
- **No new backend routes. No new shared deps. No schema changes.** All iOS work; the `spending_entries` columns added in SP5c (`merchant`, `currency`, `recurring`, `synced_entry_id`) are exactly the columns 5d's queries read.
- **Test coverage** (~10 new tests): unit tests for the new query module. Hook + screen tests deferred per parent meta-spec §3 ("TDD applies to: None"). Existing `lib/sync/__tests__/syncNow.test.ts` (SP5c) is unchanged.

**Smoke test (5d's slice-close criteria):**

1. `npm test` green (existing 331 + ~10 new = ~341 iOS tests).
2. `npx tsc --noEmit` clean.
3. **Web target sanity check** (Windows browser): You tab → sectioned list, Email sync row reads "Not connected"; tap → Intro; tap "Set up Gmail sync" → Connect; tap You-tab Subscriptions row → empty placeholder; Allowlist screen reachable when status is connected.

iPhone Expo Go visual smoke + live end-to-end smoke (which requires SP5b/SP5c live-deploy tasks, currently pending) carry over to the SP5-wide deferred pass per parent meta-spec §5.

---

## 2. Locked decisions (resolved during brainstorming)

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Settings entry point | **Replace `You` tab stub with the handoff's sectioned list landing.** Two rows are functional in 5d (Email sync, Subscriptions); the rest are visible-but-disabled scaffolding. | Matches the handoff's mental model (`tab-landings.jsx:474–477` puts Email sync under "Integrations"). Gets the You tab off its SP3b deferral. Disabled rows signal future work without committing UI to an empty navigation tree. |
| 2 | "Sync now" button semantics | **Calls existing `syncNow()`.** Generic spinner + final "Synced N new entr{y\|ies}" or "Up to date." No backend poke endpoint, no progress-phase strings. | The handoff's IMAP-internal phase strings ("Connecting to imap.gmail.com…", "Filtering by sender · 62 matches") are aspirational — they live inside the worker process. Streaming them to iOS is a meaningful infra surface, not a 5d slice. The actual product value (fresh rows show up) is delivered by the worker's own `setInterval` plus `syncNow()` on foreground; the button is a manual nudge that pulls already-indexed rows from the backend cache. |
| 3 | Subscriptions "next charge" + "$/mo" model | **Simple heuristics.** Group by `merchant` where `recurring=1`. `predictedNextChargeAt = lastSeenAt + 30 days`. `monthlyAmountCents = lastCents` (most recent occurrence). Sort upcoming list by `predictedNextChargeAt` ASC. | Consistent with how SP5b detects recurring (≥2 occurrences within ±10% in 60 days — implies near-monthly cadence). Wrong "in 32 days" labels for annual subs are small, self-correcting errors. Cadence-from-data (median of past gaps) is fragile at 2–3 data points; revisit in SP6 polish if the predictions feel wrong. |
| 4 | Connect screen flow | **Single "Save" button.** No "Test connection" intermediate. On `imap_auth_failed`, show inline red banner ("Wrong app password — Gmail rejected it") with a `Linking.openURL` to `myaccount.google.com/apppasswords`. | Matching the handoff's two-step Test/Save pattern needs a new `POST /imap/test` endpoint (validate-without-persist), which adds backend churn for marginal UX gain — IMAP login is ~1 second, so a Save-with-inline-error gives the same affordance. The hybrid "Test silently persists, Save is a no-op nav" is rejected as a footgun (Cancel-after-Test leaves a hidden persisted account). |
| 5 | Dashboard data states | **Four explicit states.** (1) connected-with-entries: full handoff dashboard. (2) connected-empty: "Connected · No receipts yet — most banks send within ~24h" + zero stats + soft empty list. (3) error/paused: red/amber banner above Sync card with single "Reconnect" CTA (no Retry — IMAP errors require credential intervention; iOS-side retry is a placebo). (4) disconnected: immediate `router.replace('intro')`; orphan `spending_entries` rows survive in Subscriptions per SP5c's SET NULL migration. | Handoff covers only the happy path; real life has the other three. Avoids a "Retry" button that does nothing useful (`syncNow()` only pulls cached rows; it can't fix bad credentials). |
| 6a | Sync settings list rows | **Render all four handoff rows; only "Detected senders" is interactive.** "Background sync · Every 5 min" is a read-only display value. "Notify on new detection · Off" stays as a non-functional row signaling future. "Pal auto-categorize · On" is read-only (parse pipeline runs unconditionally). "Detected senders · N" taps into Allowlist screen. | Matches handoff visually; trims to the one row that has real interactive content in our architecture. The other three communicate "this is what's happening" without claiming togglability the backend doesn't support. |
| 6b | Pal-noticed card on Dashboard | **Render dynamically.** Copy: "You have N recurring subscriptions totaling $X/mo." (Drops the "two haven't opened in 30+ days" line — we have no app-usage tracking.) CTA "Review subscriptions" → Subscriptions screen. **Hide entirely when N=0.** | Soft-signal accent that drives discovery of the Subscriptions screen. Data is one query away (`syncedStats().recurringMerchants` + sum of `subscriptionList().monthlyAmountCents`). Hiding when N=0 keeps the dashboard from feeling padded with empty content during the connected-empty state. |
| 6c | Disconnect button | **`Alert.alert("Disconnect Gmail?", "Synced receipts will stay on your device. You can reconnect anytime.", ["Cancel", "Disconnect" (destructive)])` before calling `imapDisconnect()`.** | Destructive actions warrant confirmation. Body copy reassures that local data survives (which it does, per SP5c's SET NULL migration). `Alert.alert` is already in use in SP4d's `DiscardConfirmModal` — no new dependency. |
| 7a | Profile header on You tab | **Drop entirely.** You tab opens straight into the sectioned list. | Pulse is a single-user app with no auth. The handoff's "Alex Chen, 92-day streak, Member since March" header was design-padding for a multi-user mental model we don't have. Dropping it sharpens the screen's purpose (it *is* the settings hub, not a profile). |
| 7b | Dashboard live-update strategy | **Fetch-on-events for server state.** `useImapStatus()` hook fires `/imap/status` on mount, on `AppState 'active'` transition, and after `syncNow()` resolves. Local data (stats tiles, Recently synced, Subscriptions) is reactive via `useLiveQuery` against `spending_entries`. Relative-time string ("4 min ago") via local 60s `setInterval` — no network. | Worker polls IMAP every 5 min server-side; polling `/imap/status` more often than that is wasted bandwidth. Mount + foreground + after-sync covers every meaningful state transition the user could observe. |
| 7c | Allowlist screen | **Read-only in 5d.** Lists current `senderAllowlist` from `imapStatus()`. Footer: "To edit, disconnect and reconnect with a different list." No backend route added. | The user-facing complaint that motivates editing the allowlist is "my bank's domain isn't in the seed list." Common bank domains (Chase, Discover, Capital One, Amex) are seeded in SP5b. Disconnect + reconnect with a custom allowlist is a 30-second workaround. A `PUT /imap/account/allowlist` route can land in SP6 polish if real friction surfaces. |
| 8 | Back-button copy | "Settings" labels in `email-sync.jsx:18`, `:296`, `:303` are renamed **"You"** to match the actual tab name. Subscriptions back button stays "Back" per `new-screens.jsx:213`. | The handoff's "Settings" was a placeholder name for a tab we didn't have. Now we have a `You` tab; the back-button copy should match what the user actually sees in the tab bar. |

---

## 3. Architecture

### 3.1 Route map

All under `app/(tabs)/you/`:

```
app/(tabs)/you/
  _layout.tsx              # Stack navigator (header hidden; per-screen NavBar)
  index.tsx                # YouTabLanding — sectioned list
  email-sync/
    _layout.tsx            # Nested stack
    intro.tsx              # EmailSyncIntroScreen
    connect.tsx            # EmailSyncConnectScreen
    dashboard.tsx          # EmailSyncDashboard
    senders.tsx            # AllowlistScreen
  subscriptions.tsx        # SubscriptionsScreen
```

The current `app/(tabs)/you.tsx` (a single-file `<StubTab>`) is removed in favor of the directory. `app/(tabs)/_layout.tsx` already declares the `you` route group; no tab-bar change needed.

### 3.2 Entry-point logic on the You-tab landing

The "Email sync" row's tap target depends on connection state, fetched once on mount via `useImapStatus()`:

- `connected: false` → `router.push('email-sync/intro')`
- `connected: true && status === 'active'` → `router.push('email-sync/dashboard')`
- `connected: true && status !== 'active'` → still routes to dashboard (which renders the error/paused banner per Q5)

The status pill on the You-tab Email-sync row mirrors:

| `imapStatus()` result | Pill text | Pill color (theme token) |
|---|---|---|
| `connected: false` | "Not connected" | `theme.ink3` (grey) |
| `connected: true, status: 'active'` | "Gmail · On" | `theme.move` (green) |
| `connected: true, status: 'paused'` | "Paused" | `theme.money` (amber/yellow) |
| `connected: true, status: 'error'` | "Error" | `#FF3B30` (red) |
| status fetch failed (network) | "—" | `theme.ink4` |
| status fetch in flight (initial mount, first ~200 ms) | "—" | `theme.ink4` |

While the initial fetch is in flight, the row is rendered with a faint spinner inside the pill and **tap is a no-op**. Once the fetch resolves (~100–500 ms on a healthy network), the row enables and routing is deterministic. If the fetch fails (network), the row stays at "—" and tap routes to Intro (where `imapConnect` will surface the network issue at form-submit time).

### 3.3 New library code

```
lib/sync/
  client.ts          # Existing (SP5c) — no change
  syncNow.ts         # Existing (SP5c) — no change
  errors.ts          # Existing (SP5c) — no change
  types.ts           # Existing (SP5c) — no change
  useImapStatus.ts   # NEW

lib/db/queries/
  syncedEntries.ts   # NEW
```

`lib/sync/useImapStatus.ts`:

```ts
export function useImapStatus(): {
  status: ImapStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

Implementation: single `useState` for the trio + a `useEffect` registering an `AppState` listener that calls `refetch()` on `'active'`. The `syncNow()` orchestrator does **not** call back into the hook directly; instead, screens that own both call sites (Dashboard) call `refetch()` after `syncNow()` resolves.

`lib/db/queries/syncedEntries.ts` query shapes are spelled out in §3.4.

### 3.4 Query shapes

```ts
// recentSynced(db, limit = 6) → SyncedRow[]
// SELECT * FROM spending_entries
// WHERE synced_entry_id IS NOT NULL
// ORDER BY occurred_at DESC LIMIT ?

// syncedStats(db) → { thisMonth: number; allTime: number; recurringMerchants: number }
// thisMonth        = COUNT(*) WHERE synced_entry_id IS NOT NULL
//                    AND occurred_at >= startOfMonthLocal(now)
// allTime          = COUNT(*) WHERE synced_entry_id IS NOT NULL
// recurringMerchants = COUNT(DISTINCT merchant) WHERE synced_entry_id IS NOT NULL
//                    AND recurring = 1 AND merchant IS NOT NULL

// subscriptionList(db) → SubscriptionGroup[]
// For each merchant where recurring = 1 and merchant IS NOT NULL:
//   { merchant, category, currency,
//     lastCents,             // cents of the most recent occurrence
//     lastSeenAt,            // max(occurred_at)
//     count,                 // count of synced rows for this merchant
//     monthlyAmountCents,    // = lastCents (Q3)
//     predictedNextChargeAt  // = lastSeenAt + 30 * 86_400_000 ms (Q3)
//   }
// ORDER BY predictedNextChargeAt ASC
```

Implementation note: `subscriptionList` uses a single SQL query with `GROUP BY merchant` and SQLite's `MAX(occurred_at)` + a correlated subquery (or a `JOIN` to itself on `(merchant, occurred_at)`) to pull `lastCents` from the most-recent row. Tests cover the grouping; SQL form is an implementation detail.

`startOfMonthLocal(now)`: a small helper that converts the current `Date` to "local-time midnight on the 1st of this month, expressed as ms since epoch." DST-safe via `Date` arithmetic in the iOS device's timezone.

### 3.5 Reactive surfaces

| Surface | Trigger | Source |
|---|---|---|
| Dashboard stats tiles | `useLiveQuery` on `spending_entries` | `syncedStats()` |
| Dashboard "Recently synced" list | `useLiveQuery` on `spending_entries` | `recentSynced(6)` |
| Dashboard Pal-noticed card | `useLiveQuery` on `spending_entries` | `syncedStats().recurringMerchants` + sum of `subscriptionList().monthlyAmountCents` (hidden when count=0) |
| Subscriptions screen | `useLiveQuery` on `spending_entries` | `subscriptionList()` |
| Dashboard Sync card status pill, "last sync N min ago", `senderAllowlist` count | `useImapStatus()` (mount + foreground + after-sync) | `/imap/status` HTTP fetch |
| Dashboard "Last sync 4 min ago" relative-time string | `useRelativeTime(lastPolledAt)` (60s `setInterval` re-render) | local clock |

`syncNow()` is called from:

1. `app/_layout.tsx` AppState listener (existing, SP5c) — triggers on app foreground, app-wide.
2. `app/(tabs)/today/spending.tsx` `RefreshControl onRefresh` (existing, SP5c).
3. `email-sync/dashboard.tsx` "Sync now" button (NEW, this slice). After resolution, calls `useImapStatus().refetch()` to update the Sync card.
4. `subscriptions.tsx` "Scan email again" footer button (NEW, this slice). Same pattern as #3 minus the status refetch (Subscriptions doesn't surface server state).

### 3.6 Subscriptions stacked-bar coloring

Each merchant segment in the stacked bar (`new-screens.jsx:251–262`) is colored by category, mapped via:

| Category (`spending_entries.category`) | Theme token |
|---|---|
| `Subscriptions`, `Music`, `Video`, `AI`, `News` | `theme.rituals` |
| `Storage`, `Work` | `theme.accent` |
| `Fitness`, `Transit` | `theme.move` |
| `Food & Drink`, `Groceries` | `theme.money` |
| anything else / NULL | `theme.fill` |

White hairline divider between segments per handoff (`:259`). The map is colocated in `lib/sync/categoryColor.ts` (or inlined into `subscriptions.tsx` if it's used nowhere else — implementation choice in the plan).

### 3.7 Files modified outside the new tree

- `app/(tabs)/you.tsx` — deleted (replaced by directory).
- `components/StubTab.tsx` — kept (other tabs may stub later); only consumer was `you.tsx` but the component is small and the deletion isn't load-bearing.
- `app/(tabs)/_layout.tsx` — no change (route group already in place).
- No changes to backend, no changes to schema, no changes to existing `lib/sync/`, `lib/db/queries/`, or `lib/db/schema.ts`.

---

## 4. Error handling

### 4.1 Connect screen

One inline red banner above the form, with a single CTA. Mapped by error class from `lib/sync/errors.ts`:

| Thrown error / backend code | Banner copy | CTA |
|---|---|---|
| `imap_auth_failed` (mapped to `ValidationError`) | "Wrong app password — Gmail rejected it." | "Generate a new one →" → `Linking.openURL('https://myaccount.google.com/apppasswords')` |
| `invalid_request` (`ValidationError` w/ generic message) | "Check the email format and try again." | none |
| `already_connected` | (no banner) silent toast "Already connected." | auto `router.replace('dashboard')` |
| `RateLimitError` | "Too many attempts. Wait a moment, then try again." | none |
| `NetworkError` | "Couldn't reach the server. Check your connection." | none |
| `UpstreamError` / `AuthError` (Pulse JWT) | "Server error. Try again." | none |

Save button shows a spinner while the request is in flight; disabled until both fields are non-empty.

### 4.2 Dashboard

| Condition | UX |
|---|---|
| `imapStatus().connected === false` (e.g., disconnected from another session) | immediate `router.replace('intro')`. No banner — the Intro screen *is* the message. |
| `imapStatus().status === 'error'` | red banner above Sync card: "Couldn't connect to Gmail — your app password may have been revoked." CTA: "Reconnect" → `router.replace('connect')`. The `lastError` string is logged but **not** shown to the user (it's IMAP-stack noise). |
| `imapStatus().status === 'paused'` | amber banner above Sync card: "Sync paused after repeated failures." CTA: "Reconnect" → `router.replace('connect')`. (Per Q5a, no Retry button.) |
| `useImapStatus()` itself throws (network) | small grey footer below Sync card: "Status check failed — pull to refresh." Auto-retries on next AppState foreground. |
| `syncNow()` throws (in Sync-now button) | inline transient chip below Sync card: "Sync failed — pull to refresh." 2s, cleared via `setTimeout`. For `AuthError` specifically, route to Intro (token issue likely means disconnected). |
| `syncNow()` resolves with `inserted: 0` | inline transient chip "Up to date." 2s. |
| `syncNow()` resolves with `inserted > 0` | inline transient chip "Synced N new entr{y\|ies}." 2s. |

### 4.3 Disconnect

| Condition | UX |
|---|---|
| `imapDisconnect()` failure (network or 5xx) | stay on dashboard, transient chip "Couldn't disconnect — try again." |
| 404 / "not connected" response | treat as success → `router.replace('intro')`. |

### 4.4 Subscriptions

Pure local-data screen. Empty-state placeholder when `subscriptionList()` returns `[]`: hide stacked-bar + Upcoming list, render centered text "Pal will list recurring charges here once it's seen them ≥2× in 60 days." The "Scan email again" button at the bottom remains visible (it's the only way for an empty-state user to take action).

### 4.5 Allowlist

Trusts `imapStatus()` — if the screen is reachable, status was healthy when the user landed on the dashboard. If `senderAllowlist` is empty (corner case from a bad seed), render "No senders configured" + the disconnect-to-edit footer note.

### 4.6 Toast/snackbar infrastructure

**No toast library added.** Transient feedback (Sync now result, error chips) uses a per-screen `useState<string | null>` + `setTimeout` to clear after 2s, rendered as a small bordered chip below the Sync card on the Dashboard. Confirmations (Disconnect) use `Alert.alert` (already in use in SP4d's `DiscardConfirmModal`).

---

## 5. Testing & verification

### 5.1 New TDD'd tests — `lib/db/queries/__tests__/syncedEntries.test.ts` (~10)

```
recentSynced
  ✓ returns at most `limit` rows
  ✓ orders by occurred_at desc
  ✓ excludes hand-logged entries (synced_entry_id IS NULL)
  ✓ returns [] on empty table

syncedStats
  ✓ thisMonth counts only current local-month rows
  ✓ thisMonth boundary case: row at 23:59:59 on last day of prior month is excluded
  ✓ allTime counts all synced rows regardless of date
  ✓ recurringMerchants = COUNT DISTINCT merchant
    (3 Netflix charges = 1, even if recurring on each)
  ✓ excludes hand-logged from all three counts

subscriptionList
  ✓ groups multiple receipts per merchant into one entry
  ✓ lastCents = cents of the most recent occurrence
  ✓ lastSeenAt = max(occurred_at) per merchant
  ✓ predictedNextChargeAt = lastSeenAt + 30 * 86_400_000 ms
  ✓ sorts by predictedNextChargeAt ASC
  ✓ excludes recurring=0 merchants
  ✓ excludes merchant=NULL
```

Test scaffold reuses SP5c's pattern (`drizzle.runMigrations` against an in-memory or fixture-backed test DB; same client used by `lib/sync/__tests__/syncNow.test.ts`).

### 5.2 Not TDD'd (deferred or covered elsewhere)

- Screen rendering (visual; deferred per parent meta-spec §5).
- `useImapStatus()` hook AppState wiring (existing AppState listener in `app/_layout.tsx` isn't tested either; visual smoke covers it).
- `syncNow()` integration (covered by SP5c's `lib/sync/__tests__/syncNow.test.ts`).
- Error-class mapping in `lib/sync/client.ts` (covered by SP5c tests; no new error codes added in 5d).
- Connect form / inline error banner / disconnect Alert / category-color mapping (visual).

### 5.3 Slice-close criteria

1. `npm test` green (root iOS suite: existing 331 + ~10 new ≈ 341).
2. `npx tsc --noEmit` clean.
3. **Web target sanity check** (Windows browser, `npm run web`):
   - You tab opens to sectioned list; "Email sync" row reads "Not connected"; tap → Intro screen.
   - "Set up Gmail sync" → Connect screen renders.
   - "Subscriptions" row in You tab → Subscriptions screen empty-state.
   - Disabled rows in You tab don't navigate on tap.

iPhone Expo Go visual smoke + live end-to-end smoke (which requires SP5b/SP5c live-deploy tasks) carry over to the SP5-wide deferred pass per parent meta-spec §5.

---

## 6. Scope cuts

Explicitly out of scope for 5d:

| Item | Reason |
|---|---|
| `POST /imap/test` endpoint (validate-without-persist) | Per Q4: collapsed to single Save button with inline error. Adding a second backend route for marginal UX gain is YAGNI. |
| `PUT /imap/account/allowlist` endpoint + editable allowlist UI | Per Q7c: read-only in 5d. Disconnect + reconnect is the workaround; revisit in SP6 polish if friction surfaces. |
| Worker poke endpoint (`POST /imap/poll-now`) and live progress streaming | Per Q2: "Sync now" pulls the backend cache only. Worker phase strings ("Connecting to imap.gmail.com…", "Filtering by sender · 62 matches") stay aspirational; they require IPC infrastructure that's out of slice. |
| Rich Pal "haven't opened in 30+ days" insight on the Dashboard | Per Q6b: we have no app-usage tracking. The dynamic count + monthly-total copy stands in. |
| Profile header on the You tab | Per Q7a: solo app, no auth, nothing useful to surface. |
| Active polling of `/imap/status` while Dashboard is open | Per Q7b: worker polls every 5 min server-side; iOS polling more often is wasted. Mount + foreground + after-sync covers every meaningful state transition. |
| Cadence-from-data subscription predictions (median past gap) | Per Q3: at 2–3 data points per merchant, median is fragile. Revisit in SP6 polish. |
| Toast/snackbar library | Per §4.6: per-screen `useState` + `setTimeout` chip is sufficient; new dep would inflate footprint for nothing 5d needs. |
| Functional Reviews / Bills / All stats / Export / Notifications / Help rows on the You tab | Reviews ship in SP5g; the others are SP6 polish or out-of-scope. Visible-but-disabled rows are scaffolding, not stubs. |
| Per-merchant "Mark as recurring / not recurring" toggle | Per parent meta-spec §6 (recurring detection is a heuristic in SP5b; UI tuning deferred). |
| Receipt re-categorization UI on the Dashboard | Per parent meta-spec §6: existing per-entry edit sheet from SP3b handles category edits. |

---

## 7. Open items

None. All 7 brainstorm questions resolved (Q1–Q7); meta-spec §7 items belong to other slices (5b/5c/5f/5g) and are not 5d's to resolve.

---

## 8. What this spec is NOT

- Not a backend change. SP5d adds zero backend routes, schema migrations, or environment variables.
- Not a redesign of any existing surface. Today, the entry sheet, Spending Detail, Pal Composer, Move tab, and Onboarding from earlier slices are unchanged. SP5d only replaces the `<StubTab>` on the You tab with the handoff's sectioned-list landing.
- Not the Reviews / Streak Celebration / Evening Close-Out / Rituals Builder surface. Those are SP5e/f/g.
- Not the live end-to-end IMAP→iOS smoke test. That requires SP5b's live worker on the droplet (Tasks 14–15 of the SP5b plan, currently pending) and SP5c's live HTTP smoke (Task 22 of the SP5c plan, currently pending). 5d's slice-close is web smoke only; the integrated iPhone pass carries over to the SP5-wide deferred batch.
