# SP4e — Post-Workout + History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 4d's PostWorkout stub with the full summary screen, ship a WorkoutDetail screen plus a Recent section + `/history` route on PreWorkout, and extend HealthKit `writeWorkout` to carry distance for cardio.

**Architecture:** Three layers, each with its own commit cadence. (1) Pure aggregate helpers (`post-session-aggregate.ts`, `date-format.ts`, `activity-type.ts`) — TDD'd, no React, no DB. (2) Read queries on `sessions.ts` that assemble inputs the pure helpers consume + a HealthKit branch added to `finalizeSession` post-commit. (3) UI: PostWorkout (replaces stub), WorkoutDetail (new), SessionRow + RecentSection on PreWorkout, `/history` route. Visual verification only on the UI layer. No schema delta.

**Tech Stack:** TypeScript + React Native 0.81 (Expo SDK 54), Drizzle ORM over expo-sqlite (better-sqlite3 in tests), Zustand (4d's `activeSessionStore`), `@kingstinct/react-native-healthkit` 14, Jest 29 with `jest-expo`, NativeWind v4 + RN inline styles per existing 4d/4c convention.

**Spec:** `docs/superpowers/specs/2026-04-26-sp4e-post-workout-history-design.md`

---

## Conventions used throughout

- All test files use `/** @jest-environment node */` at the top and live in a `__tests__` directory next to the source.
- DB tests use `makeTestDb()` and `insertCompletedSessionForTests()` from `lib/db/__tests__/test-helpers.ts`.
- Run tests with `npm test -- <pattern>`.
- Run typecheck with `npx tsc --noEmit`.
- Commit message format: `feat(sp4e): <short summary>` for code, `test(sp4e): <short summary>` for test-only commits, `refactor(sp4e): <short summary>` for non-functional refactors. Project CLAUDE.md prohibits `Co-Authored-By: Claude` — do not add it.
- Each task ends with a commit step. Stage only the files the task touched (avoid `git add -A`).

---

## Task 1: Extend `WorkoutWritePayload` and `writeWorkout` to carry distance

**Files:**
- Modify: `lib/health/types.ts`
- Modify: `lib/health/workouts.ts`
- Test: `lib/health/__tests__/workouts.test.ts` (new)

**Context:** The current `writeWorkout` calls `saveWorkoutSample(activityType, [], start, end)` — empty samples array. We need to pass a single distance sample for cardio. The `@kingstinct/react-native-healthkit` v14 sample-object shape should be confirmed via context7 (`mcp__plugin_context7_context7__query-docs` for `@kingstinct/react-native-healthkit` v14 `saveWorkoutSample`) before implementing — the steps below write the contract `writeWorkout` exposes; the implementation body adapts to whatever the library expects today.

- [ ] **Step 1: Confirm sample-object shape via context7**

Use `mcp__plugin_context7_context7__resolve-library-id` for `@kingstinct/react-native-healthkit`, then `mcp__plugin_context7_context7__query-docs` with `topic: "saveWorkoutSample distance sample"` and `version: 14`. Note the field names (`type` / `unit` / `quantity` / `startDate` / `endDate` or whatever the v14 API names them). Use those names in the implementation in step 4.

- [ ] **Step 2: Write the failing test**

Create `lib/health/__tests__/workouts.test.ts`:

```ts
/** @jest-environment node */

const saveWorkoutSampleMock = jest.fn().mockResolvedValue(undefined);

jest.mock('@kingstinct/react-native-healthkit', () => ({
  __esModule: true,
  saveWorkoutSample: (...args: unknown[]) => saveWorkoutSampleMock(...args),
  WorkoutActivityType: {
    traditionalStrengthTraining: 1,
    running: 2,
    rowing: 3,
    other: 0,
  },
}));

import { writeWorkout } from '../workouts';

const start = new Date('2026-04-26T10:00:00Z');
const end   = new Date('2026-04-26T10:47:00Z');

describe('writeWorkout', () => {
  beforeEach(() => {
    saveWorkoutSampleMock.mockClear();
  });

  it('passes empty samples for strength sessions (no distance)', async () => {
    await writeWorkout({ activityType: 'traditionalStrengthTraining', start, end });
    expect(saveWorkoutSampleMock).toHaveBeenCalledTimes(1);
    const [, samples, callStart, callEnd] = saveWorkoutSampleMock.mock.calls[0];
    expect(samples).toEqual([]);
    expect(callStart).toBe(start);
    expect(callEnd).toBe(end);
  });

  it('passes one distance sample for cardio sessions when distanceKm provided', async () => {
    await writeWorkout({ activityType: 'running', start, end, distanceKm: 3.5 });
    expect(saveWorkoutSampleMock).toHaveBeenCalledTimes(1);
    const [, samples] = saveWorkoutSampleMock.mock.calls[0];
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ quantity: 3.5, unit: 'km' });
  });

  it('omits distance sample when distanceKm is undefined', async () => {
    await writeWorkout({ activityType: 'running', start, end });
    const [, samples] = saveWorkoutSampleMock.mock.calls[0];
    expect(samples).toEqual([]);
  });

  it('omits distance sample when distanceKm is 0 or negative (defensive)', async () => {
    await writeWorkout({ activityType: 'running', start, end, distanceKm: 0 });
    const [, samples] = saveWorkoutSampleMock.mock.calls[0];
    expect(samples).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- lib/health/__tests__/workouts.test.ts`

Expected: FAIL — current `writeWorkout` always passes `[]`; the second/third test expecting a distance sample fails.

- [ ] **Step 4: Update `lib/health/types.ts`**

```ts
export type HKActivityType =
  | 'traditionalStrengthTraining'
  | 'running'
  | 'rowing'
  | 'other';

export type WorkoutWritePayload = {
  activityType: HKActivityType;
  start: Date;
  end: Date;
  distanceKm?: number;
};

export type HRSample = {
  bpm: number;
  sampledAt: Date;
};
```

- [ ] **Step 5: Update `lib/health/workouts.ts`**

Use the field names confirmed in Step 1. The shape below assumes the common `{ type, quantity, unit, startDate, endDate }` form; adjust to match the v14 docs:

```ts
import {
  saveWorkoutSample,
  WorkoutActivityType,
} from '@kingstinct/react-native-healthkit';
import type { HKActivityType, WorkoutWritePayload } from './types';

const ACTIVITY_TYPE_ID: Record<HKActivityType, WorkoutActivityType> = {
  traditionalStrengthTraining: WorkoutActivityType.traditionalStrengthTraining,
  running: WorkoutActivityType.running,
  rowing: WorkoutActivityType.rowing,
  other: WorkoutActivityType.other,
};

export async function writeWorkout(p: WorkoutWritePayload): Promise<void> {
  const samples =
    p.distanceKm !== undefined && p.distanceKm > 0
      ? [
          {
            type: 'HKQuantityTypeIdentifierDistanceWalkingRunning' as const,
            quantity: p.distanceKm,
            unit: 'km' as const,
            startDate: p.start,
            endDate: p.end,
          },
        ]
      : [];
  await saveWorkoutSample(ACTIVITY_TYPE_ID[p.activityType], samples, p.start, p.end);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- lib/health/__tests__/workouts.test.ts`

Expected: PASS — 4/4 tests green.

- [ ] **Step 7: Commit**

```bash
git add lib/health/types.ts lib/health/workouts.ts lib/health/__tests__/workouts.test.ts
git commit -m "feat(sp4e): writeWorkout accepts optional distanceKm"
```

---

## Task 2: Request distance write permission

**Files:**
- Modify: `lib/health/permissions.ts`

**Context:** Current `requestAuthorization` requests `HKWorkoutTypeIdentifier` for share. To write distance samples we need `HKQuantityTypeIdentifierDistanceWalkingRunning` in the share list as well. No new test — `permissions.ts` is verified by the smoke test on iPhone, not unit-tested.

- [ ] **Step 1: Update `lib/health/permissions.ts`**

```ts
import { requestAuthorization } from '@kingstinct/react-native-healthkit';

export async function requestPermissions(): Promise<{ granted: boolean }> {
  // iOS deliberately hides per-type grants; we treat "user responded to sheet"
  // as granted=true. Real failures surface as thrown errors at write/read time.
  try {
    const ok = await requestAuthorization({
      toShare: [
        'HKWorkoutTypeIdentifier',
        'HKQuantityTypeIdentifierDistanceWalkingRunning',
      ],
      toRead: ['HKQuantityTypeIdentifierHeartRate'],
    });
    return { granted: ok };
  } catch {
    return { granted: false };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/health/permissions.ts
git commit -m "feat(sp4e): request distance-write permission for cardio"
```

---

## Task 3: `activityTypeFor` pure helper

**Files:**
- Create: `lib/health/activity-type.ts`
- Test: `lib/health/__tests__/activity-type.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/health/__tests__/activity-type.test.ts`:

```ts
/** @jest-environment node */
import { activityTypeFor } from '../activity-type';

describe('activityTypeFor', () => {
  it('returns traditionalStrengthTraining for strength sessions regardless of equipment', () => {
    expect(
      activityTypeFor({ mode: 'strength' }, [{ equipment: 'Barbell' }]),
    ).toBe('traditionalStrengthTraining');
    expect(
      activityTypeFor({ mode: 'strength' }, []),
    ).toBe('traditionalStrengthTraining');
  });

  it('maps treadmill cardio to running', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Treadmill' }]),
    ).toBe('running');
  });

  it('maps outdoor-run cardio to running', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Outdoor Run' }]),
    ).toBe('running');
  });

  it('maps rower cardio to rowing', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Rower' }]),
    ).toBe('rowing');
  });

  it('maps unknown cardio equipment to other', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'Stair climber' }]),
    ).toBe('other');
  });

  it('maps cardio with no exercises to other (defensive)', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, []),
    ).toBe('other');
  });

  it('matches case-insensitively', () => {
    expect(
      activityTypeFor({ mode: 'cardio' }, [{ equipment: 'TREADMILL' }]),
    ).toBe('running');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/health/__tests__/activity-type.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/health/activity-type.ts`**

```ts
import type { HKActivityType } from './types';

export function activityTypeFor(
  session: { mode: 'strength' | 'cardio' },
  exercises: { equipment: string }[],
): HKActivityType {
  if (session.mode === 'strength') return 'traditionalStrengthTraining';
  const equipment = exercises[0]?.equipment?.toLowerCase() ?? '';
  if (equipment.includes('rower')) return 'rowing';
  if (equipment.includes('treadmill') || equipment.includes('outdoor run')) return 'running';
  return 'other';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/health/__tests__/activity-type.test.ts`

Expected: PASS — 7/7 green.

- [ ] **Step 5: Commit**

```bash
git add lib/health/activity-type.ts lib/health/__tests__/activity-type.test.ts
git commit -m "feat(sp4e): activityTypeFor maps session mode + equipment to HKActivityType"
```

---

## Task 4: `computeMuscleDistribution` pure helper

**Files:**
- Create: `lib/workouts/post-session-aggregate.ts`
- Test: `lib/workouts/__tests__/post-session-aggregate.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/workouts/__tests__/post-session-aggregate.test.ts`:

```ts
/** @jest-environment node */
import { computeMuscleDistribution } from '../post-session-aggregate';

const meta = {
  bench:    { name: 'Bench Press',    muscle: 'Chest',     group: 'Push' },
  ohp:      { name: 'Overhead Press', muscle: 'Shoulders', group: 'Push' },
  triceps:  { name: 'Tricep Pushdown',muscle: 'Triceps',   group: 'Push' },
  treadmil: { name: 'Treadmill',      muscle: '',          group: 'Cardio' },
};

const set = (
  exerciseId: string,
  weightKg: number | null,
  reps: number | null,
) => ({
  exerciseId,
  exercisePosition: 0,
  setPosition: 0,
  reps,
  weightKg,
  durationSeconds: null,
  distanceKm: null,
  isPr: 0,
});

describe('computeMuscleDistribution', () => {
  it('returns empty array when no sets', () => {
    expect(computeMuscleDistribution([], meta)).toEqual([]);
  });

  it('sums volume per muscle and sorts desc by tonnage', () => {
    const sets = [
      set('bench',   80, 5),  // 400 chest
      set('bench',   85, 5),  // 425 chest -> total 825
      set('ohp',     50, 6),  // 300 shoulders
      set('triceps', 30, 10), // 300 triceps
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out.map((m) => m.muscle)).toEqual(['Chest', 'Shoulders', 'Triceps']);
    expect(out[0].tonnageKg).toBe(825);
    expect(out[1].tonnageKg).toBe(300);
    expect(out[2].tonnageKg).toBe(300);
  });

  it('percentages are integers and sum to 99 or 100', () => {
    const sets = [
      set('bench',   80, 5),  // 400
      set('ohp',     50, 6),  // 300
      set('triceps', 30, 10), // 300
    ];
    const out = computeMuscleDistribution(sets, meta);
    const sum = out.reduce((s, m) => s + m.percentage, 0);
    expect(out.every((m) => Number.isInteger(m.percentage))).toBe(true);
    expect(sum === 99 || sum === 100).toBe(true);
  });

  it('excludes cardio sets (null weight or reps)', () => {
    const sets = [
      set('bench', 80, 5),
      { ...set('treadmil', null, null), durationSeconds: 1800, distanceKm: 5 },
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out).toHaveLength(1);
    expect(out[0].muscle).toBe('Chest');
  });

  it('skips contributions for unknown exercise ids without crashing', () => {
    const sets = [
      set('bench', 80, 5),
      set('ghost', 50, 5),
    ];
    const out = computeMuscleDistribution(sets, meta);
    expect(out).toHaveLength(1);
    expect(out[0].muscle).toBe('Chest');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/workouts/post-session-aggregate.ts`**

```ts
import type { SessionSet } from '@/lib/db/schema';

export interface ExerciseMeta {
  name: string;
  muscle: string;
  group: string;
}

export interface MuscleDistribution {
  muscle: string;
  tonnageKg: number;
  percentage: number; // 0..100, rounded, sum may be 99 or 100
}

export function computeMuscleDistribution(
  sets: SessionSet[],
  exerciseMetaById: Record<string, ExerciseMeta>,
): MuscleDistribution[] {
  const byMuscle = new Map<string, number>();
  for (const s of sets) {
    if (s.weightKg == null || s.reps == null) continue;
    const meta = exerciseMetaById[s.exerciseId];
    if (!meta) continue;
    const muscle = meta.muscle;
    if (!muscle) continue;
    byMuscle.set(muscle, (byMuscle.get(muscle) ?? 0) + s.weightKg * s.reps);
  }

  const total = Array.from(byMuscle.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  return Array.from(byMuscle.entries())
    .map(([muscle, tonnageKg]) => ({
      muscle,
      tonnageKg,
      percentage: Math.round((tonnageKg / total) * 100),
    }))
    .sort((a, b) => b.tonnageKg - a.tonnageKg);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: PASS — 5/5 green.

- [ ] **Step 5: Commit**

```bash
git add lib/workouts/post-session-aggregate.ts lib/workouts/__tests__/post-session-aggregate.test.ts
git commit -m "feat(sp4e): computeMuscleDistribution sums per-muscle volume and sorts desc"
```

---

## Task 5: `computeWeeklyVolumeSeries` pure helper

**Files:**
- Modify: `lib/workouts/post-session-aggregate.ts`
- Modify: `lib/workouts/__tests__/post-session-aggregate.test.ts`

**Context:** Bucketing is by ISO-week-style **Monday 00:00 local**. Use a small helper `mondayMidnightLocal(now)` inline. DST-safe because we do calendar comparisons on `Date`, not millisecond offsets.

- [ ] **Step 1: Add failing tests**

Append to `lib/workouts/__tests__/post-session-aggregate.test.ts`:

```ts
import { computeWeeklyVolumeSeries } from '../post-session-aggregate';

const session = (finishedAt: number, totalVolumeKg: number) => ({ finishedAt, totalVolumeKg });

// Wednesday April 22, 2026 14:00 local
const NOW = new Date(2026, 3, 22, 14, 0, 0).getTime();

describe('computeWeeklyVolumeSeries', () => {
  it('returns weeksBack zeros when no sessions', () => {
    const out = computeWeeklyVolumeSeries([], 8, NOW);
    expect(out).toHaveLength(8);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('places this-week session in the last bucket', () => {
    const today = new Date(2026, 3, 22, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(today, 1000)], 8, NOW);
    expect(out[7].tonnageKg).toBe(1000);
    expect(out.slice(0, 7).every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('places last-week session in the second-to-last bucket', () => {
    const lastWeek = new Date(2026, 3, 15, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(lastWeek, 800)], 8, NOW);
    expect(out[6].tonnageKg).toBe(800);
    expect(out[7].tonnageKg).toBe(0);
  });

  it('sums multiple sessions in the same week', () => {
    const monday = new Date(2026, 3, 20, 9, 0, 0).getTime();   // Mon
    const wednesday = new Date(2026, 3, 22, 9, 0, 0).getTime(); // Wed
    const out = computeWeeklyVolumeSeries(
      [session(monday, 500), session(wednesday, 700)],
      8,
      NOW,
    );
    expect(out[7].tonnageKg).toBe(1200);
  });

  it('ignores sessions older than weeksBack', () => {
    // 10 weeks ago
    const ancient = new Date(2026, 1, 11, 12, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(ancient, 999)], 8, NOW);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('returns buckets oldest first with monotonically increasing weekStart', () => {
    const out = computeWeeklyVolumeSeries([], 8, NOW);
    for (let i = 1; i < out.length; i++) {
      expect(out[i].weekStart).toBeGreaterThan(out[i - 1].weekStart);
    }
  });

  it('handles "now" on a Sunday correctly (week starts Monday)', () => {
    const sundayNow = new Date(2026, 3, 26, 14, 0, 0).getTime(); // Sun Apr 26 2026
    const sundaySession = new Date(2026, 3, 26, 9, 0, 0).getTime();
    const out = computeWeeklyVolumeSeries([session(sundaySession, 600)], 8, sundayNow);
    expect(out[7].tonnageKg).toBe(600); // current week is Mon Apr 20–Sun Apr 26
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: FAIL — `computeWeeklyVolumeSeries` is not exported.

- [ ] **Step 3: Add implementation to `lib/workouts/post-session-aggregate.ts`**

Append:

```ts
export interface WeeklyVolumeBucket {
  weekStart: number; // Monday 00:00 local, ms
  tonnageKg: number;
}

function mondayMidnightLocal(at: number): number {
  const d = new Date(at);
  const dow = d.getDay();              // 0=Sun..6=Sat
  const daysSinceMonday = (dow + 6) % 7; // Mon=0, Sun=6
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysSinceMonday);
  return d.getTime();
}

function addWeeks(monday: number, weeks: number): number {
  const d = new Date(monday);
  d.setDate(d.getDate() + weeks * 7);
  return d.getTime();
}

export function computeWeeklyVolumeSeries(
  sessions: { finishedAt: number; totalVolumeKg: number }[],
  weeksBack: number,
  now: number,
): WeeklyVolumeBucket[] {
  const currentMonday = mondayMidnightLocal(now);
  const buckets: WeeklyVolumeBucket[] = [];
  for (let i = weeksBack - 1; i >= 0; i--) {
    buckets.push({ weekStart: addWeeks(currentMonday, -i), tonnageKg: 0 });
  }
  // index from weekStart
  const idx = new Map<number, number>();
  buckets.forEach((b, i) => idx.set(b.weekStart, i));

  for (const s of sessions) {
    const monday = mondayMidnightLocal(s.finishedAt);
    const i = idx.get(monday);
    if (i !== undefined) {
      buckets[i].tonnageKg += s.totalVolumeKg;
    }
  }
  return buckets;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: PASS — all aggregate tests green (12+ assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/workouts/post-session-aggregate.ts lib/workouts/__tests__/post-session-aggregate.test.ts
git commit -m "feat(sp4e): computeWeeklyVolumeSeries buckets sessions by Monday-week"
```

---

## Task 6: `selectTopPRs` pure helper

**Files:**
- Modify: `lib/workouts/post-session-aggregate.ts`
- Modify: `lib/workouts/__tests__/post-session-aggregate.test.ts`

**Context:** PostWorkout loads after `finalizeSession` has already upserted the `prs` table — the previous-best info is gone. So `selectTopPRs` cannot compute deltas reliably; it operates on persisted `isPr`-flagged session sets and ranks by absolute new weight desc. The PR highlight card shows "PERSONAL RECORD · {name} · {weight}kg × {reps}" with no delta caption (the spec's "+5kg from previous best" copy was a handoff aspiration that's not viable without a schema delta — explicitly cut here).

- [ ] **Step 1: Add failing tests**

Append to `lib/workouts/__tests__/post-session-aggregate.test.ts`:

```ts
import { selectTopPRs, type PrHighlight } from '../post-session-aggregate';

describe('selectTopPRs', () => {
  const exMeta = {
    bench: { name: 'Bench Press',    muscle: 'Chest',     group: 'Push' },
    ohp:   { name: 'Overhead Press', muscle: 'Shoulders', group: 'Push' },
    squat: { name: 'Back Squat',     muscle: 'Quads',     group: 'Legs' },
  };

  const prInput = (exerciseId: string, weightKg: number, reps: number) => ({
    exerciseId,
    weightKg,
    reps,
  });

  it('returns empty top + 0 more when no PRs', () => {
    const out = selectTopPRs([], exMeta);
    expect(out).toEqual({ top: [], more: 0 });
  });

  it('caps top at N (default 2) and reports the rest in more', () => {
    const out = selectTopPRs(
      [prInput('bench', 90, 5), prInput('ohp', 50, 6), prInput('squat', 105, 5)],
      exMeta,
    );
    expect(out.top).toHaveLength(2);
    expect(out.more).toBe(1);
  });

  it('sorts by newWeightKg descending', () => {
    const out = selectTopPRs(
      [prInput('ohp', 50, 6), prInput('bench', 90, 5), prInput('squat', 105, 5)],
      exMeta,
      5,
    );
    expect(out.top.map((p) => p.exerciseId)).toEqual(['squat', 'bench', 'ohp']);
  });

  it('hydrates exerciseName from meta', () => {
    const out = selectTopPRs([prInput('bench', 90, 5)], exMeta);
    expect(out.top[0].exerciseName).toBe('Bench Press');
    expect(out.top[0].newWeightKg).toBe(90);
    expect(out.top[0].newReps).toBe(5);
  });

  it('falls back to exerciseId when meta is missing', () => {
    const out = selectTopPRs([prInput('ghost', 30, 5)], exMeta);
    expect(out.top[0].exerciseName).toBe('ghost');
  });

  it('deduplicates per exerciseId, keeping the best by weight × reps', () => {
    // a single session can have multiple isPr=1 sets per exercise; the highlight
    // is the heaviest one
    const out = selectTopPRs(
      [prInput('bench', 80, 5), prInput('bench', 90, 5), prInput('bench', 85, 5)],
      exMeta,
      5,
    );
    expect(out.top).toHaveLength(1);
    expect(out.top[0].newWeightKg).toBe(90);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: FAIL — `selectTopPRs` not exported.

- [ ] **Step 3: Add implementation to `lib/workouts/post-session-aggregate.ts`**

Append:

```ts
export interface PrHighlight {
  exerciseId: string;
  exerciseName: string;
  newWeightKg: number;
  newReps: number;
}

export interface PrInput {
  exerciseId: string;
  weightKg: number;
  reps: number;
}

export interface SelectedPRs {
  top: PrHighlight[];
  more: number;
}

export function selectTopPRs(
  prs: PrInput[],
  exerciseMetaById: Record<string, ExerciseMeta>,
  n = 2,
): SelectedPRs {
  // Dedupe per exercise: keep the set with the highest weight × reps.
  const bestByExercise = new Map<string, PrInput>();
  for (const p of prs) {
    const existing = bestByExercise.get(p.exerciseId);
    if (!existing || p.weightKg * p.reps > existing.weightKg * existing.reps) {
      bestByExercise.set(p.exerciseId, p);
    }
  }

  const highlights: PrHighlight[] = Array.from(bestByExercise.values()).map((p) => ({
    exerciseId: p.exerciseId,
    exerciseName: exerciseMetaById[p.exerciseId]?.name ?? p.exerciseId,
    newWeightKg: p.weightKg,
    newReps: p.reps,
  }));

  highlights.sort((a, b) => b.newWeightKg - a.newWeightKg);

  return {
    top: highlights.slice(0, n),
    more: Math.max(0, highlights.length - n),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/workouts/__tests__/post-session-aggregate.test.ts`

Expected: PASS — all aggregate tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/workouts/post-session-aggregate.ts lib/workouts/__tests__/post-session-aggregate.test.ts
git commit -m "feat(sp4e): selectTopPRs ranks isPr-flagged sets by weight desc"
```

---

## Task 7: `formatRelativeDate` pure helper

**Files:**
- Create: `lib/workouts/date-format.ts`
- Test: `lib/workouts/__tests__/date-format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/workouts/__tests__/date-format.test.ts`:

```ts
/** @jest-environment node */
import { formatRelativeDate } from '../date-format';

// Anchor: Wednesday April 22, 2026 14:00 local
const NOW = new Date(2026, 3, 22, 14, 0, 0).getTime();

describe('formatRelativeDate', () => {
  it('returns "Just now" for < 60s ago', () => {
    expect(formatRelativeDate(NOW - 30_000, NOW)).toBe('Just now');
    expect(formatRelativeDate(NOW - 59_000, NOW)).toBe('Just now');
  });

  it('returns "Today" for same calendar day, > 60s ago', () => {
    const earlierToday = new Date(2026, 3, 22, 8, 0, 0).getTime();
    expect(formatRelativeDate(earlierToday, NOW)).toBe('Today');
  });

  it('returns "Yesterday" for previous calendar day', () => {
    const yesterday = new Date(2026, 3, 21, 23, 0, 0).getTime();
    expect(formatRelativeDate(yesterday, NOW)).toBe('Yesterday');
  });

  it('returns weekday short name for 2-7 days ago', () => {
    const monday = new Date(2026, 3, 20, 12, 0, 0).getTime();
    expect(formatRelativeDate(monday, NOW)).toBe('Mon');
    const lastWed = new Date(2026, 3, 15, 12, 0, 0).getTime();
    expect(formatRelativeDate(lastWed, NOW)).toBe('Wed');
  });

  it('returns "MMM d" for current year (> 7 days ago)', () => {
    const earlier = new Date(2026, 2, 14, 12, 0, 0).getTime(); // March 14
    expect(formatRelativeDate(earlier, NOW)).toBe('Mar 14');
  });

  it('returns "MMM d, yyyy" for prior years', () => {
    const lastYear = new Date(2025, 9, 14, 12, 0, 0).getTime(); // Oct 14 2025
    expect(formatRelativeDate(lastYear, NOW)).toBe('Oct 14, 2025');
  });

  it('uses calendar comparison, not 24h offset (DST-safe)', () => {
    // ts is 25h before NOW but on the previous calendar day -> "Yesterday"
    const ts = new Date(2026, 3, 21, 13, 0, 0).getTime();
    expect(formatRelativeDate(ts, NOW)).toBe('Yesterday');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/workouts/__tests__/date-format.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `lib/workouts/date-format.ts`**

```ts
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(at: number): number {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dayDiff(now: number, ts: number): number {
  return Math.round((startOfDay(now) - startOfDay(ts)) / (24 * 60 * 60 * 1000));
}

export function formatRelativeDate(timestamp: number, now: number): string {
  const ms = now - timestamp;
  if (ms < 60_000) return 'Just now';

  const days = dayDiff(now, timestamp);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days >= 2 && days <= 6) {
    return WEEKDAYS[new Date(timestamp).getDay()];
  }

  const d = new Date(timestamp);
  const sameYear = new Date(now).getFullYear() === d.getFullYear();
  const monthDay = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return sameYear ? monthDay : `${monthDay}, ${d.getFullYear()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- lib/workouts/__tests__/date-format.test.ts`

Expected: PASS — 7/7 green.

- [ ] **Step 5: Commit**

```bash
git add lib/workouts/date-format.ts lib/workouts/__tests__/date-format.test.ts
git commit -m "feat(sp4e): formatRelativeDate uses calendar comparison for DST safety"
```

---

## Task 8: Extend `getSession` with mode + exerciseMetaById

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1: Add failing test**

Append to `lib/db/__tests__/sessions.test.ts`:

```ts
describe('getSession with mode + exerciseMetaById extension', () => {
  it('returns mode="strength" and hydrates exerciseMetaById from exercises table', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSessionForTests(db, baseDraft());
    const full = await getSession(db, sessionId);
    expect(full).not.toBeNull();
    expect(full!.mode).toBe('strength');
    expect(full!.exerciseMetaById['bench']).toBeDefined();
    expect(full!.exerciseMetaById['bench'].name).toBeTruthy();
    expect(full!.exerciseMetaById['ohp']).toBeDefined();
  });

  it('returns mode="cardio" when first exercise has kind=cardio', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    // Treadmill is in the seeded catalog; check seed-workouts for the canonical id.
    // Use 'treadmill-intervals' as exerciseId if it exists; otherwise pick whatever
    // seeded exercise has kind='cardio' from the seed dump.
    const cardio = await insertCompletedSessionForTests(db, {
      routineId: null,
      routineNameSnapshot: 'Treadmill Intervals',
      startedAt: 2_000_000,
      finishedAt: 2_000_000 + 28 * 60 * 1000,
      sets: [
        {
          exerciseId: 'treadmill',
          exercisePosition: 0,
          setPosition: 0,
          reps: null,
          weightKg: null,
          durationSeconds: 28 * 60,
          distanceKm: 3.5,
        },
      ],
    });
    const full = await getSession(db, cardio.sessionId);
    expect(full!.mode).toBe('cardio');
  });
});
```

> Confirmed seed ids in `lib/db/seed-workouts.ts`: cardio exercises include `treadmill`, `rower`, `bike`, `stairmaster`. The test uses `'treadmill'`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: FAIL — `mode` and `exerciseMetaById` are not on `SessionFull`.

- [ ] **Step 3: Update `lib/db/queries/sessions.ts`**

In the imports, add `exercises` from `../schema`. Update the type:

```ts
import { exercises as exercisesTable, movementEntries, prs, sessions, sessionSets } from '../schema';

export interface ExerciseMeta {
  name: string;
  muscle: string;
  group: string;
  equipment: string;
  kind: 'strength' | 'cardio';
  sfSymbol: string;
}

export interface SessionFull extends SessionSummary {
  sets: (typeof sessionSets.$inferSelect)[];
  mode: 'strength' | 'cardio';
  exerciseMetaById: Record<string, ExerciseMeta>;
}
```

Replace the existing `getSession` body:

```ts
export async function getSession(db: AnyDb, sessionId: number): Promise<SessionFull | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const head = await (db as any).select().from(sessions).where(eq(sessions.id, sessionId));
  if (head.length === 0) return null;
  const h: SessionSummary = head[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = await (db as any)
    .select()
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, sessionId))
    .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));

  const exerciseIds = Array.from(new Set(sets.map((s: { exerciseId: string }) => s.exerciseId)));
  const exerciseMetaById: Record<string, ExerciseMeta> = {};
  if (exerciseIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaRows = await (db as any).select().from(exercisesTable);
    for (const row of metaRows as Array<typeof exercisesTable.$inferSelect>) {
      if (exerciseIds.includes(row.id)) {
        exerciseMetaById[row.id] = {
          name: row.name,
          muscle: row.muscle,
          group: row.group,
          equipment: row.equipment,
          kind: row.kind as 'strength' | 'cardio',
          sfSymbol: row.sfSymbol,
        };
      }
    }
  }

  const firstSet = sets[0] as typeof sessionSets.$inferSelect | undefined;
  const firstMeta = firstSet ? exerciseMetaById[firstSet.exerciseId] : undefined;
  const mode: 'strength' | 'cardio' = firstMeta?.kind === 'cardio' ? 'cardio' : 'strength';

  return {
    id: h.id,
    routineId: h.routineId,
    routineNameSnapshot: h.routineNameSnapshot,
    startedAt: h.startedAt,
    finishedAt: h.finishedAt,
    durationSeconds: h.durationSeconds,
    totalVolumeKg: h.totalVolumeKg,
    prCount: h.prCount,
    sets,
    mode,
    exerciseMetaById,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: PASS — all sessions tests green.

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `npm test`

Expected: all green (216+ existing tests + new ones).

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4e): getSession returns mode + exerciseMetaById"
```

---

## Task 9: `getRecentSessions` query

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `lib/db/__tests__/sessions.test.ts`:

```ts
import { getRecentSessions } from '../queries/sessions';

describe('getRecentSessions', () => {
  it('returns empty list when no completed sessions', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const out = await getRecentSessions(db, 5);
    expect(out).toEqual([]);
  });

  it('orders by finishedAt desc and respects limit', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: 1_000_000, finishedAt: 1_500_000 });
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: 2_000_000, finishedAt: 2_500_000 });
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: 3_000_000, finishedAt: 3_500_000 });
    const out = await getRecentSessions(db, 2);
    expect(out).toHaveLength(2);
    expect(out[0].finishedAt).toBe(3_500_000);
    expect(out[1].finishedAt).toBe(2_500_000);
  });

  it('excludes draft sessions', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Pull Day A', startedAt: 9_000_000 });
    const out = await getRecentSessions(db, 5);
    expect(out).toHaveLength(1);
  });

  it('hydrates strength rows with mode + totalVolumeKg', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    const out = await getRecentSessions(db, 5);
    expect(out[0].mode).toBe('strength');
    expect(out[0].totalVolumeKg).toBeGreaterThan(0);
    expect(out[0].distanceKm).toBeNull();
    expect(out[0].paceSecondsPerKm).toBeNull();
  });

  it('hydrates cardio rows with distance + pace and totalVolumeKg=0', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, {
      routineId: null,
      routineNameSnapshot: 'Treadmill Intervals',
      startedAt: 2_000_000,
      finishedAt: 2_000_000 + 28 * 60 * 1000,
      sets: [
        {
          exerciseId: 'treadmill',
          exercisePosition: 0,
          setPosition: 0,
          reps: null,
          weightKg: null,
          durationSeconds: 28 * 60,
          distanceKm: 3.5,
        },
      ],
    });
    const out = await getRecentSessions(db, 5);
    const cardio = out.find((r) => r.mode === 'cardio');
    expect(cardio).toBeDefined();
    expect(cardio!.distanceKm).toBe(3.5);
    expect(cardio!.paceSecondsPerKm).toBeCloseTo((28 * 60) / 3.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: FAIL — `getRecentSessions` not exported.

- [ ] **Step 3: Add implementation to `lib/db/queries/sessions.ts`**

```ts
export interface SessionRowData {
  id: number;
  routineNameSnapshot: string;
  finishedAt: number;
  durationSeconds: number;
  mode: 'strength' | 'cardio';
  totalVolumeKg: number;
  prCount: number;
  setCount: number;
  distanceKm: number | null;
  paceSecondsPerKm: number | null;
}

async function hydrateRows(db: AnyDb, rows: Array<typeof sessions.$inferSelect>): Promise<SessionRowData[]> {
  if (rows.length === 0) return [];
  const sessionIds = rows.map((r) => r.id);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allSets = await (db as any)
    .select()
    .from(sessionSets)
    .orderBy(asc(sessionSets.sessionId), asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));
  const setsBySession = new Map<number, Array<typeof sessionSets.$inferSelect>>();
  for (const s of allSets as Array<typeof sessionSets.$inferSelect>) {
    if (!sessionIds.includes(s.sessionId)) continue;
    const list = setsBySession.get(s.sessionId) ?? [];
    list.push(s);
    setsBySession.set(s.sessionId, list);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const exMetaRows = await (db as any).select().from(exercisesTable);
  const exKindById = new Map<string, 'strength' | 'cardio'>();
  for (const row of exMetaRows as Array<typeof exercisesTable.$inferSelect>) {
    exKindById.set(row.id, row.kind as 'strength' | 'cardio');
  }

  return rows.map((r) => {
    const sets = setsBySession.get(r.id) ?? [];
    const firstKind = sets[0] ? exKindById.get(sets[0].exerciseId) : undefined;
    const mode: 'strength' | 'cardio' = firstKind === 'cardio' ? 'cardio' : 'strength';

    let distanceKm: number | null = null;
    let paceSecondsPerKm: number | null = null;
    if (mode === 'cardio' && sets[0]) {
      distanceKm = sets[0].distanceKm;
      const dur = sets[0].durationSeconds;
      paceSecondsPerKm =
        distanceKm != null && distanceKm > 0 && dur != null && dur > 0
          ? dur / distanceKm
          : null;
    }

    return {
      id: r.id,
      routineNameSnapshot: r.routineNameSnapshot,
      finishedAt: r.finishedAt ?? 0,
      durationSeconds: r.durationSeconds,
      mode,
      totalVolumeKg: r.totalVolumeKg,
      prCount: r.prCount,
      setCount: sets.length,
      distanceKm,
      paceSecondsPerKm,
    };
  });
}

export async function getRecentSessions(db: AnyDb, limit: number): Promise<SessionRowData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.finishedAt))
    .limit(limit);
  return hydrateRows(db, rows as Array<typeof sessions.$inferSelect>);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: PASS — all sessions tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4e): getRecentSessions returns mode-aware row data"
```

---

## Task 10: `listAllSessions` with optional mode filter

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1: Add failing tests**

Append:

```ts
import { listAllSessions } from '../queries/sessions';

describe('listAllSessions', () => {
  it('returns all completed sessions newest first when no filter', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: 1_000_000, finishedAt: 1_500_000 });
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: 2_000_000, finishedAt: 2_500_000 });
    const out = await listAllSessions(db);
    expect(out).toHaveLength(2);
    expect(out[0].finishedAt).toBeGreaterThan(out[1].finishedAt);
  });

  it('filters to strength when mode=strength', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    await insertCompletedSessionForTests(db, {
      routineId: null,
      routineNameSnapshot: 'Treadmill Intervals',
      startedAt: 5_000_000,
      finishedAt: 5_000_000 + 28 * 60 * 1000,
      sets: [
        {
          exerciseId: 'treadmill',
          exercisePosition: 0,
          setPosition: 0,
          reps: null,
          weightKg: null,
          durationSeconds: 28 * 60,
          distanceKm: 3.5,
        },
      ],
    });
    const out = await listAllSessions(db, 'strength');
    expect(out).toHaveLength(1);
    expect(out[0].mode).toBe('strength');
  });

  it('filters to cardio when mode=cardio', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    await insertCompletedSessionForTests(db, {
      routineId: null,
      routineNameSnapshot: 'Treadmill Intervals',
      startedAt: 5_000_000,
      finishedAt: 5_000_000 + 28 * 60 * 1000,
      sets: [
        {
          exerciseId: 'treadmill',
          exercisePosition: 0,
          setPosition: 0,
          reps: null,
          weightKg: null,
          durationSeconds: 28 * 60,
          distanceKm: 3.5,
        },
      ],
    });
    const out = await listAllSessions(db, 'cardio');
    expect(out).toHaveLength(1);
    expect(out[0].mode).toBe('cardio');
  });

  it('excludes drafts', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Pull Day A', startedAt: 9_000_000 });
    const out = await listAllSessions(db);
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: FAIL — `listAllSessions` not exported.

- [ ] **Step 3: Add implementation to `lib/db/queries/sessions.ts`**

```ts
export async function listAllSessions(
  db: AnyDb,
  modeFilter?: 'strength' | 'cardio',
): Promise<SessionRowData[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.finishedAt));
  const hydrated = await hydrateRows(db, rows as Array<typeof sessions.$inferSelect>);
  if (!modeFilter) return hydrated;
  return hydrated.filter((r) => r.mode === modeFilter);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4e): listAllSessions with optional mode filter"
```

---

## Task 11: `getWeeklyVolumeSeries` query

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1: Add failing tests**

Append:

```ts
import { getWeeklyVolumeSeries } from '../queries/sessions';

const NOW = new Date(2026, 3, 22, 14, 0, 0).getTime(); // Wed Apr 22 2026

describe('getWeeklyVolumeSeries', () => {
  it('returns weeksBack zeros when no sessions', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const out = await getWeeklyVolumeSeries(db, 8, NOW);
    expect(out).toHaveLength(8);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });

  it('places this-week session in the last bucket', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const today = new Date(2026, 3, 22, 12, 0, 0).getTime();
    await insertCompletedSessionForTests(db, { ...baseDraft(), startedAt: today - 1000, finishedAt: today });
    const out = await getWeeklyVolumeSeries(db, 8, NOW);
    expect(out[7].tonnageKg).toBeGreaterThan(0);
  });

  it('excludes drafts from the series', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: NOW - 1000 });
    const out = await getWeeklyVolumeSeries(db, 8, NOW);
    expect(out.every((b) => b.tonnageKg === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: FAIL — `getWeeklyVolumeSeries` not exported.

- [ ] **Step 3: Add implementation to `lib/db/queries/sessions.ts`**

```ts
import { computeWeeklyVolumeSeries, type WeeklyVolumeBucket } from '@/lib/workouts/post-session-aggregate';

export async function getWeeklyVolumeSeries(
  db: AnyDb,
  weeksBack: number,
  now: number,
): Promise<WeeklyVolumeBucket[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (db as any)
    .select({
      finishedAt: sessions.finishedAt,
      totalVolumeKg: sessions.totalVolumeKg,
    })
    .from(sessions)
    .where(eq(sessions.status, 'completed'));
  const list = (rows as Array<{ finishedAt: number | null; totalVolumeKg: number }>)
    .filter((r) => r.finishedAt !== null)
    .map((r) => ({ finishedAt: r.finishedAt as number, totalVolumeKg: r.totalVolumeKg }));
  return computeWeeklyVolumeSeries(list, weeksBack, now);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4e): getWeeklyVolumeSeries reads sessions for chart"
```

---

## Task 12: HealthKit branch in `finalizeSession`

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

**Context:** `finalizeSession` already does the transactional finalize. We add a post-commit `writeWorkout` call inside a try/catch and add `healthSyncFailed` to the result. Use a module-level seam so tests can stub the HealthKit call.

- [ ] **Step 1: Add failing tests**

Append:

```ts
import * as healthWorkouts from '@/lib/health/workouts';

describe('finalizeSession HealthKit branch', () => {
  it('returns healthSyncFailed=undefined when writeWorkout resolves', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const spy = jest
      .spyOn(healthWorkouts, 'writeWorkout')
      .mockResolvedValue(undefined);
    try {
      const result = await insertCompletedSessionForTests(db, baseDraft());
      expect(result.healthSyncFailed).toBeUndefined();
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('passes activityType=traditionalStrengthTraining for strength sessions', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const spy = jest.spyOn(healthWorkouts, 'writeWorkout').mockResolvedValue(undefined);
    try {
      await insertCompletedSessionForTests(db, baseDraft());
      expect(spy.mock.calls[0][0]).toMatchObject({ activityType: 'traditionalStrengthTraining' });
      expect(spy.mock.calls[0][0].distanceKm).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('passes activityType=running and distanceKm for treadmill cardio', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const spy = jest.spyOn(healthWorkouts, 'writeWorkout').mockResolvedValue(undefined);
    try {
      await insertCompletedSessionForTests(db, {
        routineId: null,
        routineNameSnapshot: 'Treadmill Intervals',
        startedAt: 2_000_000,
        finishedAt: 2_000_000 + 28 * 60 * 1000,
        sets: [
          {
            exerciseId: 'treadmill',
            exercisePosition: 0,
            setPosition: 0,
            reps: null,
            weightKg: null,
            durationSeconds: 28 * 60,
            distanceKm: 3.5,
          },
        ],
      });
      expect(spy.mock.calls[0][0]).toMatchObject({ activityType: 'running', distanceKm: 3.5 });
    } finally {
      spy.mockRestore();
    }
  });

  it('returns healthSyncFailed=true when writeWorkout rejects, with DB row still committed', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const spy = jest
      .spyOn(healthWorkouts, 'writeWorkout')
      .mockRejectedValue(new Error('not authorized'));
    try {
      const result = await insertCompletedSessionForTests(db, baseDraft());
      expect(result.healthSyncFailed).toBe(true);
      // DB row still committed
      const full = await getSession(db, result.sessionId);
      expect(full!.id).toBe(result.sessionId);
    } finally {
      spy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: FAIL — `finalizeSession` does not call `writeWorkout` and `CompletedSessionResult` lacks `healthSyncFailed`.

- [ ] **Step 3: Update `lib/db/queries/sessions.ts`**

Add imports at top:

```ts
import { writeWorkout } from '@/lib/health/workouts';
import { activityTypeFor } from '@/lib/health/activity-type';
```

Update the result interface:

```ts
export interface CompletedSessionResult {
  sessionId: number;
  prCount: number;
  totalVolumeKg: number;
  healthSyncFailed?: boolean;
}
```

Wrap the existing `finalizeSession` in a new outer async function. Rename the existing transactional body to `finalizeSessionTransactional` (private) and add the HealthKit branch:

```ts
function finalizeSessionTransactional(
  db: AnyDb,
  sessionId: number,
  finishedAt: number,
): Promise<{ sessionId: number; prCount: number; totalVolumeKg: number }> {
  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (db as any).transaction((tx: any) => {
        // (existing body, unchanged — copy verbatim from current finalizeSession)
      });
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}

export async function finalizeSession(
  db: AnyDb,
  sessionId: number,
  finishedAt: number,
): Promise<CompletedSessionResult> {
  const txResult = await finalizeSessionTransactional(db, sessionId, finishedAt);

  let healthSyncFailed: boolean | undefined;
  try {
    const session = await getSession(db, sessionId);
    if (!session) throw new Error('session disappeared after finalize');
    const distanceKm =
      session.mode === 'cardio' ? session.sets[0]?.distanceKm ?? undefined : undefined;
    const exercises = session.sets
      .map((s) => session.exerciseMetaById[s.exerciseId])
      .filter(Boolean);
    await writeWorkout({
      activityType: activityTypeFor(session, exercises),
      start: new Date(session.startedAt),
      end: new Date(finishedAt),
      distanceKm: distanceKm == null ? undefined : distanceKm,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[finalizeSession] HealthKit write failed', err);
    healthSyncFailed = true;
  }

  return { ...txResult, healthSyncFailed };
}
```

> Copy the existing transactional body into `finalizeSessionTransactional` verbatim. The diff is: hoist body to private, add new exported `finalizeSession`, add HealthKit branch. Do **not** modify the transaction body.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- lib/db/__tests__/sessions.test.ts`

Expected: PASS — both pre-existing and new tests green.

- [ ] **Step 5: Run full test suite**

Run: `npm test`

Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4e): finalizeSession writes HealthKit workout post-commit"
```

---

## Task 13: Propagate `healthSyncFailed` through navigation

**Files:**
- Modify: `lib/state/activeSessionStore.ts`

**Context:** `activeSessionStore.finishSession()` currently calls `router.replace({ pathname: '/(tabs)/move/post', params: { sessionId: String(result.sessionId) } })`. We add `healthSyncFailed` to params when set. No new test — the store already has lifecycle tests; adding a new spy here would over-test.

- [ ] **Step 1: Update `finishSession` in `lib/state/activeSessionStore.ts`**

Locate the `finishSession` action (around line 202). Update the `router.replace` call:

```ts
router.replace({
  pathname: '/(tabs)/move/post',
  params: {
    sessionId: String(result.sessionId),
    healthSyncFailed: result.healthSyncFailed ? '1' : '0',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Run full test suite to confirm no store regressions**

Run: `npm test`

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add lib/state/activeSessionStore.ts
git commit -m "feat(sp4e): finishSession passes healthSyncFailed via route params"
```

---

## Task 14: SessionRow shared component

**Files:**
- Create: `components/history/SessionRow.tsx`

- [ ] **Step 1: Create `components/history/SessionRow.tsx`**

```tsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { type SessionRowData } from '@/lib/db/queries/sessions';
import { formatRelativeDate } from '@/lib/workouts/date-format';
import { formatDuration, formatPace } from '@/lib/workouts/cardio-aggregate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SessionRow({ row, now }: { row: SessionRowData; now: number }) {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const dateLabel = formatRelativeDate(row.finishedAt, now);
  const durationLabel = formatDuration(row.durationSeconds);

  let metaLine: string;
  if (row.mode === 'cardio') {
    const distance = row.distanceKm != null ? `${row.distanceKm.toFixed(1)} km` : '— km';
    const pace =
      row.paceSecondsPerKm != null
        ? `${formatPace(row.paceSecondsPerKm / 60)}/km`
        : '—/km';
    metaLine = `${durationLabel} · ${distance} · ${pace}`;
  } else {
    const volume = `${Math.round(row.totalVolumeKg)} kg`;
    metaLine = `${durationLabel} · ${row.setCount} sets · ${volume}`;
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/(tabs)/move/[sessionId]', params: { sessionId: String(row.id) } })}
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 0.5,
        borderColor: palette.hair,
        backgroundColor: palette.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: palette.ink }}>
          {row.routineNameSnapshot}
        </Text>
        <Text style={{ fontSize: 13, color: palette.ink3 }}>{dateLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <Text style={{ flex: 1, fontSize: 13, color: palette.ink3 }}>{metaLine}</Text>
        {row.mode === 'strength' && row.prCount > 0 && (
          <Text style={{ fontSize: 13, color: palette.money }}>★</Text>
        )}
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/history/SessionRow.tsx
git commit -m "feat(sp4e): SessionRow mode-aware 2-line list row"
```

---

## Task 15: RecentSection component on PreWorkout

**Files:**
- Create: `components/history/RecentSection.tsx`
- Modify: `app/(tabs)/move/index.tsx`

- [ ] **Step 1: Create `components/history/RecentSection.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { db } from '@/lib/db/client';
import { getRecentSessions, type SessionRowData } from '@/lib/db/queries/sessions';
import { SessionRow } from './SessionRow';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RecentSection() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [rows, setRows] = useState<SessionRowData[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const result = await getRecentSessions(db, 5);
    setRows(result);
    setNow(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (rows.length === 0) return null;

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Recent
        </Text>
        <Pressable onPress={() => router.push('/(tabs)/move/history')}>
          <Text style={{ fontSize: 13, color: palette.accent, fontWeight: '600' }}>See all</Text>
        </Pressable>
      </View>
      <View style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: palette.surface }}>
        {rows.map((row) => (
          <SessionRow key={row.id} row={row} now={now} />
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Insert `<RecentSection />` into `app/(tabs)/move/index.tsx`**

Add the import:

```tsx
import { RecentSection } from '@/components/history/RecentSection';
```

Insert `<RecentSection />` immediately before the `<Text>Strength</Text>` heading (around line 69):

```tsx
      <RecentSection />

      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 8 }}>
        Strength
      </Text>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/history/RecentSection.tsx app/(tabs)/move/index.tsx
git commit -m "feat(sp4e): PreWorkout shows Recent section above Strength routines"
```

---

## Task 16: `/history` route

**Files:**
- Create: `app/(tabs)/move/history.tsx`

- [ ] **Step 1: Create `app/(tabs)/move/history.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { listAllSessions, type SessionRowData } from '@/lib/db/queries/sessions';
import { SessionRow } from '@/components/history/SessionRow';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Filter = 'all' | 'strength' | 'cardio';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'strength', label: 'Strength' },
  { id: 'cardio', label: 'Cardio' },
];

export default function History() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [filter, setFilter] = useState<Filter>('all');
  const [rows, setRows] = useState<SessionRowData[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const out = await listAllSessions(db, filter === 'all' ? undefined : filter);
    setRows(out);
    setNow(Date.now());
  }, [filter]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));
  useEffect(() => { refresh(); }, [refresh]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 0.5, borderColor: palette.hair }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Pressable onPress={() => router.back()}>
            <Text style={{ fontSize: 17, color: palette.accent }}>{'< Back'}</Text>
          </Pressable>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>History</Text>
            <Text style={{ fontSize: 12, color: palette.ink3 }}>{rows.length} workouts</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {FILTERS.map((f) => {
            const selected = f.id === filter;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 100,
                  backgroundColor: selected ? palette.ink : palette.surface,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? palette.bg : palette.ink }}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 15, color: palette.ink3, textAlign: 'center' }}>
            No workouts yet. Start one above.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <SessionRow row={item} now={now} />}
          contentContainerStyle={{ paddingVertical: 8 }}
        />
      )}
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/move/history.tsx
git commit -m "feat(sp4e): /move/history full sessions list with mode filter"
```

---

## Task 17: PostWorkout sub-components — strength

**Files:**
- Create: `components/post-workout/CompleteHero.tsx`
- Create: `components/post-workout/StatGrid.tsx`
- Create: `components/post-workout/PrHighlightCard.tsx`
- Create: `components/post-workout/MuscleBars.tsx`
- Create: `components/post-workout/ExerciseRecapCard.tsx`

**Context:** Visual code only — no tests. Track the design handoff at `design_handoff/src/workout-screens.jsx:732-963`. Each file is small and standalone.

- [ ] **Step 1: Create `components/post-workout/StatGrid.tsx`**

```tsx
import { Text, View } from 'react-native';

export interface StatCell {
  label: string;
  value: string;
  unit: string;
}

export function StatGrid({ cells }: { cells: StatCell[] }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.18)',
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 16,
      }}
    >
      {cells.map((c, i) => (
        <View
          key={c.label}
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 8,
            backgroundColor: 'rgba(0,0,0,0.14)',
            marginLeft: i === 0 ? 0 : 1,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>{c.value}</Text>
          <Text style={{ color: '#fff', opacity: 0.85, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 }}>
            {c.label}
          </Text>
          {c.unit ? (
            <Text style={{ color: '#fff', opacity: 0.7, fontSize: 10, marginTop: 1 }}>{c.unit}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Create `components/post-workout/CompleteHero.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { StatGrid, type StatCell } from './StatGrid';

export function CompleteHero({
  headline,
  subline,
  cells,
}: {
  headline: string;
  subline: string;
  cells: StatCell[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View
      style={{
        paddingTop: 56,
        paddingHorizontal: 20,
        paddingBottom: 24,
        backgroundColor: palette.move,
      }}
    >
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
          ✓ Complete
        </Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', marginTop: 10 }}>{headline}</Text>
      {subline ? (
        <Text style={{ color: '#fff', opacity: 0.9, fontSize: 14, marginTop: 4 }}>{subline}</Text>
      ) : null}
      <StatGrid cells={cells} />
    </View>
  );
}
```

- [ ] **Step 3: Create `components/post-workout/PrHighlightCard.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { PrHighlight } from '@/lib/workouts/post-session-aggregate';

export function PrHighlightCard({ pr, moreSuffix }: { pr: PrHighlight; moreSuffix?: string }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.hair,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.money, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 22 }}>★</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.money, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Personal record
        </Text>
        <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
          {pr.exerciseName} · {pr.newWeightKg}kg × {pr.newReps}
        </Text>
        {moreSuffix ? (
          <Text style={{ color: palette.ink3, fontSize: 12, marginTop: 2 }}>{moreSuffix}</Text>
        ) : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 4: Create `components/post-workout/MuscleBars.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { MuscleDistribution } from '@/lib/workouts/post-session-aggregate';

export function MuscleBars({ distribution }: { distribution: MuscleDistribution[] }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (distribution.length === 0) return null;

  const top = distribution.slice(0, 3);
  const moreCount = Math.max(0, distribution.length - 3);
  const barColors = [palette.move, palette.accent, palette.rituals];

  return (
    <View style={{ marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Muscles worked
      </Text>
      {top.map((m, i) => (
        <View key={m.muscle} style={{ marginBottom: i < top.length - 1 ? 10 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 }}>
            <Text style={{ flex: 1, color: palette.ink, fontSize: 13, fontWeight: '600' }}>{m.muscle}</Text>
            <Text style={{ color: palette.ink3, fontSize: 12, marginRight: 8 }}>{Math.round(m.tonnageKg)} kg</Text>
            <Text style={{ color: barColors[i], fontSize: 13, fontWeight: '700', minWidth: 32, textAlign: 'right' }}>{m.percentage}%</Text>
          </View>
          <View style={{ height: 8, borderRadius: 100, backgroundColor: palette.fill, overflow: 'hidden' }}>
            <View style={{ width: `${m.percentage}%`, height: '100%', backgroundColor: barColors[i] }} />
          </View>
        </View>
      ))}
      {moreCount > 0 ? (
        <Text style={{ color: palette.ink3, fontSize: 12, marginTop: 10 }}>+ {moreCount} more</Text>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 5: Create `components/post-workout/ExerciseRecapCard.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { SessionSet } from '@/lib/db/schema';

export function ExerciseRecapCard({
  exerciseName,
  sets,
}: {
  exerciseName: string;
  sets: SessionSet[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const total = sets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
  const maxVol = Math.max(1, ...sets.map((s) => (s.weightKg ?? 0) * (s.reps ?? 0)));
  const hasPr = sets.some((s) => s.isPr === 1);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 12, padding: 14, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        {hasPr ? (
          <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: palette.money, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontSize: 10 }}>★</Text>
          </View>
        ) : null}
        <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{exerciseName}</Text>
        <Text style={{ color: palette.ink2, fontSize: 13 }}>{Math.round(total)} kg</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 44 }}>
        {sets.map((s, j) => {
          const setVol = (s.weightKg ?? 0) * (s.reps ?? 0);
          const heightPct = (setVol / maxVol) * 100;
          const color = s.isPr === 1 ? palette.money : palette.move;
          return (
            <View key={j} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View style={{ width: '100%', height: `${Math.max(heightPct, 15)}%`, backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4, opacity: s.isPr === 1 ? 1 : 0.55 }} />
              <Text style={{ fontSize: 9, color: s.isPr === 1 ? palette.money : palette.ink3 }}>
                {s.weightKg}×{s.reps}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add components/post-workout/
git commit -m "feat(sp4e): PostWorkout sub-components for strength variant"
```

---

## Task 18: PostWorkout cardio components

**Files:**
- Create: `components/post-workout/CardioRecapCard.tsx`

- [ ] **Step 1: Create `components/post-workout/CardioRecapCard.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';

export function CardioRecapCard({
  exerciseName,
  durationSeconds,
  distanceKm,
}: {
  exerciseName: string;
  durationSeconds: number;
  distanceKm: number | null;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const pace = paceMinPerKm(durationSeconds, distanceKm ?? 0);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {exerciseName}
      </Text>
      <Text style={{ color: palette.ink, fontSize: 36, fontWeight: '700', marginTop: 4 }}>
        {formatDuration(durationSeconds)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
        <View>
          <Text style={{ color: palette.ink3, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>Distance</Text>
          <Text style={{ color: palette.ink, fontSize: 18, fontWeight: '600', marginTop: 2 }}>
            {distanceKm != null ? `${distanceKm.toFixed(1)} km` : '— km'}
          </Text>
        </View>
        <View>
          <Text style={{ color: palette.ink3, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>Pace</Text>
          <Text style={{ color: palette.ink, fontSize: 18, fontWeight: '600', marginTop: 2 }}>
            {formatPace(pace)}/km
          </Text>
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/post-workout/CardioRecapCard.tsx
git commit -m "feat(sp4e): CardioRecapCard for cardio PostWorkout variant"
```

---

## Task 19: Replace PostWorkout stub with full route

**Files:**
- Modify: `app/(tabs)/move/post.tsx` (full rewrite)

- [ ] **Step 1: Replace `app/(tabs)/move/post.tsx` contents**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getSession, type SessionFull } from '@/lib/db/queries/sessions';
import {
  computeMuscleDistribution,
  selectTopPRs,
  type MuscleDistribution,
} from '@/lib/workouts/post-session-aggregate';
import { CompleteHero } from '@/components/post-workout/CompleteHero';
import { PrHighlightCard } from '@/components/post-workout/PrHighlightCard';
import { MuscleBars } from '@/components/post-workout/MuscleBars';
import { ExerciseRecapCard } from '@/components/post-workout/ExerciseRecapCard';
import { CardioRecapCard } from '@/components/post-workout/CardioRecapCard';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';

export default function PostWorkout() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId: string; healthSyncFailed?: string }>();
  const healthSyncFailed = params.healthSyncFailed === '1';

  const [session, setSession] = useState<SessionFull | null>(null);

  useEffect(() => {
    const id = Number(params.sessionId);
    if (!Number.isFinite(id)) return;
    getSession(db, id).then(setSession);
  }, [params.sessionId]);

  const distribution = useMemo<MuscleDistribution[]>(() => {
    if (!session) return [];
    return computeMuscleDistribution(session.sets, session.exerciseMetaById);
  }, [session]);

  // PR highlights are derived from persisted isPr=1 flags on session_sets.
  // Previous-best deltas are unrecoverable post-finalize (the prs table has been
  // upserted), so we sort by absolute new weight.
  const topPRs = useMemo(() => {
    if (!session) return { top: [], more: 0 };
    const prInputs = session.sets
      .filter((s) => s.isPr === 1 && s.weightKg != null && s.reps != null)
      .map((s) => ({
        exerciseId: s.exerciseId,
        weightKg: s.weightKg as number,
        reps: s.reps as number,
      }));
    return selectTopPRs(prInputs, session.exerciseMetaById, 2);
  }, [session]);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: palette.ink3, fontSize: 15 }}>Couldn't load this workout.</Text>
        <Pressable onPress={() => router.replace('/(tabs)/move')} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: palette.fill }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const totalReps = session.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0);

  // Build hero subline
  let subline: string;
  if (session.mode === 'cardio') {
    subline = session.routineNameSnapshot;
  } else if (session.prCount > 0 && topPRs.top[0]) {
    subline = `You hit a new PR on ${topPRs.top[0].exerciseName}`;
  } else {
    subline = `${Math.round(session.durationSeconds / 60)} minutes well spent`;
  }

  // Hero stat cells
  const cells = session.mode === 'cardio'
    ? [
        { label: 'Time', value: formatDuration(session.durationSeconds), unit: '' },
        { label: 'Distance', value: session.sets[0]?.distanceKm != null ? session.sets[0].distanceKm.toFixed(1) : '—', unit: 'km' },
        { label: 'Pace', value: formatPace(paceMinPerKm(session.durationSeconds, session.sets[0]?.distanceKm ?? 0)), unit: '/km' },
      ]
    : [
        { label: 'Time', value: String(Math.round(session.durationSeconds / 60)), unit: 'min' },
        { label: 'Volume', value: (session.totalVolumeKg / 1000).toFixed(1), unit: 'tonnes' },
        { label: 'Sets', value: String(session.sets.length), unit: `${totalReps} reps` },
        { label: 'PRs', value: String(session.prCount), unit: 'records' },
      ];

  // Group sets by exercise position for the recap
  const byExercise = new Map<number, typeof session.sets>();
  for (const s of session.sets) {
    const list = byExercise.get(s.exercisePosition) ?? [];
    list.push(s);
    byExercise.set(s.exercisePosition, list);
  }
  const exercisePositions = Array.from(byExercise.keys()).sort((a, b) => a - b);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <CompleteHero headline="Nice session." subline={subline} cells={cells} />

        {session.mode === 'strength' && topPRs.top.map((pr, idx) => {
          const moreSuffix =
            idx === topPRs.top.length - 1 && topPRs.more > 0
              ? `+${topPRs.more} more PRs unlocked`
              : undefined;
          return <PrHighlightCard key={pr.exerciseId} pr={pr} moreSuffix={moreSuffix} />;
        })}

        {session.mode === 'strength' && <MuscleBars distribution={distribution} />}

        {session.mode === 'cardio' && session.sets[0] && (
          <CardioRecapCard
            exerciseName={session.exerciseMetaById[session.sets[0].exerciseId]?.name ?? session.routineNameSnapshot}
            durationSeconds={session.durationSeconds}
            distanceKm={session.sets[0].distanceKm}
          />
        )}

        {session.mode === 'strength' && exercisePositions.length > 0 && (
          <View style={{ marginTop: 18 }}>
            <Text style={{ marginHorizontal: 20, marginBottom: 6, color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Exercises · {exercisePositions.length}
            </Text>
            {exercisePositions.map((pos) => {
              const sets = byExercise.get(pos)!;
              const exerciseId = sets[0].exerciseId;
              const name = session.exerciseMetaById[exerciseId]?.name ?? exerciseId;
              return <ExerciseRecapCard key={pos} exerciseName={name} sets={sets} />;
            })}
          </View>
        )}

        {healthSyncFailed && (
          <Text style={{ marginHorizontal: 20, marginTop: 16, color: palette.ink3, fontSize: 12 }}>
            Couldn't sync to Health.app — your workout is saved locally.
          </Text>
        )}

        <Pressable
          onPress={() => router.replace('/(tabs)/move')}
          style={{ marginHorizontal: 20, marginTop: 18, padding: 16, borderRadius: 12, backgroundColor: palette.move, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/move/post.tsx
git commit -m "feat(sp4e): full PostWorkout route with strength + cardio variants"
```

---

## Task 20: WorkoutDetail sub-components

**Files:**
- Create: `components/workout-detail/StatTile.tsx`
- Create: `components/workout-detail/WeeklyVolumeChart.tsx`
- Create: `components/workout-detail/ExerciseTable.tsx`

- [ ] **Step 1: Create `components/workout-detail/StatTile.tsx`**

```tsx
import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function StatTile({
  label,
  value,
  unit,
  tint,
}: {
  label: string;
  value: string;
  unit: string;
  tint: string;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const dim = value === '—';

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: dim ? palette.ink4 : palette.ink3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={{ color: dim ? palette.ink4 : tint, fontSize: 24, fontWeight: '700' }}>{value}</Text>
        {unit ? <Text style={{ color: palette.ink3, fontSize: 11 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}
```

- [ ] **Step 2: Create `components/workout-detail/WeeklyVolumeChart.tsx`**

```tsx
import { Text, View } from 'react-native';

import type { WeeklyVolumeBucket } from '@/lib/workouts/post-session-aggregate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function WeeklyVolumeChart({ series }: { series: WeeklyVolumeBucket[] }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (series.length === 0) return null;

  const max = Math.max(1, ...series.map((b) => b.tonnageKg));
  const last = series[series.length - 1];
  const first4 = series.slice(0, 4);
  const avgFirst4 = first4.reduce((s, b) => s + b.tonnageKg, 0) / first4.length;
  const pctPill =
    avgFirst4 > 0 ? `+${Math.round(((last.tonnageKg - avgFirst4) / avgFirst4) * 100)}% in 4 wks` : null;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        Volume over 8 weeks
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
        <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '700' }}>
          {(series.reduce((s, b) => s + b.tonnageKg, 0) / 1000).toFixed(1)}
        </Text>
        <Text style={{ color: palette.ink3, fontSize: 13, marginLeft: 4 }}>t total</Text>
        <View style={{ flex: 1 }} />
        {pctPill ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.move + '22', borderRadius: 100 }}>
            <Text style={{ color: palette.move, fontSize: 11, fontWeight: '700' }}>{pctPill}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 }}>
        {series.map((b, i) => {
          const heightPct = (b.tonnageKg / max) * 100;
          const isLast = i === series.length - 1;
          return (
            <View key={b.weekStart} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              {isLast && b.tonnageKg > 0 ? (
                <View style={{ paddingHorizontal: 4, paddingVertical: 1, backgroundColor: palette.move + '22', borderRadius: 4 }}>
                  <Text style={{ color: palette.move, fontSize: 10, fontWeight: '700' }}>
                    {(b.tonnageKg / 1000).toFixed(1)}t
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: `${Math.max(heightPct, 4)}%`,
                  backgroundColor: isLast ? palette.move : palette.move + '44',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />
              <Text style={{ color: isLast ? palette.move : palette.ink3, fontSize: 9, fontWeight: isLast ? '700' : '500' }}>
                W{i + 1}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Create `components/workout-detail/ExerciseTable.tsx`**

```tsx
import { Text, View } from 'react-native';

import type { SessionSet } from '@/lib/db/schema';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseTable({
  exerciseName,
  sets,
}: {
  exerciseName: string;
  sets: SessionSet[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const total = sets.reduce((s, x) => s + (x.weightKg ?? 0) * (x.reps ?? 0), 0);

  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 0.5, borderColor: palette.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 6 }}>
        <Text style={{ flex: 1, color: palette.ink, fontSize: 16, fontWeight: '600' }}>{exerciseName}</Text>
        <Text style={{ color: palette.ink3, fontSize: 12 }}>
          {sets.length} × {Math.round(total)} kg
        </Text>
      </View>

      <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: palette.hair, paddingVertical: 4 }}>
        <Text style={{ width: 32, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>SET</Text>
        <Text style={{ flex: 1, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>KG</Text>
        <Text style={{ flex: 1, color: palette.ink3, fontSize: 10, fontWeight: '700', letterSpacing: 0.5 }}>REPS</Text>
        <View style={{ width: 40 }} />
      </View>
      {sets.map((s, j) => (
        <View key={j} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
          <Text style={{ width: 32, color: palette.ink3, fontSize: 13, fontWeight: '600' }}>{j + 1}</Text>
          <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{s.weightKg ?? '—'}</Text>
          <Text style={{ flex: 1, color: palette.ink, fontSize: 15, fontWeight: '600' }}>{s.reps ?? '—'}</Text>
          <View style={{ width: 40 }}>
            {s.isPr === 1 ? (
              <View style={{ alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: palette.money }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700', letterSpacing: 0.3 }}>PR</Text>
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add components/workout-detail/
git commit -m "feat(sp4e): WorkoutDetail sub-components (StatTile, WeeklyVolumeChart, ExerciseTable)"
```

---

## Task 21: WorkoutDetail route

**Files:**
- Create: `app/(tabs)/move/[sessionId]/index.tsx`

- [ ] **Step 1: Create `app/(tabs)/move/[sessionId]/index.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import {
  getSession,
  getWeeklyVolumeSeries,
  type SessionFull,
} from '@/lib/db/queries/sessions';
import type { WeeklyVolumeBucket } from '@/lib/workouts/post-session-aggregate';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';
import { formatRelativeDate } from '@/lib/workouts/date-format';
import { StatTile } from '@/components/workout-detail/StatTile';
import { WeeklyVolumeChart } from '@/components/workout-detail/WeeklyVolumeChart';
import { ExerciseTable } from '@/components/workout-detail/ExerciseTable';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function WorkoutDetail() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();

  const [session, setSession] = useState<SessionFull | null>(null);
  const [series, setSeries] = useState<WeeklyVolumeBucket[]>([]);

  useEffect(() => {
    const id = Number(sessionId);
    if (!Number.isFinite(id)) return;
    (async () => {
      const s = await getSession(db, id);
      setSession(s);
      try {
        const series = await getWeeklyVolumeSeries(db, 8, Date.now());
        setSeries(series);
      } catch {
        setSeries([]); // hide chart on failure, keep rest of screen
      }
    })();
  }, [sessionId]);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: palette.ink3, fontSize: 15 }}>Couldn't load this workout.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: palette.fill }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const subtitle = formatRelativeDate(session.finishedAt ?? Date.now(), Date.now());

  // Build stat tiles
  const tiles = session.mode === 'cardio'
    ? [
        { label: 'Duration', value: formatDuration(session.durationSeconds), unit: '', tint: palette.move },
        { label: 'Distance', value: session.sets[0]?.distanceKm != null ? session.sets[0].distanceKm.toFixed(1) : '—', unit: 'km', tint: palette.accent },
        { label: 'Pace', value: formatPace(paceMinPerKm(session.durationSeconds, session.sets[0]?.distanceKm ?? 0)), unit: '/km', tint: palette.rituals },
        { label: 'Avg HR', value: '—', unit: '', tint: palette.money },
      ]
    : [
        { label: 'Duration', value: String(Math.round(session.durationSeconds / 60)), unit: 'min', tint: palette.move },
        { label: 'Volume', value: (session.totalVolumeKg / 1000).toFixed(1), unit: 'tonnes', tint: palette.accent },
        { label: 'Sets', value: String(session.sets.length), unit: `${session.sets.reduce((s, x) => s + (x.reps ?? 0), 0)} reps`, tint: palette.rituals },
        { label: 'PRs', value: String(session.prCount), unit: 'new best', tint: palette.money },
      ];

  // Group sets by exercise position
  const byExercise = new Map<number, typeof session.sets>();
  for (const s of session.sets) {
    const list = byExercise.get(s.exercisePosition) ?? [];
    list.push(s);
    byExercise.set(s.exercisePosition, list);
  }
  const exercisePositions = Array.from(byExercise.keys()).sort((a, b) => a - b);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={{ paddingTop: 56, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: palette.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Pressable onPress={() => router.back()}>
              <Text style={{ fontSize: 17, color: palette.accent }}>{'< Back'}</Text>
            </Pressable>
          </View>
          <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '700', marginTop: 8 }}>
            {session.routineNameSnapshot}
          </Text>
          <Text style={{ color: palette.ink3, fontSize: 13, marginTop: 2 }}>{subtitle}</Text>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: 4 }}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <StatTile {...tiles[0]} />
            <StatTile {...tiles[1]} />
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile {...tiles[2]} />
            <StatTile {...tiles[3]} />
          </View>
        </View>

        {session.mode === 'strength' && series.length > 0 && (
          <WeeklyVolumeChart series={series} />
        )}

        <View style={{ marginTop: 18 }}>
          <Text style={{ marginHorizontal: 20, marginBottom: 6, color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Exercises · {exercisePositions.length}
          </Text>
          {exercisePositions.length === 0 ? (
            <Text style={{ marginHorizontal: 20, color: palette.ink3, fontSize: 13 }}>No exercises logged.</Text>
          ) : (
            exercisePositions.map((pos) => {
              const sets = byExercise.get(pos)!;
              const exerciseId = sets[0].exerciseId;
              const name = session.exerciseMetaById[exerciseId]?.name ?? exerciseId;
              return <ExerciseTable key={pos} exerciseName={name} sets={sets} />;
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/move/[sessionId]/index.tsx
git commit -m "feat(sp4e): WorkoutDetail route with stat grid + 8-week chart + exercise table"
```

---

## Task 22: Web smoke test on golden path

**Files:**
- None modified — manual verification.

**Context:** The full smoke test in spec §1 step 4 (Health.app) requires the iPhone dev client and is deferred per the SP4 verification posture. Web smoke covers steps 1–3, 5–6, 8–10.

- [ ] **Step 1: Start the dev server on web**

Run: `npm run web`

Expected: Expo CLI starts; press `w` to open browser if not auto-opened. App loads at `http://localhost:8081`.

- [ ] **Step 2: Verify strength PostWorkout**

In the app:
1. Tap any strength routine on PreWorkout (e.g., Push Day A).
2. ActiveSession opens; log all sets for at least one exercise (use weights that exceed seeded PRs to trigger PR detection).
3. Tap Finish.
4. Confirm: hero shows "✓ COMPLETE" + "Nice session." + 4-stat grid with non-zero numbers.
5. Confirm: at least one PR card appears with "+Xkg from previous best" or "First-ever PR".
6. Confirm: muscle bars render with at least one row.
7. Confirm: per-exercise mini bar chart renders.
8. Tap Done.

Expected: lands back on PreWorkout. The Recent section is now visible (was hidden before because no completed sessions existed).

- [ ] **Step 3: Verify Recent + WorkoutDetail**

1. On PreWorkout, the Recent section shows the just-finished session at the top with date "Just now" or "Today".
2. Tap that row.
3. WorkoutDetail loads with the same routine name + 2×2 stat grid + 8-week chart (last bar highlighted) + per-exercise table with PR badges.
4. Tap Back; lands on PreWorkout.

- [ ] **Step 4: Verify cardio PostWorkout + WorkoutDetail**

1. Start the Treadmill Intervals routine (or whichever cardio routine is seeded).
2. Enter a distance (e.g., 3.5 km), tap Finish.
3. PostWorkout shows 3-stat grid (Time / Distance / Pace), no muscle bars, no PR card, single CardioRecapCard.
4. Tap Done.
5. Recent row shows duration + distance + pace, no ★.
6. Tap into WorkoutDetail; 4-tile grid shows Avg HR as "—" dimmed; per-exercise table is a single row.

- [ ] **Step 5: Verify history list**

1. Tap "See all" on Recent section.
2. `/history` opens with both sessions, newest first.
3. Tap "Cardio" filter; only cardio session remains.
4. Tap "All"; both sessions return.
5. Tap Back.

- [ ] **Step 6: Verify empty state**

(Skip if you don't want to wipe data — verified by code path alone.)

If desired: clear the database via the dev-tools route or a fresh install, then load PreWorkout and confirm Recent section is hidden. Visit `/move/history` directly via the URL bar; confirm "No workouts yet" message.

- [ ] **Step 7: Run the full test suite one more time**

Run: `npm test`

Expected: all green (216+ existing + ~45 new tests).

- [ ] **Step 8: Run typecheck one more time**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 9: Commit any docs/checklist updates** (optional)

If any spec or meta-spec status row needs updating to mark 4e in progress / complete, do that as a separate `docs(sp4e): mark slice 4e complete in meta spec` commit after iPhone verification. The plan does **not** mark complete prematurely — meta-spec updates land only when the smoke test (including iPhone HealthKit) actually passes.

---

## What is NOT in this plan

- iPhone HealthKit smoke test (spec §1 steps 4 + 7) — requires the 4b dev client; deferred per SP4 verification posture documented in the meta-spec.
- 4f (AI Routine Generator) and 4g (Live Activities) — separate slices.
- Pal note on WorkoutDetail (SP5).
- Share button on PostWorkout (cut).
- HR persistence + Avg HR tile data (cut; tile renders dimmed "—").
- Schema migration (none needed).

---

## Smoke test acceptance

Per spec §1, 4e is code-complete when:
- All Jest tests pass (`npm test`).
- Typecheck is clean (`npx tsc --noEmit`).
- Web smoke steps 2–6 above pass.
- iPhone Health.app verification (steps 4 + 7 of spec smoke) is recorded in the meta-spec status row as deferred to user — matching the precedent set by 4b/4c/4d.
