# SP4e — Post-Workout + History (Design)

**Date:** 2026-04-26
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-25-ios-v2-workouts-design.md`](./meta/2026-04-25-ios-v2-workouts-design.md) §3 row 4e
**Scope:** The PostWorkout summary that replaces 4d's stub, the WorkoutDetail screen for past sessions, a Recent section added to PreWorkout, a `/move/history` full-list route, the HealthKit-write extension to carry distance for cardio, and the post-session aggregate functions that drive the new screens. Does **not** include AI routine generation or Live Activities — those are 4f and 4g.

---

## 1. What ships

- **PostWorkout** at `app/(tabs)/move/post.tsx` — replaces the 4d stub. Strength variant per `design_handoff/src/workout-screens.jsx:732-963`. Cardio variant designed here (no handoff mockup).
- **WorkoutDetail** at `app/(tabs)/move/[sessionId]/index.tsx` — new. Per `design_handoff/src/workout-screens2.jsx:259-457`, minus the Pal note section.
- **PreWorkout "Recent" section** in `app/(tabs)/move/index.tsx` — new section above the Strength routine grid; up to 5 most recent completed sessions with a "See all" link to `/move/history`.
- **History full-list route** at `app/(tabs)/move/history.tsx` — newest-first list of all completed sessions, with All / Strength / Cardio mode chips.
- **HealthKit write extension** — `lib/health/workouts.ts` `writeWorkout()` accepts an optional `distanceKm`; `finalizeSession` calls it post-commit.
- **Aggregate functions** in `lib/workouts/post-session-aggregate.ts` — pure, TDD'd: muscle distribution, weekly volume series, top-PR selection.
- **New query helpers** in `lib/db/queries/sessions.ts` — `getRecentSessions(db, limit)`, `listAllSessions(db, modeFilter?)`, `getWeeklyVolumeSeries(db, weeksBack, now)`. TDD'd.
- **Date-format helper** in `lib/workouts/date-format.ts` — `formatRelativeDate(timestamp, now)`. TDD'd.

### Smoke test (per SP4 meta §3 row 4e, expanded)

1. **Strength PostWorkout.** Finish a strength session in 4d → land on PostWorkout → hero shows routine name + "✓ COMPLETE" + "Nice session." headline → 4-stat grid shows correct Time / Volume / Sets / PR count → if any PRs, up to 2 highlight cards appear with "+N more PRs unlocked" copy when there are 3+ → muscle bars render the top 3 with correct percentages → per-exercise mini bar charts show one bar per set with heights proportional to that set's volume relative to the session max-set, PR-set bar tinted gold.
2. **Recent integration.** Tap Done → land on PreWorkout → "Recent" section shows the just-finished session at the top with relative-date label ("Just now" / "Today"), routine name, duration, total volume, ★ trailing if PRs.
3. **WorkoutDetail.** Tap that recent row → land on WorkoutDetail at `/move/{id}` → 2×2 stat grid matches PostWorkout's stats → 8-week volume chart shows the current week's bar highlighted with the just-added session's tonnage; "+X% in 4 wks" pill computes correctly → per-exercise table lists each set with kg / reps / PR badge populated.
4. **HealthKit strength.** Open Health.app on iPhone → "Workouts" → today shows "Traditional Strength Training" with the correct duration.
5. **Cardio PostWorkout.** Finish a treadmill session → PostWorkout 3-stat grid shows Time / Distance / Pace → no muscle bars, no PR card → CardioRecapCard shows duration as primary number, distance + pace below → Done.
6. **Cardio recent + WorkoutDetail.** Recent row formatter shows "Today · Treadmill Intervals · 28:14 · 3.5 km · 8:03/km" (no ★) → WorkoutDetail shows distance/pace in the 2×2 grid; the fourth tile renders "—" (no HR persistence) → set table is a single row with "DURATION / DISTANCE / PACE" headers.
7. **HealthKit cardio.** Health.app shows "Running, 28:14, 3.5 km".
8. **History list.** Tap "See all" → `/move/history` lists all completed sessions newest-first → Cardio chip filters to cardio rows; All restores.
9. **Empty state.** With zero completed sessions: PreWorkout's Recent section is hidden entirely; `/move/history` renders a "No workouts yet" message with a CTA back to PreWorkout.
10. **HealthKit failure non-blocking.** With Health permission revoked, finalize a session → DB row still saved, `healthSyncFailed=true` → PostWorkout shows a quiet inline "Couldn't sync to Health.app" note above Done; navigation, recent row, WorkoutDetail all behave normally.

**Verification surface:** iPhone via the 4b dev client for steps 4 and 7 (HealthKit Health.app inspection). Web target sufficient for steps 1–3, 5–6, 8–10.

---

## 2. Locked decisions

These were settled during brainstorming. Inputs to the implementation plan, not open in this spec.

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | History entry point | "Recent" section on PreWorkout (top 5) + `/move/history` full-list route reached via "See all" | Smoke test wants "row appears in WorkoutDetail history"; matches the "See all" pattern already used for the Strength section. |
| 2 | Pal note on WorkoutDetail | **Cut** from 4e | SP5 owns review-flavored content; the only network-dependent piece in the handoff. Card slot is omitted, not feature-flagged. |
| 3 | Share button on PostWorkout | **Cut** | Personal-use app, no recipient. Footer collapses to a single Done CTA. |
| 4 | Muscle distribution bars | **In** — top 3 + "+N more" line | Cheap aggregate, faithful to handoff, natural TDD target. |
| 5 | 8-week volume chart | **In**, hand-rolled bars (no Victory Native this slice) | Picking up Victory should be its own decision when 2+ charts amortize the dep. Hand-rolled tracks the handoff design closely. |
| 6 | Cardio PostWorkout | Hero + 3-stat grid (Time / Distance / Pace), single CardioRecapCard, no PR card, no muscle bars | No HR persistence (locked, see #7). 4-stat grid feels off for cardio; drop the slot rather than show "—". |
| 7 | HR persistence | **Cut** | 4d's `LiveHRChip` is live-display-only by design. Adding HR-avg storage would mean a schema delta + capture logic in `activeSessionStore`. SP4g territory. WorkoutDetail's cardio tile shows "—" placeholder. |
| 8 | HealthKit write enrichment | Add **distance** for cardio; no calories, no HR samples | Treadmill in Health.app looks broken without distance. Calories need user weight (untracked). HR is locked out per #7. |
| 9 | Schema delta | **None** | Aggregates compute on read. N is small (≤ ~50 sets per session for muscle dist; ≤ ~16 sessions for 8-week chart). Denormalized columns add migration risk and sync bugs. 4d set the precedent: schema delta only when correctness demands it. |
| 10 | Multiple PRs in one session | Stack up to **2** PR highlight cards; if 3+, second card's caption gets a "+N more PRs unlocked" suffix | Faithful to handoff aesthetic (one star card) without losing the "I PR'd today" signal when several PRs land. |
| 11 | HealthKit failure handling | DB commit succeeds; `writeWorkout` runs **post-commit, best-effort**; failure surfaces as a quiet inline toast on PostWorkout via `result.healthSyncFailed` | DB is source of truth; Health.app is a mirror. Holding a SQLite tx across the native bridge is a deadlock risk. |
| 12 | Activity type for cardio | Pure `activityTypeFor(session, exercises)`: treadmill / outdoor-run equipment → `running`; rower → `rowing`; else → `other` | Equipment string lookup; no new schema. Seeded cardio routines map cleanly. TDD'd. |
| 13 | History row layout | Two lines, mode-aware: strength shows `duration · sets · volume ★?`; cardio shows `duration · distance · pace` | Matches density of PreWorkout's strength routine cards. Single component swaps line-2 formatter on `session.mode`. |
| 14 | Date-grouped headers on `/history` | **Cut** | YAGNI for MVP. Per-row relative-date string carries enough context. |
| 15 | Editing / deleting past sessions | **Cut** | Mid-session edit (4d) covers the common case. v3+ if requested. |

---

## 3. No schema delta

4e ships **no migration**. All data needed for PostWorkout, WorkoutDetail, the Recent section, and `/history` is already in the 4a schema (with 4d's `0003_omniscient_puck` adding `sessions.status` and the partial-unique draft index).

The aggregate work is exclusively in pure functions and read queries.

---

## 4. Query module changes (`lib/db/queries/sessions.ts`)

The existing functions stay. Three new read helpers and one mutation extension.

| Function | Signature | Behavior |
|---|---|---|
| `getRecentSessions(db, limit)` | `→ Promise<SessionRowData[]>` | `WHERE status='completed' ORDER BY finished_at DESC LIMIT ?`. Returns mode-aware row data: `{ id, routineNameSnapshot, finishedAt, durationSeconds, mode, totalVolumeKg, prCount, distanceKm?, paceSecondsPerKm? }`. Joins `session_sets` only for cardio rows (single-set lookup) to surface `distanceKm`; strength rows skip the join. |
| `listAllSessions(db, modeFilter?)` | `modeFilter?: 'strength' \| 'cardio' → Promise<SessionRowData[]>` | Same shape as `getRecentSessions` without the limit; optional `mode` predicate. Used by `/move/history`. |
| `getWeeklyVolumeSeries(db, weeksBack, now)` | `→ Promise<{ weekStart: number; tonnageKg: number }[]>` | Returns exactly `weeksBack` rows (default 8), oldest first. Bucketed by ISO week (`weekStart` is the Monday 00:00 local of the bucket). Sums `totalVolumeKg` across completed sessions whose `finishedAt` falls in the bucket. Empty buckets return `0`. Drafts excluded. |
| `getSession(db, id)` (existing, **extended**) | `→ Promise<SessionFull>` | Already returns session row + sets. Extension: also returns `exerciseMetaById: Record<string, { name, muscle, group, equipment, sf, kind }>` — one extra `IN (...)` query against `exercises` keyed by the distinct exercise IDs in the session. **Also adds `mode: 'strength' \| 'cardio'`** derived from `exerciseMetaById[sets[0].exerciseId].kind` (no schema column — `mode` is computed at hydration time, matching 4d's store-side definition). PostWorkout and WorkoutDetail both consume this. |
| `finalizeSession(db, sessionId, finishedAt)` (existing, **extended**) | `→ Promise<CompletedSessionResult>` | Existing transactional finalize body unchanged. **New**: after the transaction commits, hydrate the session via `getSession`, derive `activityType` and `distanceKm`, call `writeWorkout` in a try/catch. On failure, log + set `healthSyncFailed: true` on the result. DB state never depends on HealthKit success. |

**`SessionRowData`** is a new exported interface in this module. **`CompletedSessionResult`** gains an optional `healthSyncFailed?: boolean`.

**`SessionFull`** gains an `exerciseMetaById` field. The 4d caller in PostWorkout (`getSession(db, id).then(setSession)`) starts using it; older callers ignore it.

---

## 5. Architecture

```
app/
  (tabs)/move/
    index.tsx                          # CHANGED — adds <RecentSection /> above Strength grid
    post.tsx                           # REPLACED — full PostWorkout per handoff
    history.tsx                        # NEW — full sessions list
    [sessionId]/
      index.tsx                        # NEW — WorkoutDetail
    active.tsx                         # unchanged from 4d
    library.tsx, generate.tsx,
    [routineId]/edit.tsx               # unchanged from 4c

lib/
  workouts/
    post-session-aggregate.ts          # NEW — pure functions, TDD'd
    date-format.ts                     # NEW — formatRelativeDate, TDD'd
    cardio-aggregate.ts                # unchanged from 4d (formatPace, formatDuration)
    pr-detection.ts                    # unchanged from 4a
  db/queries/
    sessions.ts                        # CHANGED — getRecentSessions, listAllSessions,
                                       #            getWeeklyVolumeSeries, getSession ext.,
                                       #            finalizeSession HealthKit branch
  health/
    workouts.ts                        # CHANGED — writeWorkout takes optional distanceKm
    types.ts                           # CHANGED — WorkoutWritePayload + distanceKm?

components/
  post-workout/
    CompleteHero.tsx                   # gradient hero + complete pill + headline + stat grid
    StatGrid.tsx                       # 4-slot strength / 3-slot cardio (mode prop)
    PrHighlightCard.tsx                # one card; PostWorkout stacks up to 2 + "+N more"
    MuscleBars.tsx                     # top 3 + "+N more" line; receives full sorted array
    ExerciseRecapCard.tsx              # name + total volume + per-set mini bar chart
    CardioRecapCard.tsx                # name + duration + distance + pace block
  workout-detail/
    StatTile.tsx                       # 2×2 grid tile (icon + label + value + unit)
    WeeklyVolumeChart.tsx              # hand-rolled bars over series; highlights last bar
    ExerciseTable.tsx                  # set table with PR badge column
  history/
    SessionRow.tsx                     # mode-aware 2-line row used by Recent section + /history
    RecentSection.tsx                  # PreWorkout-embedded wrapper; hidden when N=0
```

### Module boundaries

1. **`post-session-aggregate.ts` is pure.** Takes plain inputs (`SessionSet[]`, `Record<string, ExerciseMeta>`, `now: number`, etc.) and returns plain TS values. No DB, no React, no `Date.now()` — `now` is always passed.
2. **Query layer in `sessions.ts` is the only DB-facing code.** It assembles inputs the pure functions consume.
3. **`finalizeSession`'s HealthKit call lives in the query module, not the route.** One call site; routes don't have to remember to fire side effects.

### Data flow on Finish (4d → 4e handoff)

1. 4d's ActiveSession dispatches `activeSessionStore.finishSession()`.
2. Store calls `finalizeSession(db, sessionId, now)`.
3. `finalizeSession` runs the existing transaction (status flip, PR snapshot, `session_sets.isPr` flags, `prs` upsert, `movement_entries` insert).
4. **NEW**: post-commit, `finalizeSession` calls `writeWorkout` with the resolved activity type and (cardio) distance. Failure → `healthSyncFailed: true` on the result.
5. Store resolves; `activeSessionStore` resets to `idle`. The route in `app/(tabs)/move/active.tsx` (4d code) reads `result.healthSyncFailed` and pushes `router.replace('/move/post?sessionId={id}&healthSyncFailed={1 \| 0}')` — this is the only 4d code touched by 4e.
6. PostWorkout reads via `getSession(db, sessionId)` and renders. The `healthSyncFailed` query param drives the inline "Couldn't sync to Health.app" note above the Done button.

### Aggregate API

```ts
// lib/workouts/post-session-aggregate.ts

export interface MuscleDistribution {
  muscle: string;
  tonnageKg: number;
  percentage: number;       // 0..100, rounded to integer; sum may be 99 or 100 due to rounding
}

export function computeMuscleDistribution(
  sets: SessionSet[],
  exerciseMetaById: Record<string, ExerciseMeta>,
): MuscleDistribution[];   // sorted desc by tonnage

export interface WeeklyVolumeBucket {
  weekStart: number;        // Monday 00:00 local, ms
  tonnageKg: number;
}

export function computeWeeklyVolumeSeries(
  sessions: { finishedAt: number; totalVolumeKg: number }[],
  weeksBack: number,
  now: number,
): WeeklyVolumeBucket[];   // length === weeksBack, oldest first

export interface SelectedPRs {
  top: NewPR[];             // up to N (default 2), sorted by delta desc
  more: number;             // remaining count
}

export function selectTopPRs(prs: NewPR[], n?: number): SelectedPRs;
```

`SessionSet`, `ExerciseMeta`, `NewPR` are already exported from existing modules (`lib/db/queries/sessions.ts`, `lib/workouts/pr-detection.ts`).

---

## 6. Screens

### 6.1 PostWorkout — strength variant

Per `design_handoff/src/workout-screens.jsx:732-963`.

- **Hero:** linear gradient `move → accent`, top inset 56px (no nav bar), inline "✓ COMPLETE" pill (small, dark-translucent), "Nice session." headline (SF Rounded, 34px, weight 700), secondary line — PR teaser if `prCount > 0` ("You hit a new PR on {topPR.exerciseName}"), else duration teaser ("{duration} minutes well spent"). Decorative blobs + diagonal stripe overlay per handoff.
- **Stat grid:** 4 columns × 1 row inside the hero, fused background (`rgba(255,255,255,0.18)` outer, `rgba(0,0,0,0.14)` cells). Cells:
  - **Time** — `Math.round(durationSeconds / 60)`, unit "min".
  - **Volume** — `(totalVolumeKg / 1000).toFixed(1)`, unit "tonnes".
  - **Sets** — `sets.length`, unit "{totalReps} reps".
  - **PRs** — `prCount`, unit "records".
- **PR highlight (0–2 cards):** rendered between hero and muscle bars. Card: gold gradient swatch + star icon, "PERSONAL RECORD" eyebrow, `${exerciseName} · ${weightKg}kg × ${reps}`, delta caption from `selectTopPRs` data ("+5kg from previous best · {previousPR.date}"). When `prs.more > 0`, the second card's caption gets a trailing " · +{more} more PRs unlocked".
- **Muscle distribution:** section header "MUSCLES WORKED" (eyebrow style). Card with up to 3 rows from `MuscleBars` component (label / tonnage / percentage / filled bar). If `distribution.length > 3`, single ink3 caption below: "+ {distribution.length - 3} more".
- **Exercise recap:** section header "EXERCISES · {N}". One `ExerciseRecapCard` per exercise. Header line = exercise name + ★ + total volume; body = N mini bars (one per set), height-proportional to `set.weightKg * set.reps` relative to the session's max-set, PR-set bar tinted `theme.money` with a small dot above. Per-bar caption "{kg}×{reps}".
- **Footer:** single Done CTA (move-tinted, full-width). Replaces the handoff's two-button row.
- **HealthKit-failed inline note:** when `healthSyncFailed=true`, render a small ink3 row above the Done CTA: "Couldn't sync to Health.app — your workout is saved locally."

### 6.2 PostWorkout — cardio variant

Same hero shell, but stat grid drops to 3 cells:

- **Time** — duration as `mm:ss`, unit "min".
- **Distance** — `distanceKm.toFixed(1)`, unit "km".
- **Pace** — `formatPace(durationSeconds, distanceKm)`, unit "/km".

Body is a single **`CardioRecapCard`**: large duration as primary number, distance + pace below in a horizontal pair, no per-set bars (single set). PR card and muscle bars are not rendered. Done CTA.

### 6.3 WorkoutDetail

Per `design_handoff/src/workout-screens2.jsx:259-457`, minus Pal note.

- **Native nav bar:** title = `routineNameSnapshot`, subtitle = `formatRelativeDate(finishedAt, now)` + " · " + `mm:ss` time-of-day for today's sessions, just the relative date for older. Leading back chevron, no trailing.
- **2×2 stat grid:** four `StatTile`s (icon + label + value + unit, 50px decorative blob in corner). Strength: Duration (move) / Volume (accent) / Sets (rituals) / PRs (money). Cardio: Duration / Distance / Pace / **Avg HR** (renders dimmed "—", no value, no unit).
- **8-week volume chart:** section header "Volume over 8 weeks". Title row = current week's tonnage as `34.2` + "t total" suffix, trailing pill `+X% in 4 wks` (computed: `((thisWeek - avgFirst4) / avgFirst4) * 100`, rounded; suppressed if avgFirst4 = 0). 8 hand-rolled bars W1…W8, last bar move-color with the tonnage label floating above it; previous bars `${move}44`.
- **Per-exercise table:** section header "EXERCISES · {N}". One block per exercise: header line = name + total volume; column header row "SET / KG / REPS / —"; one row per set with PR badge in the last column when `set.isPr`. Cardio: single block, header "DURATION / DISTANCE / PACE", one row.

### 6.4 PreWorkout — Recent section

Inserted into `app/(tabs)/move/index.tsx` between the Pal pick block and the "Strength · N" section.

- Header: eyebrow "RECENT" + trailing "See all" link to `/move/history`. Hidden entirely when `getRecentSessions(db, 5)` returns `[]`.
- Body: vertical stack of `SessionRow`s, up to 5.
- Section is hidden when N=0; no empty-state row.

### 6.5 `/move/history` route

- **Native nav bar:** title "History", subtitle `${count} workouts`, leading back chevron.
- **Filter chips row** below nav: All / Strength / Cardio (single-select, default All). Selection drives `listAllSessions(db, modeFilter)`.
- **`FlatList` of `SessionRow`s**, newest first. No date-grouped headers.
- **Empty state** (N=0): single-line "No workouts yet. Start one above." centered, with a CTA chevron back to PreWorkout.

### 6.6 `SessionRow` (shared)

- Two lines, ~64px tall, full-width pressable.
- **Line 1:** routine name (ink, weight 600, 16px), trailing relative-date string (ink3, right-aligned).
- **Line 2** (ink3, 13px, mode-aware):
  - Strength: `${duration} · ${sets} sets · ${volume} kg ★?` — star rendered when `prCount > 0`.
  - Cardio: `${duration} · ${distance} km · ${pace}/km`.
- Pressable; navigates to `/move/${id}`.

### 6.7 Date formatting

`lib/workouts/date-format.ts` — `formatRelativeDate(timestamp, now)`:

| Diff | Output |
|---|---|
| `now - timestamp < 60_000` | "Just now" |
| same calendar day | "Today" |
| previous calendar day | "Yesterday" |
| within last 7 days (excl. above) | weekday short name ("Wed") |
| this calendar year | `MMM d` ("Mar 14") |
| different year | `MMM d, yyyy` ("Mar 14, 2025") |

Pure; `now` always passed in. DST-safe (uses `Date` calendar comparisons, not millisecond offsets).

---

## 7. HealthKit extension

### 7.1 Type changes (`lib/health/types.ts`)

```ts
export interface WorkoutWritePayload {
  activityType: HKActivityType;
  start: Date;
  end: Date;
  distanceKm?: number;        // NEW — cardio sessions only
}
```

### 7.2 `writeWorkout` extension (`lib/health/workouts.ts`)

```ts
export async function writeWorkout(p: WorkoutWritePayload): Promise<void> {
  const samples = p.distanceKm != null
    ? [buildDistanceSample(p.distanceKm, p.start, p.end)]
    : [];
  await saveWorkoutSample(ACTIVITY_TYPE_ID[p.activityType], samples, p.start, p.end);
}
```

The `@kingstinct/react-native-healthkit` API for `saveWorkoutSample` already takes a samples array as the second argument (4b passed `[]`). Distance is a write-only `HKQuantityTypeIdentifier.distanceWalkingRunning` sample; it's bundled with workout-write authorization, so no new permission prompt.

**The exact sample-object shape consumed by this library is a plan-time lookup** (the API has shifted across kingstinct versions; resolve via context7 against the version pinned in `package.json`). The contract that matters here: `writeWorkout` accepts an optional `distanceKm`, populates a samples array for cardio, leaves it empty for strength.

### 7.3 Activity type mapping

Pure helper, TDD'd:

```ts
export function activityTypeFor(
  session: { mode: SessionMode },
  exercises: { equipment: string }[],
): HKActivityType {
  if (session.mode === 'strength') return 'traditionalStrengthTraining';
  // mode === 'cardio' — single-exercise per 4d locked rule
  const equipment = exercises[0]?.equipment?.toLowerCase() ?? '';
  if (equipment.includes('rower')) return 'rowing';
  if (equipment.includes('treadmill') || equipment.includes('outdoor run')) return 'running';
  return 'other';
}
```

Tested against the seeded cardio routines: Treadmill Intervals → `running`, Row 5k → `rowing`.

### 7.4 `finalizeSession` integration

Inside `lib/db/queries/sessions.ts`, after the existing transactional finalize body resolves:

```ts
let healthSyncFailed: boolean | undefined;
try {
  const session = await getSession(db, sessionId);   // hydrates with exerciseMetaById
  const distanceKm = session.mode === 'cardio'
    ? session.sets[0]?.distanceKm ?? undefined
    : undefined;
  const exercises = session.sets
    .map(s => session.exerciseMetaById[s.exerciseId])
    .filter(Boolean);
  await writeWorkout({
    activityType: activityTypeFor(session, exercises),
    start: new Date(session.startedAt),
    end: new Date(finishedAt),
    distanceKm,
  });
} catch (err) {
  console.warn('[finalizeSession] HealthKit write failed', err);
  healthSyncFailed = true;
}

return { sessionId, prCount, totalVolumeKg, healthSyncFailed };
```

**Why post-commit, not inside the transaction:**

- HealthKit write can take 100ms–2s on cold starts (permission revalidation, watchOS sync). Holding a SQLite transaction across the native bridge is a deadlock risk.
- HealthKit can fail orthogonally (permission revoked, watch app uninstalled, iOS background limits). DB is source of truth; Health is a mirror.
- "DB succeeded, Health failed" is a recoverable user state — surface a quiet toast. "DB failed" already aborts before HealthKit is called.

### 7.5 Permission gating

When permission isn't granted yet, `writeWorkout` is a no-op (early return after a permission check). Permission UI lives in 4b's settings surface; PostWorkout doesn't prompt. The user has already consented during 4b setup.

If permission was granted then revoked, `writeWorkout` rejects → `healthSyncFailed: true` → quiet inline note. No retry button this slice (manual re-finalize would re-create the workout — bigger surface; defer to SP4g if it ever matters).

---

## 8. TDD scope

| Module | Tests | Approx. count |
|---|---|---|
| `lib/workouts/post-session-aggregate.ts` | `computeMuscleDistribution`: empty sets → empty array; sets across 3 muscles → sorted desc with correct percentages summing to 100 (or 99/100 with rounding); cardio sets (null weight/reps) excluded; missing exercise meta → contribution skipped, others recomputed. `computeWeeklyVolumeSeries`: empty list → `weeksBack` zeros; sessions across 8 ISO weeks → correct bucketing; sessions older than `weeksBack` ignored; multiple sessions in same week sum; week labels stable across DST. `selectTopPRs`: 0/1/2/3+ PRs → returns top N (delta-sorted) and `more` count. | ~14 |
| `lib/workouts/date-format.ts` | `formatRelativeDate`: `< 60s` → "Just now"; same day → "Today"; previous day → "Yesterday"; within 7d → weekday; current year → `MMM d`; prior year → `MMM d, yyyy`. DST boundary case (timestamp 25h ago across spring-forward → still "Yesterday" by calendar comparison). | ~7 |
| `lib/health/workouts.ts` | `activityTypeFor`: strength → `traditionalStrengthTraining`; treadmill cardio → `running`; rower cardio → `rowing`; unknown equipment → `other`. `writeWorkout` payload assembly: no distance → `samples=[]`; cardio with distance → one distance sample with correct unit and dates. (Mock `saveWorkoutSample`, assert call shape.) | ~6 |
| `lib/db/queries/sessions.ts` (new) | `getRecentSessions`: limit honored, draft sessions excluded, ordered by `finishedAt DESC`, returns mode-aware fields. `listAllSessions`: same minus limit; mode filter narrows correctly. `getWeeklyVolumeSeries`: 8-element array, bucketing correctness, drafts excluded. `finalizeSession` HealthKit branch: success → `healthSyncFailed` undefined; mocked `writeWorkout` rejection → `healthSyncFailed=true` and DB row still committed. | ~10 |

**Not TDD'd:**

- All components in `components/post-workout/`, `components/workout-detail/`, `components/history/`. Visual verification only.
- The `WeeklyVolumeChart` rendering math (bar height percentages) is trivial JSX; the underlying `computeWeeklyVolumeSeries` is the TDD'd surface.
- The `expo-router` glue in `[sessionId]/index.tsx` and `history.tsx`.
- The `RecentSection` wrapper (it's a hook + a list).

---

## 9. Error handling

| Failure | Behavior |
|---|---|
| `getSession` returns null on PostWorkout / WorkoutDetail | Render skeleton placeholder + a "Couldn't load this workout" message; back-button works. |
| `writeWorkout` throws in `finalizeSession` | DB commit succeeds, `healthSyncFailed=true` returned, PostWorkout shows quiet inline note. |
| HealthKit permission not granted | `writeWorkout` no-ops (early return). No toast — permission UX is 4b's. |
| `getWeeklyVolumeSeries` throws | WorkoutDetail hides the chart section; rest of screen renders. Logged, not surfaced. |
| Empty history (zero completed sessions) | PreWorkout: Recent section hidden. `/history`: empty state with CTA back. |
| Past session has zero exercises (corrupt) | WorkoutDetail per-exercise table renders empty list with a small "No exercises logged" hint. Stats still render (zeros). |

---

## 10. Scope cuts

Explicitly cut from 4e:

| Item | Reason |
|---|---|
| Pal note on WorkoutDetail | SP5 owns review-flavored content. Slot omitted, not feature-flagged. |
| Share button on PostWorkout | Personal-use app, no recipient. Single Done CTA. |
| HR persistence + HR-avg stat tile | Reverses 4d's "live HR is read-only" decision; SP4g territory. |
| Calorie / energy estimate | Needs user weight; not modeled. Defer. |
| Date-grouped headers on `/history` ("This week" / "March") | YAGNI for MVP. |
| Pull-to-refresh on `/history` | SQLite is local; no network round-trip to refresh. List re-renders via `useLiveQuery` if used. |
| Search / text filter on `/history` | YAGNI. Mode chip is enough triage for v2. |
| Editing a past session from WorkoutDetail | Mid-session edit (4d) covers the common case. v3+. |
| Deleting a past session | Out of scope. Personal-use, single device. v3+. |
| Exporting (CSV / Health backup) | Out of scope. |
| Sub-routes under `[sessionId]/` (Share, Edit, Delete) | None ship in 4e; the directory exists for future expansion. |
| Victory Native chart adoption | Hand-rolled bars suffice. Picking up Victory should be its own decision when 2+ charts amortize the dep. |
| Pal note "Try 92.5kg next push day" suggestion | Same as Pal note above — SP5 territory. |

---

## 11. What this spec is NOT

- Not a product spec for SP4f (AI Routine Generator) or SP4g (Live Activities).
- Not an implementation plan. The next step (after user review of this spec) is invoking `superpowers:writing-plans` to produce the plan for 4e.
- Not a schedule.
