# SP4d — Active Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the strength + cardio Active Session screen, the rest-timer state machine, the in-flight PR detection wrapper, the Zustand session store, draft persistence (per-set write-through with resume-on-launch), and a placeholder PostWorkout screen sufficient to close the navigation contract for SP4e.

**Architecture:** A new Expo Router route at `app/(tabs)/move/active.tsx` consumes a Zustand store at `lib/state/activeSessionStore.ts`. Each `Complete-set` tap mutates the store and writes through to a `sessions` row whose new `status` column distinguishes drafts from completed sessions. Tapping `Finish` runs the store's `finishSession` action, which calls `finalizeSession` — an atomic Drizzle transaction that flips `status='completed'`, writes per-set `isPr` flags, upserts the `prs` table, and inserts a `movement_entries` row. Resume-on-launch runs in `app/_layout.tsx` after migrations.

**Tech Stack:** React Native + Expo SDK 54, Expo Router 6, Drizzle ORM (`expo-sqlite` runtime; `better-sqlite3` for tests), Zustand 5, NativeWind v4, RN built-in `Modal` for sheets, `@kingstinct/react-native-healthkit` (consumed via 4b's `useLiveHeartRate`), Jest 29 via `jest-expo`.

**Spec:** [`docs/superpowers/specs/2026-04-25-sp4d-active-session-design.md`](../specs/2026-04-25-sp4d-active-session-design.md).

**Codebase delta from the spec:**
- Spec §4 says `insertCompletedSession` is "replaced by a five-function lifecycle." This plan **deletes** `insertCompletedSession` outright. Existing callers (`scripts/smoke-sp4a.ts`, `lib/db/__tests__/sessions.test.ts`) are migrated to the new lifecycle. A small test helper `insertCompletedSessionForTests` is added inside `lib/db/__tests__/test-helpers.ts` for tests that just need a populated completed session.
- 4c shipped the PreWorkout RoutineCard's `onPress` as "navigate to editor." Per the design handoff, the natural action on a routine card is **start the workout**. This plan changes `onPress` to start the session and adds an "Edit" row to `RoutineActionSheet` (long-press) so the editor remains reachable.
- The 4c cardio row's `onPress` is currently a no-op stub. It becomes "start cardio session" in the same task.
- Drizzle 0.45's partial unique index syntax (`uniqueIndex(...).on(...).where(sql\`...\`)`) is the right call for the `idx_sessions_one_draft` index. Drizzle generates `CREATE UNIQUE INDEX ... WHERE ...` SQL natively.
- Spec §6 names the Zustand store `activeSessionStore.ts`; matches 4c's `editorStore.ts` location at `lib/state/`.

---

## File map

**Modify:**
- `lib/db/schema.ts` — `sessions`: relax `finishedAt` NOT NULL; add `status` text column with default `'completed'`; add partial unique index `idx_sessions_one_draft`. Re-export `Session` type unchanged (but `finishedAt` is now `number | null`).
- `lib/db/queries/sessions.ts` — delete `insertCompletedSession`; add `getOpenDraft`, `startDraftSession` (+ `DraftAlreadyOpenError`), `upsertDraftSet`, `discardDraftSession`, `finalizeSession`; update `listSessions` to filter `status='completed'`; export new types `DraftSession`, `SessionSetDraft`.
- `lib/db/queries/routines.ts` — `lastDoneAt` subquery: add `AND status = 'completed'`.
- `lib/db/__tests__/test-helpers.ts` — add `insertCompletedSessionForTests(db, draft)` helper.
- `lib/db/__tests__/sessions.test.ts` — drop `insertCompletedSession` describe; add describes for the five new functions; rewrite `listSessions/getSession` describes to use the new lifecycle (via the helper).
- `lib/db/__tests__/routines.test.ts` — extend with a test asserting `lastDoneAt` ignores draft sessions.
- `scripts/smoke-sp4a.ts` — switch to the new lifecycle (`startDraftSession` → `upsertDraftSet` × N → `finalizeSession`).
- `app/_layout.tsx` — after migrations + onboarding check, run a one-shot resume hook that pushes `/(tabs)/move/active` if `getOpenDraft` returns a row.
- `app/(tabs)/move/index.tsx` — change RoutineCard tap from `router.push(... edit)` to start a session and route to `/(tabs)/move/active`. Same change for CardioRow. Add an "Edit" row to RoutineActionSheet wiring.
- `components/workouts/RoutineActionSheet.tsx` — add an `onEdit` row.
- `package.json` — no changes (Zustand already installed in 4c; no new deps).

**Create:**
- `lib/db/migrations/0003_<generated>.sql` — Drizzle-generated migration.
- `lib/db/migrations/meta/0003_snapshot.json` — Drizzle metadata.
- `lib/db/migrations/meta/_journal.json` — auto-updated by Drizzle.
- `lib/workouts/rest-timer.ts` — pure reducer.
- `lib/workouts/__tests__/rest-timer.test.ts` — reducer tests.
- `lib/workouts/in-flight-pr.ts` — wrapper over `detectSessionPRs`.
- `lib/workouts/__tests__/in-flight-pr.test.ts` — wrapper tests.
- `lib/workouts/cardio-aggregate.ts` — pace + duration helpers.
- `lib/workouts/__tests__/cardio-aggregate.test.ts` — helper tests.
- `lib/state/activeSessionStore.ts` — Zustand store.
- `app/(tabs)/move/active.tsx` — Active Session route.
- `app/(tabs)/move/post.tsx` — PostWorkout stub route.
- `components/active-session/SessionHeader.tsx`
- `components/active-session/RestBanner.tsx`
- `components/active-session/ExerciseCard.tsx`
- `components/active-session/SetCard.tsx`
- `components/active-session/SetEditSheet.tsx`
- `components/active-session/CardioBody.tsx`
- `components/active-session/UpNextRow.tsx`
- `components/active-session/LiveHRChip.tsx`
- `components/active-session/DiscardConfirmModal.tsx`

**Delete:** none. (`insertCompletedSession` is removed in-place from `lib/db/queries/sessions.ts`.)

---

## Task 1: Schema delta — `sessions.status`, nullable `finishedAt`, partial unique index

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0003_<generated>.sql` (via drizzle-kit)
- Create: `lib/db/migrations/meta/0003_snapshot.json` (via drizzle-kit)

- [ ] **Step 1:** Open `lib/db/schema.ts`. Find the `sessions` table at line 127. Replace it entirely with this version:

```ts
export const sessions = sqliteTable(
  'sessions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    routineId: integer('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    routineNameSnapshot: text('routine_name_snapshot').notNull(),
    status: text('status', { enum: ['draft', 'completed'] }).notNull().default('completed'),
    startedAt: integer('started_at').notNull(),
    finishedAt: integer('finished_at'),
    durationSeconds: integer('duration_seconds').notNull().default(0),
    totalVolumeKg: real('total_volume_kg').notNull().default(0),
    prCount: integer('pr_count').notNull().default(0),
  },
  (t) => ({
    startedAtIdx: index('idx_sessions_started_at').on(t.startedAt),
    oneDraftIdx: uniqueIndex('idx_sessions_one_draft').on(t.status).where(sql`status = 'draft'`),
  }),
);
```

Note three changes from the existing definition:
- `status` column added (text enum, default `'completed'`).
- `finishedAt` is now nullable (no `.notNull()`).
- `durationSeconds` now defaults to `0` (was no default; the existing rows always populated it).
- New partial unique index `oneDraftIdx`.

- [ ] **Step 2:** Add `uniqueIndex` to the `drizzle-orm/sqlite-core` import at the top of the file:

```ts
import { integer, real, sqliteTable, text, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
```

- [ ] **Step 3:** Generate the migration.

```bash
npm run db:generate
```

Expected: a new file `lib/db/migrations/0003_<adjective>_<noun>.sql` is created. Inspect it. It should contain (modulo Drizzle's exact formatting):

```sql
ALTER TABLE `sessions` ADD `status` text DEFAULT 'completed' NOT NULL;
-- finished_at relaxation: drizzle-kit may emit a table rebuild for SQLite since
-- SQLite doesn't allow ALTER COLUMN to drop NOT NULL. That's expected and safe.
CREATE UNIQUE INDEX `idx_sessions_one_draft` ON `sessions` (`status`) WHERE status = 'draft';
```

If drizzle-kit prompts about a destructive change for the `finished_at` relaxation, accept it — there are no draft rows yet, so the rebuild is a no-op for data.

- [ ] **Step 4:** Run the migration test.

```bash
npm test -- migrations-workouts.test
```

Expected: PASS (the existing migration tests verify all migrations apply to a fresh DB without error).

- [ ] **Step 5:** Run the full test suite to confirm nothing else broke from the type change.

```bash
npm test
```

Expected: most tests still PASS. The `sessions.test.ts` and any code paths consuming `Session.finishedAt` may now have type errors because `finishedAt` is `number | null`. **Do not fix those yet** — they'll be addressed in subsequent tasks. If everything passes, that's also fine; just note any new failures.

- [ ] **Step 6:** Commit.

```bash
git add lib/db/schema.ts lib/db/migrations/0003_*.sql lib/db/migrations/meta/
git commit -m "feat(sp4d): sessions.status + nullable finished_at + one-draft index"
```

---

## Task 2: New types and `getOpenDraft` query (TDD)

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

This task adds the `DraftSession` and `SessionSetDraft` types plus the `getOpenDraft` query. It does **not** yet remove `insertCompletedSession` (Task 7 does that, after the lifecycle pieces exist).

- [ ] **Step 1:** Add two new types at the top of `lib/db/queries/sessions.ts`, just after the existing `CompletedSessionDraftSet` interface:

```ts
export interface SessionSetDraft {
  exerciseId: string;
  exercisePosition: number;
  setPosition: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface DraftSession {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  sets: SessionSetDraft[];
}
```

- [ ] **Step 2:** Write the failing tests. Open `lib/db/__tests__/sessions.test.ts` and add a new `describe` block at the bottom (after the existing `listSessions / getSession` describe):

```ts
import { getOpenDraft } from '../queries/sessions';

describe('getOpenDraft', () => {
  it('returns null when no draft exists', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const draft = await getOpenDraft(db);
    expect(draft).toBeNull();
  });

  it('returns the draft session with its sets when one exists', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    // Manually insert a draft + two sets via raw SQL to avoid coupling to startDraftSession (not yet built).
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at, finished_at)
                 VALUES (?, ?, 'draft', ?, NULL)`).run(1, 'Push Day A', 1_000_000);
    const sessionId = (raw.prepare(`SELECT id FROM sessions WHERE status='draft'`).get() as { id: number }).id;
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 0, 5, 80, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 1, 5, 85, NULL, NULL, 0)`).run(sessionId);

    const draft = await getOpenDraft(db);
    expect(draft).not.toBeNull();
    expect(draft!.id).toBe(sessionId);
    expect(draft!.routineId).toBe(1);
    expect(draft!.routineNameSnapshot).toBe('Push Day A');
    expect(draft!.startedAt).toBe(1_000_000);
    expect(draft!.sets).toHaveLength(2);
    expect(draft!.sets[0]).toMatchObject({ exerciseId: 'bench', setPosition: 0, reps: 5, weightKg: 80 });
    expect(draft!.sets[1]).toMatchObject({ exerciseId: 'bench', setPosition: 1, reps: 5, weightKg: 85 });
  });

  it('orders sets by (exercisePosition, setPosition)', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at)
                 VALUES (?, ?, 'draft', ?)`).run(1, 'Push Day A', 1_000_000);
    const sessionId = (raw.prepare(`SELECT id FROM sessions WHERE status='draft'`).get() as { id: number }).id;
    // Insert in non-sorted order
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'ohp', 1, 0, 6, 50, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 1, 5, 85, NULL, NULL, 0)`).run(sessionId);
    raw.prepare(`INSERT INTO session_sets
                 (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'bench', 0, 0, 5, 80, NULL, NULL, 0)`).run(sessionId);

    const draft = await getOpenDraft(db);
    expect(draft!.sets.map((s) => `${s.exercisePosition}:${s.setPosition}`)).toEqual(['0:0', '0:1', '1:0']);
  });
});
```

- [ ] **Step 3:** Run the new tests to verify they fail.

```bash
npm test -- sessions.test
```

Expected: FAIL with "getOpenDraft is not a function" (or similar import error).

- [ ] **Step 4:** Implement `getOpenDraft`. Add at the bottom of `lib/db/queries/sessions.ts`:

```ts
export async function getOpenDraft(db: AnyDb): Promise<DraftSession | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heads = await (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'draft'));
  if (heads.length === 0) return null;
  const head = heads[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sets = await (db as any)
    .select()
    .from(sessionSets)
    .where(eq(sessionSets.sessionId, head.id))
    .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition));

  return {
    id: head.id,
    routineId: head.routineId,
    routineNameSnapshot: head.routineNameSnapshot,
    startedAt: head.startedAt,
    sets: sets.map((r: typeof sessionSets.$inferSelect) => ({
      exerciseId: r.exerciseId,
      exercisePosition: r.exercisePosition,
      setPosition: r.setPosition,
      reps: r.reps,
      weightKg: r.weightKg,
      durationSeconds: r.durationSeconds,
      distanceKm: r.distanceKm,
    })),
  };
}
```

- [ ] **Step 5:** Run the tests to verify they pass.

```bash
npm test -- sessions.test
```

Expected: the three new `getOpenDraft` tests PASS. Existing `insertCompletedSession` tests should also still pass (we haven't touched it).

- [ ] **Step 6:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): getOpenDraft query + draft types"
```

---

## Task 3: `startDraftSession` query (TDD)

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1:** Write the failing tests. Append to `lib/db/__tests__/sessions.test.ts`:

```ts
import { startDraftSession, DraftAlreadyOpenError } from '../queries/sessions';

describe('startDraftSession', () => {
  it('inserts a draft row with finishedAt=null and returns sessionId', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1,
      routineNameSnapshot: 'Push Day A',
      startedAt: 1_500_000,
    });
    expect(sessionId).toBeGreaterThan(0);
    const row = raw.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as {
      status: string; routine_id: number; routine_name_snapshot: string;
      started_at: number; finished_at: number | null; duration_seconds: number;
    };
    expect(row.status).toBe('draft');
    expect(row.routine_id).toBe(1);
    expect(row.routine_name_snapshot).toBe('Push Day A');
    expect(row.started_at).toBe(1_500_000);
    expect(row.finished_at).toBeNull();
    expect(row.duration_seconds).toBe(0);
  });

  it('throws DraftAlreadyOpenError when a draft already exists', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000 });
    await expect(
      startDraftSession(db, { routineId: 2, routineNameSnapshot: 'Pull Day A', startedAt: 1_600_000 })
    ).rejects.toThrow(DraftAlreadyOpenError);
  });

  it('allows starting a new draft after the previous one is finalized or discarded', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const first = await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000 });
    // Simulate finalize by flipping status manually (real finalize comes in Task 6).
    raw.prepare(`UPDATE sessions SET status='completed', finished_at = ? WHERE id = ?`).run(1_600_000, first.sessionId);
    const second = await startDraftSession(db, { routineId: 2, routineNameSnapshot: 'Pull Day A', startedAt: 1_700_000 });
    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('accepts a null routineId for ad-hoc / freestyle sessions', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: null,
      routineNameSnapshot: 'Freestyle',
      startedAt: 1_500_000,
    });
    const row = raw.prepare(`SELECT routine_id FROM sessions WHERE id = ?`).get(sessionId) as { routine_id: number | null };
    expect(row.routine_id).toBeNull();
  });
});
```

- [ ] **Step 2:** Run the tests to verify they fail.

```bash
npm test -- sessions.test -t "startDraftSession"
```

Expected: FAIL with import errors.

- [ ] **Step 3:** Implement `startDraftSession`. Append to `lib/db/queries/sessions.ts`:

```ts
export class DraftAlreadyOpenError extends Error {
  constructor() {
    super('A draft session is already open. Resume or discard it before starting a new one.');
    this.name = 'DraftAlreadyOpenError';
  }
}

export interface StartDraftSessionArgs {
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
}

export async function startDraftSession(
  db: AnyDb,
  args: StartDraftSessionArgs,
): Promise<{ sessionId: number }> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inserted = await (db as any)
      .insert(sessions)
      .values({
        routineId: args.routineId,
        routineNameSnapshot: args.routineNameSnapshot,
        status: 'draft',
        startedAt: args.startedAt,
        finishedAt: null,
        durationSeconds: 0,
        totalVolumeKg: 0,
        prCount: 0,
      })
      .returning({ id: sessions.id });
    return { sessionId: inserted[0].id };
  } catch (e) {
    const msg = String(e);
    if (msg.includes('UNIQUE') && msg.includes('idx_sessions_one_draft')) {
      throw new DraftAlreadyOpenError();
    }
    throw e;
  }
}
```

- [ ] **Step 4:** Run the tests to verify they pass.

```bash
npm test -- sessions.test -t "startDraftSession"
```

Expected: all four tests PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): startDraftSession + DraftAlreadyOpenError"
```

---

## Task 4: `upsertDraftSet` query (TDD)

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1:** Write the failing tests. Append to `lib/db/__tests__/sessions.test.ts`:

```ts
import { upsertDraftSet } from '../queries/sessions';

describe('upsertDraftSet', () => {
  async function freshDraft() {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    return { db, raw, sessionId };
  }

  it('inserts a new row when no row at (sessionId, exercisePosition, setPosition) exists', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    const rows = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      exercise_id: string; exercise_position: number; set_position: number;
      reps: number; weight_kg: number; is_pr: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ exercise_id: 'bench', exercise_position: 0, set_position: 0, reps: 5, weight_kg: 80, is_pr: 0 });
  });

  it('replaces an existing row at the same (sessionId, exercisePosition, setPosition)', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 6, weightKg: 82.5, durationSeconds: null, distanceKm: null,
    });
    const rows = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      reps: number; weight_kg: number;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ reps: 6, weight_kg: 82.5 });
  });

  it('keeps isPr=0 even if the caller provides truthy data — finalize sets the flag', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 100, weightKg: 999, durationSeconds: null, distanceKm: null,
    });
    const row = raw.prepare(`SELECT is_pr FROM session_sets WHERE session_id = ?`).get(sessionId) as { is_pr: number };
    expect(row.is_pr).toBe(0);
  });

  it('supports cardio sets (durationSeconds + distanceKm, reps/weightKg null)', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0,
      reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5.0,
    });
    const row = raw.prepare(`SELECT * FROM session_sets WHERE session_id = ?`).get(sessionId) as {
      reps: number | null; weight_kg: number | null; duration_seconds: number; distance_km: number;
    };
    expect(row.reps).toBeNull();
    expect(row.weight_kg).toBeNull();
    expect(row.duration_seconds).toBe(1800);
    expect(row.distance_km).toBe(5.0);
  });

  it('allows multiple sets at different (exercisePosition, setPosition) keys', async () => {
    const { db, raw, sessionId } = await freshDraft();
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'ohp',   exercisePosition: 1, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null,
    });
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM session_sets WHERE session_id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(3);
  });
});
```

- [ ] **Step 2:** Run the tests to verify they fail.

```bash
npm test -- sessions.test -t "upsertDraftSet"
```

Expected: FAIL with import errors.

- [ ] **Step 3:** Add the implementation to `lib/db/queries/sessions.ts`:

```ts
import { and, eq } from 'drizzle-orm';   // add `and` to the existing import line if not present

export async function upsertDraftSet(
  db: AnyDb,
  sessionId: number,
  draft: SessionSetDraft,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existing = await (db as any)
    .select({ id: sessionSets.id })
    .from(sessionSets)
    .where(
      and(
        eq(sessionSets.sessionId, sessionId),
        eq(sessionSets.exercisePosition, draft.exercisePosition),
        eq(sessionSets.setPosition, draft.setPosition),
      ),
    );
  if (existing.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .update(sessionSets)
      .set({
        exerciseId: draft.exerciseId,
        reps: draft.reps,
        weightKg: draft.weightKg,
        durationSeconds: draft.durationSeconds,
        distanceKm: draft.distanceKm,
        isPr: 0,
      })
      .where(eq(sessionSets.id, existing[0].id));
    return;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .insert(sessionSets)
    .values({
      sessionId,
      exerciseId: draft.exerciseId,
      exercisePosition: draft.exercisePosition,
      setPosition: draft.setPosition,
      reps: draft.reps,
      weightKg: draft.weightKg,
      durationSeconds: draft.durationSeconds,
      distanceKm: draft.distanceKm,
      isPr: 0,
    });
}
```

- [ ] **Step 4:** Run the tests to verify they pass.

```bash
npm test -- sessions.test -t "upsertDraftSet"
```

Expected: all five tests PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): upsertDraftSet query"
```

---

## Task 5: `discardDraftSession` + `deleteDraftSet` queries (TDD)

We need both: `discardDraftSession` for the back-button discard, and `deleteDraftSet` for the SetEditSheet's "Remove set" action (locked decision #15 in the spec).

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1:** Write the failing tests. Append to `lib/db/__tests__/sessions.test.ts`:

```ts
import { discardDraftSession, deleteDraftSet } from '../queries/sessions';

describe('discardDraftSession', () => {
  it('deletes the draft session row', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await discardDraftSession(db, sessionId);
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM sessions WHERE id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(0);
  });

  it('cascades to delete session_sets', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1,
      reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await discardDraftSession(db, sessionId);
    const count = raw.prepare(`SELECT COUNT(*) AS c FROM session_sets WHERE session_id = ?`).get(sessionId) as { c: number };
    expect(count.c).toBe(0);
  });

  it('is a no-op when the session does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await expect(discardDraftSession(db, 99999)).resolves.toBeUndefined();
  });
});

describe('deleteDraftSet', () => {
  it('deletes a single set by (sessionId, exercisePosition, setPosition) without touching others', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null,
    });
    await deleteDraftSet(db, sessionId, 0, 0);
    const remaining = raw.prepare(`SELECT set_position FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{ set_position: number }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].set_position).toBe(1);
  });

  it('is a no-op when the row does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_500_000,
    });
    await expect(deleteDraftSet(db, sessionId, 9, 9)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2:** Run the tests to verify they fail.

```bash
npm test -- sessions.test -t "discardDraftSession"
```

Expected: FAIL with import errors.

- [ ] **Step 3:** Add the implementations. Append to `lib/db/queries/sessions.ts`:

```ts
export async function discardDraftSession(db: AnyDb, sessionId: number): Promise<void> {
  // session_sets has ON DELETE CASCADE on sessions.id; deleting the session row removes both.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any).delete(sessions).where(eq(sessions.id, sessionId));
}

export async function deleteDraftSet(
  db: AnyDb,
  sessionId: number,
  exercisePosition: number,
  setPosition: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (db as any)
    .delete(sessionSets)
    .where(
      and(
        eq(sessionSets.sessionId, sessionId),
        eq(sessionSets.exercisePosition, exercisePosition),
        eq(sessionSets.setPosition, setPosition),
      ),
    );
}
```

- [ ] **Step 4:** Run the tests.

```bash
npm test -- sessions.test -t "discardDraftSession"
npm test -- sessions.test -t "deleteDraftSet"
```

Expected: all PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): discardDraftSession + deleteDraftSet"
```

---

## Task 6: `finalizeSession` query (TDD) — replaces `insertCompletedSession`

This is the largest query task. `finalizeSession` is the atomic transaction that promotes a draft to completed: recompute volume, detect PRs, flip status, write PR rows, write the movement entry. It also unblocks deleting `insertCompletedSession`.

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1:** Write the failing tests. Append to `lib/db/__tests__/sessions.test.ts`:

```ts
import { finalizeSession, type CompletedSessionResult } from '../queries/sessions';

async function loadDraftWith(db: TestDb, sessionId: number, sets: SessionSetDraft[]) {
  for (const s of sets) {
    await upsertDraftSet(db, sessionId, s);
  }
}

const benchSets: SessionSetDraft[] = [
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null },
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 2, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
  { exerciseId: 'ohp',   exercisePosition: 1, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null },
];

describe('finalizeSession', () => {
  it('flips status to completed and sets finishedAt + durationSeconds', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    const finishedAt = 1_000_000 + 60 * 52 * 1000;
    const result = await finalizeSession(db, sessionId, finishedAt);

    expect(result.sessionId).toBe(sessionId);
    expect(result.totalVolumeKg).toBe(1575);
    expect(result.prCount).toBe(2);

    const row = raw.prepare(`SELECT * FROM sessions WHERE id = ?`).get(sessionId) as {
      status: string; finished_at: number | null; duration_seconds: number;
      total_volume_kg: number; pr_count: number;
    };
    expect(row.status).toBe('completed');
    expect(row.finished_at).toBe(finishedAt);
    expect(row.duration_seconds).toBe(60 * 52);
    expect(row.total_volume_kg).toBe(1575);
    expect(row.pr_count).toBe(2);
  });

  it('marks isPr=1 on session_sets that beat the snapshot', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);

    const rows = raw.prepare(`SELECT exercise_id, set_position, is_pr FROM session_sets WHERE session_id = ?`).all(sessionId) as Array<{
      exercise_id: string; set_position: number; is_pr: number;
    }>;
    // All four sets beat the empty PR snapshot, so all four are flagged.
    expect(rows.every((r) => r.is_pr === 1)).toBe(true);
    expect(rows).toHaveLength(4);
  });

  it('upserts the prs table to best-of-session per exercise', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);

    const prRows = raw.prepare(`SELECT exercise_id, weight_kg, reps FROM prs`).all() as Array<{
      exercise_id: string; weight_kg: number; reps: number;
    }>;
    expect(prRows).toHaveLength(2);
    const bench = prRows.find((r) => r.exercise_id === 'bench')!;
    const ohp = prRows.find((r) => r.exercise_id === 'ohp')!;
    expect(bench).toMatchObject({ weight_kg: 90, reps: 5 });
    expect(ohp).toMatchObject({ weight_kg: 50, reps: 6 });
  });

  it('inserts a movement_entries row keyed to finishedAt', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    const finishedAt = 1_000_000 + 60 * 52 * 1000;
    await finalizeSession(db, sessionId, finishedAt);

    const m = raw.prepare(`SELECT * FROM movement_entries`).all() as Array<{
      minutes: number; kind: string; note: string; occurred_at: number;
    }>;
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ minutes: 52, kind: 'workout', note: 'Push Day A', occurred_at: finishedAt });
  });

  it('handles cardio sessions (no PRs, volume = 0)', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: null, routineNameSnapshot: 'Treadmill', startedAt: 1_000_000,
    });
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0,
      reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5.0,
    });
    const result = await finalizeSession(db, sessionId, 1_000_000 + 1_800_000);
    expect(result.totalVolumeKg).toBe(0);
    expect(result.prCount).toBe(0);
    const m = raw.prepare(`SELECT minutes, kind FROM movement_entries`).all() as Array<{ minutes: number; kind: string }>;
    expect(m).toHaveLength(1);
    expect(m[0].minutes).toBe(30);
    expect(m[0].kind).toBe('workout');
  });

  it('rolls back the entire transaction if a PR upsert fails', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    // Bad: exercise_id that doesn't exist in the seeded catalog → FK violation on prs upsert.
    await upsertDraftSet(db, sessionId, {
      exerciseId: 'NOT-AN-EXERCISE', exercisePosition: 0, setPosition: 0,
      reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null,
    });
    // The set was upserted with FK off? No — session_sets references exercises with ON DELETE no action by default,
    // but FK is enforced at insert time by `pragma foreign_keys = ON`. So this insert should already have failed.
    // Actually session_sets.exerciseId is `text('exercise_id').notNull().references(() => exercises.id)` — FK enforced.
    // For this test we instead need to set up a scenario where finalizeSession itself fails. We do it by
    // pre-existing a row in prs with a missing FK to make the upsert update path fail.
    // Simpler: insert a session_set with a valid exerciseId, then before finalize, drop the matching prs constraint?
    // SQLite doesn't allow dropping constraints. The easiest robust test is to check that throwing inside the txn
    // does not partially commit. We do this by stubbing `Date.now` to throw at the right moment is too clever.
    // Rely on the existing well-tested rollback in `insertCompletedSession` semantics; for finalizeSession the
    // equivalent guarantee comes from wrapping the body in `db.transaction(...)`. We assert that an FK violation
    // anywhere in the transaction leaves the session in 'draft' status.

    // Manually corrupt: insert a session_set with an invalid exercise_id by bypassing Drizzle.
    raw.pragma('foreign_keys = OFF');
    raw.prepare(`INSERT INTO session_sets (session_id, exercise_id, exercise_position, set_position, reps, weight_kg, duration_seconds, distance_km, is_pr)
                 VALUES (?, 'NOT-AN-EXERCISE', 0, 1, 5, 80, NULL, NULL, 0)`).run(sessionId);
    raw.pragma('foreign_keys = ON');

    await expect(finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000)).rejects.toThrow();

    const status = (raw.prepare(`SELECT status FROM sessions WHERE id = ?`).get(sessionId) as { status: string }).status;
    expect(status).toBe('draft');
    const movementCount = (raw.prepare(`SELECT COUNT(*) AS c FROM movement_entries`).get() as { c: number }).c;
    expect(movementCount).toBe(0);
  });

  it('throws when the session does not exist', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await expect(finalizeSession(db, 99999, 1_000_000)).rejects.toThrow(/not found/i);
  });

  it('throws when the session is already completed', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await startDraftSession(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
    });
    await loadDraftWith(db, sessionId, benchSets);
    await finalizeSession(db, sessionId, 1_000_000 + 60 * 52 * 1000);
    await expect(finalizeSession(db, sessionId, 2_000_000)).rejects.toThrow(/not a draft/i);
  });
});
```

- [ ] **Step 2:** Run the tests to verify they fail.

```bash
npm test -- sessions.test -t "finalizeSession"
```

Expected: FAIL with import errors.

- [ ] **Step 3:** Implement `finalizeSession`. Append to `lib/db/queries/sessions.ts`:

```ts
export function finalizeSession(
  db: AnyDb,
  sessionId: number,
  finishedAt: number,
): Promise<CompletedSessionResult> {
  return new Promise((resolve, reject) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (db as any).transaction((tx: any) => {
        const head: { startedAt: number; status: string; routineNameSnapshot: string } | undefined =
          tx.select({
            startedAt: sessions.startedAt,
            status: sessions.status,
            routineNameSnapshot: sessions.routineNameSnapshot,
          }).from(sessions).where(eq(sessions.id, sessionId)).all()[0];
        if (!head) throw new Error(`Session ${sessionId} not found`);
        if (head.status !== 'draft') throw new Error(`Session ${sessionId} is not a draft`);

        const setsRows: Array<typeof sessionSets.$inferSelect> =
          tx.select().from(sessionSets).where(eq(sessionSets.sessionId, sessionId))
            .orderBy(asc(sessionSets.exercisePosition), asc(sessionSets.setPosition)).all();

        const exerciseIds = Array.from(new Set(setsRows.map((s) => s.exerciseId)));
        const snapshotRows = exerciseIds.length === 0
          ? []
          : tx.select({ exerciseId: prs.exerciseId, weightKg: prs.weightKg, reps: prs.reps })
              .from(prs).all()
              .filter((r: { exerciseId: string }) => exerciseIds.includes(r.exerciseId));
        const snapshot = new Map<string, { weightKg: number; reps: number }>();
        for (const r of snapshotRows as { exerciseId: string; weightKg: number; reps: number }[]) {
          snapshot.set(r.exerciseId, { weightKg: r.weightKg, reps: r.reps });
        }

        const detection = detectSessionPRs(
          snapshot,
          setsRows.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })),
        );

        const totalVolumeKg = computeStrengthVolume(
          setsRows.map((s) => ({ reps: s.reps, weightKg: s.weightKg })),
        );

        const durationSeconds = Math.round((finishedAt - head.startedAt) / 1000);

        // Update session row
        tx.update(sessions)
          .set({
            status: 'completed',
            finishedAt,
            durationSeconds,
            totalVolumeKg,
            prCount: detection.newPRs.size,
          })
          .where(eq(sessions.id, sessionId))
          .run();

        // Update per-set isPr flags
        for (let i = 0; i < setsRows.length; i++) {
          if (detection.isPrPerSet[i]) {
            tx.update(sessionSets)
              .set({ isPr: 1 })
              .where(eq(sessionSets.id, setsRows[i].id))
              .run();
          }
        }

        // Upsert prs table
        for (const [exerciseId, pr] of detection.newPRs) {
          tx.insert(prs).values({
            exerciseId,
            weightKg: pr.weightKg,
            reps: pr.reps,
            sessionId,
            achievedAt: finishedAt,
          }).onConflictDoUpdate({
            target: prs.exerciseId,
            set: { weightKg: pr.weightKg, reps: pr.reps, sessionId, achievedAt: finishedAt },
          }).run();
        }

        // Movement entry
        tx.insert(movementEntries).values({
          minutes: Math.round(durationSeconds / 60),
          kind: 'workout',
          note: head.routineNameSnapshot,
          occurredAt: finishedAt,
        }).run();

        return { sessionId, prCount: detection.newPRs.size, totalVolumeKg };
      });
      resolve(result);
    } catch (e) {
      reject(e);
    }
  });
}
```

- [ ] **Step 4:** Run the tests.

```bash
npm test -- sessions.test -t "finalizeSession"
```

Expected: all tests PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): finalizeSession atomic transaction"
```

---

## Task 7: Delete `insertCompletedSession`; rewrite its tests via the lifecycle

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`
- Modify: `lib/db/__tests__/test-helpers.ts`

- [ ] **Step 1:** Add a test helper. Append to `lib/db/__tests__/test-helpers.ts`:

```ts
import { startDraftSession, upsertDraftSet, finalizeSession, type CompletedSessionDraft } from '../queries/sessions';

/**
 * Builds a completed session via the new lifecycle (start → upsert × N → finalize).
 * Used by tests that just need a populated completed session as a fixture.
 */
export async function insertCompletedSessionForTests(
  db: TestDb,
  draft: CompletedSessionDraft,
): Promise<{ sessionId: number; prCount: number; totalVolumeKg: number }> {
  const { sessionId } = await startDraftSession(db, {
    routineId: draft.routineId,
    routineNameSnapshot: draft.routineNameSnapshot,
    startedAt: draft.startedAt,
  });
  for (const s of draft.sets) {
    await upsertDraftSet(db, sessionId, {
      exerciseId: s.exerciseId,
      exercisePosition: s.exercisePosition,
      setPosition: s.setPosition,
      reps: s.reps,
      weightKg: s.weightKg,
      durationSeconds: s.durationSeconds,
      distanceKm: s.distanceKm,
    });
  }
  return finalizeSession(db, sessionId, draft.finishedAt);
}
```

- [ ] **Step 2:** Open `lib/db/queries/sessions.ts`. Delete the entire `insertCompletedSession` function (the `export function insertCompletedSession(...) { ... }` block). Keep all the types it referenced — they're still exported for the test helper and for SP4e/4f.

- [ ] **Step 3:** Rewrite the `describe('insertCompletedSession', ...)` block in `lib/db/__tests__/sessions.test.ts` to use the helper. Find the block (lines 28–131 originally) and replace it with:

```ts
describe('completed-session lifecycle (start → upsert → finalize)', () => {
  it('writes a session row with computed totals (parity with old insertCompletedSession)', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const result = await insertCompletedSessionForTests(db, baseDraft());

    expect(result.sessionId).toBeGreaterThan(0);
    expect(result.totalVolumeKg).toBe(1575);
    expect(result.prCount).toBe(2);
  });

  it('writes session_sets rows in order with is_pr correctly flagged', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const { sessionId } = await insertCompletedSessionForTests(db, baseDraft());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(sessionSets).where(eq(sessionSets.sessionId, sessionId));
    expect(rows).toHaveLength(4);
    const bench3rd = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 2);
    const ohp1st  = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'ohp'   && r.setPosition === 0);
    expect(bench3rd.isPr).toBe(1);
    expect(ohp1st.isPr).toBe(1);
    const bench1st = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 0);
    const bench2nd = rows.find((r: { exerciseId: string; setPosition: number }) => r.exerciseId === 'bench' && r.setPosition === 1);
    expect(bench1st.isPr).toBe(1);
    expect(bench2nd.isPr).toBe(1);
  });

  it('upserts the prs table to best-of-session per exercise', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(prs);
    expect(rows).toHaveLength(2);
    const bench = rows.find((r: { exerciseId: string }) => r.exerciseId === 'bench')!;
    const ohp   = rows.find((r: { exerciseId: string }) => r.exerciseId === 'ohp')!;
    expect(bench).toMatchObject({ exerciseId: 'bench', weightKg: 90, reps: 5 });
    expect(ohp).toMatchObject({ exerciseId: 'ohp',   weightKg: 50, reps: 6 });
  });

  it('inserts a movement_entries row for the workout', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    const draft = baseDraft();
    await insertCompletedSessionForTests(db, draft);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = await (db as any).select().from(movementEntries);
    expect(m).toHaveLength(1);
    expect(m[0].minutes).toBe(52);
    expect(m[0].kind).toBe('workout');
    expect(m[0].note).toBe('Push Day A');
    expect(m[0].occurredAt).toBe(draft.finishedAt);
  });

  it('does not duplicate prs rows for the same exercise across two sessions; updates instead', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft());
    await insertCompletedSessionForTests(db, baseDraft({
      startedAt: 2_000_000,
      finishedAt: 2_000_000 + 60 * 30 * 1000,
      sets: [
        { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 95, durationSeconds: null, distanceKm: null },
      ],
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any).select().from(prs);
    const benchRows = rows.filter((r: { exerciseId: string }) => r.exerciseId === 'bench');
    expect(benchRows).toHaveLength(1);
    expect(benchRows[0]).toMatchObject({ weightKg: 95, reps: 5 });
  });
});
```

Update the `listSessions / getSession` describe similarly — replace `insertCompletedSession` calls with `insertCompletedSessionForTests`. (Same arguments; the helper's signature matches the original.)

- [ ] **Step 4:** Update the import in `sessions.test.ts`: remove `insertCompletedSession` from the imports, and add `insertCompletedSessionForTests` to the imports from `./test-helpers`. The original `CompletedSessionDraft` import from `../queries/sessions` stays.

- [ ] **Step 5:** Run the full test file.

```bash
npm test -- sessions.test
```

Expected: all tests PASS.

- [ ] **Step 6:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts lib/db/__tests__/test-helpers.ts
git commit -m "refactor(sp4d): drop insertCompletedSession; tests use lifecycle helper"
```

---

## Task 8: Filter `listSessions` to status='completed' (TDD)

`listSessions` should hide drafts; `getSession` stays unfiltered (the resume hook needs to load drafts by id if it ever wants to).

**Files:**
- Modify: `lib/db/queries/sessions.ts`
- Modify: `lib/db/__tests__/sessions.test.ts`

- [ ] **Step 1:** Write the failing test. Append to the `listSessions / getSession` describe block in `sessions.test.ts`:

```ts
  it('listSessions excludes draft sessions', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, baseDraft({ startedAt: 1_000_000, finishedAt: 1_500_000 }));
    // Create a draft that is NOT completed.
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 2_000_000 });

    const list = await listSessions(db);
    expect(list).toHaveLength(1);
    expect(list[0].startedAt).toBe(1_000_000);
  });
```

- [ ] **Step 2:** Run to verify it fails.

```bash
npm test -- sessions.test -t "excludes draft"
```

Expected: FAIL — `list.length` is 2.

- [ ] **Step 3:** Update `listSessions` in `lib/db/queries/sessions.ts`. Find the function (was at line 137) and add a `where` clause:

```ts
export async function listSessions(
  db: AnyDb,
  args: { limit?: number; offset?: number } = {},
): Promise<SessionSummary[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q = (db as any)
    .select()
    .from(sessions)
    .where(eq(sessions.status, 'completed'))
    .orderBy(desc(sessions.startedAt));
  if (args.limit !== undefined)  q = q.limit(args.limit);
  if (args.offset !== undefined) q = q.offset(args.offset);
  const rows = await q;
  return rows.map((r: SessionSummary) => ({
    id: r.id,
    routineId: r.routineId,
    routineNameSnapshot: r.routineNameSnapshot,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt,
    durationSeconds: r.durationSeconds,
    totalVolumeKg: r.totalVolumeKg,
    prCount: r.prCount,
  }));
}
```

Note: the `SessionSummary.finishedAt` field type is now technically `number | null`. Since `listSessions` only returns completed rows, the value is always a number. Update the `SessionSummary` interface at the top of the file if it doesn't already allow null:

```ts
export interface SessionSummary {
  id: number;
  routineId: number | null;
  routineNameSnapshot: string;
  startedAt: number;
  finishedAt: number;          // always set on completed sessions
  durationSeconds: number;
  totalVolumeKg: number;
  prCount: number;
}
```

(Leave `finishedAt: number` here — `listSessions` filters to completed, so it's correct. `SessionFull` may need `finishedAt: number | null` if `getSession` is allowed to return drafts; check at the top of the file. If `SessionFull extends SessionSummary`, change the base or shadow the field. Simplest: leave both as `number` and document that `getSession` for a draft is not a supported use.)

- [ ] **Step 4:** Run the test.

```bash
npm test -- sessions.test
```

Expected: PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/db/queries/sessions.ts lib/db/__tests__/sessions.test.ts
git commit -m "feat(sp4d): listSessions excludes drafts"
```

---

## Task 9: Filter `routines.lastDoneAt` to status='completed' (TDD)

The PreWorkout RoutineCard's "last done" stamp should ignore in-progress drafts.

**Files:**
- Modify: `lib/db/queries/routines.ts`
- Modify: `lib/db/__tests__/routines.test.ts`

- [ ] **Step 1:** Write the failing test. Open `lib/db/__tests__/routines.test.ts` and add:

```ts
import { startDraftSession } from '../queries/sessions';
import { insertCompletedSessionForTests } from './test-helpers';

describe('listRoutines.lastDoneAt', () => {
  it('uses the latest completed session, ignoring drafts', async () => {
    const { db } = makeTestDb();
    seedWorkouts(db);
    // Completed session at t=1_000_000
    await insertCompletedSessionForTests(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A',
      startedAt: 1_000_000, finishedAt: 1_100_000,
      sets: [{ exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null }],
    });
    // Draft session in the future — should NOT update lastDoneAt
    await startDraftSession(db, { routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 9_000_000 });

    const rows = await listRoutines(db);
    const pushDayA = rows.find((r) => r.id === 1)!;
    expect(pushDayA.lastDoneAt).toBe(1_100_000);
  });
});
```

(Make sure the existing `routines.test.ts` already imports `listRoutines` and `seedWorkouts` and `makeTestDb` from the right places — check the top of the file before adding.)

- [ ] **Step 2:** Run to verify it fails.

```bash
npm test -- routines.test -t "lastDoneAt"
```

Expected: FAIL — `lastDoneAt` is `9_000_000` (the draft's `startedAt` is being picked up by the `MAX(finished_at)` subquery; actually `finished_at` is null for the draft and `MAX` ignores nulls, so this might already pass. If it does, remove the test). 

Actually: `MAX(finished_at)` over `{1_100_000, NULL}` is `1_100_000`. So this test may already pass. But if SP4e adds a `pr_count > 0` filter on this subquery, the draft with `pr_count=0` would still be picked up. To be defensive *and* explicit, add the `status='completed'` filter regardless. **Tighten the test** by also asserting that a draft with a non-null `finished_at` (impossible via the query layer but possible via direct SQL) is also ignored:

Replace the test body with:

```ts
  it('uses the latest completed session, ignoring drafts even if they have a finishedAt', async () => {
    const { db, raw } = makeTestDb();
    seedWorkouts(db);
    await insertCompletedSessionForTests(db, {
      routineId: 1, routineNameSnapshot: 'Push Day A',
      startedAt: 1_000_000, finishedAt: 1_100_000,
      sets: [{ exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null }],
    });
    // Manually corrupt: a draft with a non-null finished_at (defensive — should never happen via the API,
    // but the query should be robust to it).
    raw.prepare(`INSERT INTO sessions (routine_id, routine_name_snapshot, status, started_at, finished_at)
                 VALUES (1, 'Push Day A', 'draft', 9000000, 9100000)`).run();

    const rows = await listRoutines(db);
    const pushDayA = rows.find((r) => r.id === 1)!;
    expect(pushDayA.lastDoneAt).toBe(1_100_000);
  });
```

- [ ] **Step 3:** Run again to verify the corrupted-draft test fails.

```bash
npm test -- routines.test -t "lastDoneAt"
```

Expected: FAIL — `lastDoneAt` is `9_100_000`.

- [ ] **Step 4:** Update the subquery in `lib/db/queries/routines.ts`. Find the `lastDoneAt` line (line 58–60):

```ts
      lastDoneAt: sql<number | null>`(
        SELECT MAX(${sessions.finishedAt}) FROM ${sessions} WHERE ${sessions.routineId} = ${routines.id}
      )`,
```

Change to:

```ts
      lastDoneAt: sql<number | null>`(
        SELECT MAX(${sessions.finishedAt}) FROM ${sessions}
        WHERE ${sessions.routineId} = ${routines.id} AND ${sessions.status} = 'completed'
      )`,
```

- [ ] **Step 5:** Run the test.

```bash
npm test -- routines.test
```

Expected: PASS.

- [ ] **Step 6:** Commit.

```bash
git add lib/db/queries/routines.ts lib/db/__tests__/routines.test.ts
git commit -m "fix(sp4d): listRoutines.lastDoneAt ignores draft sessions"
```

---

## Task 10: Migrate `scripts/smoke-sp4a.ts` to the new lifecycle

**Files:**
- Modify: `scripts/smoke-sp4a.ts`

- [ ] **Step 1:** Open `scripts/smoke-sp4a.ts`. The current script imports `insertCompletedSession`. Replace its contents (specifically the import and the `result = await insertCompletedSession(...)` block).

Find the line:

```ts
import { insertCompletedSession, listSessions } from '../lib/db/queries/sessions';
```

Replace with:

```ts
import { startDraftSession, upsertDraftSet, finalizeSession, listSessions } from '../lib/db/queries/sessions';
```

- [ ] **Step 2:** Find the block that calls `insertCompletedSession` (line 24-33). Replace it with the equivalent lifecycle. The current script has the call inlined with `1_000_000` literals and 2 sets. Replace lines 23-33 with:

```ts
const sets = [
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
  { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { sessionId } = await startDraftSession(db as any, {
  routineId: 1, routineNameSnapshot: 'Push Day A', startedAt: 1_000_000,
});
for (const s of sets) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await upsertDraftSet(db as any, sessionId, s);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const result = await finalizeSession(db as any, sessionId, 1_000_000 + 60 * 52 * 1000);
```

The existing volume assertion (`5 * 80 + 5 * 90 = 850`) on line 39 still holds because the same two sets are logged.

- [ ] **Step 3:** Run the smoke script.

```bash
npm run smoke:sp4a
```

Expected: prints the same output as before — a session ID, totals, and the listed session row.

- [ ] **Step 4:** Commit.

```bash
git add scripts/smoke-sp4a.ts
git commit -m "chore(sp4d): migrate smoke-sp4a to new session lifecycle"
```

---

## Task 11: Rest timer reducer (TDD)

**Files:**
- Create: `lib/workouts/rest-timer.ts`
- Create: `lib/workouts/__tests__/rest-timer.test.ts`

- [ ] **Step 1:** Write the failing tests. Create `lib/workouts/__tests__/rest-timer.test.ts`:

```ts
/** @jest-environment node */
import { reduce, type RestTimerState, type RestTimerEvent } from '../rest-timer';

describe('rest timer reducer', () => {
  const idle: RestTimerState = { status: 'idle' };
  const running = (startedAt: number, durationMs: number): RestTimerState =>
    ({ status: 'running', startedAt, durationMs });

  it('START from idle → running', () => {
    const next = reduce(idle, { type: 'START', now: 1000, durationMs: 90_000 });
    expect(next).toEqual(running(1000, 90_000));
  });

  it('START from running → running (replaces)', () => {
    const next = reduce(running(1000, 90_000), { type: 'START', now: 5000, durationMs: 60_000 });
    expect(next).toEqual(running(5000, 60_000));
  });

  it('TICK while running and not yet expired → unchanged', () => {
    const state = running(1000, 90_000);
    const next = reduce(state, { type: 'TICK', now: 5000 });
    expect(next).toBe(state);
  });

  it('TICK while running and expired → unchanged (banner persists)', () => {
    const state = running(1000, 90_000);
    const next = reduce(state, { type: 'TICK', now: 200_000 });
    expect(next).toBe(state);
  });

  it('TICK from idle → unchanged (no-op)', () => {
    const next = reduce(idle, { type: 'TICK', now: 5000 });
    expect(next).toBe(idle);
  });

  it('ADD_30S while running → durationMs +30000', () => {
    const next = reduce(running(1000, 60_000), { type: 'ADD_30S' });
    expect(next).toEqual(running(1000, 90_000));
  });

  it('ADD_30S from idle → unchanged', () => {
    const next = reduce(idle, { type: 'ADD_30S' });
    expect(next).toBe(idle);
  });

  it('SKIP from running → idle', () => {
    const next = reduce(running(1000, 60_000), { type: 'SKIP' });
    expect(next).toEqual(idle);
  });

  it('SKIP from idle → unchanged', () => {
    const next = reduce(idle, { type: 'SKIP' });
    expect(next).toBe(idle);
  });

  it('handles a realistic sequence: START → TICK → ADD_30S → TICK → SKIP', () => {
    let s: RestTimerState = idle;
    s = reduce(s, { type: 'START', now: 1000, durationMs: 60_000 });
    s = reduce(s, { type: 'TICK', now: 30_000 });
    s = reduce(s, { type: 'ADD_30S' });
    s = reduce(s, { type: 'TICK', now: 60_000 });
    expect(s).toEqual(running(1000, 90_000));
    s = reduce(s, { type: 'SKIP' });
    expect(s).toEqual(idle);
  });
});
```

- [ ] **Step 2:** Run to verify failure.

```bash
npm test -- rest-timer
```

Expected: FAIL with module-not-found.

- [ ] **Step 3:** Implement the reducer. Create `lib/workouts/rest-timer.ts`:

```ts
export type RestTimerState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number; durationMs: number };

export type RestTimerEvent =
  | { type: 'START';   now: number; durationMs: number }
  | { type: 'TICK';    now: number }
  | { type: 'ADD_30S' }
  | { type: 'SKIP' };

export function reduce(state: RestTimerState, event: RestTimerEvent): RestTimerState {
  switch (event.type) {
    case 'START':
      return { status: 'running', startedAt: event.now, durationMs: event.durationMs };
    case 'TICK':
      return state;
    case 'ADD_30S':
      if (state.status !== 'running') return state;
      return { status: 'running', startedAt: state.startedAt, durationMs: state.durationMs + 30_000 };
    case 'SKIP':
      if (state.status !== 'running') return state;
      return { status: 'idle' };
  }
}

/** Derived helpers — pure, used by components and the store. */
export function remainingMs(state: RestTimerState, now: number): number {
  if (state.status !== 'running') return 0;
  return Math.max(0, state.durationMs - (now - state.startedAt));
}

export function isOvertime(state: RestTimerState, now: number): boolean {
  if (state.status !== 'running') return false;
  return now - state.startedAt >= state.durationMs;
}
```

- [ ] **Step 4:** Run the tests.

```bash
npm test -- rest-timer
```

Expected: all PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/workouts/rest-timer.ts lib/workouts/__tests__/rest-timer.test.ts
git commit -m "feat(sp4d): rest timer reducer + helpers"
```

---

## Task 12: In-flight PR detection wrapper (TDD)

**Files:**
- Create: `lib/workouts/in-flight-pr.ts`
- Create: `lib/workouts/__tests__/in-flight-pr.test.ts`

- [ ] **Step 1:** Write the failing tests. Create `lib/workouts/__tests__/in-flight-pr.test.ts`:

```ts
/** @jest-environment node */
import { getInFlightBadges, wouldThisSetBeAPR } from '../in-flight-pr';
import type { PRSnapshot } from '../pr-detection';

describe('getInFlightBadges', () => {
  it('returns all-false when snapshot is empty and there are no sets', () => {
    expect(getInFlightBadges(new Map(), [])).toEqual([]);
  });

  it('flags every set that beats the snapshot', () => {
    const snapshot: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    const sets = [
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 0, reps: 5, weightKg: 80, durationSeconds: null, distanceKm: null },
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 1, reps: 5, weightKg: 85, durationSeconds: null, distanceKm: null },
      { exerciseId: 'bench', exercisePosition: 0, setPosition: 2, reps: 5, weightKg: 90, durationSeconds: null, distanceKm: null },
    ];
    expect(getInFlightBadges(snapshot, sets)).toEqual([false, true, true]);
  });

  it('flags every set when no prior PR exists', () => {
    const sets = [
      { exerciseId: 'ohp', exercisePosition: 0, setPosition: 0, reps: 6, weightKg: 50, durationSeconds: null, distanceKm: null },
      { exerciseId: 'ohp', exercisePosition: 0, setPosition: 1, reps: 6, weightKg: 52.5, durationSeconds: null, distanceKm: null },
    ];
    expect(getInFlightBadges(new Map(), sets)).toEqual([true, true]);
  });

  it('ignores cardio sets (reps or weightKg null)', () => {
    const sets = [
      { exerciseId: 'treadmill', exercisePosition: 0, setPosition: 0, reps: null, weightKg: null, durationSeconds: 1800, distanceKm: 5 },
    ];
    expect(getInFlightBadges(new Map(), sets)).toEqual([false]);
  });
});

describe('wouldThisSetBeAPR', () => {
  it('returns true when no prior PR exists', () => {
    expect(wouldThisSetBeAPR(new Map(), 'bench', 5, 80)).toBe(true);
  });

  it('returns true when reps*weight beats the prior PR', () => {
    const snap: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    expect(wouldThisSetBeAPR(snap, 'bench', 5, 85)).toBe(true);
  });

  it('returns false when reps*weight equals the prior PR', () => {
    const snap: PRSnapshot = new Map([['bench', { weightKg: 80, reps: 5 }]]);
    expect(wouldThisSetBeAPR(snap, 'bench', 5, 80)).toBe(false);
  });

  it('returns false when reps or weight is null', () => {
    expect(wouldThisSetBeAPR(new Map(), 'bench', null, 80)).toBe(false);
    expect(wouldThisSetBeAPR(new Map(), 'bench', 5, null)).toBe(false);
  });
});
```

- [ ] **Step 2:** Run to verify failure.

```bash
npm test -- in-flight-pr
```

Expected: FAIL with module-not-found.

- [ ] **Step 3:** Implement. Create `lib/workouts/in-flight-pr.ts`:

```ts
import { detectSessionPRs, type PRSnapshot } from './pr-detection';
import type { SessionSetDraft } from '@/lib/db/queries/sessions';

export function getInFlightBadges(
  snapshot: PRSnapshot,
  drafts: SessionSetDraft[],
): boolean[] {
  return detectSessionPRs(
    snapshot,
    drafts.map((s) => ({ exerciseId: s.exerciseId, reps: s.reps, weightKg: s.weightKg })),
  ).isPrPerSet;
}

export function wouldThisSetBeAPR(
  snapshot: PRSnapshot,
  exerciseId: string,
  reps: number | null,
  weightKg: number | null,
): boolean {
  if (reps === null || weightKg === null) return false;
  const result = detectSessionPRs(snapshot, [{ exerciseId, reps, weightKg }]);
  return result.isPrPerSet[0];
}
```

- [ ] **Step 4:** Run.

```bash
npm test -- in-flight-pr
```

Expected: all PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/workouts/in-flight-pr.ts lib/workouts/__tests__/in-flight-pr.test.ts
git commit -m "feat(sp4d): in-flight PR detection wrapper"
```

---

## Task 13: Cardio aggregate helpers (TDD)

**Files:**
- Create: `lib/workouts/cardio-aggregate.ts`
- Create: `lib/workouts/__tests__/cardio-aggregate.test.ts`

- [ ] **Step 1:** Write the failing tests. Create `lib/workouts/__tests__/cardio-aggregate.test.ts`:

```ts
/** @jest-environment node */
import { paceMinPerKm, formatPace, formatDuration } from '../cardio-aggregate';

describe('paceMinPerKm', () => {
  it('returns null when distance is 0 or negative', () => {
    expect(paceMinPerKm(1800, 0)).toBeNull();
    expect(paceMinPerKm(1800, -1)).toBeNull();
  });

  it('returns null when duration is 0 or negative', () => {
    expect(paceMinPerKm(0, 5)).toBeNull();
    expect(paceMinPerKm(-1, 5)).toBeNull();
  });

  it('computes min/km for a typical run (5k in 25 min → 5:00 pace)', () => {
    expect(paceMinPerKm(25 * 60, 5)).toBeCloseTo(5);
  });

  it('computes min/km for a slower run (3k in 18 min → 6:00 pace)', () => {
    expect(paceMinPerKm(18 * 60, 3)).toBeCloseTo(6);
  });
});

describe('formatPace', () => {
  it('formats null as em-dash', () => {
    expect(formatPace(null)).toBe('—');
  });

  it('formats whole minutes', () => {
    expect(formatPace(5)).toBe('5:00');
  });

  it('formats fractional minutes correctly', () => {
    expect(formatPace(5.5)).toBe('5:30');
  });

  it('rounds seconds to nearest', () => {
    expect(formatPace(5.25)).toBe('5:15');
    expect(formatPace(5.75)).toBe('5:45');
  });
});

describe('formatDuration', () => {
  it('formats sub-hour as mm:ss', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(45)).toBe('0:45');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(125)).toBe('2:05');
    expect(formatDuration(60 * 30)).toBe('30:00');
  });

  it('formats one-hour-plus as h:mm:ss', () => {
    expect(formatDuration(60 * 60)).toBe('1:00:00');
    expect(formatDuration(60 * 60 + 125)).toBe('1:02:05');
  });
});
```

- [ ] **Step 2:** Run to verify failure.

```bash
npm test -- cardio-aggregate
```

Expected: FAIL with module-not-found.

- [ ] **Step 3:** Implement. Create `lib/workouts/cardio-aggregate.ts`:

```ts
export function paceMinPerKm(durationSeconds: number, distanceKm: number): number | null {
  if (distanceKm <= 0 || durationSeconds <= 0) return null;
  return (durationSeconds / 60) / distanceKm;
}

export function formatPace(minPerKm: number | null): string {
  if (minPerKm === null) return '—';
  const min = Math.floor(minPerKm);
  const sec = Math.round((minPerKm - min) * 60);
  // Handle 60-second carry from rounding
  if (sec === 60) return `${min + 1}:00`;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${minutes}:${String(secs).padStart(2, '0')}`;
}
```

- [ ] **Step 4:** Run.

```bash
npm test -- cardio-aggregate
```

Expected: all PASS.

- [ ] **Step 5:** Commit.

```bash
git add lib/workouts/cardio-aggregate.ts lib/workouts/__tests__/cardio-aggregate.test.ts
git commit -m "feat(sp4d): cardio aggregate helpers (pace + duration formatting)"
```

---

## Task 14: Zustand active session store — types + lifecycle methods

This is the largest non-test file. Split into three tasks (14, 15, 16) for review-ability. Task 14 establishes types, lifecycle (`startSession`, `hydrateFromDraft`, `finishSession`, `discardSession`), and selectors.

**Files:**
- Create: `lib/state/activeSessionStore.ts`

- [ ] **Step 1:** Create `lib/state/activeSessionStore.ts` with the types and lifecycle:

```ts
import { create } from 'zustand';
import { router } from 'expo-router';

import { db } from '@/lib/db/client';
import {
  startDraftSession,
  upsertDraftSet,
  deleteDraftSet,
  discardDraftSession,
  finalizeSession,
  type DraftSession,
  type SessionSetDraft,
} from '@/lib/db/queries/sessions';
import { getRoutineWithSets, type RoutineFull } from '@/lib/db/queries/routines';
import { getPRsForExercises, type PRSnapshot } from '@/lib/db/queries/prs';
import { type RestTimerState, reduce as reduceRest, type RestTimerEvent } from '@/lib/workouts/rest-timer';

export type SessionPhase = 'idle' | 'hydrating' | 'active' | 'finalizing';
export type SessionMode = 'strength' | 'cardio';

export interface ExerciseInSession {
  exerciseId: string;
  position: number;
  prescribedSets: Array<{
    reps: number | null;
    weightKg: number | null;
    durationSeconds: number | null;
    distanceKm: number | null;
  }>;
  meta: {
    name: string;
    equipment: string;
    muscle: string;
    sfSymbol: string;
    kind: 'strength' | 'cardio';
  };
}

interface CompleteSetPayload {
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

export interface ActiveSessionState {
  phase: SessionPhase;
  mode: SessionMode;
  sessionId: number | null;
  routineId: number | null;
  routineNameSnapshot: string;
  restDefaultSeconds: number;
  startedAt: number;
  exercises: ExerciseInSession[];
  currentExerciseIdx: number;
  prSnapshot: PRSnapshot;
  setDrafts: SessionSetDraft[];
  rest: RestTimerState;

  // lifecycle
  startSession(routineId: number): Promise<void>;
  hydrateFromDraft(draft: DraftSession): Promise<void>;
  finishSession(): Promise<void>;
  discardSession(): Promise<void>;

  // set ops (Task 15)
  completeSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  editSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  removeSet(exPos: number, setPos: number): Promise<void>;
  addSetToCurrent(): Promise<void>;
  skipExercise(): void;
  goToNextExercise(): void;

  // rest timer (Task 16)
  startRestTimer(durationMs: number): void;
  addRestTime(secs: number): void;
  skipRest(): void;
  tickRest(now: number): void;
}

const ZERO_STATE = {
  phase: 'idle' as const,
  mode: 'strength' as const,
  sessionId: null,
  routineId: null,
  routineNameSnapshot: '',
  restDefaultSeconds: 120,
  startedAt: 0,
  exercises: [] as ExerciseInSession[],
  currentExerciseIdx: 0,
  prSnapshot: new Map() as PRSnapshot,
  setDrafts: [] as SessionSetDraft[],
  rest: { status: 'idle' as const } as RestTimerState,
};

function exercisesFromRoutine(r: RoutineFull): ExerciseInSession[] {
  return r.exercises.map((re) => ({
    exerciseId: re.exercise.id,
    position: re.position,
    prescribedSets: re.sets.map((s) => ({
      reps: s.targetReps,
      weightKg: s.targetWeightKg,
      durationSeconds: s.targetDurationSeconds,
      distanceKm: s.targetDistanceKm,
    })),
    meta: {
      name: re.exercise.name,
      equipment: re.exercise.equipment,
      muscle: re.exercise.muscle,
      sfSymbol: re.exercise.sfSymbol,
      kind: re.exercise.kind === 'cardio' ? 'cardio' : 'strength',
    },
  }));
}

export const useActiveSessionStore = create<ActiveSessionState>()((set, get) => ({
  ...ZERO_STATE,

  startSession: async (routineId: number) => {
    set({ phase: 'hydrating' });
    const routine = await getRoutineWithSets(db, routineId);
    if (!routine) {
      set({ ...ZERO_STATE });
      throw new Error(`Routine ${routineId} not found`);
    }
    const exercises = exercisesFromRoutine(routine);
    const mode: SessionMode = exercises[0]?.meta.kind === 'cardio' ? 'cardio' : 'strength';
    const startedAt = Date.now();
    const { sessionId } = await startDraftSession(db, {
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      startedAt,
    });
    const exerciseIds = exercises.map((e) => e.exerciseId);
    const snapshot = await getPRsForExercises(db, exerciseIds);
    set({
      ...ZERO_STATE,
      phase: 'active',
      mode,
      sessionId,
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      restDefaultSeconds: routine.restDefaultSeconds,
      startedAt,
      exercises,
      currentExerciseIdx: 0,
      prSnapshot: snapshot,
      setDrafts: [],
      rest: { status: 'idle' },
    });
  },

  hydrateFromDraft: async (draft: DraftSession) => {
    set({ phase: 'hydrating' });
    if (draft.routineId === null) {
      // Freestyle drafts aren't supported in v2 (locked: routines are the unit). Discard defensively.
      await discardDraftSession(db, draft.id);
      set({ ...ZERO_STATE });
      return;
    }
    const routine = await getRoutineWithSets(db, draft.routineId);
    if (!routine) {
      // Routine deleted out from under us; discard the orphan draft.
      await discardDraftSession(db, draft.id);
      set({ ...ZERO_STATE });
      return;
    }
    const exercises = exercisesFromRoutine(routine);
    const mode: SessionMode = exercises[0]?.meta.kind === 'cardio' ? 'cardio' : 'strength';
    const exerciseIds = exercises.map((e) => e.exerciseId);
    const snapshot = await getPRsForExercises(db, exerciseIds);

    // Determine currentExerciseIdx: smallest exercisePosition that doesn't yet have all its prescribed sets logged.
    const setsByExPos = new Map<number, number>();
    for (const s of draft.sets) {
      setsByExPos.set(s.exercisePosition, (setsByExPos.get(s.exercisePosition) ?? 0) + 1);
    }
    let currentExerciseIdx = 0;
    for (let i = 0; i < exercises.length; i++) {
      const logged = setsByExPos.get(i) ?? 0;
      const prescribed = exercises[i].prescribedSets.length;
      if (logged < prescribed) {
        currentExerciseIdx = i;
        break;
      }
      currentExerciseIdx = Math.min(i + 1, exercises.length - 1);
    }

    set({
      ...ZERO_STATE,
      phase: 'active',
      mode,
      sessionId: draft.id,
      routineId: routine.id,
      routineNameSnapshot: routine.name,
      restDefaultSeconds: routine.restDefaultSeconds,
      startedAt: draft.startedAt,
      exercises,
      currentExerciseIdx,
      prSnapshot: snapshot,
      setDrafts: draft.sets,
      rest: { status: 'idle' },
    });
  },

  finishSession: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    set({ phase: 'finalizing' });
    try {
      const result = await finalizeSession(db, s.sessionId, Date.now());
      set({ ...ZERO_STATE });
      router.replace({ pathname: '/(tabs)/move/post', params: { sessionId: String(result.sessionId) } });
    } catch (e) {
      set({ phase: 'active' });   // re-enable the Finish button
      throw e;
    }
  },

  discardSession: async () => {
    const s = get();
    if (s.sessionId === null) return;
    await discardDraftSession(db, s.sessionId);
    set({ ...ZERO_STATE });
    router.replace('/(tabs)/move');
  },

  // Stubs filled in by Task 15 + 16
  completeSet: async () => { throw new Error('completeSet: not yet implemented'); },
  editSet: async () => { throw new Error('editSet: not yet implemented'); },
  removeSet: async () => { throw new Error('removeSet: not yet implemented'); },
  addSetToCurrent: async () => { throw new Error('addSetToCurrent: not yet implemented'); },
  skipExercise: () => { throw new Error('skipExercise: not yet implemented'); },
  goToNextExercise: () => { throw new Error('goToNextExercise: not yet implemented'); },

  startRestTimer: () => { throw new Error('startRestTimer: not yet implemented'); },
  addRestTime: () => { throw new Error('addRestTime: not yet implemented'); },
  skipRest: () => { throw new Error('skipRest: not yet implemented'); },
  tickRest: () => { throw new Error('tickRest: not yet implemented'); },
}));
```

- [ ] **Step 2:** Type-check the file.

```bash
npx tsc --noEmit
```

Expected: clean exit. If you get errors about `getPRsForExercises` returning a `Map<string, ...>` shape mismatch, double-check it returns `PRSnapshot` (i.e. `Map<string, { weightKg: number; reps: number }>`) — it should.

- [ ] **Step 3:** Run the test suite — there are no tests for the store yet, but make sure nothing else broke.

```bash
npm test
```

Expected: all existing tests still pass.

- [ ] **Step 4:** Commit.

```bash
git add lib/state/activeSessionStore.ts
git commit -m "feat(sp4d): active session store — types + lifecycle"
```

---

## Task 15: Active session store — set operations

**Files:**
- Modify: `lib/state/activeSessionStore.ts`

- [ ] **Step 1:** Replace the `completeSet`, `editSet`, `removeSet`, `addSetToCurrent`, `skipExercise`, and `goToNextExercise` stubs in `lib/state/activeSessionStore.ts` with these implementations. Find each stub and replace it with the corresponding block:

```ts
  completeSet: async (exPos, setPos, payload) => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    const draft: SessionSetDraft = {
      exerciseId: s.exercises[exPos].exerciseId,
      exercisePosition: exPos,
      setPosition: setPos,
      reps: payload.reps,
      weightKg: payload.weightKg,
      durationSeconds: payload.durationSeconds,
      distanceKm: payload.distanceKm,
    };
    // Local update first (optimistic).
    const next = [...s.setDrafts.filter((d) => !(d.exercisePosition === exPos && d.setPosition === setPos)), draft]
      .sort((a, b) => a.exercisePosition - b.exercisePosition || a.setPosition - b.setPosition);

    // Advance currentExerciseIdx if all prescribed sets of the current exercise are now logged.
    let nextExerciseIdx = s.currentExerciseIdx;
    if (s.mode === 'strength' && exPos === s.currentExerciseIdx) {
      const loggedAtCurrent = next.filter((d) => d.exercisePosition === exPos).length;
      const prescribed = s.exercises[exPos].prescribedSets.length;
      if (loggedAtCurrent >= prescribed && exPos + 1 < s.exercises.length) {
        nextExerciseIdx = exPos + 1;
      }
    }

    set({ setDrafts: next, currentExerciseIdx: nextExerciseIdx });

    // Persist (optimistic — see error-handling note in spec §5).
    try {
      await upsertDraftSet(db, s.sessionId, draft);
    } catch (e) {
      // Surface via console; UI toast is the screen's responsibility.
      // eslint-disable-next-line no-console
      console.warn('upsertDraftSet failed (set kept locally):', e);
    }

    // Auto-start rest timer for strength sets.
    if (s.mode === 'strength') {
      get().startRestTimer(s.restDefaultSeconds * 1000);
    }
  },

  editSet: async (exPos, setPos, payload) => {
    // Same write path as completeSet — upsert is idempotent on the (exPos, setPos) key.
    return get().completeSet(exPos, setPos, payload);
  },

  removeSet: async (exPos, setPos) => {
    const s = get();
    if (s.sessionId === null) return;
    const next = s.setDrafts.filter((d) => !(d.exercisePosition === exPos && d.setPosition === setPos));
    set({ setDrafts: next });
    try {
      await deleteDraftSet(db, s.sessionId, exPos, setPos);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('deleteDraftSet failed:', e);
    }
  },

  addSetToCurrent: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    const exPos = s.currentExerciseIdx;
    const ex = s.exercises[exPos];
    if (!ex) return;
    // The new set's prescribed values default to the last logged set, falling back to last prescribed.
    const loggedAt = s.setDrafts.filter((d) => d.exercisePosition === exPos);
    const lastLogged = loggedAt[loggedAt.length - 1];
    const lastPrescribed = ex.prescribedSets[ex.prescribedSets.length - 1];
    const prescribed = {
      reps: lastLogged?.reps ?? lastPrescribed?.reps ?? null,
      weightKg: lastLogged?.weightKg ?? lastPrescribed?.weightKg ?? null,
      durationSeconds: lastPrescribed?.durationSeconds ?? null,
      distanceKm: lastPrescribed?.distanceKm ?? null,
    };
    const newPrescribed = [...ex.prescribedSets, prescribed];
    const newExercises = s.exercises.map((e, i) => i === exPos ? { ...e, prescribedSets: newPrescribed } : e);
    set({ exercises: newExercises });
    // No DB write here — prescribed sets are not persisted; only logged sets are. The new "active" slot
    // in the UI appears because there's now a prescribed set with no matching logged set.
  },

  skipExercise: () => {
    const s = get();
    if (s.phase !== 'active') return;
    if (s.currentExerciseIdx + 1 >= s.exercises.length) return;
    set({ currentExerciseIdx: s.currentExerciseIdx + 1 });
  },

  goToNextExercise: () => {
    const s = get();
    if (s.phase !== 'active') return;
    if (s.currentExerciseIdx + 1 >= s.exercises.length) return;
    set({ currentExerciseIdx: s.currentExerciseIdx + 1 });
  },
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Run the suite.

```bash
npm test
```

Expected: all PASS (no new tests; verifying nothing broke).

- [ ] **Step 4:** Commit.

```bash
git add lib/state/activeSessionStore.ts
git commit -m "feat(sp4d): active session store — set operations"
```

---

## Task 16: Active session store — rest timer integration

**Files:**
- Modify: `lib/state/activeSessionStore.ts`

- [ ] **Step 1:** Replace the four rest-timer stubs at the bottom of the store. Find each stub (`startRestTimer`, `addRestTime`, `skipRest`, `tickRest`) and replace with:

```ts
  startRestTimer: (durationMs: number) => {
    const next = reduceRest(get().rest, { type: 'START', now: Date.now(), durationMs });
    set({ rest: next });
  },

  addRestTime: (secs: number) => {
    if (secs === 30) {
      const next = reduceRest(get().rest, { type: 'ADD_30S' });
      set({ rest: next });
      return;
    }
    // For arbitrary secs, build a synthetic event by composing ADD_30S calls. v2 only uses 30.
    let next = get().rest;
    let remaining = secs;
    while (remaining >= 30) {
      next = reduceRest(next, { type: 'ADD_30S' });
      remaining -= 30;
    }
    set({ rest: next });
  },

  skipRest: () => {
    const next = reduceRest(get().rest, { type: 'SKIP' });
    set({ rest: next });
  },

  tickRest: (now: number) => {
    // Reducer is a no-op for TICK; we still call it for symmetry / future extension.
    const next = reduceRest(get().rest, { type: 'TICK', now });
    if (next !== get().rest) set({ rest: next });
  },
```

- [ ] **Step 2:** Type-check + test.

```bash
npx tsc --noEmit && npm test
```

Expected: all PASS.

- [ ] **Step 3:** Commit.

```bash
git add lib/state/activeSessionStore.ts
git commit -m "feat(sp4d): active session store — rest timer integration"
```

---

## Task 17: `LiveHRChip` component

Tiny consumer of 4b's `useLiveHeartRate`. No tests (spec §11).

**Files:**
- Create: `components/active-session/LiveHRChip.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { useLiveHeartRate } from '@/lib/health/heart-rate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const STALE_MS = 30_000;

export function LiveHRChip() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { current, isStreaming, start, stop } = useLiveHeartRate();

  useEffect(() => {
    if (!isStreaming) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!current) return null;
  const sampledAtMs = current.sampledAt instanceof Date ? current.sampledAt.getTime() : Number(current.sampledAt);
  if (Date.now() - sampledAtMs > STALE_MS) return null;

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 8, paddingVertical: 3,
      borderRadius: 10, backgroundColor: palette.fill,
    }}>
      <Text style={{ color: palette.move, fontSize: 11, fontWeight: '700' }}>♥</Text>
      <Text style={{ color: palette.ink, fontSize: 12, fontWeight: '600' }}>
        {Math.round(current.bpm)} bpm
      </Text>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean. If `useLiveHeartRate`'s `current.sampledAt` type is unclear, peek at `lib/health/heart-rate.ts` and `lib/health/types.ts` and adjust the conversion accordingly.

- [ ] **Step 3:** Commit.

```bash
git add components/active-session/LiveHRChip.tsx
git commit -m "feat(sp4d): LiveHRChip component"
```

---

## Task 18: `SetCard` component (done / active / upcoming states)

**Files:**
- Create: `components/active-session/SetCard.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export type SetCardState =
  | { kind: 'done'; reps: number; weightKg: number; isPr: boolean }
  | { kind: 'active'; targetReps: number | null; targetWeightKg: number | null; reps: number | null; weightKg: number | null }
  | { kind: 'upcoming'; targetReps: number | null; targetWeightKg: number | null };

export function SetCard({
  num,
  state,
  onTapDone,
  onChange,
  onComplete,
}: {
  num: number;
  state: SetCardState;
  onTapDone?: () => void;                                   // tap on a done set → opens edit sheet
  onChange?: (patch: { reps?: number | null; weightKg?: number | null }) => void;
  onComplete?: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (state.kind === 'done') {
    const volume = state.weightKg * state.reps;
    return (
      <Pressable
        onPress={onTapDone}
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 12,
          padding: 12, borderRadius: 12,
          backgroundColor: palette.surface,
          borderWidth: 0.5, borderColor: state.isPr ? palette.money : palette.hair,
        }}
      >
        <View style={{
          width: 28, height: 28, borderRadius: 14, backgroundColor: palette.move,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
        </View>
        <Text style={{ color: palette.ink3, fontSize: 13, fontWeight: '700' }}>SET {num}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '700' }}>
          {state.weightKg}<Text style={{ color: palette.ink3, fontSize: 11 }}> kg </Text>
          × {state.reps}
        </Text>
        <Text style={{ color: state.isPr ? palette.money : palette.ink3, fontSize: 11, minWidth: 42, textAlign: 'right' }}>
          {state.isPr ? 'PR' : `${volume} kg`}
        </Text>
      </Pressable>
    );
  }

  if (state.kind === 'active') {
    return (
      <View style={{
        padding: 14, borderRadius: 14,
        backgroundColor: palette.fill,
        borderWidth: 1.5, borderColor: palette.accent,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View style={{
            paddingHorizontal: 10, paddingVertical: 3, borderRadius: 100,
            backgroundColor: palette.accent,
          }}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>SET {num}</Text>
          </View>
          {state.targetReps !== null && state.targetWeightKg !== null && (
            <Text style={{ color: palette.ink3, fontSize: 11 }}>
              Target: {state.targetWeightKg}kg × {state.targetReps}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: palette.surface, alignItems: 'center' }}>
            <Text style={{ color: palette.ink3, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }}>WEIGHT</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={state.weightKg === null ? '' : String(state.weightKg)}
              onChangeText={(v) => onChange?.({ weightKg: v === '' ? null : Number(v) })}
              style={{ color: palette.ink, fontSize: 28, fontWeight: '700', marginTop: 2 }}
            />
          </View>
          <View style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: palette.surface, alignItems: 'center' }}>
            <Text style={{ color: palette.ink3, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }}>REPS</Text>
            <TextInput
              keyboardType="number-pad"
              value={state.reps === null ? '' : String(state.reps)}
              onChangeText={(v) => onChange?.({ reps: v === '' ? null : Number(v) })}
              style={{ color: palette.ink, fontSize: 28, fontWeight: '700', marginTop: 2 }}
            />
          </View>
        </View>
        <Pressable
          onPress={onComplete}
          disabled={state.reps === null || state.weightKg === null}
          style={{
            padding: 11, borderRadius: 10,
            backgroundColor: state.reps !== null && state.weightKg !== null ? palette.accent : palette.hair,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓ Complete set</Text>
        </Pressable>
      </View>
    );
  }

  // upcoming
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 12, borderRadius: 12,
      backgroundColor: palette.fill,
      borderWidth: 0.5, borderColor: palette.hair,
      opacity: 0.7,
    }}>
      <View style={{
        width: 28, height: 28, borderRadius: 14,
        borderWidth: 1.5, borderColor: palette.ink4,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700' }}>{num}</Text>
      </View>
      <Text style={{ color: palette.ink3, fontSize: 13, fontWeight: '700' }}>SET {num}</Text>
      <View style={{ flex: 1 }} />
      <Text style={{ color: palette.ink3, fontSize: 15 }}>
        {state.targetWeightKg ?? '—'}<Text style={{ color: palette.ink4, fontSize: 10 }}> kg </Text>
        × {state.targetReps ?? '—'}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Commit.

```bash
git add components/active-session/SetCard.tsx
git commit -m "feat(sp4d): SetCard with done/active/upcoming states"
```

---

## Task 19: `SetEditSheet` component

A modal sheet for editing a previously-completed set's reps/weight, with a "Remove set" destructive action (locked decision #15).

**Files:**
- Create: `components/active-session/SetEditSheet.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetEditSheet({
  visible,
  initialReps,
  initialWeightKg,
  onCancel,
  onSave,
  onRemove,
}: {
  visible: boolean;
  initialReps: number;
  initialWeightKg: number;
  onCancel: () => void;
  onSave: (patch: { reps: number; weightKg: number }) => void;
  onRemove: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [reps, setReps] = useState(String(initialReps));
  const [weight, setWeight] = useState(String(initialWeightKg));

  useEffect(() => {
    if (visible) {
      setReps(String(initialReps));
      setWeight(String(initialWeightKg));
    }
  }, [visible, initialReps, initialWeightKg]);

  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const valid = !Number.isNaN(repsNum) && !Number.isNaN(weightNum) && repsNum > 0 && weightNum >= 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: palette.surface, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>Edit set</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>WEIGHT (kg)</Text>
            <TextInput
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              style={{
                fontSize: 22, fontWeight: '700', color: palette.ink,
                borderBottomWidth: 1, borderBottomColor: palette.hair, paddingVertical: 4,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>REPS</Text>
            <TextInput
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
              style={{
                fontSize: 22, fontWeight: '700', color: palette.ink,
                borderBottomWidth: 1, borderBottomColor: palette.hair, paddingVertical: 4,
              }}
            />
          </View>
        </View>
        <Pressable
          onPress={() => valid && onSave({ reps: repsNum, weightKg: weightNum })}
          disabled={!valid}
          style={{
            padding: 14, borderRadius: 12,
            backgroundColor: valid ? palette.accent : palette.hair,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Save</Text>
        </Pressable>
        <Pressable
          onPress={onRemove}
          style={{ padding: 14, alignItems: 'center' }}
        >
          <Text style={{ color: palette.red, fontSize: 15, fontWeight: '600' }}>Remove set</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ padding: 10, alignItems: 'center' }}>
          <Text style={{ color: palette.accent, fontSize: 15 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Commit.

```bash
git add components/active-session/SetEditSheet.tsx
git commit -m "feat(sp4d): SetEditSheet with remove action"
```

---

## Task 20: `ExerciseCard` component (composes SetCard + SetEditSheet)

**Files:**
- Create: `components/active-session/ExerciseCard.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { SetCard, type SetCardState } from './SetCard';
import { SetEditSheet } from './SetEditSheet';
import { LiveHRChip } from './LiveHRChip';
import { useActiveSessionStore, type ExerciseInSession } from '@/lib/state/activeSessionStore';
import { wouldThisSetBeAPR } from '@/lib/workouts/in-flight-pr';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseCard({
  exerciseIdx,
  exercise,
}: {
  exerciseIdx: number;
  exercise: ExerciseInSession;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const prSnapshot = useActiveSessionStore((s) => s.prSnapshot);
  const completeSet = useActiveSessionStore((s) => s.completeSet);
  const editSet = useActiveSessionStore((s) => s.editSet);
  const removeSet = useActiveSessionStore((s) => s.removeSet);
  const addSetToCurrent = useActiveSessionStore((s) => s.addSetToCurrent);
  const skipExercise = useActiveSessionStore((s) => s.skipExercise);

  const loggedAtThis = setDrafts.filter((d) => d.exercisePosition === exerciseIdx);
  const prescribed = exercise.prescribedSets;

  // Build SetCardState[] from prescribed + logged
  const cards: { state: SetCardState; setPos: number }[] = [];
  for (let i = 0; i < prescribed.length; i++) {
    const logged = loggedAtThis.find((d) => d.setPosition === i);
    if (logged) {
      const isPr = wouldThisSetBeAPR(prSnapshot, exercise.exerciseId, logged.reps, logged.weightKg);
      cards.push({
        state: {
          kind: 'done',
          reps: logged.reps ?? 0,
          weightKg: logged.weightKg ?? 0,
          isPr,
        },
        setPos: i,
      });
    } else {
      // The first un-logged prescribed set is "active"; the rest are "upcoming".
      const firstActiveIdx = prescribed.findIndex((_, j) => !loggedAtThis.some((d) => d.setPosition === j));
      const isActive = i === firstActiveIdx;
      if (isActive) {
        cards.push({
          state: {
            kind: 'active',
            targetReps: prescribed[i].reps,
            targetWeightKg: prescribed[i].weightKg,
            reps: prescribed[i].reps,
            weightKg: prescribed[i].weightKg,
          },
          setPos: i,
        });
      } else {
        cards.push({
          state: {
            kind: 'upcoming',
            targetReps: prescribed[i].reps,
            targetWeightKg: prescribed[i].weightKg,
          },
          setPos: i,
        });
      }
    }
  }

  const [editing, setEditing] = useState<{ setPos: number; reps: number; weightKg: number } | null>(null);
  const [activeDraft, setActiveDraft] = useState<{ setPos: number; reps: number | null; weightKg: number | null } | null>(null);

  const onComplete = (setPos: number, reps: number | null, weightKg: number | null) => {
    if (reps === null || weightKg === null) return;
    completeSet(exerciseIdx, setPos, { reps, weightKg, durationSeconds: null, distanceKm: null });
    setActiveDraft(null);
  };

  return (
    <View style={{ padding: 18, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: palette.move, letterSpacing: 1.2 }}>
            ● NOW · EXERCISE {exerciseIdx + 1}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '700', color: palette.ink, marginTop: 2 }}>{exercise.meta.name}</Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 4 }}>
            {exercise.meta.muscle} · {exercise.meta.equipment}
          </Text>
        </View>
        <LiveHRChip />
        <Pressable
          onPress={() => Alert.alert(
            exercise.meta.name,
            undefined,
            [
              { text: 'Skip exercise', onPress: skipExercise },
              { text: 'Cancel', style: 'cancel' },
            ],
          )}
          style={{
            width: 32, height: 32, borderRadius: 16, backgroundColor: palette.fill,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: palette.ink2, fontSize: 16 }}>⋯</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        {cards.map(({ state, setPos }) => (
          <View key={setPos}>
            {state.kind === 'active' ? (
              <SetCard
                num={setPos + 1}
                state={{
                  ...state,
                  reps: activeDraft?.setPos === setPos ? activeDraft.reps : state.reps,
                  weightKg: activeDraft?.setPos === setPos ? activeDraft.weightKg : state.weightKg,
                }}
                onChange={(patch) => setActiveDraft({
                  setPos,
                  reps: 'reps' in patch ? patch.reps! : (activeDraft?.reps ?? state.reps),
                  weightKg: 'weightKg' in patch ? patch.weightKg! : (activeDraft?.weightKg ?? state.weightKg),
                })}
                onComplete={() => onComplete(
                  setPos,
                  activeDraft?.setPos === setPos ? activeDraft.reps : state.reps,
                  activeDraft?.setPos === setPos ? activeDraft.weightKg : state.weightKg,
                )}
              />
            ) : state.kind === 'done' ? (
              <SetCard
                num={setPos + 1}
                state={state}
                onTapDone={() => setEditing({ setPos, reps: state.reps, weightKg: state.weightKg })}
              />
            ) : (
              <SetCard num={setPos + 1} state={state} />
            )}
          </View>
        ))}
      </View>

      <Pressable
        onPress={addSetToCurrent}
        style={{
          marginTop: 10, padding: 12, borderRadius: 12,
          borderWidth: 1.5, borderColor: palette.hair, borderStyle: 'dashed',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: palette.ink3, fontWeight: '600' }}>+ Add set</Text>
      </Pressable>

      <SetEditSheet
        visible={editing !== null}
        initialReps={editing?.reps ?? 0}
        initialWeightKg={editing?.weightKg ?? 0}
        onCancel={() => setEditing(null)}
        onSave={(patch) => {
          if (editing) {
            editSet(exerciseIdx, editing.setPos, { ...patch, durationSeconds: null, distanceKm: null });
          }
          setEditing(null);
        }}
        onRemove={() => {
          if (editing) {
            removeSet(exerciseIdx, editing.setPos);
          }
          setEditing(null);
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Commit.

```bash
git add components/active-session/ExerciseCard.tsx
git commit -m "feat(sp4d): ExerciseCard composes SetCard + edit sheet"
```

---

## Task 21: `UpNextRow` component

**Files:**
- Create: `components/active-session/UpNextRow.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { Text, View } from 'react-native';

import type { ExerciseInSession } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function UpNextRow({ exercise }: { exercise: ExerciseInSession }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const firstSet = exercise.prescribedSets[0];

  return (
    <View style={{
      marginTop: 16, padding: 14, borderRadius: 14,
      backgroundColor: palette.surface,
      borderWidth: 0.5, borderColor: palette.hair,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <View style={{
        paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4,
        backgroundColor: palette.fill,
      }}>
        <Text style={{ fontSize: 9, fontWeight: '700', color: palette.ink3, letterSpacing: 1 }}>NEXT</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>{exercise.meta.name}</Text>
        <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 1 }}>
          {exercise.prescribedSets.length} sets · {firstSet?.weightKg ?? '—'}kg × {firstSet?.reps ?? '—'}
        </Text>
      </View>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check + commit.

```bash
npx tsc --noEmit
git add components/active-session/UpNextRow.tsx
git commit -m "feat(sp4d): UpNextRow component"
```

---

## Task 22: `RestBanner` component

**Files:**
- Create: `components/active-session/RestBanner.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { remainingMs, isOvertime } from '@/lib/workouts/rest-timer';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration } from '@/lib/workouts/cardio-aggregate';

export function RestBanner() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const rest = useActiveSessionStore((s) => s.rest);
  const addRestTime = useActiveSessionStore((s) => s.addRestTime);
  const skipRest = useActiveSessionStore((s) => s.skipRest);
  const tickRest = useActiveSessionStore((s) => s.tickRest);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (rest.status !== 'running') return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      tickRest(t);
    }, 1000);
    return () => clearInterval(id);
  }, [rest.status, tickRest]);

  if (rest.status !== 'running') return null;

  const remSec = Math.ceil(remainingMs(rest, now) / 1000);
  const overtime = isOvertime(rest, now);
  const display = overtime ? "Rest's up" : formatDuration(remSec);

  return (
    <View style={{
      backgroundColor: palette.accent,
      paddingHorizontal: 16, paddingVertical: 12,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    }}>
      <View>
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', opacity: 0.85, letterSpacing: 1 }}>REST</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', color: '#fff' }}>{display}</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Pressable
        onPress={() => addRestTime(30)}
        style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.22)' }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>+30s</Text>
      </Pressable>
      <Pressable
        onPress={skipRest}
        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100, backgroundColor: '#fff' }}
      >
        <Text style={{ color: palette.accent, fontSize: 12, fontWeight: '700' }}>Skip</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check + commit.

```bash
npx tsc --noEmit
git add components/active-session/RestBanner.tsx
git commit -m "feat(sp4d): RestBanner with ticker"
```

---

## Task 23: `SessionHeader` component

**Files:**
- Create: `components/active-session/SessionHeader.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, paceMinPerKm, formatPace } from '@/lib/workouts/cardio-aggregate';

export function SessionHeader({ onBack }: { onBack: () => void }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const phase = useActiveSessionStore((s) => s.phase);
  const mode = useActiveSessionStore((s) => s.mode);
  const routineNameSnapshot = useActiveSessionStore((s) => s.routineNameSnapshot);
  const startedAt = useActiveSessionStore((s) => s.startedAt);
  const exercises = useActiveSessionStore((s) => s.exercises);
  const currentExerciseIdx = useActiveSessionStore((s) => s.currentExerciseIdx);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const finishSession = useActiveSessionStore((s) => s.finishSession);

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const completedSets = setDrafts.length;
  const totalSets = exercises.reduce((s, e) => s + e.prescribedSets.length, 0);
  const totalVolume = setDrafts.reduce(
    (s, d) => s + (d.reps ?? 0) * (d.weightKg ?? 0),
    0,
  );

  // Cardio derived stats
  const cardioSet = mode === 'cardio' ? setDrafts[0] : undefined;
  const cardioDistance = cardioSet?.distanceKm ?? 0;
  const cardioPace = formatPace(paceMinPerKm(elapsedSec, cardioDistance));

  return (
    <View style={{
      backgroundColor: palette.move,
      paddingTop: 54, paddingBottom: 18, paddingHorizontal: 16,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          onPress={onBack}
          style={{
            width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14 }}>▼</Text>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff', opacity: 0.75, letterSpacing: 1.8 }}>
            ● {routineNameSnapshot.toUpperCase()}
          </Text>
          <Text style={{ fontSize: 32, fontWeight: '700', color: '#fff', marginTop: 2 }}>
            {formatDuration(elapsedSec)}
          </Text>
        </View>
        <Pressable
          onPress={finishSession}
          disabled={phase === 'finalizing'}
          style={{
            backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100,
            opacity: phase === 'finalizing' ? 0.6 : 1,
          }}
        >
          <Text style={{ color: palette.move, fontSize: 13, fontWeight: '700' }}>
            {phase === 'finalizing' ? 'Saving…' : 'Finish'}
          </Text>
        </Pressable>
      </View>

      {mode === 'strength' && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 16 }}>
          {exercises.map((_, i) => (
            <View key={i} style={{
              width: i === currentExerciseIdx ? 24 : 6, height: 4, borderRadius: 2,
              backgroundColor: i <= currentExerciseIdx ? '#fff' : 'rgba(255,255,255,0.3)',
            }} />
          ))}
        </View>
      )}

      <View style={{ flexDirection: 'row', marginTop: 18, borderRadius: 12, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)' }}>
        {mode === 'strength' ? (
          <>
            <Stat label="Exercise" value={`${currentExerciseIdx + 1}/${exercises.length}`} />
            <Stat label="Sets" value={`${completedSets}/${totalSets}`} />
            <Stat label="Volume" value={String(Math.round(totalVolume))} />
          </>
        ) : (
          <>
            <Stat label="Distance" value={`${cardioDistance.toFixed(2)} km`} />
            <Stat label="Pace" value={cardioPace} />
          </>
        )}
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1, padding: 8, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.12)' }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>{value}</Text>
      <Text style={{ fontSize: 9, fontWeight: '700', color: '#fff', opacity: 0.75, letterSpacing: 0.6, marginTop: 2 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check + commit.

```bash
npx tsc --noEmit
git add components/active-session/SessionHeader.tsx
git commit -m "feat(sp4d): SessionHeader with strength/cardio chips"
```

---

## Task 24: `CardioBody` component

**Files:**
- Create: `components/active-session/CardioBody.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, paceMinPerKm, formatPace } from '@/lib/workouts/cardio-aggregate';

export function CardioBody() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const exercises = useActiveSessionStore((s) => s.exercises);
  const startedAt = useActiveSessionStore((s) => s.startedAt);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const completeSet = useActiveSessionStore((s) => s.completeSet);

  const exercise = exercises[0];
  const target = exercise?.prescribedSets[0];

  const draft = setDrafts[0];
  const [distance, setDistance] = useState(
    draft?.distanceKm !== undefined && draft?.distanceKm !== null
      ? String(draft.distanceKm)
      : (target?.distanceKm !== null && target?.distanceKm !== undefined ? String(target.distanceKm) : ''),
  );

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsedSec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const distanceNum = Number(distance);
  const validDistance = !Number.isNaN(distanceNum) && distanceNum > 0;

  const persist = () => {
    if (!exercise) return;
    completeSet(0, 0, {
      reps: null, weightKg: null,
      durationSeconds: null,             // finalized at Finish
      distanceKm: validDistance ? distanceNum : null,
    });
  };

  if (!exercise) return null;

  return (
    <View style={{ padding: 18 }}>
      <View style={{
        padding: 22, borderRadius: 18, backgroundColor: palette.surface,
        borderWidth: 0.5, borderColor: palette.hair, alignItems: 'center', gap: 16,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 1.2 }}>
          {exercise.meta.name.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 56, fontWeight: '700', color: palette.ink, fontVariant: ['tabular-nums'] }}>
          {formatDuration(elapsedSec)}
        </Text>
        {target?.durationSeconds != null && (
          <Text style={{ fontSize: 13, color: palette.ink3 }}>
            Target: {formatDuration(target.durationSeconds)}
          </Text>
        )}

        <View style={{
          marginTop: 8, alignSelf: 'stretch', padding: 14, borderRadius: 12,
          backgroundColor: palette.fill, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>
            DISTANCE (km)
          </Text>
          <TextInput
            keyboardType="decimal-pad"
            value={distance}
            onChangeText={setDistance}
            onBlur={persist}
            style={{ fontSize: 36, fontWeight: '700', color: palette.ink, marginTop: 4 }}
          />
          {target?.distanceKm != null && (
            <Text style={{ fontSize: 11, color: palette.ink3, marginTop: 4 }}>
              Target: {target.distanceKm} km
            </Text>
          )}
        </View>

        {validDistance && (
          <Text style={{ fontSize: 13, color: palette.ink2 }}>
            Pace: {formatPace(paceMinPerKm(elapsedSec, distanceNum))} /km
          </Text>
        )}
      </View>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check + commit.

```bash
npx tsc --noEmit
git add components/active-session/CardioBody.tsx
git commit -m "feat(sp4d): CardioBody with live elapsed + distance input"
```

---

## Task 25: `DiscardConfirmModal` component

**Files:**
- Create: `components/active-session/DiscardConfirmModal.tsx`

- [ ] **Step 1:** Create the file:

```tsx
import { Modal, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function DiscardConfirmModal({
  visible,
  loggedSetCount,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  loggedSetCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: palette.surface, borderRadius: 16, padding: 22, width: '100%', maxWidth: 320, gap: 6,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink, textAlign: 'center' }}>
            Discard this workout?
          </Text>
          <Text style={{ fontSize: 13, color: palette.ink3, textAlign: 'center' }}>
            {loggedSetCount === 0
              ? 'Nothing logged yet.'
              : `You'll lose ${loggedSetCount} logged set${loggedSetCount === 1 ? '' : 's'}.`}
          </Text>
          <Pressable
            onPress={onConfirm}
            style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: palette.red, alignItems: 'center' }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Discard</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            style={{ padding: 12, alignItems: 'center' }}
          >
            <Text style={{ color: palette.accent, fontWeight: '600', fontSize: 15 }}>Keep going</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2:** Type-check + commit.

```bash
npx tsc --noEmit
git add components/active-session/DiscardConfirmModal.tsx
git commit -m "feat(sp4d): DiscardConfirmModal"
```

---

## Task 26: ActiveSession route — strength + cardio assembly

**Files:**
- Create: `app/(tabs)/move/active.tsx`

- [ ] **Step 1:** Create the route:

```tsx
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Stack } from 'expo-router';

import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
import { SessionHeader } from '@/components/active-session/SessionHeader';
import { RestBanner } from '@/components/active-session/RestBanner';
import { ExerciseCard } from '@/components/active-session/ExerciseCard';
import { UpNextRow } from '@/components/active-session/UpNextRow';
import { CardioBody } from '@/components/active-session/CardioBody';
import { DiscardConfirmModal } from '@/components/active-session/DiscardConfirmModal';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function ActiveSession() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const phase = useActiveSessionStore((s) => s.phase);
  const mode = useActiveSessionStore((s) => s.mode);
  const exercises = useActiveSessionStore((s) => s.exercises);
  const currentExerciseIdx = useActiveSessionStore((s) => s.currentExerciseIdx);
  const setDrafts = useActiveSessionStore((s) => s.setDrafts);
  const discardSession = useActiveSessionStore((s) => s.discardSession);

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const currentExercise = exercises[currentExerciseIdx];
  const nextExercise = exercises[currentExerciseIdx + 1];

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <SessionHeader onBack={() => setConfirmingDiscard(true)} />

      {mode === 'strength' && <RestBanner />}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 80 }}>
        {phase !== 'idle' && currentExercise && mode === 'strength' && (
          <>
            <ExerciseCard exerciseIdx={currentExerciseIdx} exercise={currentExercise} />
            {nextExercise && <UpNextRow exercise={nextExercise} />}
          </>
        )}
        {phase !== 'idle' && mode === 'cardio' && <CardioBody />}
      </ScrollView>

      <DiscardConfirmModal
        visible={confirmingDiscard}
        loggedSetCount={setDrafts.length}
        onCancel={() => setConfirmingDiscard(false)}
        onConfirm={async () => {
          setConfirmingDiscard(false);
          await discardSession();
        }}
      />
    </View>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Commit.

```bash
git add app/(tabs)/move/active.tsx
git commit -m "feat(sp4d): ActiveSession route with strength + cardio branches"
```

---

## Task 27: `PostWorkout` stub route

**Files:**
- Create: `app/(tabs)/move/post.tsx`

- [ ] **Step 1:** Create the route:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getSession, type SessionFull } from '@/lib/db/queries/sessions';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration } from '@/lib/workouts/cardio-aggregate';

export default function PostWorkout() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const [session, setSession] = useState<SessionFull | null>(null);

  useEffect(() => {
    const id = Number(sessionId);
    if (!Number.isFinite(id)) return;
    getSession(db, id).then(setSession);
  }, [sessionId]);

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg, padding: 24, gap: 18 }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{ marginTop: 60, gap: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: palette.move, letterSpacing: 1.2 }}>
          ✓ COMPLETE
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '700', color: palette.ink }}>
          {session?.routineNameSnapshot ?? 'Saved'}
        </Text>
      </View>

      {session && (
        <View style={{ gap: 8, marginTop: 12 }}>
          <Row label="Session" value={`#${session.id}`} palette={palette} />
          <Row label="Sets" value={String(session.sets.length)} palette={palette} />
          <Row label="Total volume" value={`${Math.round(session.totalVolumeKg)} kg`} palette={palette} />
          <Row label="Duration" value={formatDuration(session.durationSeconds)} palette={palette} />
          <Row label="PRs" value={String(session.prCount)} palette={palette} />
        </View>
      )}

      <View style={{ flex: 1 }} />

      <Pressable
        onPress={() => router.replace('/(tabs)/move')}
        style={{ padding: 16, borderRadius: 12, backgroundColor: palette.move, alignItems: 'center' }}
      >
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Done</Text>
      </Pressable>
    </View>
  );
}

function Row({ label, value, palette }: { label: string; value: string; palette: typeof colors.light }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 14 }}>{label}</Text>
      <Text style={{ color: palette.ink, fontSize: 14, fontWeight: '600' }}>{value}</Text>
    </View>
  );
}
```

- [ ] **Step 2:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean. If `colors.light` isn't a valid type reference, replace `palette: typeof colors.light` with `palette: ReturnType<typeof useTheme>['palette']` or simply pass the relevant fields explicitly.

- [ ] **Step 3:** Commit.

```bash
git add app/(tabs)/move/post.tsx
git commit -m "feat(sp4d): PostWorkout stub route"
```

---

## Task 28: Resume hook in `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1:** Open `app/_layout.tsx`. Update the `Boot` component to add a one-shot resume check after the onboarding redirect logic. The full `Boot` becomes:

```tsx
function Boot({ children }: { children: React.ReactNode }) {
  const { success, error } = useDbMigrations();
  const router = useRouter();
  const segments = useSegments();
  const resumeChecked = React.useRef(false);

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      const done = await isOnboardingComplete(db);
      if (cancelled) return;
      const inOnboarding = segments[0] === 'onboarding';
      if (!done && !inOnboarding) {
        router.replace('/onboarding');
        return;
      }
      if (done && inOnboarding) {
        router.replace('/(tabs)/today');
        return;
      }

      // One-shot resume: if there's an open draft session, push the active route.
      if (!resumeChecked.current && done) {
        resumeChecked.current = true;
        try {
          const draft = await getOpenDraft(db);
          if (cancelled) return;
          if (draft) {
            await useActiveSessionStore.getState().hydrateFromDraft(draft);
            router.push('/(tabs)/move/active');
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Resume check failed:', e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, segments, router]);

  if (error) {
    throw error;
  }
  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 2:** Add the new imports at the top of the file (alongside the existing imports):

```tsx
import React, { useEffect } from 'react';   // add React if not already there for useRef
import { getOpenDraft } from '@/lib/db/queries/sessions';
import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
```

- [ ] **Step 3:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4:** Run all tests.

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5:** Commit.

```bash
git add app/_layout.tsx
git commit -m "feat(sp4d): one-shot resume hook in Boot"
```

---

## Task 29: Wire PreWorkout taps to start sessions

Move the routine card tap from "edit" to "start session", and add an "Edit" entry to the action sheet. Same change for the cardio row.

**Files:**
- Modify: `components/workouts/RoutineActionSheet.tsx`
- Modify: `app/(tabs)/move/index.tsx`

- [ ] **Step 1:** Update `components/workouts/RoutineActionSheet.tsx` to add an `onEdit` prop and Row:

```tsx
import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RoutineActionSheet({
  visible, onClose, onEdit, onDuplicate, onRename, onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
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
        <Row label="Edit" onPress={onEdit} />
        <Row label="Duplicate" onPress={onDuplicate} />
        <Row label="Rename" onPress={onRename} />
        <Row label="Delete" onPress={onDelete} danger />
        <Row label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2:** Update `app/(tabs)/move/index.tsx`. Add a `startActive` helper that calls the store and navigates, and rewire the tap handlers. Find the `RoutineCard` JSX (around line 56) and the `CardioRow` JSX (around line 70). Update the `RoutineActionSheet` JSX to wire `onEdit`. The relevant changes:

Add at the top, with the existing imports:

```tsx
import { useActiveSessionStore } from '@/lib/state/activeSessionStore';
```

Add inside the component, after the `actions` declaration:

```tsx
const startSession = useActiveSessionStore((s) => s.startSession);
const startActive = async (routineId: number) => {
  try {
    await startSession(routineId);
    router.push('/(tabs)/move/active');
  } catch (e) {
    // The most likely error is DraftAlreadyOpenError — meaning the resume hook didn't fire / the user
    // navigated here while a draft is open. Push to active to let them resume.
    if (e instanceof Error && e.name === 'DraftAlreadyOpenError') {
      router.push('/(tabs)/move/active');
    } else {
      // eslint-disable-next-line no-console
      console.warn('startSession failed:', e);
    }
  }
};
```

Change the `RoutineCard` `onPress` from `router.push(... edit)` to `startActive(r.id)`:

```tsx
<RoutineCard
  key={r.id}
  routine={r}
  onPress={() => startActive(r.id)}
  onLongPress={() => setActionTarget(r)}
/>
```

Change the `CardioRow` `onPress` from the no-op stub to `startActive(r.id)`:

```tsx
<CardioRow
  key={r.id}
  routine={r}
  onPress={() => startActive(r.id)}
/>
```

Wire the `onEdit` row in the action sheet. Update the `<RoutineActionSheet ...>` JSX:

```tsx
<RoutineActionSheet
  visible={actionTarget !== null}
  onClose={() => setActionTarget(null)}
  onEdit={() => {
    if (actionTarget) {
      router.push({ pathname: '/(tabs)/move/[routineId]/edit', params: { routineId: String(actionTarget.id) } });
    }
  }}
  onDuplicate={async () => {
    if (actionTarget) {
      await actions.duplicate(actionTarget.id);
      await refresh();
    }
  }}
  onRename={() => { setRenameTarget(actionTarget); setActionTarget(null); }}
  onDelete={async () => {
    if (actionTarget) {
      await actions.delete(actionTarget.id, actionTarget.name);
      await refresh();
    }
  }}
/>
```

- [ ] **Step 3:** Type-check.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 4:** Commit.

```bash
git add components/workouts/RoutineActionSheet.tsx app/(tabs)/move/index.tsx
git commit -m "feat(sp4d): PreWorkout taps start sessions; Edit moves to action sheet"
```

---

## Task 30: End-to-end smoke + manual verification

This task has no code; it's the verification gate that closes 4d.

**Verification surface:** iPhone via the EAS dev client built in 4b. Web target is acceptable for steps 1–6 (the data + state-machine smoke); HR + draft-resume-across-app-kill require the device. If iPhone dev-client install is still pending, document that here and treat 4d as "code complete; iPhone verification carried."

- [ ] **Step 1:** Run the full test suite.

```bash
npm test
```

Expected: all PASS. Note the test count for the commit message.

- [ ] **Step 2:** Run typecheck.

```bash
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 3:** Start the app on web (Windows-friendly path).

```bash
npm run web
```

Walk through the **strength smoke** (spec §1):
1. Open Workouts (Move) tab → see seeded routines.
2. Tap a strength routine card → ActiveSession opens, draft row created in DB, header timer ticks.
3. Log set 1 (enter weight + reps, tap Complete set) → SetCard collapses to "done"; rest banner counts down.
4. Tap "+30s" → display jumps. Tap Skip → banner hides.
5. Log set 2 with a higher weight than the prior PR (PRs start empty, so any logged set badges) → PR badge fires inline on that set.
6. Tap a previously-done set → SetEditSheet → change reps → Save → set updates; in-flight badge recomputes.
7. Tap "..." on the active exercise → Skip → next exercise becomes active.
8. Tap Finish → spinner → PostWorkout stub renders with totals → tap Done → returns to PreWorkout.

- [ ] **Step 4:** Walk through the **cardio smoke** (web is fine):
1. From PreWorkout, tap a Cardio row.
2. Active Session opens with `<CardioBody />`; live elapsed clock ticks up.
3. Type a distance value (e.g. 3.5) → blur → distance is persisted to the draft.
4. Tap Finish → PostWorkout stub shows the cardio session.

- [ ] **Step 5:** Walk through the **discard smoke** (web is fine):
1. Start a session, log 2 sets.
2. Tap the back arrow on the header → DiscardConfirmModal appears with "You'll lose 2 logged sets."
3. Tap Discard → returns to PreWorkout; the routine card's last-done is unchanged.
4. Verify in DB (e.g. `tsx scripts/smoke-sp4a.ts` printout, or open the SQLite file) that no draft sessions remain.

- [ ] **Step 6:** Walk through the **resume smoke** (web is OK; iPhone preferred):
1. Start a session, log 2 sets.
2. Reload the web page (or kill the iOS app from the app switcher).
3. App boots → resume hook runs → lands directly on Active Session with both sets present and the elapsed timer continuing from `startedAt`.

- [ ] **Step 7:** **iPhone-only:** verify the **HR chip**.
1. Wear the Apple Watch.
2. Start a strength session on the iPhone via the dev client.
3. HR chip appears in the active exercise card with current bpm.
4. Remove the watch / wait 30s → chip disappears silently.

If iPhone is not available right now, skip step 7 and document it as "iPhone HR verification deferred until 4b dev-client install is exercised."

- [ ] **Step 8:** Update the meta-spec status. Open `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md`. Find §3 row 4d and §3 sub-slice status section. Mark 4d complete (check ✅) with the test count, the iPhone-verification deferral note (if applicable), and the date 2026-04-25. Mirror the format used for 4a/4b/4c.

- [ ] **Step 9:** Commit the meta-spec update.

```bash
git add docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md
git commit -m "docs(sp4d): mark slice 4d complete in meta spec"
```

- [ ] **Step 10:** Optional but recommended: run `superpowers:requesting-code-review` against the SP4d diff (every commit since the spec) and address any blocking findings.

---

## Plan self-review summary

**Spec coverage** (each spec section → task):
- §1 What ships: smoke tests in Task 30; routes/screens in Tasks 26–28.
- §2 Locked decisions: #1 PR snapshot → Tasks 12, 14; #2 persistence → Tasks 1–10; #3 rest timer → Tasks 11, 16, 22; #4 cardio variant → Tasks 13, 24, 26; #5 Zustand → Task 14; #6/7 cuts → no task needed; #8 add set → Task 15 (`addSetToCurrent`); #9 edit set → Tasks 19, 20; #10 skip exercise → Tasks 15, 20; #11 discard → Tasks 25, 26; #12 resume → Task 28; #13 HR display → Task 17; #14 one-draft → Tasks 1, 3; #15 delete set → Tasks 5, 19, 20.
- §3 Schema delta: Task 1.
- §4 Query module changes: Tasks 2–7, 8.
- §5 Architecture (file map, data flow): Tasks 17–28.
- §6 Zustand store shape: Tasks 14–16.
- §7 Rest timer state machine: Task 11.
- §8 PR detection in-flight: Task 12.
- §9 Cardio variant: Tasks 13, 24, 26.
- §10 Live HR: Task 17.
- §11 TDD scope: Tasks 2–13 (TDD'd modules).
- §12 Error handling: Task 14 (`finishSession` re-enables on throw); Task 15 (optimistic UI on `upsertDraftSet` throw); Task 28 (resume catches `getOpenDraft` throw); Task 29 (DraftAlreadyOpenError handled).
- §13 Scope cuts: nothing to do.
- §14 What this spec is NOT: handed off to plan; no task.

**Placeholder scan:** No "TBD"/"TODO" comments. The migration filename uses `<generated>` which is the existing project convention (matches SP4c plan).

**Type consistency:** `SessionSetDraft` shape matches across `lib/db/queries/sessions.ts` (Task 2), the store (Task 14), and the components (Tasks 18–20, 24). `PRSnapshot` is `Map<string, { weightKg: number; reps: number }>` everywhere. `RestTimerState` and `RestTimerEvent` types are exported from `lib/workouts/rest-timer.ts` (Task 11) and consumed by the store (Task 16) and `RestBanner` (Task 22) without re-declaration. `ExerciseInSession` is exported from the store (Task 14) and consumed by `ExerciseCard` (Task 20) and `UpNextRow` (Task 21).

**Bite-size:** all tasks are 5 minutes to ~30 minutes of work; the largest (Task 6 finalizeSession) is justified by the unit's atomic nature.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-25-sp4d-active-session-plan.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
