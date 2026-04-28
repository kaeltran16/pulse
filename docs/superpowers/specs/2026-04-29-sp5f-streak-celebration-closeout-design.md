# SP5f — Streak surface + Streak Celebration + Evening Close-Out

**Date:** 2026-04-29
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) §3 row 6 (5f)
**Scope:** iOS-only. No backend changes. No new dependencies. Three deliverables: an inline streak pill on the Rituals-tab Today list, a Streak Celebration modal fired on app foreground when a per-ritual high-water-mark is broken, and a full-screen Evening Close-Out fired on app foreground past 21:00 when the daily goal is unmet.

Resolves the parent meta-spec's §7 open items for 5f: **streak surface placement** (Rituals tab → Today list inline) and **once-per-day dismissal storage** (new SQLite table).

---

## 1. What 5f ships

- **Inline streak pill** on each row of `app/(tabs)/rituals/index.tsx`. A small flame symbol + number, themed by the ritual's `color` (5e schema). Hidden when the current streak ≤ 1.
- **Streak Celebration modal** at `app/celebration.tsx`. Modal-presented route. Fired by a single foreground check pass when any active ritual's current streak exceeds its stored high-water-mark. Coalesces multiple HWM breaks into one modal showing the most impressive new streak; advances all broken HWMs in a single transaction regardless of which one is shown.
- **Evening Close-Out screen** at `app/close-out.tsx`. Full-screen pushed route. Fired by the same foreground check pass when local time ≥ 21:00 and today's distinct-ritual-count is below the user's daily goal and Close-Out has not already been dismissed today. Renders the design-handoff checklist (`design_handoff/src/new-screens.jsx:472`); checking a row writes a `ritual_entries` row via the existing `toggleToday` query; the "Good night" CTA enables when the daily goal is met. Either back-out or "Good night" persists a same-day dismissal.

---

## 2. Locked decisions

These resolve the open items from §7 of the parent meta-spec and the brainstorming session for 5f. Not open for relitigation in the implementation plan.

| Decision | Choice | Reason |
|---|---|---|
| Streak surface placement | Rituals tab → Today list (`rituals/index`) inline on each row | Today list is where the user's eyes already land daily; streak-as-row-detail rewards the action just taken. Builder is less-visited; Today (home tab) is already busy with Pal nudge from 5e. |
| Streak Celebration trigger model | Per-ritual HWMs, coalesced to one modal per foreground | Per-ritual feels truer to the product (each ritual deserves its own milestone), but coalescing avoids stacking modals on the same morning when several streaks tick up at once. |
| HWM update timing | On every ritual write (inside `toggleToday`), regardless of whether the celebration is shown | The celebration is a *recognition* of the new HWM, not the source of truth. Decouples "did we record the milestone" from "did the user see the modal." |
| Storage for HWMs and Close-Out dismissals | New SQLite tables (`ritual_streak_high_water` + `dismissed_close_outs`) | Consistent with the rest of `lib/db/queries/*`; `useLiveQuery`-friendly; one shared persistence model is simpler than splitting state across SQLite + AsyncStorage. |
| Evening Close-Out completion gate | Daily goal reached (count ≥ goal); CTA stays tappable past goal as the affirming exit | Consistent with 5e's daily-goal semantics — the goal *is* the user's definition of "enough." Literal mockup parity (5/5) would be inconsistent with that. |
| Evening Close-Out presentation | Full-screen pushed route (`app/close-out.tsx`) | The mockup's hero treatment + checklist + Pal-prompt row + dual CTAs don't survive being squashed into a bottom sheet. Route stack is already idiomatic from 5e. |
| Trigger orchestration | Foreground-only check pass on every `AppState` `'active'` transition (and initial mount). Show order: Celebration first, then Close-Out (mutually exclusive — Close-Out only runs if Celebration didn't navigate). | A `setInterval` while-app-open polling loop covers a rare case (user crosses 21:00 with the app already open) at the cost of AppState/timer juggling. Foreground-only is what the meta-spec already commits to. |
| Threshold time for Close-Out | Fixed at 21:00 local | Meta-spec §6 already cuts "snooze / quiet-hours" — configurability is in SP6 Polish. |
| Celebration modal scope | MVP + single "Next milestone · N days" pill (ladder: 7, 14, 30, 60, 100, 365) + "Keep going" CTA | Full-mockup parity (Share sheet, shareable card, three stat pills) requires aggregates we don't track (per-ritual time totals) and opens a Share rabbit hole for a feature most users will see rarely. The milestone pill is a free morale boost — pure function on current streak. |

---

## 3. Architecture

### 3.1 Data model

Two new tables (drizzle-kit auto-named, likely `0006_*.sql`):

```ts
// lib/db/schema.ts — additions

export const ritualStreakHighWater = sqliteTable('ritual_streak_high_water', {
  ritualId: integer('ritual_id').primaryKey().references(() => rituals.id, { onDelete: 'cascade' }),
  hwm: integer('hwm').notNull().default(0),
  reachedAt: integer('reached_at').notNull(), // ms
});

export const dismissedCloseOuts = sqliteTable('dismissed_close_outs', {
  dateKey: text('date_key').primaryKey(), // 'YYYY-MM-DD'
  dismissedAt: integer('dismissed_at').notNull(), // ms
});
```

**Cascade semantics:**
- Soft-delete (5e's `deleted_at`) preserves the HWM row so a restore preserves history.
- Hard-delete cascades via `onDelete: 'cascade'`.
- `dismissed_close_outs` is date-keyed, not ritual-keyed; unaffected by ritual lifecycle.
- Old dismissal rows are not pruned (one row per dismissed day at single-user scale is trivial).

### 3.2 Query modules

**`lib/db/queries/streakHighWater.ts`** (new):
- `getHwm(ritualId: number): Promise<number>` — returns 0 if no row.
- `bumpHwmIfHigher(ritualId: number, current: number, now: Date): Promise<{ wasBroken: boolean; previous: number; current: number }>` — upserts when `current > previous`; no-op otherwise.
- `clearHwm(ritualId: number): Promise<void>` — explicit clear (called from `rituals.ts:hardDelete` for symmetry; the FK cascade handles the row but this lets the call site stay explicit).

**`lib/db/queries/closeOutDismissals.ts`** (new):
- `isDismissedToday(dayKey: string): Promise<boolean>`
- `markDismissedToday(dayKey: string, now: Date): Promise<void>` — idempotent (writes via `INSERT OR REPLACE`).

**`lib/db/queries/rituals.ts:toggleToday` extension** — after a successful insert path, call `bumpHwmIfHigher(ritualId, streakForRitual({...}))`. The `wasBroken` return is *not* surfaced from `toggleToday`; the foreground check pass re-derives broken state from `(currentStreak vs. storedHwm)` so the celebration trigger has a single source of truth.

### 3.3 Foreground check pass

**`lib/sync/foregroundChecks.ts`** (new):

```ts
export async function runForegroundChecks(now: Date = new Date()): Promise<void> {
  // Re-entrance guard (mirrors syncNow.ts pattern from SP5c)
  if (running) return running;
  running = (async () => {
    try {
      // 1) Celebration check
      //    Read all active rituals + entries → compute streakForRitual per ritual.
      //    Read stored HWMs.
      //    Collect every ritual where current > hwm.
      //    Pick winner: highest current streak; tiebreak: highest delta (current - hwm),
      //    then ritual.id ASC.
      //    Bump ALL broken HWMs in one transaction (silent advance for losers).
      //    If a winner exists → router.push('/celebration', { ritualId, streak, previousHwm })
      //    and return — Close-Out does not run on the same pass.
      //
      // 2) Close-Out check (only if Celebration didn't navigate)
      //    Read daily goal (5e's goals.value).
      //    Read distinct-rituals-logged-today (dayKey(now)).
      //    Read dismissed_close_outs for dayKey(now).
      //    If localHour(now) >= 21 AND distinctToday < goal AND !dismissed:
      //      router.push('/close-out')
    } finally { running = null; }
  })();
  return running;
}
```

**Wiring point:** `app/_layout.tsx`'s existing AppState listener (already wired in SP5c for `syncNow`) calls `runForegroundChecks()` after `syncNow` resolves on every `'active'` transition and on initial mount.

### 3.4 UI components

**`components/StreakPill.tsx`** (new) — pure presentational:
- Props: `streak: number`, `tone?: RitualColor` (defaults to ritual's color).
- Returns `null` when `streak ≤ 1` (avoids "1-day streak" noise).
- Layout: small flame SF Symbol + tabular-numeric streak number, in a pill background tinted from `tone`.
- Reused only on `rituals/index` rows for SP5f. Component-level so it can drop into Builder later without refactor.

**`app/(tabs)/rituals/index.tsx` change** — for each row:
- Compute `streakForRitual({ ritualEntries, ritualId, asOf: new Date() })` against the existing `useLiveQuery` result.
- Render `<StreakPill streak={n} tone={ritual.color} />` to the right of the cadence label, left of the chevron.

**`app/celebration.tsx`** (new modal route, `presentation: 'modal'`):
- Params: `ritualId`, `streak`, `previousHwm`.
- Renders:
  - Big tabular-numeric streak number (140pt, themed by `ritual.color`)
  - Hero subtitle: `"{ritual.name}"` (28pt)
  - Body subtitle: `"Longest run yet"` if `previousHwm === 0`, else `"Your longest in {streak - previousHwm} days"` (or `"Your new high"` if delta = 1; exact copy locked in plan)
  - One "Next milestone · N days" pill — `nextMilestone(streak)` returns the next ladder rung above the current streak; pill hides when `null` (past 365)
  - Single "Keep going" CTA → `router.dismiss()`
- Background: existing radial gradient idiom from the mockup, themed by `ritual.color` instead of `theme.move`.

**`app/close-out.tsx`** (new pushed route, full-screen):
- Renders the design-handoff checklist faithfully (`design_handoff/src/new-screens.jsx:472`):
  - Hero ("Close out your day.")
  - Time + weekday line ("21:30 · Thursday")
  - Progress bar (`distinctRitualsToday / totalActiveRituals`)
  - Checklist of today's *active* rituals — check states from `useLiveQuery`(`ritual_entries` for today). Tapping a row calls `toggleToday(ritualId)`. Cascading-delete behavior on un-toggle is inherited from 5e.
  - "Ask Pal for a reflection prompt" row → opens the existing `<PalComposer />` as a local modal on the Close-Out screen with a new optional `prefill` prop. The prefill string is `"Give me a reflection prompt for tonight"`. Adding the `prefill` prop is a minor extension to `components/PalComposer.tsx` (one prop forwarded into the existing input's initial value).
  - Bottom CTA: "Good night" enabled when `distinctRitualsToday >= dailyGoal`, else `"{goal - distinctRitualsToday} to go"` disabled.
- Both back-button and "Good night" call `markDismissedToday(dayKey(now))` before popping. "Good night" additionally pops to the tab root (so the user lands back on Today, not the Close-Out screen via back-stack).

### 3.5 Pure helpers

- **`lib/sync/nextMilestone.ts`** — `nextMilestone(streak: number): number | null`. Ladder: `[7, 14, 30, 60, 100, 365]`. Returns the first rung strictly greater than `streak`; returns `null` if `streak >= 365`.

---

## 4. Cross-cutting dependencies

| Dependency | Where consumed | Status |
|---|---|---|
| 5e's `rituals.ts` (`toggleToday`, `streakForRitual` consumer surface, soft/hard delete cascade) | 3.2 (HWM extension to `toggleToday`), 3.4 (StreakPill on rituals/index, Close-Out checklist) | Shipped in 5e (commit `984efad`). |
| 5e's `goals` table (`reminder_time_minutes`, `value` for daily goal) | 3.3 (Close-Out gate uses `goals.value`) | Shipped in 5e. |
| 5e's `pal_cache` + `<PalComposer />` component | 3.4 (Close-Out's "Ask Pal for a reflection prompt" row opens `<PalComposer />` as a local modal with a new `prefill` prop) | Shipped in 5e (`components/PalComposer.tsx`). 5f adds a small `prefill?: string` prop — only consumer is the Close-Out screen. |
| SP5c's `app/_layout.tsx` AppState handler | 3.3 (foreground check wired alongside `syncNow`) | Shipped in 5c. The handler already imports `syncNow` dynamically on `'active'` transitions; 5f adds a sibling dynamic import of `runForegroundChecks` that runs after `syncNow` resolves. |
| `useLiveQuery` (Drizzle on iOS) | 3.4 (rituals/index streak compute, Close-Out checklist) | In use since SP3a. |
| `streakForRitual` math | 3.2 (HWM extension), 3.4 (StreakPill compute) | TDD'd in SP3a. **Cadence-agnostic** — see §6. |

**No new deps. No backend deploy gate. Not blocked by `OPENROUTER_API_KEY` carry-over from 5b/5c/5e.**

---

## 5. Tests

**Pure-helper unit tests (Node env):**
- `lib/sync/__tests__/nextMilestone.test.ts` — table-driven over the ladder + edges (0, 1, 6→7, 7→14, 365→null, 999→null).
- `lib/sync/__tests__/foregroundChecks.test.ts` — table-driven over the decision matrix:
  - Celebration fires when any current > HWM; picks highest streak; bumps all broken HWMs.
  - Close-Out blocked by celebration-navigated.
  - Close-Out blocked by `localHour < 21`.
  - Close-Out blocked by `distinctToday >= goal`.
  - Close-Out blocked by `isDismissedToday`.
  - Both blocked → no navigation.
  - Re-entrance guard: second concurrent call resolves to the same in-flight promise.
  - Mocks: fake `db` accessor, fake `router`, injectable `now`.

**Query-module tests (jest expo-sqlite env):**
- `lib/db/queries/__tests__/streakHighWater.test.ts` — `bumpHwmIfHigher` returns `wasBroken=true` and updates row when current > stored; returns `false` and is a no-op when current ≤ stored; first-call (no row) treats stored as 0; cascade on hard-delete; `clearHwm` removes the row.
- `lib/db/queries/__tests__/closeOutDismissals.test.ts` — `markDismissedToday` is idempotent (writing same `dateKey` twice doesn't throw); `isDismissedToday` reads correctly; date-key isolation.

**Integration test (jest expo-sqlite env):**
- `lib/db/queries/__tests__/rituals.toggleToday.hwm.test.ts` — `toggleToday` calls `bumpHwmIfHigher`. Seed entries, toggle a new one that ticks the streak past the stored HWM, assert the HWM row reflects the new value.

**Component / screen tests — out of scope.** Per parent meta-spec §5, iOS slices close on typecheck + unit tests + web-target sanity check. UI smoke is deferred to the SP5-wide pass, consistent with the SP5e pattern.

**Expected delta:** ~18 new tests (≈8 helper + 8 query + 2 integration). No backend tests.

---

## 6. Open notes, scope cuts, slice-close criteria

### Carried-over quirks (not fixed in 5f)

- **Cadence-agnostic streaks.** `streakForRitual` counts consecutive days regardless of cadence. A `weekdays`-cadence ritual not logged Sat/Sun breaks its streak. Out of scope; revisit in SP6 Polish if it bites.
- **HWM survives soft-delete.** Soft-deleted rituals retain their HWM so a restore preserves history. Hard-delete cascades.

### Explicit cuts (deferred to SP6 or later)

- Configurable Close-Out threshold time (fixed at 21:00).
- Share sheet + shareable card on Celebration.
- Stat pills "Total minutes / Best day" (no time-tracking on rituals).
- Per-foregrounding queue replay of un-shown HWM breaks (silently advance; no later notification).
- Setting-level toggle to disable Celebration / Close-Out entirely.
- Streak surface on Builder, on Today (home tab), or as its own section header on `rituals/index`.
- Cadence-aware streak math.

### Slice-close criteria

1. `npm test` green at the new total (~408 = 390 baseline + ~18 new).
2. `npx tsc --noEmit` baseline-preserved (still 28, same as post-5e per the parent meta-spec status line).
3. Web-target manual smoke walks: Today list shows streak pills on rituals with streak ≥ 2; force a HWM below current → foreground → Celebration appears once; force device clock to 22:00 with rituals < goal → foreground → Close-Out appears, tapping rows toggles checkboxes, "Good night" enables when goal reached.
4. iPhone Expo Go visual verification carries over to the SP5-wide deferred pass.

### Meta-spec amendments

**None required.** 5f stays inside the boundaries already settled in §2/§4/§7 of the parent meta-spec. The streak-placement and dismissal-storage decisions resolve §7 open items inline; this spec references them rather than amending the parent. The parent's §3 "Sub-slice status" line for 5f will be updated from "Not started" to "✅ Code complete YYYY-MM-DD — …" at slice close (Task 33-equivalent), as 5e did.

---

## 7. What this spec is NOT

- Not an implementation plan. The next step is `superpowers:writing-plans` to produce the 5f plan.
- Not a redesign of the Rituals tab. 5e's Today list and Builder shapes are unchanged; 5f only adds the streak pill on rituals/index rows and two new top-level routes.
- Not a notifications feature. 5e's `expo-notifications` integration (daily ritual reminder) is unrelated; 5f's triggers are pure foreground checks against local DB state.
- Not a Pal Composer redesign. The Close-Out's "Ask Pal" row adds a single `prefill?: string` prop to the existing component; behavior, layout, and call sites elsewhere are unchanged.
