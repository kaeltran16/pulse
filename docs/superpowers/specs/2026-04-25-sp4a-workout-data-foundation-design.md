# SP4a — Workout Data Foundation Design

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** `docs/superpowers/specs/2026-04-25-ios-v2-workouts-design.md` (SP4 meta-spec, slice 4a)
**Scope:** The Drizzle schema, seed data, queries, and pure-function math for the workout subsystem. No UI. No HealthKit. Pure data layer that 4b–4g consume.

---

## 1. What 4a ships

- Seven new tables added to the existing Drizzle schema, plus their migration.
- A seeded read-only exercise catalog (21 rows from `design_handoff/src/workout-data.jsx`).
- Six seeded starter routines (Push A, Pull A, Leg Day, Upper Power, Treadmill Intervals, Steady Row 5k), inserted only if the routines table is empty.
- Pure-function modules for rest defaults, strength-volume math, and PR detection.
- Query modules that wrap the schema for the consumers in 4b–4g.
- TDD coverage of every pure function and every multi-row write.

**Smoke test:** `npm test` green; running migrations on a fresh DB yields exactly 21 exercises and 6 routines; a Node script can call `insertCompletedSession()` with hand-built input and `listSessions()` returns the row.

---

## 2. Locked decisions (resolved during brainstorming)

| Decision | Choice | Reason |
|---|---|---|
| Rest timer storage | Hardcoded group defaults + optional per-`routine_exercises.rest_seconds` override | Right mental model: defaults exist, override only when meaningful |
| Routine progression | None — templates are static | Personal app; baked-in linear progression silently overrides user intent |
| PR snapshot | Snapshot at session start; single upsert per exercise at finish | Clean "this session beat my old PR" semantics; no partial writes on abandon |
| Workouts ↔ Move ring | PostWorkout writes a `movement_entries` row (`minutes = round(duration_seconds/60)`, `kind='workout'`) | Move ring fills automatically; SP3a aggregate code unchanged |
| Set polymorphism | One `routine_sets` + one `session_sets` table, NULLable strength/cardio columns | Cardio is 10% of catalog; doubling tables is overkill |
| In-flight session persistence | AsyncStorage draft (in 4d), atomic DB commit at finish | DB only ever sees completed sessions; no `status` column polluting queries |
| Volume definition | `sum(weight × reps)` over strength sets only | Mixing strength weight × reps with cardio km/min produces nonsense |

---

## 3. Tables (all new; existing SP3a tables untouched)

```
exercises               -- seeded read-only catalog
  id            TEXT PK        -- slug, e.g. 'bench'
  name          TEXT NOT NULL
  group         TEXT NOT NULL  -- 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio'
  muscle        TEXT NOT NULL
  equipment     TEXT NOT NULL
  kind          TEXT NOT NULL  -- 'strength' | 'cardio'
  sf_symbol     TEXT NOT NULL

routines
  id            INTEGER PK AUTOINCREMENT
  name          TEXT NOT NULL
  tag           TEXT NOT NULL          -- 'Upper' | 'Lower' | 'Custom' | 'Cardio'
  color         TEXT NOT NULL          -- token name: 'move' | 'rituals' | 'money' | 'accent'
  position      INTEGER NOT NULL
  created_at    INTEGER NOT NULL DEFAULT (unixepoch() * 1000)

routine_exercises
  id                  INTEGER PK AUTOINCREMENT
  routine_id          INTEGER NOT NULL  REFERENCES routines(id) ON DELETE CASCADE
  exercise_id         TEXT    NOT NULL  REFERENCES exercises(id)
  position            INTEGER NOT NULL
  rest_seconds        INTEGER NULL      -- NULL = use group default

routine_sets
  id                       INTEGER PK AUTOINCREMENT
  routine_exercise_id      INTEGER NOT NULL REFERENCES routine_exercises(id) ON DELETE CASCADE
  position                 INTEGER NOT NULL
  target_reps              INTEGER NULL
  target_weight_kg         REAL    NULL
  target_duration_seconds  INTEGER NULL
  target_distance_km       REAL    NULL

sessions                 -- only completed sessions land here
  id                      INTEGER PK AUTOINCREMENT
  routine_id              INTEGER NULL REFERENCES routines(id) ON DELETE SET NULL
  routine_name_snapshot   TEXT    NOT NULL
  started_at              INTEGER NOT NULL
  finished_at             INTEGER NOT NULL
  duration_seconds        INTEGER NOT NULL
  total_volume_kg         REAL    NOT NULL DEFAULT 0
  pr_count                INTEGER NOT NULL DEFAULT 0

session_sets
  id                  INTEGER PK AUTOINCREMENT
  session_id          INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  exercise_id         TEXT    NOT NULL REFERENCES exercises(id)
  exercise_position   INTEGER NOT NULL    -- order of the exercise within the session
  set_position        INTEGER NOT NULL    -- order of the set within the exercise
  reps                INTEGER NULL
  weight_kg           REAL    NULL
  duration_seconds    INTEGER NULL
  distance_km         REAL    NULL
  is_pr               INTEGER NOT NULL DEFAULT 0     -- 0 | 1

prs
  id            INTEGER PK AUTOINCREMENT
  exercise_id   TEXT NOT NULL UNIQUE REFERENCES exercises(id)
  weight_kg     REAL NOT NULL
  reps          INTEGER NOT NULL
  session_id    INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE
  achieved_at   INTEGER NOT NULL
```

### Indexes

```
CREATE INDEX idx_routine_exercises_routine_position ON routine_exercises(routine_id, position);
CREATE INDEX idx_routine_sets_routine_exercise_position ON routine_sets(routine_exercise_id, position);
CREATE INDEX idx_sessions_started_at ON sessions(started_at);
CREATE INDEX idx_session_sets_session_id ON session_sets(session_id);
CREATE INDEX idx_session_sets_exercise_id ON session_sets(exercise_id);
```

### Migration

Drizzle Kit will emit `lib/db/migrations/0001_workouts.sql` (next sequence after the existing `0000_quiet_thundra.sql`) plus a `meta/_journal.json` update. The migration is additive and adds no columns to SP3a tables.

---

## 4. Seed data

### Exercises (idempotent)

```ts
// runs unconditionally on every migration; INSERT OR IGNORE on the slug PK
SEEDED_EXERCISES: 21 rows total
  Push (5):    bench, ohp, incline-db, tricep-rope, lateral-raise
  Pull (5):    deadlift, pullup, barbell-row, face-pull, bicep-curl
  Legs (5):    squat, rdl, leg-press, calf-raise, walking-lunge
  Core (2):    plank, hanging-leg
  Cardio (4): treadmill, rower, bike, stairmaster
```

Source of truth: `design_handoff/src/workout-data.jsx`'s `EXERCISES` array, mapped 1:1. The `pr` field on the design rows is intentionally not seeded — `prs` starts empty and is built from real sessions.

### Routines (only if routines table is empty)

```ts
SEEDED_ROUTINES: 6 routines
  push-a:        Push Day A   — Upper, color 'move',    5 exercises
  pull-a:        Pull Day A   — Upper, color 'rituals', 5 exercises
  legs:          Leg Day      — Lower, color 'money',   5 exercises
  upper-power:   Upper Power  — Custom, color 'accent', 4 exercises
  treadmill-int: Treadmill Intervals — Cardio, color 'move', 1 exercise
  row-steady:    Steady Row 5k — Cardio, color 'move',  1 exercise
```

The seeder runs inside a transaction. If `routines` already has rows, the seeder is a no-op (so editing your routines doesn't get clobbered on app upgrade).

---

## 5. Module layout

```
lib/db/
  schema.ts                          # extended: 7 new exports + types
  migrations/
    0001_workouts.sql                # generated by drizzle-kit
    meta/_journal.json               # generated
    migrations.js                    # generated (adds the new entry)
  seed-workouts.ts                   # NEW — idempotent seeders
  queries/
    routines.ts                      # NEW
    sessions.ts                      # NEW
    prs.ts                           # NEW
  __tests__/
    migrations-workouts.test.ts      # NEW
    sessions.test.ts                 # NEW

lib/workouts/                        # NEW directory — pure functions only
  rest-defaults.ts
  volume.ts
  pr-detection.ts
  __tests__/
    rest-defaults.test.ts
    volume.test.ts
    pr-detection.test.ts
```

**Boundary discipline:** anything in `lib/workouts/` is a pure function — no Drizzle imports, no DB. Anything in `lib/db/queries/{routines,sessions,prs}.ts` is a thin DB wrapper that calls into `lib/workouts/` for math. Tests for pure functions never touch SQLite; tests for DB wrappers run against an in-memory SQLite via the existing test harness.

---

## 6. Public API surface

These are the functions 4b–4g will call. Signatures shown in TypeScript shape; Drizzle's actual return types may add a generic envelope.

```ts
// lib/db/queries/routines.ts
export function listRoutines(): Promise<RoutineSummary[]>;
// RoutineSummary = { id, name, tag, color, exerciseCount, estMinutes, lastDoneAt }
// estMinutes is computed: setCount * 2 + restSecondsTotal/60 (rough heuristic; the design
// handoff's estMin is hand-tuned, but we don't store it — derive it).
// lastDoneAt comes from MAX(sessions.finished_at) WHERE routine_id = id.

export function getRoutineWithSets(routineId: number): Promise<RoutineFull | null>;
// RoutineFull = { ...routine, exercises: Array<{ ...routine_exercise, exercise, sets: routine_set[] }> }

// lib/db/queries/sessions.ts
export function listSessions(args?: { limit?: number; offset?: number }): Promise<SessionSummary[]>;
export function getSession(id: number): Promise<SessionFull | null>;

export type CompletedSessionDraft = {
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  finishedAt: number;
  sets: Array<{
    exerciseId: string;
    exercisePosition: number;
    setPosition: number;
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
    distanceKm: number | null;
  }>;
};
export function insertCompletedSession(draft: CompletedSessionDraft): Promise<{ sessionId: number; prCount: number; totalVolumeKg: number }>;
// Atomic transaction:
//   1. snapshot prs for the exercises in draft
//   2. detectSessionPRs(snapshot, draft.sets) → marks is_pr per set, returns new_prs
//   3. compute totalVolumeKg via computeStrengthVolume
//   4. insert sessions row with totals
//   5. insert session_sets rows
//   6. upsert prs rows from new_prs (best-of-session per exercise)
//   7. insert movement_entries row { minutes: round(durationSeconds/60), kind: 'workout', note: routineNameSnapshot, occurred_at: finishedAt }
// Throws on any step → entire transaction rolls back.

// lib/db/queries/prs.ts
export function getPRsForExercises(exerciseIds: string[]): Promise<Map<string, { weightKg: number; reps: number }>>;
```

```ts
// lib/workouts/rest-defaults.ts
export const REST_DEFAULTS = { Push: 120, Pull: 120, Legs: 150, Core: 60, Cardio: 0 } as const;
export function getRestSeconds(group: keyof typeof REST_DEFAULTS, override: number | null): number;

// lib/workouts/volume.ts
export type StrengthSet = { reps: number | null; weightKg: number | null };
export function computeStrengthVolume(sets: StrengthSet[]): number;
// Returns sum of (reps * weightKg) for sets where both are non-null.

// lib/workouts/pr-detection.ts
export type PRSnapshot = Map<string, { weightKg: number; reps: number }>;
export type SessionSetInput = { exerciseId: string; reps: number | null; weightKg: number | null };
export type PRDetectionResult = {
  isPrPerSet: boolean[];                                                    // aligned to input order
  newPRs: Map<string, { weightKg: number; reps: number; setIndex: number }>;// best-of-session per exercise
};
export function detectSessionPRs(snapshot: PRSnapshot, sessionSets: SessionSetInput[]): PRDetectionResult;
// Rule: a set is a PR if (reps * weightKg) > (snapshot.weightKg * snapshot.reps), or if no snapshot exists for the exercise.
// Cardio sets (reps=null OR weightKg=null) never PR.
// If multiple sets PR for the same exercise, only the best-of-session wins newPRs.
```

---

## 7. TDD targets

Per parent meta-spec §3, 4a is TDD-eligible for "schema migrations, derived aggregates, basic streaks." Concrete targets:

### `lib/workouts/__tests__/rest-defaults.test.ts`
- Group lookup returns expected constants (Push 120, Pull 120, Legs 150, Core 60, Cardio 0).
- Override > 0 is honored over default.
- `override = null` falls through to group default.
- `override = 0` is honored (explicit "no rest").

### `lib/workouts/__tests__/volume.test.ts`
- Empty input → 0.
- Strength sets sum correctly.
- A set with `reps=null` is excluded.
- A set with `weightKg=null` is excluded (bodyweight pull-ups don't add volume in v2).
- Mixed strength + cardio input → cardio rows ignored.

### `lib/workouts/__tests__/pr-detection.test.ts`
- No prior snapshot for an exercise → first valid set is a PR.
- Set tying the snapshot is **not** a PR (strict `>`).
- Set beating snapshot → `isPr=true`, appears in `newPRs`.
- Two PR sets for the same exercise in one session → only best-of-session in `newPRs`.
- Cardio set (null reps) never PR even with empty snapshot.
- `isPrPerSet` array order matches input order.

### `lib/db/__tests__/migrations-workouts.test.ts`
- Migration on fresh DB creates all 7 tables with expected columns.
- Re-running migrations is idempotent (no duplicate exercises, no errors).
- Post-migration: `SELECT COUNT(*) FROM exercises = 21`, `SELECT COUNT(*) FROM routines = 6`.
- Routines seeder is a no-op when `routines` already has rows.

### `lib/db/__tests__/sessions.test.ts`
- `insertCompletedSession` writes session, session_sets, upserts prs, and inserts a `movement_entries` row in one transaction.
- A session with strength PRs updates `prs` to best-of-session.
- A session with no PRs leaves `prs` unchanged.
- A draft that throws inside the transaction (e.g., bad exercise_id FK) leaves the DB unchanged — no orphaned rows.
- `total_volume_kg` and `pr_count` on the session row match what `computeStrengthVolume` and `detectSessionPRs` return.
- `movement_entries` row has `kind='workout'`, `minutes = round(durationSeconds/60)`, `note = routineNameSnapshot`.

UI is untouched. All tests run on the existing Node/web test target.

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Drizzle Kit emits a migration that conflicts with the existing `0000_quiet_thundra.sql` | Follow the existing pattern: run `drizzle-kit generate` and inspect the diff before committing. The migration must be additive only (no ALTER on SP3a tables). |
| Atomic transaction fails silently on `expo-sqlite` if a callback throws | Wrap `insertCompletedSession` body in an explicit `db.transaction(async (tx) => { … })` and re-throw to surface failures in tests. |
| Seeder runs twice and double-inserts routines | Seeder is conditional: `if ((await db.select().from(routines).limit(1)).length === 0) { … }`. Tested in `migrations-workouts.test.ts`. |
| `lastDoneAt` query on `listRoutines()` is N+1 | Single query: `LEFT JOIN sessions ON sessions.routine_id = routines.id GROUP BY routines.id`, taking `MAX(finished_at)`. Tested implicitly by `sessions.test.ts`. |
| Volume of bodyweight pull-ups is 0 | Documented in `volume.test.ts`; if v3 wants "bodyweight + added load" volume, a future spec adds a `bodyweight_kg` column. Not in 4a. |

---

## 9. What this spec is NOT

- **Not the rest timer state machine.** That lives in 4d (Active Session). 4a only exposes the static lookup.
- **Not the AsyncStorage draft format.** 4d owns the draft shape; 4a sees only completed drafts via `insertCompletedSession`.
- **Not Active Session UI**, PostWorkout UI, or any other screen.
- **Not HealthKit.** `writeWorkout()` lives in 4b/4e. 4a's contract ends at the local DB.
- **Not "routine progression."** The parent meta-spec listed it as a TDD target; with "no auto-progression" locked in Q2, the phrase collapses. When 4d implements *session navigation* (next-set/exercise cursor), that's its own module — not 4a math.

---

## 10. Open items for 4a's plan

None. All design decisions are settled. The plan can proceed directly to drizzle-kit migration generation, seed data, pure functions (TDD), and DB queries (TDD).
