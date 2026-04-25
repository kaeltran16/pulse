# SP4c — Routine browse + edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the three Move-tab screens (PreWorkout list, RoutineEditor, ExerciseLibrary) plus the Zustand editor store and routine CRUD queries, persisting all data needed by SP4d/4e.

**Architecture:** Three Expo Router routes under `app/(tabs)/move/`, fed by `useLiveQuery` for list reads and a transactional Drizzle diff on save. In-flight editor state lives in a Zustand store (`lib/state/editorStore.ts`). One small migration adds three columns to the `routines` table for the new session settings.

**Tech Stack:** React Native + Expo SDK 55, Expo Router, Drizzle ORM (`expo-sqlite`), Zustand (new dep), NativeWind v4, RN built-in `Modal` for sheets, Jest for tests, `better-sqlite3` for in-memory test DB.

**Spec:** [`docs/superpowers/specs/2026-04-25-sp4c-routine-browse-edit-design.md`](../specs/2026-04-25-sp4c-routine-browse-edit-design.md).

**Codebase delta from the spec:**
- The spec's "Workouts tab" is the **Move** tab (`app/(tabs)/move.tsx`); routes will live under `app/(tabs)/move/`.
- `lib/db/queries/routines.ts` already has `listRoutines` and `getRoutineWithSets` (returning a `RoutineFull`). The plan extends that file rather than introducing a parallel `getRoutine`.
- Tests use **Jest** (not Vitest) via `jest-expo`; the test helper is `lib/db/__tests__/test-helpers.ts`.

---

## File map

**Modify:**
- `lib/db/schema.ts` — add 3 columns to `routines`; export updated types.
- `lib/db/seed-workouts.ts` — set new column defaults on each seeded routine.
- `lib/db/queries/routines.ts` — extend `RoutineFull`; add `createEmptyRoutine`, `updateRoutine`, `duplicateRoutine`, `deleteRoutine`.
- `lib/db/__tests__/routines.test.ts` — extend with tests for the new functions.
- `lib/db/__tests__/seed-workouts.test.ts` — assert new column defaults.
- `app/(tabs)/_layout.tsx` — keep tabs as-is; the `Tabs.Screen name="move"` already renders the new directory.
- `app/(tabs)/move.tsx` — **delete** (replaced by `move/index.tsx` under the new directory). Note: Expo Router resolves a directory + a sibling file as a conflict; we delete the file.
- `package.json` — add `zustand` dep.

**Create:**
- `lib/db/migrations/0002_<generated>.sql` — Drizzle-generated migration for 3 new columns.
- `lib/db/migrations/meta/0002_snapshot.json`, `meta/_journal.json` — Drizzle artifacts (auto-generated).
- `lib/state/editorStore.ts` — Zustand store with `Draft` types and mutators.
- `lib/state/__tests__/editorStore.test.ts` — store tests (Jest).
- `app/(tabs)/move/_layout.tsx` — Stack layout for the Move group.
- `app/(tabs)/move/index.tsx` — PreWorkout screen.
- `app/(tabs)/move/[routineId]/edit.tsx` — RoutineEditor screen.
- `app/(tabs)/move/library.tsx` — ExerciseLibrary screen (browse + picker).
- `app/(tabs)/move/generate.tsx` — Stub for 4f.
- `components/workouts/RoutineCard.tsx`
- `components/workouts/CardioRow.tsx`
- `components/workouts/ExerciseRow.tsx`
- `components/workouts/SetChip.tsx`
- `components/workouts/TagPills.tsx`
- `components/workouts/ExerciseSettingsSheet.tsx`
- `components/workouts/SetEditSheet.tsx`
- `components/workouts/RenameRoutineSheet.tsx`
- `components/workouts/RoutineActionSheet.tsx`
- `lib/hooks/useRoutineActions.ts` — wraps action-sheet platform branching + the action handlers.

---

## Task 1: Add Zustand dependency

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1:** Install Zustand at the version compatible with React 19 / RN 0.83.

```bash
npm install zustand@^5.0.0
```

- [ ] **Step 2:** Verify the install.

```bash
node -e "console.log(require('zustand/package.json').version)"
```
Expected: `5.x.x`.

- [ ] **Step 3:** Commit.

```bash
git add package.json package-lock.json
git commit -m "chore(sp4c): add zustand dep"
```

---

## Task 2: Schema delta — three new columns on routines

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0002_<generated>.sql` (via drizzle-kit)

- [ ] **Step 1:** Edit `lib/db/schema.ts`. Find the `routines` table (line 76) and add three columns at the bottom of the table object (after `createdAt`):

```ts
export const routines = sqliteTable('routines', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  tag: text('tag').notNull(),
  color: text('color').notNull(),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  restDefaultSeconds: integer('rest_default_seconds').notNull().default(120),
  warmupReminder: integer('warmup_reminder', { mode: 'boolean' }).notNull().default(false),
  autoProgress: integer('auto_progress', { mode: 'boolean' }).notNull().default(false),
});
```

- [ ] **Step 2:** Generate the migration.

```bash
npm run db:generate
```
Expected: a new file `lib/db/migrations/0002_<adjective>_<noun>.sql` is created. Inspect it; it should contain three `ALTER TABLE routines ADD COLUMN ...` statements with defaults `120`, `0`, `0`.

- [ ] **Step 3:** Run the migrate test to confirm migrations apply cleanly.

```bash
npm test -- migrate.test
```
Expected: PASS.

- [ ] **Step 4:** Commit.

```bash
git add lib/db/schema.ts lib/db/migrations
git commit -m "feat(sp4c): add rest_default_seconds, warmup_reminder, auto_progress to routines"
```

---

## Task 3: Update the workouts seed and its test

**Files:**
- Modify: `lib/db/seed-workouts.ts`
- Modify: `lib/db/__tests__/seed-workouts.test.ts`

- [ ] **Step 1:** Open `lib/db/seed-workouts.ts`, find the `tx.insert(routines).values({...})` block (around line 188). Add the three new fields. Inferred defaults for each seeded routine: `restDefaultSeconds: 120`, `warmupReminder: false`, `autoProgress: false`. The block becomes:

```ts
const inserted = tx.insert(routines).values({
  name: r.name,
  tag: r.tag,
  color: r.color,
  position: r.position,
  restDefaultSeconds: 120,
  warmupReminder: false,
  autoProgress: false,
}).returning({ id: routines.id }).get();
```

(Match exact existing structure — only add the three new fields.)

- [ ] **Step 2:** Open `lib/db/__tests__/seed-workouts.test.ts` and add a test asserting defaults:

```ts
it('seeds routines with default session settings', async () => {
  const { db } = makeTestDb();
  seedWorkouts(db);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: Array<{ name: string; restDefaultSeconds: number; warmupReminder: boolean; autoProgress: boolean }> =
    await (db as any).select({
      name: routines.name,
      restDefaultSeconds: routines.restDefaultSeconds,
      warmupReminder: routines.warmupReminder,
      autoProgress: routines.autoProgress,
    }).from(routines);
  for (const row of all) {
    expect(row.restDefaultSeconds).toBe(120);
    expect(row.warmupReminder).toBe(false);
    expect(row.autoProgress).toBe(false);
  }
});
```

Add `routines` to the existing import from `'../schema'` if not already imported.

- [ ] **Step 3:** Run.

```bash
npm test -- seed-workouts
```
Expected: PASS, including the new test.

- [ ] **Step 4:** Commit.

```bash
git add lib/db/seed-workouts.ts lib/db/__tests__/seed-workouts.test.ts
git commit -m "feat(sp4c): seed routine session-setting defaults"
```

---

## Task 4: Extend `RoutineFull` to expose new fields

**Files:**
- Modify: `lib/db/queries/routines.ts`

- [ ] **Step 1:** In `lib/db/queries/routines.ts`, extend the `RoutineFull` interface (currently lines 17–30) with three fields and the `createdAt`:

```ts
export interface RoutineFull {
  id: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: Array<{
    id: number;
    position: number;
    restSeconds: number | null;
    exercise: typeof exercises.$inferSelect;
    sets: (typeof routineSets.$inferSelect)[];
  }>;
}
```

- [ ] **Step 2:** Update `getRoutineWithSets` so the returned object passes through the new fields. Find the `return { id: head.id, ... }` block (around line 109) and add the three:

```ts
return {
  id: head.id,
  name: head.name,
  tag: head.tag,
  color: head.color,
  position: head.position,
  restDefaultSeconds: head.restDefaultSeconds,
  warmupReminder: Boolean(head.warmupReminder),
  autoProgress: Boolean(head.autoProgress),
  exercises: reRows
    /* unchanged */
};
```

(The Drizzle `mode: 'boolean'` typing should already give booleans, but `Boolean(...)` makes the contract explicit and tolerant of raw 0/1 from older rows.)

- [ ] **Step 3:** Add a unit test in `lib/db/__tests__/routines.test.ts` (append to the existing `describe('getRoutineWithSets')` block, or add one if absent):

```ts
describe('getRoutineWithSets', () => {
  it('returns null for missing id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const r = await getRoutineWithSets(db, 99999);
    expect(r).toBeNull();
  });

  it('exposes session settings on the hydrated routine', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const id = all[0].id;
    const r = await getRoutineWithSets(db, id);
    expect(r).not.toBeNull();
    expect(r!.restDefaultSeconds).toBe(120);
    expect(r!.warmupReminder).toBe(false);
    expect(r!.autoProgress).toBe(false);
  });
});
```

- [ ] **Step 4:** Run.

```bash
npm test -- routines.test
```
Expected: PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "feat(sp4c): expose session settings on RoutineFull"
```

---

## Task 5: `createEmptyRoutine`

**Files:**
- Modify: `lib/db/queries/routines.ts`
- Modify: `lib/db/__tests__/routines.test.ts`

- [ ] **Step 1: Write failing test.** Append to `routines.test.ts`:

```ts
import { createEmptyRoutine } from '../queries/routines';

describe('createEmptyRoutine', () => {
  it('inserts a routine and returns its id', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await listRoutines(db);
    const id = await createEmptyRoutine(db, { name: 'My routine', tag: 'Custom' });
    expect(typeof id).toBe('number');
    const after = await listRoutines(db);
    expect(after).toHaveLength(before.length + 1);
    const created = after.find((r) => r.id === id)!;
    expect(created.name).toBe('My routine');
    expect(created.tag).toBe('Custom');
    expect(created.exerciseCount).toBe(0);
  });

  it('appends to the end (max position + 1)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await listRoutines(db);
    const maxPos = Math.max(...before.map((r) => r.position));
    const id = await createEmptyRoutine(db, { name: 'Z', tag: 'Custom' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (db as any).select().from(routines).where(eq(routines.id, id));
    expect(row[0].position).toBe(maxPos + 1);
  });

  it('uses default session settings', async () => {
    const { db } = makeTestDb();
    const id = await createEmptyRoutine(db, { name: 'X', tag: 'Custom' });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = await (db as any).select().from(routines).where(eq(routines.id, id));
    expect(row[0].restDefaultSeconds).toBe(120);
    expect(row[0].warmupReminder).toBe(false);
    expect(row[0].autoProgress).toBe(false);
  });
});
```

(Add `eq` and `routines` to the test file's imports.)

- [ ] **Step 2: Run — expect FAIL.**

```bash
npm test -- routines.test
```
Expected: 3 failing tests (createEmptyRoutine is undefined).

- [ ] **Step 3: Implement.** Append to `lib/db/queries/routines.ts`:

```ts
export async function createEmptyRoutine(
  db: AnyDb,
  init: { name: string; tag: string; color?: string },
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxRow: Array<{ max: number | null }> = await (db as any)
    .select({ max: sql<number | null>`MAX(${routines.position})` })
    .from(routines);
  const nextPos = (maxRow[0]?.max ?? -1) + 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted = (db as any)
    .insert(routines)
    .values({
      name: init.name,
      tag: init.tag,
      color: init.color ?? 'accent',
      position: nextPos,
      restDefaultSeconds: 120,
      warmupReminder: false,
      autoProgress: false,
    })
    .returning({ id: routines.id })
    .get();
  return inserted.id as number;
}
```

- [ ] **Step 4: Run — expect PASS.**

```bash
npm test -- routines.test
```
Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "feat(sp4c): createEmptyRoutine"
```

---

## Task 6: `deleteRoutine`

**Files:**
- Modify: `lib/db/queries/routines.ts`
- Modify: `lib/db/__tests__/routines.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
import { deleteRoutine } from '../queries/routines';
import { sessions, sessionSets } from '../schema';

describe('deleteRoutine', () => {
  it('removes the routine and cascades exercises + sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const target = all[0].id;
    await deleteRoutine(db, target);
    const after = await listRoutines(db);
    expect(after.find((r) => r.id === target)).toBeUndefined();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reLeft = await (db as any).select().from(routineExercises).where(eq(routineExercises.routineId, target));
    expect(reLeft).toHaveLength(0);
  });

  it('preserves past sessions with routine_id=NULL and snapshot intact', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const target = all[0].id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (db as any).insert(sessions).values({
      routineId: target,
      routineNameSnapshot: 'Push Day A',
      startedAt: 1_700_000_000_000,
      finishedAt: 1_700_000_900_000,
      durationSeconds: 900,
      totalVolumeKg: 1000,
      prCount: 0,
    }).run();
    await deleteRoutine(db, target);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const surviving = await (db as any).select().from(sessions);
    expect(surviving).toHaveLength(1);
    expect(surviving[0].routineId).toBeNull();
    expect(surviving[0].routineNameSnapshot).toBe('Push Day A');
  });
});
```

(Add `routineExercises` to imports.)

- [ ] **Step 2: Run — FAIL.**

```bash
npm test -- routines.test
```

- [ ] **Step 3: Implement.** Append to `lib/db/queries/routines.ts`:

```ts
export async function deleteRoutine(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).delete(routines).where(eq(routines.id, id)).run();
}
```

(`routine_exercises` and `routine_sets` cascade via FK; `sessions.routine_id` SET NULL via FK.)

- [ ] **Step 4: Run — PASS.**

```bash
npm test -- routines.test
```

- [ ] **Step 5: Commit.**

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "feat(sp4c): deleteRoutine with cascade"
```

---

## Task 7: `duplicateRoutine`

**Files:**
- Modify: `lib/db/queries/routines.ts`
- Modify: `lib/db/__tests__/routines.test.ts`

- [ ] **Step 1: Write failing tests.**

```ts
import { duplicateRoutine } from '../queries/routines';

describe('duplicateRoutine', () => {
  it('clones routine + exercises + sets with new ids', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const all = await listRoutines(db);
    const source = all.find((r) => r.name === 'Push Day A')!;
    const newId = await duplicateRoutine(db, source.id);
    expect(newId).not.toBe(source.id);
    const src = await getRoutineWithSets(db, source.id);
    const dup = await getRoutineWithSets(db, newId);
    expect(dup!.exercises).toHaveLength(src!.exercises.length);
    for (let i = 0; i < dup!.exercises.length; i++) {
      expect(dup!.exercises[i].sets).toHaveLength(src!.exercises[i].sets.length);
      expect(dup!.exercises[i].id).not.toBe(src!.exercises[i].id);
    }
  });

  it('names "X" → "X copy" → "X copy 2" → "X copy 3"', async () => {
    const { db } = makeTestDb();
    const id1 = await createEmptyRoutine(db, { name: 'Foo', tag: 'Custom' });
    const id2 = await duplicateRoutine(db, id1);
    const id3 = await duplicateRoutine(db, id2);
    const id4 = await duplicateRoutine(db, id3);
    const names = (await listRoutines(db)).map((r) => r.name).sort();
    expect(names).toEqual(['Foo', 'Foo copy', 'Foo copy 2', 'Foo copy 3']);
    void id4;
  });

  it('source is unchanged after duplicate', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const before = await getRoutineWithSets(db, (await listRoutines(db))[0].id);
    await duplicateRoutine(db, before!.id);
    const after = await getRoutineWithSets(db, before!.id);
    expect(after).toEqual(before);
  });
});
```

- [ ] **Step 2: Run — FAIL.**

```bash
npm test -- routines.test
```

- [ ] **Step 3: Implement.** Append to `lib/db/queries/routines.ts`:

```ts
function nextCopyName(existingNames: string[], baseName: string): string {
  // Strip a trailing " copy" or " copy N" from baseName so duplicating "X copy" yields "X copy 2".
  const m = baseName.match(/^(.*) copy(?: (\d+))?$/);
  const root = m ? m[1] : baseName;
  const taken = new Set(existingNames);
  if (!taken.has(`${root} copy`)) return `${root} copy`;
  for (let n = 2; n < 10000; n++) {
    const cand = `${root} copy ${n}`;
    if (!taken.has(cand)) return cand;
  }
  throw new Error('Too many copies');
}

export async function duplicateRoutine(db: AnyDb, sourceId: number): Promise<number> {
  const src = await getRoutineWithSets(db, sourceId);
  if (!src) throw new Error(`Routine ${sourceId} not found`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const allNames: Array<{ name: string }> = await (db as any).select({ name: routines.name }).from(routines);
  const newName = nextCopyName(allNames.map((r) => r.name), src.name);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const maxRow: Array<{ max: number | null }> = await (db as any)
    .select({ max: sql<number | null>`MAX(${routines.position})` })
    .from(routines);
  const nextPos = (maxRow[0]?.max ?? -1) + 1;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inserted = (db as any).insert(routines).values({
    name: newName,
    tag: src.tag,
    color: src.color,
    position: nextPos,
    restDefaultSeconds: src.restDefaultSeconds,
    warmupReminder: src.warmupReminder,
    autoProgress: src.autoProgress,
  }).returning({ id: routines.id }).get();
  const newRoutineId = inserted.id as number;

  for (const ex of src.exercises) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertedRe = (db as any).insert(routineExercises).values({
      routineId: newRoutineId,
      exerciseId: ex.exercise.id,
      position: ex.position,
      restSeconds: ex.restSeconds,
    }).returning({ id: routineExercises.id }).get();
    const newReId = insertedRe.id as number;
    for (const s of ex.sets) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).insert(routineSets).values({
        routineExerciseId: newReId,
        position: s.position,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      }).run();
    }
  }
  return newRoutineId;
}
```

- [ ] **Step 4: Run — PASS.**

```bash
npm test -- routines.test
```

- [ ] **Step 5: Commit.**

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "feat(sp4c): duplicateRoutine with name suffixing"
```

---

## Task 8: `updateRoutine` (transactional diff)

**Files:**
- Modify: `lib/db/queries/routines.ts`
- Modify: `lib/db/__tests__/routines.test.ts`

This is the largest query task. The function takes the full `Draft` from the editor store and reconciles persisted state to match.

- [ ] **Step 1: Define the input type.** Add to `lib/db/queries/routines.ts`:

```ts
export interface DraftSetInput {
  id: number | null;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
}
export interface DraftExerciseInput {
  id: number | null;
  exerciseId: string;
  restSeconds: number | null;
  sets: DraftSetInput[];
}
export interface DraftInput {
  routineId: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: DraftExerciseInput[];
}
```

- [ ] **Step 2: Write failing tests.**

```ts
import { updateRoutine, type DraftInput } from '../queries/routines';

function draftFromFull(r: NonNullable<Awaited<ReturnType<typeof getRoutineWithSets>>>): DraftInput {
  return {
    routineId: r.id,
    name: r.name,
    tag: r.tag,
    color: r.color,
    position: r.position,
    restDefaultSeconds: r.restDefaultSeconds,
    warmupReminder: r.warmupReminder,
    autoProgress: r.autoProgress,
    exercises: r.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exercise.id,
      restSeconds: ex.restSeconds,
      sets: ex.sets.map((s) => ({
        id: s.id,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      })),
    })),
  };
}

describe('updateRoutine', () => {
  it('updates name + session settings on the routine', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.name = 'Renamed';
    draft.restDefaultSeconds = 90;
    draft.warmupReminder = true;
    draft.autoProgress = true;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.name).toBe('Renamed');
    expect(after.restDefaultSeconds).toBe(90);
    expect(after.warmupReminder).toBe(true);
    expect(after.autoProgress).toBe(true);
  });

  it('removes deleted exercises and their sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises = draft.exercises.slice(0, 1);
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises).toHaveLength(1);
  });

  it('inserts a new exercise (id=null) with its sets', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises.push({
      id: null,
      exerciseId: 'lateral-raise',
      restSeconds: null,
      sets: [
        { id: null, targetReps: 12, targetWeightKg: 8, targetDurationSeconds: null, targetDistanceKm: null },
        { id: null, targetReps: 12, targetWeightKg: 8, targetDurationSeconds: null, targetDistanceKm: null },
      ],
    });
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises).toHaveLength(r.exercises.length + 1);
    const last = after.exercises[after.exercises.length - 1];
    expect(last.exercise.id).toBe('lateral-raise');
    expect(last.sets).toHaveLength(2);
    expect(last.sets[0].targetReps).toBe(12);
  });

  it('updates a mutated set (targetReps, weight)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises[0].sets[0].targetReps = 999;
    draft.exercises[0].sets[0].targetWeightKg = 77.5;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises[0].sets[0].targetReps).toBe(999);
    expect(after.exercises[0].sets[0].targetWeightKg).toBe(77.5);
  });

  it('renumbers positions densely after delete', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises = [draft.exercises[0], draft.exercises[2]]; // drop middle
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises.map((e) => e.position)).toEqual([0, 1]);
  });

  it('updates per-exercise restSeconds (incl. setting to null)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const id = (await listRoutines(db))[0].id;
    const r = (await getRoutineWithSets(db, id))!;
    const draft = draftFromFull(r);
    draft.exercises[0].restSeconds = 45;
    draft.exercises[1].restSeconds = null;
    await updateRoutine(db, draft);
    const after = (await getRoutineWithSets(db, id))!;
    expect(after.exercises[0].restSeconds).toBe(45);
    expect(after.exercises[1].restSeconds).toBeNull();
  });
});
```

- [ ] **Step 3: Run — FAIL.**

```bash
npm test -- routines.test
```

- [ ] **Step 4: Implement.** Append to `lib/db/queries/routines.ts`:

```ts
export async function updateRoutine(db: AnyDb, draft: DraftInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).transaction(async (tx: AnyDb) => {
    // Update routine row.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (tx as any).update(routines).set({
      name: draft.name,
      tag: draft.tag,
      color: draft.color,
      position: draft.position,
      restDefaultSeconds: draft.restDefaultSeconds,
      warmupReminder: draft.warmupReminder,
      autoProgress: draft.autoProgress,
    }).where(eq(routines.id, draft.routineId)).run();

    // Load persisted exercise + set rows.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const persistedRe: Array<{ id: number }> = await (tx as any)
      .select({ id: routineExercises.id })
      .from(routineExercises)
      .where(eq(routineExercises.routineId, draft.routineId));
    const draftReIds = new Set(draft.exercises.map((e) => e.id).filter((x): x is number => x !== null));
    // Delete removed exercises (cascades sets).
    for (const row of persistedRe) {
      if (!draftReIds.has(row.id)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tx as any).delete(routineExercises).where(eq(routineExercises.id, row.id)).run();
      }
    }

    // Upsert exercises in draft order; renumber positions densely.
    for (let i = 0; i < draft.exercises.length; i++) {
      const ex = draft.exercises[i];
      let reId: number;
      if (ex.id === null) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inserted = (tx as any).insert(routineExercises).values({
          routineId: draft.routineId,
          exerciseId: ex.exerciseId,
          position: i,
          restSeconds: ex.restSeconds,
        }).returning({ id: routineExercises.id }).get();
        reId = inserted.id as number;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (tx as any).update(routineExercises).set({
          exerciseId: ex.exerciseId,
          position: i,
          restSeconds: ex.restSeconds,
        }).where(eq(routineExercises.id, ex.id)).run();
        reId = ex.id;
      }

      // Diff sets for this exercise.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const persistedSets: Array<{ id: number }> = await (tx as any)
        .select({ id: routineSets.id })
        .from(routineSets)
        .where(eq(routineSets.routineExerciseId, reId));
      const draftSetIds = new Set(ex.sets.map((s) => s.id).filter((x): x is number => x !== null));
      for (const row of persistedSets) {
        if (!draftSetIds.has(row.id)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).delete(routineSets).where(eq(routineSets.id, row.id)).run();
        }
      }
      for (let j = 0; j < ex.sets.length; j++) {
        const s = ex.sets[j];
        if (s.id === null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).insert(routineSets).values({
            routineExerciseId: reId,
            position: j,
            targetReps: s.targetReps,
            targetWeightKg: s.targetWeightKg,
            targetDurationSeconds: s.targetDurationSeconds,
            targetDistanceKm: s.targetDistanceKm,
          }).run();
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (tx as any).update(routineSets).set({
            position: j,
            targetReps: s.targetReps,
            targetWeightKg: s.targetWeightKg,
            targetDurationSeconds: s.targetDurationSeconds,
            targetDistanceKm: s.targetDistanceKm,
          }).where(eq(routineSets.id, s.id)).run();
        }
      }
    }
  });
}
```

- [ ] **Step 5: Run — PASS.**

```bash
npm test -- routines.test
```

- [ ] **Step 6: Commit.**

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "feat(sp4c): updateRoutine transactional diff"
```

---

## Task 9: Editor store — types and skeleton

**Files:**
- Create: `lib/state/editorStore.ts`
- Create: `lib/state/__tests__/editorStore.test.ts`

- [ ] **Step 1: Write the failing test.**

```ts
/** @jest-environment node */
import { useEditorStore } from '../editorStore';
import type { RoutineFull } from '@/lib/db/queries/routines';

const fakeFull: RoutineFull = {
  id: 1, name: 'Push', tag: 'Upper', color: 'move', position: 0,
  restDefaultSeconds: 120, warmupReminder: false, autoProgress: false,
  exercises: [
    {
      id: 10, position: 0, restSeconds: null,
      exercise: { id: 'bench', name: 'Bench', group: 'Push', muscle: 'Chest', equipment: 'Barbell', kind: 'strength', sfSymbol: 'x' },
      sets: [
        { id: 100, routineExerciseId: 10, position: 0, targetReps: 5, targetWeightKg: 60, targetDurationSeconds: null, targetDistanceKm: null },
      ],
    },
  ],
};

beforeEach(() => useEditorStore.getState().clearDraft());

describe('editorStore', () => {
  it('starts with no draft and isDirty=false', () => {
    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });

  it('loadDraft hydrates draft and resets isDirty', () => {
    useEditorStore.getState().loadDraft(fakeFull);
    const s = useEditorStore.getState();
    expect(s.draft).not.toBeNull();
    expect(s.draft!.name).toBe('Push');
    expect(s.draft!.exercises[0].sets[0].targetReps).toBe(5);
    expect(s.isDirty).toBe(false);
  });

  it('clearDraft empties draft and resets isDirty', () => {
    useEditorStore.getState().loadDraft(fakeFull);
    useEditorStore.getState().clearDraft();
    const s = useEditorStore.getState();
    expect(s.draft).toBeNull();
    expect(s.isDirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run — FAIL** (module missing).

```bash
npm test -- editorStore
```

- [ ] **Step 3: Implement.** Create `lib/state/editorStore.ts`:

```ts
import { create } from 'zustand';

import type { RoutineFull } from '@/lib/db/queries/routines';

export interface DraftSet {
  id: number | null;
  position: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
}

export interface DraftExercise {
  id: number | null;
  exerciseId: string;
  position: number;
  restSeconds: number | null;
  sets: DraftSet[];
}

export interface Draft {
  routineId: number;
  name: string;
  tag: string;
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: DraftExercise[];
}

export interface EditorState {
  draft: Draft | null;
  isDirty: boolean;
  loadDraft: (r: RoutineFull) => void;
  clearDraft: () => void;
  setName: (n: string) => void;
  setTag: (t: string) => void;
  setRestDefault: (s: number) => void;
  setWarmupReminder: (b: boolean) => void;
  setAutoProgress: (b: boolean) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (index: number) => void;
  reorderExercises: (from: number, to: number) => void;
  setExerciseRest: (index: number, restSeconds: number | null) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, patch: Partial<Omit<DraftSet, 'id' | 'position'>>) => void;
  reorderSets: (exerciseIndex: number, from: number, to: number) => void;
}

function fromRoutineFull(r: RoutineFull): Draft {
  return {
    routineId: r.id,
    name: r.name,
    tag: r.tag,
    color: r.color,
    position: r.position,
    restDefaultSeconds: r.restDefaultSeconds,
    warmupReminder: r.warmupReminder,
    autoProgress: r.autoProgress,
    exercises: r.exercises.map((ex) => ({
      id: ex.id,
      exerciseId: ex.exercise.id,
      position: ex.position,
      restSeconds: ex.restSeconds,
      sets: ex.sets.map((s) => ({
        id: s.id,
        position: s.position,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        targetDistanceKm: s.targetDistanceKm,
      })),
    })),
  };
}

function dirty<T extends EditorState>(set: (fn: (s: T) => Partial<T>) => void) {
  return (mut: (d: Draft) => void) =>
    set((s) => {
      if (!s.draft) return {} as Partial<T>;
      const next = structuredClone(s.draft);
      mut(next);
      return { draft: next, isDirty: true } as Partial<T>;
    });
}

export const useEditorStore = create<EditorState>()((set) => {
  const mutate = dirty<EditorState>(set);
  return {
    draft: null,
    isDirty: false,
    loadDraft: (r) => set({ draft: fromRoutineFull(r), isDirty: false }),
    clearDraft: () => set({ draft: null, isDirty: false }),
    setName: (n) => mutate((d) => { d.name = n; }),
    setTag: (t) => mutate((d) => { d.tag = t; }),
    setRestDefault: (s) => mutate((d) => { d.restDefaultSeconds = s; }),
    setWarmupReminder: (b) => mutate((d) => { d.warmupReminder = b; }),
    setAutoProgress: (b) => mutate((d) => { d.autoProgress = b; }),
    addExercise: (exerciseId) => mutate((d) => {
      d.exercises.push({
        id: null,
        exerciseId,
        position: d.exercises.length,
        restSeconds: null,
        sets: [
          { id: null, position: 0, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
          { id: null, position: 1, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
          { id: null, position: 2, targetReps: 8, targetWeightKg: null, targetDurationSeconds: null, targetDistanceKm: null },
        ],
      });
    }),
    removeExercise: (index) => mutate((d) => {
      d.exercises.splice(index, 1);
      d.exercises.forEach((ex, i) => { ex.position = i; });
    }),
    reorderExercises: (from, to) => mutate((d) => {
      if (from === to || from < 0 || to < 0 || from >= d.exercises.length || to >= d.exercises.length) return;
      const [moved] = d.exercises.splice(from, 1);
      d.exercises.splice(to, 0, moved);
      d.exercises.forEach((ex, i) => { ex.position = i; });
    }),
    setExerciseRest: (index, restSeconds) => mutate((d) => {
      if (d.exercises[index]) d.exercises[index].restSeconds = restSeconds;
    }),
    addSet: (exerciseIndex) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      ex.sets.push({
        id: null,
        position: ex.sets.length,
        targetReps: last?.targetReps ?? 8,
        targetWeightKg: last?.targetWeightKg ?? null,
        targetDurationSeconds: last?.targetDurationSeconds ?? null,
        targetDistanceKm: last?.targetDistanceKm ?? null,
      });
    }),
    removeSet: (exerciseIndex, setIndex) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      ex.sets.splice(setIndex, 1);
      ex.sets.forEach((s, i) => { s.position = i; });
    }),
    updateSet: (exerciseIndex, setIndex, patch) => mutate((d) => {
      const s = d.exercises[exerciseIndex]?.sets[setIndex];
      if (!s) return;
      Object.assign(s, patch);
    }),
    reorderSets: (exerciseIndex, from, to) => mutate((d) => {
      const ex = d.exercises[exerciseIndex];
      if (!ex) return;
      if (from === to || from < 0 || to < 0 || from >= ex.sets.length || to >= ex.sets.length) return;
      const [moved] = ex.sets.splice(from, 1);
      ex.sets.splice(to, 0, moved);
      ex.sets.forEach((s, i) => { s.position = i; });
    }),
  };
});
```

- [ ] **Step 4: Run — PASS** (the three baseline tests).

```bash
npm test -- editorStore
```

- [ ] **Step 5: Commit.**

```bash
git add lib/state/editorStore.ts lib/state/__tests__/editorStore.test.ts
git commit -m "feat(sp4c): editor Zustand store skeleton"
```

---

## Task 10: Editor store mutator tests (top-level fields)

**Files:**
- Modify: `lib/state/__tests__/editorStore.test.ts`

- [ ] **Step 1: Append tests** for setters that touch top-level fields:

```ts
describe('editorStore top-level mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('setName flips isDirty and updates value', () => {
    useEditorStore.getState().setName('Renamed');
    expect(useEditorStore.getState().draft!.name).toBe('Renamed');
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('setTag, setRestDefault, setWarmupReminder, setAutoProgress all set isDirty', () => {
    useEditorStore.getState().setTag('Lower');
    useEditorStore.getState().setRestDefault(60);
    useEditorStore.getState().setWarmupReminder(true);
    useEditorStore.getState().setAutoProgress(true);
    const d = useEditorStore.getState().draft!;
    expect(d.tag).toBe('Lower');
    expect(d.restDefaultSeconds).toBe(60);
    expect(d.warmupReminder).toBe(true);
    expect(d.autoProgress).toBe(true);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('mutators on null draft are no-ops', () => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().setName('X');
    expect(useEditorStore.getState().draft).toBeNull();
    expect(useEditorStore.getState().isDirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run — PASS.**

```bash
npm test -- editorStore
```

- [ ] **Step 3: Commit.**

```bash
git add lib/state/__tests__/editorStore.test.ts
git commit -m "test(sp4c): editor store top-level mutators"
```

---

## Task 11: Editor store mutator tests (exercises)

**Files:**
- Modify: `lib/state/__tests__/editorStore.test.ts`

- [ ] **Step 1: Append tests.**

```ts
describe('editorStore exercise mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('addExercise appends with id=null and 3 default sets', () => {
    useEditorStore.getState().addExercise('ohp');
    const ex = useEditorStore.getState().draft!.exercises;
    expect(ex).toHaveLength(2);
    expect(ex[1].id).toBeNull();
    expect(ex[1].exerciseId).toBe('ohp');
    expect(ex[1].position).toBe(1);
    expect(ex[1].sets).toHaveLength(3);
    expect(useEditorStore.getState().isDirty).toBe(true);
  });

  it('removeExercise renumbers positions densely', () => {
    useEditorStore.getState().addExercise('ohp');
    useEditorStore.getState().addExercise('incline-db');
    useEditorStore.getState().removeExercise(0);
    const ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.position)).toEqual([0, 1]);
  });

  it('reorderExercises moves and renumbers; no-op for invalid args', () => {
    useEditorStore.getState().addExercise('ohp');
    useEditorStore.getState().addExercise('incline-db');
    useEditorStore.getState().reorderExercises(0, 2);
    let ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.exerciseId)).toEqual(['ohp', 'incline-db', 'bench']);
    expect(ex.map((e) => e.position)).toEqual([0, 1, 2]);
    // No-op cases.
    useEditorStore.getState().reorderExercises(0, 0);
    useEditorStore.getState().reorderExercises(-1, 1);
    useEditorStore.getState().reorderExercises(0, 99);
    ex = useEditorStore.getState().draft!.exercises;
    expect(ex.map((e) => e.exerciseId)).toEqual(['ohp', 'incline-db', 'bench']);
  });

  it('setExerciseRest accepts number and null', () => {
    useEditorStore.getState().setExerciseRest(0, 90);
    expect(useEditorStore.getState().draft!.exercises[0].restSeconds).toBe(90);
    useEditorStore.getState().setExerciseRest(0, null);
    expect(useEditorStore.getState().draft!.exercises[0].restSeconds).toBeNull();
  });
});
```

- [ ] **Step 2: Run — PASS.**

```bash
npm test -- editorStore
```

- [ ] **Step 3: Commit.**

```bash
git add lib/state/__tests__/editorStore.test.ts
git commit -m "test(sp4c): editor store exercise mutators"
```

---

## Task 12: Editor store mutator tests (sets)

**Files:**
- Modify: `lib/state/__tests__/editorStore.test.ts`

- [ ] **Step 1: Append tests.**

```ts
describe('editorStore set mutators', () => {
  beforeEach(() => {
    useEditorStore.getState().clearDraft();
    useEditorStore.getState().loadDraft(fakeFull);
  });

  it('addSet appends with id=null, copies last set targets', () => {
    useEditorStore.getState().addSet(0);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets).toHaveLength(2);
    expect(sets[1].id).toBeNull();
    expect(sets[1].position).toBe(1);
    expect(sets[1].targetReps).toBe(5);     // copied from existing set
    expect(sets[1].targetWeightKg).toBe(60);
  });

  it('removeSet renumbers densely', () => {
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().removeSet(0, 1);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets.map((s) => s.position)).toEqual([0, 1]);
  });

  it('updateSet patches reps and weight without touching id', () => {
    useEditorStore.getState().updateSet(0, 0, { targetReps: 12, targetWeightKg: 65 });
    const s = useEditorStore.getState().draft!.exercises[0].sets[0];
    expect(s.id).toBe(100);
    expect(s.targetReps).toBe(12);
    expect(s.targetWeightKg).toBe(65);
  });

  it('reorderSets moves and renumbers; no-op for invalid args', () => {
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().addSet(0);
    useEditorStore.getState().reorderSets(0, 2, 0);
    const sets = useEditorStore.getState().draft!.exercises[0].sets;
    expect(sets.map((s) => s.position)).toEqual([0, 1, 2]);
    // No-op invalid args.
    useEditorStore.getState().reorderSets(0, 0, 0);
    useEditorStore.getState().reorderSets(0, -1, 1);
    useEditorStore.getState().reorderSets(0, 0, 99);
  });
});
```

- [ ] **Step 2: Run — PASS.**

```bash
npm test -- editorStore
```

- [ ] **Step 3: Commit.**

```bash
git add lib/state/__tests__/editorStore.test.ts
git commit -m "test(sp4c): editor store set mutators"
```

---

## Task 13: Move tab → directory route group

**Files:**
- Delete: `app/(tabs)/move.tsx`
- Create: `app/(tabs)/move/_layout.tsx`
- Create: `app/(tabs)/move/index.tsx` (placeholder for now; replaced in Task 17)

- [ ] **Step 1: Delete the existing move.tsx.**

```bash
git rm app/\(tabs\)/move.tsx
```

(In bash on Windows, escaping the parens with backslashes — or quote the path: `git rm "app/(tabs)/move.tsx"`.)

- [ ] **Step 2: Create the layout.** `app/(tabs)/move/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function MoveLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create a temporary index.** `app/(tabs)/move/index.tsx`:

```tsx
import { StubTab } from '@/components/StubTab';
export default function MoveIndex() {
  return <StubTab title="Move" comingIn="SP4c" />;
}
```

- [ ] **Step 4: Type-check.**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 5: Run app on web** (manual smoke; non-blocking — confirms the tab still renders).

```bash
npx expo start --web
```
Expected: Move tab loads without error. Stop the server.

- [ ] **Step 6: Commit.**

```bash
git add app/\(tabs\)/move
git commit -m "refactor(sp4c): convert move tab to stack group"
```

---

## Task 14: Shared workout components — TagPills, SetChip, ExerciseRow, RoutineCard, CardioRow

**Files:**
- Create: `components/workouts/TagPills.tsx`
- Create: `components/workouts/SetChip.tsx`
- Create: `components/workouts/ExerciseRow.tsx`
- Create: `components/workouts/RoutineCard.tsx`
- Create: `components/workouts/CardioRow.tsx`

Visuals follow `design_handoff/src/workout-screens.jsx` and `workout-screens2.jsx`. NativeWind classes. Existing project pattern uses `useTheme()` from `@/lib/theme/provider` and `colors[resolved]` palette.

- [ ] **Step 1: TagPills.** `components/workouts/TagPills.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const ALL_TAGS = ['Upper', 'Lower', 'Full', 'Cardio', 'Custom'] as const;
export type Tag = (typeof ALL_TAGS)[number];

export function TagPills({
  value, onChange, disabledTags = [],
}: {
  value: string;
  onChange: (t: string) => void;
  disabledTags?: string[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {ALL_TAGS.map((t) => {
        const selected = t === value;
        const disabled = disabledTags.includes(t);
        return (
          <Pressable
            key={t}
            disabled={disabled}
            onPress={() => onChange(t)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
              backgroundColor: selected ? palette.accent : palette.fill,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Text style={{
              fontSize: 12, fontWeight: '600',
              color: selected ? '#fff' : palette.ink2,
            }}>{t}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 2: SetChip.** `components/workouts/SetChip.tsx`:

```tsx
import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetChip({
  reps, weightKg, onPress,
}: {
  reps: number | null;
  weightKg: number | null;
  onPress?: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const label =
    weightKg != null && reps != null ? `${weightKg}×${reps}`
    : reps != null ? `${reps} reps`
    : '—';
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
        backgroundColor: palette.fill,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.ink2, fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: ExerciseRow.** `components/workouts/ExerciseRow.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { SetChip } from './SetChip';

export interface ExerciseRowProps {
  name: string;
  muscle: string;
  sfSymbol: string;
  sets: Array<{ targetReps: number | null; targetWeightKg: number | null }>;
  onTapRow: () => void;
  onTapSet: (index: number) => void;
  onAddSet: () => void;
}

export function ExerciseRow(props: ExerciseRowProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <Pressable onPress={props.onTapRow} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
          backgroundColor: `${palette.move}22`,
        }}>
          <SymbolView name={props.sfSymbol as never} size={16} tintColor={palette.move} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{props.name}</Text>
          <Text style={{ fontSize: 12, color: palette.ink3 }}>
            {props.muscle} · {props.sets.length} sets
          </Text>
        </View>
        <SymbolView name={'chevron.right' as never} size={13} tintColor={palette.ink4} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 5, marginTop: 8, marginLeft: 52, flexWrap: 'wrap' }}>
        {props.sets.map((s, i) => (
          <SetChip key={i} reps={s.targetReps} weightKg={s.targetWeightKg} onPress={() => props.onTapSet(i)} />
        ))}
        <Pressable
          onPress={props.onAddSet}
          style={{
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
            borderWidth: 1, borderColor: palette.hair, borderStyle: 'dashed',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: palette.ink3 }}>+ set</Text>
        </Pressable>
      </View>
    </View>
  );
}
```

- [ ] **Step 4: RoutineCard.** `components/workouts/RoutineCard.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RoutineSummary } from '@/lib/db/queries/routines';

export function RoutineCard({
  routine, onPress, onLongPress,
}: {
  routine: RoutineSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.hair, borderWidth: 0.5,
        borderRadius: 12, padding: 14, marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase' }}>
        {routine.tag}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 4 }}>
        {routine.name}
      </Text>
      <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 4 }}>
        {routine.exerciseCount} exercises · ~{routine.estMinutes} min
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 5: CardioRow.** `components/workouts/CardioRow.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RoutineSummary } from '@/lib/db/queries/routines';

export function CardioRow({ routine, onPress }: { routine: RoutineSummary; onPress: () => void }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 14,
        backgroundColor: palette.surface,
        borderBottomColor: palette.hair, borderBottomWidth: 0.5,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{routine.name}</Text>
        <Text style={{ fontSize: 12, color: palette.ink3 }}>{routine.exerciseCount} · ~{routine.estMinutes} min</Text>
      </View>
    </Pressable>
  );
}
```

- [ ] **Step 6: Type-check.**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add components/workouts
git commit -m "feat(sp4c): shared workout components"
```

---

## Task 15: Modal sheets — SetEditSheet, ExerciseSettingsSheet, RenameRoutineSheet

**Files:**
- Create: `components/workouts/SetEditSheet.tsx`
- Create: `components/workouts/ExerciseSettingsSheet.tsx`
- Create: `components/workouts/RenameRoutineSheet.tsx`

All three follow the `<Modal animationType="slide" transparent>` pattern from `components/PalComposer.tsx`.

- [ ] **Step 1: SetEditSheet.** `components/workouts/SetEditSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetEditSheet({
  visible, initialReps, initialWeight, onCancel, onSave,
}: {
  visible: boolean;
  initialReps: number | null;
  initialWeight: number | null;
  onCancel: () => void;
  onSave: (reps: number | null, weightKg: number | null) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [reps, setReps] = useState(initialReps?.toString() ?? '');
  const [weight, setWeight] = useState(initialWeight?.toString() ?? '');

  useEffect(() => {
    if (visible) {
      setReps(initialReps?.toString() ?? '');
      setWeight(initialWeight?.toString() ?? '');
    }
  }, [visible, initialReps, initialWeight]);

  const repsNum = reps.trim() === '' ? null : parseInt(reps, 10);
  const weightNum = weight.trim() === '' ? null : parseFloat(weight);
  const isValid = (repsNum === null || (Number.isFinite(repsNum) && repsNum >= 1))
                && (weightNum === null || (Number.isFinite(weightNum) && weightNum >= 0));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginBottom: 12 }}>Edit set</Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginBottom: 4 }}>Reps</Text>
          <TextInput
            value={reps} onChangeText={setReps} keyboardType="number-pad"
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 12,
            }}
          />
          <Text style={{ fontSize: 12, color: palette.ink3, marginBottom: 4 }}>Weight (kg)</Text>
          <TextInput
            value={weight} onChangeText={setWeight} keyboardType="decimal-pad"
            placeholder="(bodyweight)"
            placeholderTextColor={palette.ink4}
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onCancel}
              style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.fill, alignItems: 'center' }}
            >
              <Text style={{ color: palette.ink, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!isValid}
              onPress={() => onSave(repsNum, weightNum)}
              style={{
                flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                backgroundColor: isValid ? palette.accent : palette.fill,
              }}
            >
              <Text style={{ color: isValid ? '#fff' : palette.ink3, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 2: ExerciseSettingsSheet.** `components/workouts/ExerciseSettingsSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseSettingsSheet({
  visible, exerciseName, initialRest, fallbackRest, onCancel, onSave,
}: {
  visible: boolean;
  exerciseName: string;
  initialRest: number | null;
  fallbackRest: number;
  onCancel: () => void;
  onSave: (restSeconds: number | null) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [rest, setRest] = useState(initialRest?.toString() ?? '');

  useEffect(() => { if (visible) setRest(initialRest?.toString() ?? ''); }, [visible, initialRest]);

  const restNum = rest.trim() === '' ? null : parseInt(rest, 10);
  const isValid = restNum === null || (Number.isFinite(restNum) && restNum >= 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink }}>{exerciseName}</Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 12, marginBottom: 4 }}>
            Rest seconds (blank = use routine default of {fallbackRest}s)
          </Text>
          <TextInput
            value={rest} onChangeText={setRest} keyboardType="number-pad"
            placeholder={`${fallbackRest}`}
            placeholderTextColor={palette.ink4}
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onCancel}
              style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.fill, alignItems: 'center' }}
            >
              <Text style={{ color: palette.ink, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!isValid}
              onPress={() => onSave(restNum)}
              style={{
                flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                backgroundColor: isValid ? palette.accent : palette.fill,
              }}
            >
              <Text style={{ color: isValid ? '#fff' : palette.ink3, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 3: RenameRoutineSheet.** `components/workouts/RenameRoutineSheet.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RenameRoutineSheet({
  visible, initialName, onCancel, onSave,
}: {
  visible: boolean;
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [name, setName] = useState(initialName);

  useEffect(() => { if (visible) setName(initialName); }, [visible, initialName]);
  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginBottom: 12 }}>Rename routine</Text>
          <TextInput
            value={name} onChangeText={setName} autoFocus
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onCancel}
              style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.fill, alignItems: 'center' }}
            >
              <Text style={{ color: palette.ink, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!isValid}
              onPress={() => onSave(trimmed)}
              style={{
                flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                backgroundColor: isValid ? palette.accent : palette.fill,
              }}
            >
              <Text style={{ color: isValid ? '#fff' : palette.ink3, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
```

- [ ] **Step 4: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 5: Commit.**

```bash
git add components/workouts
git commit -m "feat(sp4c): editor modal sheets"
```

---

## Task 16: Routine action sheet + handlers hook

**Files:**
- Create: `components/workouts/RoutineActionSheet.tsx`
- Create: `lib/hooks/useRoutineActions.ts`

The action sheet is a custom modal (cross-platform, since `ActionSheetIOS` isn't on web). Three actions: Duplicate / Rename / Delete. The hook exposes them.

- [ ] **Step 1: RoutineActionSheet.** `components/workouts/RoutineActionSheet.tsx`:

```tsx
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RoutineActionSheet({
  visible, onClose, onDuplicate, onRename, onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const Row = ({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable
      onPress={() => { onPress(); onClose(); }}
      style={{
        padding: 16, alignItems: 'center',
        borderTopColor: palette.hair, borderTopWidth: 0.5,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '500', color: danger ? palette.red : palette.accent }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: palette.surface }}>
        <Row label="Duplicate" onPress={onDuplicate} />
        <Row label="Rename" onPress={onRename} />
        <Row label="Delete" onPress={onDelete} danger />
        <Row label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: useRoutineActions hook.** `lib/hooks/useRoutineActions.ts`:

```ts
import { Alert } from 'react-native';
import { useDb } from '@/lib/db/provider';
import { deleteRoutine, duplicateRoutine, updateRoutine, getRoutineWithSets } from '@/lib/db/queries/routines';

export function useRoutineActions() {
  const db = useDb();
  return {
    duplicate: async (id: number) => {
      try {
        await duplicateRoutine(db, id);
      } catch (e) {
        Alert.alert("Couldn't duplicate routine", String(e));
      }
    },
    rename: async (id: number, newName: string) => {
      try {
        const r = await getRoutineWithSets(db, id);
        if (!r) return;
        await updateRoutine(db, {
          routineId: r.id, name: newName, tag: r.tag, color: r.color, position: r.position,
          restDefaultSeconds: r.restDefaultSeconds, warmupReminder: r.warmupReminder, autoProgress: r.autoProgress,
          exercises: r.exercises.map((ex) => ({
            id: ex.id, exerciseId: ex.exercise.id, restSeconds: ex.restSeconds,
            sets: ex.sets.map((s) => ({
              id: s.id,
              targetReps: s.targetReps, targetWeightKg: s.targetWeightKg,
              targetDurationSeconds: s.targetDurationSeconds, targetDistanceKm: s.targetDistanceKm,
            })),
          })),
        });
      } catch (e) {
        Alert.alert("Couldn't rename routine", String(e));
      }
    },
    delete: (id: number, name: string) =>
      new Promise<boolean>((resolve) => {
        Alert.alert(
          'Delete routine',
          `Delete "${name}"? This can't be undone.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
            {
              text: 'Delete', style: 'destructive', onPress: async () => {
                try {
                  await deleteRoutine(db, id);
                  resolve(true);
                } catch (e) {
                  Alert.alert("Couldn't delete routine", String(e));
                  resolve(false);
                }
              },
            },
          ],
        );
      }),
  };
}
```

(`useDb` and `lib/db/provider` come from SP3a — verify the exact import path. If the project uses a different name like `useDatabase` or imports `db` directly, update accordingly.)

- [ ] **Step 3: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 4: Commit.**

```bash
git add components/workouts/RoutineActionSheet.tsx lib/hooks/useRoutineActions.ts
git commit -m "feat(sp4c): routine action sheet + handlers hook"
```

---

## Task 17: PreWorkout screen

**Files:**
- Modify: `app/(tabs)/move/index.tsx` (replace stub from Task 13)

- [ ] **Step 1: Implement.** Replace the file's contents:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useDb } from '@/lib/db/provider';
import { listRoutines, createEmptyRoutine, type RoutineSummary } from '@/lib/db/queries/routines';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { RoutineCard } from '@/components/workouts/RoutineCard';
import { CardioRow } from '@/components/workouts/CardioRow';
import { RoutineActionSheet } from '@/components/workouts/RoutineActionSheet';
import { RenameRoutineSheet } from '@/components/workouts/RenameRoutineSheet';
import { useRoutineActions } from '@/lib/hooks/useRoutineActions';

export default function PreWorkout() {
  const db = useDb();
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const actions = useRoutineActions();

  // useLiveQuery resubscribes when listRoutines's underlying tables change.
  const { data: routines = [] } = useLiveQuery(listRoutines(db) as unknown as Promise<RoutineSummary[]>);

  const [actionTarget, setActionTarget] = useState<RoutineSummary | null>(null);
  const [renameTarget, setRenameTarget] = useState<RoutineSummary | null>(null);

  const strength = routines.filter((r) => r.tag !== 'Cardio');
  const cardio = routines.filter((r) => r.tag === 'Cardio');

  const onNew = async () => {
    const id = await createEmptyRoutine(db, { name: 'New routine', tag: 'Custom' });
    router.push({ pathname: '/(tabs)/move/[routineId]/edit', params: { routineId: String(id) } });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.ink }}>Workouts</Text>
        <Pressable onPress={onNew}>
          <Text style={{ fontSize: 17, color: palette.accent, fontWeight: '600' }}>+ New</Text>
        </Pressable>
      </View>

      <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 8 }}>
        Strength
      </Text>
      {strength.map((r) => (
        <RoutineCard
          key={r.id}
          routine={r}
          onPress={() => router.push({ pathname: '/(tabs)/move/[routineId]/edit', params: { routineId: String(r.id) } })}
          onLongPress={() => setActionTarget(r)}
        />
      ))}

      {cardio.length > 0 && (
        <>
          <Text style={{ fontSize: 12, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginVertical: 12 }}>
            Cardio
          </Text>
          {cardio.map((r) => (
            <CardioRow
              key={r.id}
              routine={r}
              onPress={() => { /* SP4d: start cardio session. No-op in 4c. */ }}
            />
          ))}
        </>
      )}

      <View style={{ marginTop: 24, gap: 8 }}>
        <Pressable
          onPress={() => router.push('/(tabs)/move/library')}
          style={{ padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderColor: palette.hair, borderWidth: 0.5, alignItems: 'center' }}
        >
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Browse exercise library</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/move/generate')}
          style={{ padding: 14, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Generate routine with AI</Text>
        </Pressable>
      </View>

      <RoutineActionSheet
        visible={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        onDuplicate={() => actionTarget && actions.duplicate(actionTarget.id)}
        onRename={() => { setRenameTarget(actionTarget); setActionTarget(null); }}
        onDelete={() => actionTarget && actions.delete(actionTarget.id, actionTarget.name)}
      />
      <RenameRoutineSheet
        visible={renameTarget !== null}
        initialName={renameTarget?.name ?? ''}
        onCancel={() => setRenameTarget(null)}
        onSave={async (name) => {
          if (renameTarget) await actions.rename(renameTarget.id, name);
          setRenameTarget(null);
        }}
      />
    </ScrollView>
  );
}
```

(If `useLiveQuery`'s actual signature in this project's drizzle version doesn't accept the listRoutines join shape, simplify by selecting `.from(routines).orderBy(asc(routines.position))` directly inside `useLiveQuery` and computing `exerciseCount` and `estMinutes` per-row in JS. The plan keeps the spec-level interface but allows this fallback.)

- [ ] **Step 2: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 3: Manual smoke (web).**

```bash
npx expo start --web
```
Steps:
1. Open Move tab → routines render in two sections.
2. Tap "+ New" → navigates to editor with a new empty routine.
3. Long-press a routine → action sheet shows.
4. Tap Duplicate → returns to list with `<name> copy`.
5. Tap Rename → sheet → save → name updates.
6. Tap Delete → Alert → confirm → row gone.
7. Tap "Browse exercise library" → navigates (Task 19's screen — placeholder for now if not yet done).

Stop server.

- [ ] **Step 4: Commit.**

```bash
git add app/\(tabs\)/move/index.tsx
git commit -m "feat(sp4c): PreWorkout screen"
```

---

## Task 18: RoutineEditor screen

**Files:**
- Create: `app/(tabs)/move/[routineId]/edit.tsx`

- [ ] **Step 1: Implement.**

```tsx
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useDb } from '@/lib/db/provider';
import { getRoutineWithSets, updateRoutine, deleteRoutine, type DraftInput } from '@/lib/db/queries/routines';
import { useEditorStore } from '@/lib/state/editorStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { ExerciseRow } from '@/components/workouts/ExerciseRow';
import { TagPills } from '@/components/workouts/TagPills';
import { ExerciseSettingsSheet } from '@/components/workouts/ExerciseSettingsSheet';
import { SetEditSheet } from '@/components/workouts/SetEditSheet';
import { seedWorkoutsExercises } from '@/lib/db/seed-workouts'; // for exercise meta lookup; if not exported, use getExerciseById

// Minimal helper: load exercise metadata for the rows. Use a query if available.
import { exercises as exercisesTbl, type Exercise } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export default function RoutineEditor() {
  const db = useDb();
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const id = Number(routineId);
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const { draft, isDirty, loadDraft, clearDraft, setName, setTag, setRestDefault,
          setWarmupReminder, setAutoProgress, removeExercise, setExerciseRest,
          addSet, updateSet } = useEditorStore();

  const [notFound, setNotFound] = useState(false);
  const [exerciseMeta, setExerciseMeta] = useState<Record<string, Exercise>>({});

  // Hydrate the draft once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await getRoutineWithSets(db, id);
      if (cancelled) return;
      if (!r) { setNotFound(true); return; }
      loadDraft(r);
      // Cache exercise metadata for the rows.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const all = await (db as any).select().from(exercisesTbl) as Exercise[];
      const map: Record<string, Exercise> = {};
      for (const ex of all) map[ex.id] = ex;
      setExerciseMeta(map);
    })();
    return () => { cancelled = true; clearDraft(); };
  }, [db, id, loadDraft, clearDraft]);

  // Sheet state.
  const [exSettingsIdx, setExSettingsIdx] = useState<number | null>(null);
  const [setEdit, setSetEdit] = useState<{ exIdx: number; setIdx: number } | null>(null);

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.ink, fontSize: 17 }}>Routine not found</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16, padding: 12 }}>
          <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
        </Pressable>
      </View>
    );
  }
  if (!draft) return <View style={{ flex: 1, backgroundColor: palette.bg }} />;

  const trimmedNameValid = draft.name.trim().length > 0;
  const canSave = isDirty && trimmedNameValid;

  const onCancel = () => {
    if (!isDirty) { router.back(); return; }
    Alert.alert('Discard changes?', 'You have unsaved edits.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearDraft(); router.back(); } },
    ]);
  };

  const onSave = async () => {
    const input: DraftInput = {
      routineId: draft.routineId,
      name: draft.name.trim(),
      tag: draft.tag,
      color: draft.color,
      position: draft.position,
      restDefaultSeconds: draft.restDefaultSeconds,
      warmupReminder: draft.warmupReminder,
      autoProgress: draft.autoProgress,
      exercises: draft.exercises.map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        restSeconds: ex.restSeconds,
        sets: ex.sets.map((s) => ({
          id: s.id,
          targetReps: s.targetReps,
          targetWeightKg: s.targetWeightKg,
          targetDurationSeconds: s.targetDurationSeconds,
          targetDistanceKm: s.targetDistanceKm,
        })),
      })),
    };
    try {
      await updateRoutine(db, input);
      clearDraft();
      router.back();
    } catch (e) {
      Alert.alert("Couldn't save changes", String(e));
    }
  };

  const onDelete = () => {
    Alert.alert('Delete routine', `Delete "${draft.name}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteRoutine(db, draft.routineId);
            clearDraft();
            router.back();
          } catch (e) {
            Alert.alert("Couldn't delete routine", String(e));
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 80 }}>
      {/* Nav bar */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 16 }}>
        <Pressable onPress={onCancel}>
          <Text style={{ color: palette.accent, fontSize: 17 }}>Cancel</Text>
        </Pressable>
        <Pressable onPress={onSave} disabled={!canSave}>
          <Text style={{ color: canSave ? palette.accent : palette.ink4, fontSize: 17, fontWeight: '600' }}>Save</Text>
        </Pressable>
      </View>

      {/* Name + tag */}
      <View style={{ paddingHorizontal: 16 }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 4 }}>Name</Text>
        <TextInput
          value={draft.name}
          onChangeText={setName}
          style={{
            fontSize: 17, fontWeight: '500', color: palette.ink,
            borderBottomWidth: 0.5, borderBottomColor: trimmedNameValid ? palette.hair : palette.red,
            paddingVertical: 8, marginBottom: 12,
          }}
        />
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', marginBottom: 6 }}>Tag</Text>
        <TagPills value={draft.tag} onChange={setTag} disabledTags={['Cardio']} />
      </View>

      {/* Exercises */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', padding: 16 }}>
        Exercises · {draft.exercises.length}
      </Text>
      {draft.exercises.map((ex, i) => {
        const meta = exerciseMeta[ex.exerciseId];
        return (
          <View key={`${ex.id}-${i}`} style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
            <ExerciseRow
              name={meta?.name ?? ex.exerciseId}
              muscle={meta?.muscle ?? ''}
              sfSymbol={meta?.sfSymbol ?? 'dumbbell.fill'}
              sets={ex.sets}
              onTapRow={() => setExSettingsIdx(i)}
              onTapSet={(setIdx) => setSetEdit({ exIdx: i, setIdx })}
              onAddSet={() => addSet(i)}
            />
            <Pressable onPress={() => removeExercise(i)} style={{ alignItems: 'flex-end', padding: 8 }}>
              <Text style={{ color: palette.red, fontSize: 12 }}>Remove</Text>
            </Pressable>
          </View>
        );
      })}

      <Pressable
        onPress={() => router.push('/(tabs)/move/library?pick=1')}
        style={{ margin: 16, padding: 14, borderRadius: 12, backgroundColor: palette.surface, borderColor: palette.hair, borderWidth: 0.5, alignItems: 'center' }}
      >
        <Text style={{ color: palette.accent, fontWeight: '600' }}>+ Add exercise from library</Text>
      </Pressable>

      <Pressable
        onPress={() => router.push('/(tabs)/move/generate')}
        style={{ marginHorizontal: 16, padding: 14, borderRadius: 12, backgroundColor: palette.accent, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontWeight: '700' }}>Generate routine with AI</Text>
      </Pressable>

      {/* Session settings */}
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase', padding: 16, marginTop: 16 }}>
        Session settings
      </Text>
      <View style={{ paddingHorizontal: 16, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Rest timer default (sec)</Text>
          <TextInput
            keyboardType="number-pad"
            value={String(draft.restDefaultSeconds)}
            onChangeText={(t) => setRestDefault(parseInt(t || '0', 10) || 0)}
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 6,
              padding: 6, color: palette.ink, minWidth: 60, textAlign: 'right',
            }}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Warm-up reminder</Text>
          <Switch value={draft.warmupReminder} onValueChange={setWarmupReminder} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: palette.ink, fontSize: 15 }}>Auto-progress weights</Text>
          <Switch value={draft.autoProgress} onValueChange={setAutoProgress} />
        </View>
      </View>

      <Pressable onPress={onDelete} style={{ marginTop: 24, padding: 13, alignItems: 'center' }}>
        <Text style={{ color: palette.red, fontSize: 15, fontWeight: '500' }}>Delete routine</Text>
      </Pressable>

      {/* Sheets */}
      <ExerciseSettingsSheet
        visible={exSettingsIdx !== null}
        exerciseName={exSettingsIdx !== null ? (exerciseMeta[draft.exercises[exSettingsIdx].exerciseId]?.name ?? '') : ''}
        initialRest={exSettingsIdx !== null ? draft.exercises[exSettingsIdx].restSeconds : null}
        fallbackRest={draft.restDefaultSeconds}
        onCancel={() => setExSettingsIdx(null)}
        onSave={(r) => { if (exSettingsIdx !== null) setExerciseRest(exSettingsIdx, r); setExSettingsIdx(null); }}
      />
      <SetEditSheet
        visible={setEdit !== null}
        initialReps={setEdit ? draft.exercises[setEdit.exIdx].sets[setEdit.setIdx].targetReps : null}
        initialWeight={setEdit ? draft.exercises[setEdit.exIdx].sets[setEdit.setIdx].targetWeightKg : null}
        onCancel={() => setSetEdit(null)}
        onSave={(reps, weight) => {
          if (setEdit) updateSet(setEdit.exIdx, setEdit.setIdx, { targetReps: reps, targetWeightKg: weight });
          setSetEdit(null);
        }}
      />
    </ScrollView>
  );
}
```

(Note: the `import { seedWorkoutsExercises } from '@/lib/db/seed-workouts'` is not needed — the editor pulls exercise meta directly from the `exercises` table. Remove the line if your IDE flags it as unused.)

- [ ] **Step 2: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit.**

```bash
git add app/\(tabs\)/move/\[routineId\]
git commit -m "feat(sp4c): RoutineEditor screen"
```

---

## Task 19: ExerciseLibrary screen (browse + picker)

**Files:**
- Create: `app/(tabs)/move/library.tsx`

- [ ] **Step 1: Implement.**

```tsx
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useDb } from '@/lib/db/provider';
import { exercises as exercisesTbl, type Exercise } from '@/lib/db/schema';
import { useEditorStore } from '@/lib/state/editorStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const GROUPS = ['All', 'Push', 'Pull', 'Legs', 'Core', 'Cardio'] as const;

export default function ExerciseLibrary() {
  const db = useDb();
  const router = useRouter();
  const params = useLocalSearchParams<{ pick?: string }>();
  const isPicker = params.pick === '1';
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [filter, setFilter] = useState<(typeof GROUPS)[number]>('All');
  const [all, setAll] = useState<Exercise[]>([]);
  const [detail, setDetail] = useState<Exercise | null>(null);
  const addExercise = useEditorStore((s) => s.addExercise);

  useEffect(() => {
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = await (db as any).select().from(exercisesTbl) as Exercise[];
      setAll(rows);
    })();
  }, [db]);

  const filtered = filter === 'All' ? all : all.filter((e) => e.group === filter);

  const onTap = (ex: Exercise) => {
    if (isPicker) {
      addExercise(ex.id);
      router.back();
    } else {
      setDetail(ex);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: palette.accent, fontSize: 17 }}>{isPicker ? 'Cancel' : 'Back'}</Text>
        </Pressable>
        <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '600' }}>
          {isPicker ? 'Pick exercise' : 'Library'}
        </Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
        {GROUPS.map((g) => (
          <Pressable
            key={g}
            onPress={() => setFilter(g)}
            style={{
              paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100,
              backgroundColor: g === filter ? palette.accent : palette.fill,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '600', color: g === filter ? '#fff' : palette.ink2 }}>{g}</Text>
          </Pressable>
        ))}
      </View>

      {filtered.map((ex) => (
        <Pressable
          key={ex.id}
          onPress={() => onTap(ex)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingVertical: 12, paddingHorizontal: 12,
            borderBottomWidth: 0.5, borderBottomColor: palette.hair,
          }}
        >
          <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: `${palette.move}22` }}>
            <SymbolView name={ex.sfSymbol as never} size={16} tintColor={palette.move} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{ex.name}</Text>
            <Text style={{ fontSize: 12, color: palette.ink3 }}>{ex.muscle} · {ex.equipment}</Text>
          </View>
        </Pressable>
      ))}

      {/* Detail overlay (browse mode) */}
      {detail && (
        <View style={{
          position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{ backgroundColor: palette.surface, padding: 16, borderRadius: 12, width: '85%' }}>
            <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink }}>{detail.name}</Text>
            <Text style={{ fontSize: 13, color: palette.ink3, marginTop: 4 }}>
              {detail.group} · {detail.muscle} · {detail.equipment}
            </Text>
            <Pressable onPress={() => setDetail(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.accent, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
```

- [ ] **Step 2: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit.**

```bash
git add app/\(tabs\)/move/library.tsx
git commit -m "feat(sp4c): ExerciseLibrary browse + picker"
```

---

## Task 20: Generate stub screen

**Files:**
- Create: `app/(tabs)/move/generate.tsx`

- [ ] **Step 1: Implement.**

```tsx
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function GenerateStub() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: palette.ink, marginBottom: 8 }}>Generate routine</Text>
      <Text style={{ fontSize: 15, color: palette.ink3, textAlign: 'center' }}>
        AI routine generation arrives in SP4f.
      </Text>
      <Pressable onPress={() => router.back()} style={{ marginTop: 24, padding: 12 }}>
        <Text style={{ color: palette.accent, fontWeight: '600' }}>Back</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2: Type-check.**

```bash
npm run typecheck
```

- [ ] **Step 3: Commit.**

```bash
git add app/\(tabs\)/move/generate.tsx
git commit -m "feat(sp4c): generator stub for SP4f"
```

---

## Task 21: Smoke verification + meta-spec update

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md` (status row for 4c)
- Modify: `docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md` (sub-project 4 status update)
- Modify: `docs/superpowers/plans/2026-04-25-sp4c-routine-browse-edit-plan.md` (tick all task checkboxes)

- [ ] **Step 1: Run the full test suite.**

```bash
npm test
```
Expected: all green, including new `routines.test.ts` cases and `editorStore.test.ts`.

- [ ] **Step 2: Type-check.**

```bash
npm run typecheck
```
Expected: clean.

- [ ] **Step 3: Manual smoke (web).** Start `npx expo start --web` and walk through the 10-step smoke from the spec §1:

1. Open Move tab → seeded routines render in Strength + Cardio sections.
2. Tap "+ New" → empty editor opens.
3. "Add exercise from library" → picker → tap an exercise → returns to editor with it added.
4. Tap a set chip → SetEditSheet → change weight → save → chip shows new weight.
5. Tap an exercise row → ExerciseSettingsSheet → set rest = 90 → save.
6. Toggle warm-up reminder + auto-progress.
7. Save → list updates with the new routine.
8. Long-press routine → Duplicate → see "X copy".
9. Long-press → Delete → confirm → row gone.
10. Reopen the duplicated routine → all fields persisted.

If any step fails, diagnose and fix in the corresponding earlier task before moving on.

- [ ] **Step 4: Update SP4 meta-spec status.** In `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md`, change the `4c` status to:

```
| **4c** | Code complete 2026-04-25 — three-screen flow shipped, Zustand editor store, transactional `updateRoutine`, full CRUD + duplicate + rename. Migration `0002_*` adds `rest_default_seconds` / `warmup_reminder` / `auto_progress` to `routines`. NN tests passing. iPhone Expo Go verification deferred (carries until 4b dev client lands). |
```

(Replace `NN` with the actual passing-test count from Step 1.)

- [ ] **Step 5: Update parent meta-spec.** In `docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md`, the `§8a` row for sub-project 4 — update the in-progress note to mention 4c is complete (alongside 4a). Append: "4c (routine browse + edit) ✅ code complete 2026-04-25."

- [ ] **Step 6: Tick the plan checkboxes.** Mark every `- [ ]` in this plan as `- [x]` for tasks completed.

- [ ] **Step 7: Final commit.**

```bash
git add docs/superpowers/specs/meta docs/superpowers/plans/2026-04-25-sp4c-routine-browse-edit-plan.md
git commit -m "docs(sp4c): mark slice 4c complete"
```

---

## Self-review notes

- **§1 surfaces:** PreWorkout (Task 17), RoutineEditor (Task 18), ExerciseLibrary (Task 19), generator stub (Task 20), 10-step smoke (Task 21 Step 3).
- **§2 locked decisions:** all eleven mapped — full editor scope (Tasks 6, 7, 17, 18); edit-in-place (no new schema for delete; FK already SET NULL); browse + picker (Task 19); per-set chips (Task 14 SetChip); rest with routine fallback (Task 14 ExerciseRow / Task 15 ExerciseSettingsSheet); warm-up + auto-progress booleans persisted (Task 2 schema, Task 18 Switch); cardio not editable (Task 14 CardioRow has no longPress, Task 17 routes cardio to no-op).
- **§3 schema delta:** Task 2 adds three columns; Task 3 updates seed defaults.
- **§4 architecture:** routes (Task 13), editor store (Task 9), queries (Tasks 4–8), components (Tasks 14–16).
- **§5 data flow:** hydrate → loadDraft (Task 18); save → updateRoutine (Task 8/18); cancel with Alert (Task 18); picker round-trip (Task 19); create / duplicate / delete (Tasks 5/7/16).
- **§6 error handling:** name validation (Task 18 `canSave`); set/rest validation in sheets (Task 15); Alert on save/delete failure (Tasks 16/18); `notFound` empty state (Task 18).
- **§7 testing:** queries TDD'd (Tasks 4–8); editorStore TDD'd (Tasks 9–12); UI smoke in Task 21.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling"/"similar to Task N". The one `// SP4d: ...` comment in PreWorkout is an explicit no-op for cardio; not a placeholder.

**Type consistency:** `Draft` / `DraftExercise` / `DraftSet` (Task 9) matched against `DraftInput` / `DraftExerciseInput` / `DraftSetInput` (Task 8 input). The editor's `onSave` (Task 18) bridges them by stripping `position` (DB renumbers) and dropping the wrapping fields. Names of mutators (`addExercise`, `removeExercise`, `reorderExercises`, `setExerciseRest`, `addSet`, `removeSet`, `updateSet`, `reorderSets`, `setName`, `setTag`, `setRestDefault`, `setWarmupReminder`, `setAutoProgress`) consistent across Tasks 9, 10, 11, 12, 18.
