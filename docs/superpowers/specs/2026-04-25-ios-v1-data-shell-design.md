# Pulse — Sub-Project 3a: iOS v1, Data + Shell

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** `2026-04-25-implementation-process-design.md` (§3 row 3a)
**Predecessors:** SP0 (pipeline pre-flight) ✅, SP1 (design system) ✅
**Successor (next here):** SP3b (entry sheet + Pal client)

---

## 1. Goal

Land the persistent shape of the app: a SQLite-backed data layer with migrations, a 4-step Onboarding that captures the user's daily targets, and a Today screen that renders today's three rings against real data. Tab bar and FAB exist as navigational chrome but only Today is wired; the other three tabs are stubs awaiting their owning sub-projects.

Verification surface (per parent §3):
- SQLite schema migrates cleanly
- Today screen renders today's data
- Tab bar + FAB present and navigate
- Onboarding completes and persists Goals

---

## 2. Stack additions

Beyond what SP0/SP1 already established (Expo SDK 54 + NativeWind v4 + ThemeProvider + tokens):

- `expo-sqlite` — device DB (already in SDK 54 base)
- `drizzle-orm` + `drizzle-kit` — schema definitions, codegen migrations, query builder
- `@shopify/react-native-skia` — Activity-style ring rendering on Today
- `react-native-reanimated` — already pulled by SDK; used for ring fill animation
- `expo-router` — already in template; gains an `onboarding/` route group and a `(tabs)/` group

No new native modules. Custom dev client is **not** required for SP3a; Expo Go runtime is sufficient.

---

## 3. Data model

Five tables. Drizzle schema lives in `lib/db/schema.ts`.

### 3.1 `goals` — singleton (id always 1)

| Column | Type | Notes |
|---|---|---|
| `id` | int PK | always 1; enforced in code |
| `daily_budget_cents` | int | from onboarding chip |
| `daily_move_minutes` | int | from onboarding chip |
| `daily_ritual_target` | int | count of toggled-on rituals at onboarding |
| `created_at` | int (unix ms) | onboarding finish time |

Onboarding writes once. SP5+ may later allow editing.

### 3.2 `rituals` — definitions of tracked rituals

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `title` | text | e.g. "Morning pages" |
| `icon` | text | SF Symbol name from handoff |
| `active` | int (bool) | 1 = appears in today's count |
| `position` | int | sort order (lower = top) |
| `created_at` | int (unix ms) | |

Seeded by onboarding. SP5's Ritual Builder edits.

### 3.3 `spending_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `cents` | int | always positive; expenditure |
| `note` | text nullable | user-entered |
| `category` | text nullable | free-form for now; SP5 may enum |
| `occurred_at` | int (unix ms) | local-time-aware via JS Date |

SP3b will write; SP3a reads only (rows arrive via dev seed).

### 3.4 `movement_entries`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `minutes` | int | duration |
| `kind` | text nullable | "walk", "run", etc. — free-form |
| `note` | text nullable | |
| `occurred_at` | int (unix ms) | |

### 3.5 `ritual_entries` — per-completion log

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `ritual_id` | int FK rituals.id | |
| `occurred_at` | int (unix ms) | |

One row per completion tap. Dedupe-by-day in `getTodayAggregates`.

### 3.6 Day boundary semantics

All "today" math uses local-TZ midnight via `Date` arithmetic. Aggregate functions accept an injected `asOf: Date` (default `new Date()`) so tests can pin time. DST is handled by Date itself; one streak test pins a spring-forward fixture.

---

## 4. Migrations

**Tooling:** `drizzle-kit generate` (option A from brainstorm).

**Workflow:**
1. Edit `lib/db/schema.ts`.
2. Run `npx drizzle-kit generate` → produces `lib/db/migrations/NNNN_<slug>.sql` plus `meta/_journal.json`.
3. Commit both `schema.ts` and the generated files together.
4. App's `lib/db/migrate.ts` runs all unapplied migrations on boot using `expo-sqlite`'s migration helper (or Drizzle's `migrate()` if available in SDK 54 — verify at plan time).

**Initial migration:** `0000_initial.sql` defines all five tables + indexes:
- `idx_spending_occurred_at`, `idx_movement_occurred_at`, `idx_ritual_entries_occurred_at` — all aggregate queries filter by `occurred_at`.
- `idx_ritual_entries_ritual_id` — streak query groups by it.

**Drift check:** `drizzle-kit check` runs in CI/local; migration parity test (§7.3) provides the runtime check.

---

## 5. Onboarding flow

Route group `app/onboarding/`. `app/_layout.tsx` checks for `goals.id = 1` on mount; if absent, `router.replace('/onboarding')`. Presence of the row is the *only* gate — no separate flag column or AsyncStorage key.

**Stepper UI** (matches `design_handoff/src/ai-screens.jsx:182`):

| Step | Content | Persists |
|---|---|---|
| 0 — Welcome | hero glyph, title, body, "Get started" CTA | nothing |
| 1 — Daily budget | 4 chips: $50 / $85 / $120 / $200 | local form state |
| 2 — Move goal | 4 chips: 20 / 45 / 60 / 90 min | local form state |
| 3 — Rituals | toggle list of 6 default rituals | local form state |

Default ritual list (all on initially):
1. Morning pages — `book.closed.fill`
2. Inbox zero — `tray.fill`
3. Language practice — `character.book.closed.fill`
4. Stretch — `dumbbell.fill`
5. Read before bed — `books.vertical.fill`
6. Meditate — `heart.fill`

**Validation:** step 3 CTA ("Start tracking") disabled when zero rituals toggled on (otherwise the ritual ring goal would be 0).

**Commit transaction (`finishOnboarding`):**
1. Insert `goals` (id=1) with `daily_budget_cents = budget * 100`, `daily_move_minutes`, `daily_ritual_target = activeCount`.
2. Insert one `rituals` row per toggled-on default, in display order, `active=1`, `position` matching its index.
3. `router.replace('/(tabs)/today')`.

Skip behavior: visible on steps 1–3 only. Tapping Skip applies the handoff's default selection for that step (step 1 → $85, step 2 → 60 min, step 3 → all six rituals on) and advances one step. Skip on step 3 advances to commit. Back button is not in scope for SP3a; users go forward only.

---

## 6. Tab shell + Today screen

### 6.1 Tab bar

`app/(tabs)/_layout.tsx` defines four tabs (Today, Move, Rituals, You) with SF Symbol icons matching the handoff. Only `today.tsx` is wired; the other three render a single-line "Coming in SP3b/SP4" stub. Tab bar uses theme tokens from SP1.

### 6.2 FAB

Floating action button on Today (per handoff). Tap → no-op + `console.log('Log entry — SP3b')`. Absent on the stub tabs.

### 6.3 Today layout

Top: status-bar spacer + date pill ("Wed · Apr 25", non-interactive in SP3a).

Hero: `RingTriad` — three concentric Skia arcs in money / move / rituals colors from SP1 tokens. Ring values:
- Money: `min(spentTodayCents / dailyBudgetCents, 1)`
- Move: `min(moveTodayMinutes / dailyMoveMinutes, 1)`
- Rituals: `ritualsDoneToday / dailyRitualTarget`

Over-budget styling (Money ring exceeds 100%) deferred to SP6.

Below rings: three stat blocks (tabular-nums) showing `$X / $Y`, `M min / G`, `R / N`. Empty state shows zeros — no special copy.

Animation: ring fill animates from previous to current value via Reanimated worklet, 400ms linear ease-in-out. Polish deferred to SP6.

### 6.4 Reactive data

Today uses Drizzle's `useLiveQuery` so dev-seed mutations rerender the rings without manual refetch. Aggregate queries live in `lib/db/queries/today.ts`.

### 6.5 Dev seed button

Visible only under `if (__DEV__)`. Top-right of Today, small `seed` pill. Tap → action sheet:
- **Seed today (partial):** 2 spending rows ($14, $28); one 35-minute movement row; mark 3 of the active rituals done.
- **Seed today (full):** Spending up to budget; movement at goal; all active rituals done.
- **Clear today:** delete all entries with `occurred_at >= localMidnight(asOf)`.

Lives in `components/DevSeedButton.tsx`. The dead-code-elimination pass strips it from prod bundles.

---

## 7. TDD scope (parent §3: "Drizzle schema, migrations, derived aggregates")

Tests run via existing `jest` config from SP1. In-memory SQLite (`better-sqlite3`) for migration/transaction tests; pure-function tests for aggregates.

### 7.1 `getTodayAggregates(rows, asOf)`
Pure. Returns `{ spentCents, moveMinutes, ritualsDone, activeRitualCount }`. Cases:
- empty rows → all zeros
- yesterday's rows excluded (local-TZ boundary)
- tomorrow's rows excluded
- two `ritual_entries` for same `ritual_id` same day → counts as 1 done
- DST spring-forward fixture day still slices correctly

### 7.2 `streakForRitual(ritualEntries, ritualId, asOf)`
Pure. Returns int. Cases:
- no entries → 0
- logged today only → 1
- logged today + yesterday → 2
- gap mid-streak → counts only the run ending today/yesterday
- logged yesterday, not today → still counts (today not yet over)
- last logged 3 days ago → 0
- DST-spanning streak increments correctly

### 7.3 Migration parity
Boot `migrate()` against in-memory SQLite, introspect `sqlite_master`, assert table set + column set match `schema.ts`. Catches schema-drift-without-regenerate.

### 7.4 `finishOnboarding` transaction
Integration test against in-memory DB. Asserts goals row matches inputs; rituals row count = toggled-on count; toggled-off defaults absent; positions monotonic.

UI (onboarding stepper, Today rings, dev seed) is **not** TDD'd — visual verification per parent §3.

---

## 8. Verification (smoke test order)

1. Fresh install on web target: onboarding renders → 4 steps complete with custom selections → land on Today.
2. Inspect SQLite (Drizzle Studio or sqlite3 CLI on the simulator path): `goals` row exists with the chosen values; `rituals` rows match toggled-on selections.
3. Force-quit + relaunch: skips onboarding, lands on Today.
4. Today: empty state — three rings at 0.
5. Dev seed → "Seed today (partial)": rings animate to roughly money 33% / move 58% / rituals 60%; stat numbers match.
6. Dev seed → "Clear today": rings animate back to 0.
7. `npm test` passes (4 suites from §7).
8. `npx drizzle-kit check` passes — no drift.
9. (Best-effort) Expo Go on iPhone — same flow. Deferred-acceptable per SP1 precedent if blocked.

---

## 9. Scope cuts (deferred)

| Item | Owner |
|---|---|
| Log Entry sheet (FAB target) | SP3b |
| Spending Detail screen | SP3b |
| Date pill becomes a date scrubber | SP3b |
| "Next ritual" suggestion strip from `today.jsx` | SP3b |
| Editing / removing entries | SP3b |
| Custom budget / move-goal free-text entry | SP5 |
| Ritual Builder (add/remove/reorder rituals after onboarding) | SP5 |
| Move tab landing | SP4 |
| Rituals tab landing | SP5 |
| You tab landing (full) | SP5 — stub remains until then |
| Over-budget Money ring styling | SP6 |
| Settings, theme picker | SP3b/SP6 |
| Cloud sync, multi-device, backups | out of v1–v3 |

---

## 10. Risks

1. **Skia in Expo Go.** `@shopify/react-native-skia` should be in the Expo Go SDK 54 runtime; plan should context7-verify before the rings implementation step. Fallback: plain SVG arcs — same math.
2. **DST and timezone math** is the most likely source of streak bugs. Two §7 tests target it explicitly. The `asOf`-injection pattern in queries makes test fixtures trivial.
3. **Drizzle migrate API in `expo-sqlite` SDK 54.** The `migrate()` helper's exact import path / API has shifted across versions; plan must context7-verify before wiring.
4. **`useLiveQuery` reactivity over `expo-sqlite`.** Drizzle docs claim support; verify at plan time. Fallback: manual refetch on focus + a refresh-after-seed callback. Not architecturally invasive.
5. **Singleton `goals` row** is enforced in code, not by SQLite. A second insert would clobber via `INSERT OR REPLACE`. Acceptable for v1.

---

## 11. Out of scope for this spec

- The Log Entry sheet. SP3b spec.
- Pal client / `/chat` integration. SP3b spec (depends on backend v1, handled out-of-band).
- Workouts and PRs. SP4 spec.
- Email receipts. SP5 spec.

---

## 12. Open items for plan-writing time

- Confirm `drizzle-orm` + `drizzle-kit` versions compatible with `expo-sqlite` SDK 54 (context7).
- Confirm `useLiveQuery` works on top of `expo-sqlite` in SDK 54 (context7).
- Confirm Skia is in Expo Go SDK 54 runtime (context7).
- Decide between `better-sqlite3` and `@vlcn.io/wa-sqlite` for jest in-memory tests (likely `better-sqlite3` — simpler, sync, well-supported).
