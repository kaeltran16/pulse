# SP4c — Routine browse + edit (Design)

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-25-ios-v2-workouts-design.md`](./meta/2026-04-25-ios-v2-workouts-design.md) §3 row 4c
**Scope:** Three screens — PreWorkout (routine list), RoutineEditor (full edit), ExerciseLibrary (browse + picker). Persists everything 4d/4e will consume. No session execution; no AI generation; no HealthKit.

---

## 1. What ships

- **PreWorkout** at `/(tabs)/move` — landing for the Move tab (the workouts tab in this codebase). Lists all strength routines as cards and cardio routines as rows. Entry points: tap routine → editor; long-press → action sheet (Duplicate / Rename / Delete); "+ New" → empty routine; "Browse exercise library" → library; "Generate routine with AI" → stub for 4f.
- **RoutineEditor** at `/(tabs)/move/[routineId]/edit` — strength-routine editor only. Edits name, tag, ordered exercises, ordered sets per exercise, per-exercise rest, three session settings. Save commits a transactional diff. Cancel discards (with confirm if dirty). Footer "Delete routine" with confirm.
- **ExerciseLibrary** at `/(tabs)/move/library` — dual-mode. **Browse mode** (default) shows the seeded catalog, filterable by group, tap → exercise detail (description + muscles, no actions). **Picker mode** (`?pick=1`) tap → write to editor draft → `router.back()`.

### Smoke test (per SP4 meta §3 row 4c)

1. Open Workouts tab → seeded routines from 4a render.
2. Tap "+ New" → empty editor.
3. "Add exercise from library" → picker opens → tap → returns to editor with the exercise added.
4. Tap a set chip → SetEditSheet → change weight → chip updates.
5. Tap an exercise row → ExerciseSettingsSheet → set rest = 90s.
6. Toggle warm-up reminder + auto-progress.
7. Save → list updates with the new routine.
8. Long-press routine → Duplicate → see "X copy" appear.
9. Long-press → Delete → confirm → row gone.
10. Reopen the duplicate → all fields persisted.

Verification surface in 4c: web target (Drizzle + RN web). iPhone via 4b's dev client is a bonus, not blocking.

---

## 2. Locked decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Editor scope | Full: edit, new empty, duplicate, rename, delete | User pick. Library editor surface stays minimal (browser only). |
| 2 | Routine ↔ session coupling | Edit-in-place; history immutable via `session_sets` snapshots | Schema already snapshots per-set exercise/weight/reps in `session_sets`; `sessions.routine_name_snapshot` already records the name. `sessions.routine_id` already `ON DELETE SET NULL`. No migration for delete cascade. |
| 3 | ExerciseLibrary role | Browse + picker; no per-exercise history tab | History view belongs to 4e. |
| 4 | Set row UX | Per-set chips (`60×8`) + "+ set" affordance + tap to edit | Matches design handoff. |
| 5 | Session settings | All three from handoff fully implemented | User pick (over recommended "rest only"). |
| 6 | Rest timer default | Per-exercise rest with routine-level fallback | `routine_exercises.rest_seconds` already exists in 4a's schema; routine-level default is the new column. |
| 7 | Warm-up reminder | Boolean persisted in 4c; banner rendered in 4d | One-line consumption in the next sub-project. |
| 8 | Auto-progress weights | Boolean per routine; **+2.5 kg uniform** when all prescribed sets at prescribed reps were hit; math in 4e | Classic linear progression. |
| 9 | Cardio editor | Cardio routines listed but **not editable** in 4c | Handoff doesn't show a cardio editor. v3+. |
| 10 | Architecture | Approach 3 — Zustand store for editor draft state | User pick. Resolves SP4 meta §7 deferred "global state" item: **Zustand becomes the project's chosen tool**, reused in 4d for active session state. |
| 11 | Tag pills | Strength editor allows Upper / Lower / Full / Custom; Cardio is disabled (cardio routines aren't editable) | Per #9. |

---

## 3. Schema delta

One migration. All other workout tables ship as-is from 4a.

**Next migration** (Drizzle picks the name; the plan runs `drizzle-kit generate`. Existing migrations stop at `0001_perpetual_tempest.sql`, so the new file will be `lib/db/migrations/0002_<generated>.sql`.) — adds three columns to `routines`:

```sql
ALTER TABLE routines ADD COLUMN rest_default_seconds INTEGER NOT NULL DEFAULT 120;
ALTER TABLE routines ADD COLUMN warmup_reminder INTEGER NOT NULL DEFAULT 0;
ALTER TABLE routines ADD COLUMN auto_progress INTEGER NOT NULL DEFAULT 0;
```

`schema.ts` adds the matching columns to `routines`:
```ts
restDefaultSeconds: integer('rest_default_seconds').notNull().default(120),
warmupReminder: integer('warmup_reminder', { mode: 'boolean' }).notNull().default(false),
autoProgress: integer('auto_progress', { mode: 'boolean' }).notNull().default(false),
```

The 4a seed (`lib/db/seed-workouts.ts`) is updated to set sensible defaults on each seeded routine (e.g. `restDefaultSeconds: 120`, `warmupReminder: false`, `autoProgress: false`). The seeder is idempotent per its 4a contract — re-running on an upgraded DB updates seeded rows.

No other schema changes. No table renames. No column removals.

---

## 4. Architecture

### Routes (Expo Router file structure)

```
app/(tabs)/move/
  index.tsx                  // PreWorkout
  [routineId]/
    edit.tsx                 // RoutineEditor
  library.tsx                // ExerciseLibrary (browse + picker)
  generate.tsx               // Stub for 4f
```

`(tabs)/move/_layout.tsx` is a `Stack` so editor and library push above the tab.

### State

**`lib/state/editorStore.ts`** — Zustand store with one slice:

```ts
type DraftSet = {
  id: number | null;          // null for new sets not yet saved
  position: number;
  targetReps: number | null;
  targetWeightKg: number | null;
  targetDurationSeconds: number | null;
  targetDistanceKm: number | null;
};
type DraftExercise = {
  id: number | null;          // routine_exercise id; null for new
  exerciseId: string;
  position: number;
  restSeconds: number | null;  // null = use routine default
  sets: DraftSet[];
};
type Draft = {
  routineId: number;
  name: string;
  tag: 'Upper' | 'Lower' | 'Full' | 'Cardio' | 'Custom';
  color: string;
  position: number;
  restDefaultSeconds: number;
  warmupReminder: boolean;
  autoProgress: boolean;
  exercises: DraftExercise[];
};

type EditorState = {
  draft: Draft | null;
  isDirty: boolean;
  loadDraft: (r: HydratedRoutine) => void;
  clearDraft: () => void;
  setName: (n: string) => void;
  setTag: (t: Draft['tag']) => void;
  setRestDefault: (s: number) => void;
  setWarmupReminder: (b: boolean) => void;
  setAutoProgress: (b: boolean) => void;
  addExercise: (exerciseId: string) => void;
  removeExercise: (index: number) => void;
  reorderExercises: (from: number, to: number) => void;
  setExerciseRest: (index: number, restSeconds: number | null) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  updateSet: (exerciseIndex: number, setIndex: number, patch: Partial<DraftSet>) => void;
  reorderSets: (exerciseIndex: number, from: number, to: number) => void;
};
```

Every mutator sets `isDirty = true`. `loadDraft` and `clearDraft` set `isDirty = false`.

### Queries

**`lib/db/queries/routines.ts`** — extends 4a's `routines.ts`:

```ts
export async function listRoutines(db): Promise<Routine[]>;          // already in 4a
export async function getRoutine(db, id: number): Promise<HydratedRoutine | null>;  // joined with exercises + sets
export async function createEmptyRoutine(db, init: { name: string; tag: string }): Promise<number>;
export async function updateRoutine(db, draft: Draft): Promise<void>;
export async function duplicateRoutine(db, sourceId: number): Promise<number>;
export async function deleteRoutine(db, id: number): Promise<void>;
```

`HydratedRoutine` is the row plus its ordered `exercises[]` (each with its ordered `sets[]`), built from a single transaction with three SELECTs.

`updateRoutine` runs in one Drizzle transaction:
1. Update `routines` row.
2. Compute the diff against the persisted state (loaded fresh inside the txn). Delete removed `routine_exercises` and `routine_sets`. Insert new ones (ids = null). Update mutated rows.
3. Renumber `position` densely (0, 1, 2, …) for both exercises and sets.

`duplicateRoutine` runs in one transaction: insert routines row → fetch source's exercises → insert clones with new ids → for each new exercise, insert clones of its sets. Name suffix logic: if source name ends in ` copy` or ` copy N`, increment N; else append ` copy`.

### Components

```
components/move/
  RoutineCard.tsx            // strength routine in PreWorkout
  CardioRow.tsx              // cardio routine in PreWorkout
  ExerciseRow.tsx            // exercise in RoutineEditor (with set chips)
  SetChip.tsx                // single set chip
  ExerciseSettingsSheet.tsx  // bottom sheet, per-exercise rest
  SetEditSheet.tsx           // bottom sheet, set reps + weight
  RenameRoutineSheet.tsx     // bottom sheet, name input
  RoutineActionSheet.tsx     // long-press menu: Duplicate / Rename / Delete
  TagPills.tsx               // shared selector
```

Bottom sheets reuse the existing project pattern: RN's built-in `<Modal animationType="slide" transparent>` with a manual backdrop, as already used by `components/PalComposer.tsx`. No new sheet library. Confirmation prompts use RN's `Alert.alert`.

### Long-press / action sheet

Web target uses a tap-and-hold menu (CSS `touch-action: none` + a synthetic long-press hook). iOS uses `ActionSheetIOS`. Implementation lives behind a single `useRoutineActions(routineId)` hook so screens don't branch on platform.

---

## 5. Data flow

**Hydrate editor:**
1. Route mounts with `routineId`. Component reads `getRoutine(db, routineId)` once (non-live).
2. If null → "Routine not found" empty state.
3. `editorStore.loadDraft(routine)`. Component renders bound to `draft`.

**Edit:** every interaction calls a typed action. `isDirty` flips true on first mutation.

**Save:** `updateRoutine(db, draft)` (single transaction). On success, `clearDraft()` and `router.back()`. PreWorkout's `useLiveQuery` re-renders.

**Cancel:** `isDirty` ? `Alert.alert("Discard changes?", …)` then `clearDraft()` + back : back directly.

**Picker round-trip:** editor → `router.push('/move/library?pick=1')` → tap exercise → `editorStore.addExercise(exerciseId)` → `router.back()`.

**Create:** PreWorkout "+ New" → `createEmptyRoutine(db, { name: 'New routine', tag: 'Custom' })` → returns id → `router.push('/move/{id}/edit')`.

**Duplicate:** action sheet → `duplicateRoutine(db, id)` → list re-renders.

**Delete:** action sheet → `Alert.alert` confirm → `deleteRoutine(db, id)` → cascade applies, sessions retain `routine_name_snapshot` and `routine_id = NULL`.

---

## 6. Error handling

**Client-side validation (Save disabled until satisfied):**
- Routine name: non-empty after trim.
- Each set: `targetReps >= 1`. `targetWeightKg` may be null or `>= 0`.
- Per-exercise rest: blank or `>= 0`.
- Routine rest default: `>= 0`. Default 120 if blank.
- Empty routine (zero exercises) **is allowed** to save. (4d's "Start" is disabled for empty routines.)

**DB errors:** wrap every write in `try/catch`. Failure → toast "Couldn't save changes" + leave draft intact. `getRoutine` returning null → "Routine not found" empty state with Back.

**Concurrent state:** single-device, single-window. No multi-editor handling.

**Picker invariant:** if no draft is loaded when picker tap fires, no-op + back. Picker is treated as undefined behavior outside the editor flow.

**Async indication:** SQLite is fast enough that no spinner is shown on Save. If Save takes >300 ms in the wild, add `ActivityIndicator` to the Save button.

---

## 7. Testing

Per SP4 meta §3 row 4c, **TDD applies to: None (UI screens; visual verification).** Two non-UI surfaces are TDD'd anyway because they're pure logic:

**`lib/db/queries/routines.test.ts`** (in-memory SQLite, same harness as 4a):
- `getRoutine` returns null for missing id; for a real id returns hydrated routine with ordered exercises and sets.
- `createEmptyRoutine` produces a row with sane defaults; visible in `listRoutines`.
- `updateRoutine` diff: removes deleted exercises and sets; adds new ones; updates mutated rows; renumbers positions densely (0, 1, 2 …).
- `updateRoutine` is transactional: failure mid-update leaves the persisted state unchanged (simulate by passing a malformed draft and asserting nothing changed).
- `duplicateRoutine` clones routine + exercises + sets with new ids; source unchanged.
- Duplicate naming: `"Push A"` → `"Push A copy"`; `"Push A copy"` → `"Push A copy 2"`; `"Push A copy 2"` → `"Push A copy 3"`.
- `deleteRoutine` cascades routine_sets → routine_exercises → routine; existing sessions for that routine survive with `routine_id = NULL` and `routine_name_snapshot` intact.

**`lib/state/editorStore.test.ts`** (Zustand store under Vitest):
- `loadDraft` populates from a hydrated routine; `isDirty = false`.
- Mutations flip `isDirty = true` and produce expected shape: `addExercise`, `removeExercise`, `reorderExercises` (boundaries: from=0, from=last, no-op when from===to), `addSet`, `removeSet`, `updateSet`, `reorderSets`, `setExerciseRest` (null and number), `setName`, `setTag`, `setRestDefault`, `setWarmupReminder`, `setAutoProgress`.
- `clearDraft` clears draft and resets `isDirty`.

No tests for: UI components, navigation, sheet animations, long-press timing, action sheet content.

---

## 8. Out of scope (cut from 4c)

| Item | Reason |
|---|---|
| Cardio routine editing | Per §2 #9. v3+. |
| AI routine generation | 4f. 4c only renders a stub entry. |
| Custom (user-defined) exercises | Per SP4 meta §6. v3+. |
| Per-exercise warm-up sets | Not in handoff. v3+. |
| Per-exercise auto-progress increment | Per §2 #8 — uniform +2.5 kg in v2. |
| Reordering routines on PreWorkout | Out of handoff. Routines render in `position` order from 4a's seed. |
| Drag-and-drop reordering on web | RN drag libs are tricky on web. Use ↑/↓ buttons on the exercise row for web; native drag handle on iOS via `react-native-draggable-flatlist` (existing project dep if present, otherwise added). |
| Routine color picker | `routines.color` exists but isn't user-editable in the handoff; 4a's seed sets it. |
| History tab on exercise detail | Per §2 #3 — belongs to 4e. |
| Workout templates / favorites | Not in scope. |

---

## 9. Open questions resolved here

From SP4 meta §7:
- ✅ **Rest timer defaults:** per-exercise rest with routine-level fallback (§2 #6).
- ✅ **Routine progression rule:** linear +2.5 kg uniform when all prescribed sets at prescribed reps were hit; toggle in 4c, math in 4e (§2 #8).
- ⏳ **PR scope at session start:** still 4d's call.

From parent meta §7 deferrals:
- ✅ **Global state store:** Zustand, picked here (§2 #10).

---

## 10. What this spec is NOT

- Not a plan. The next step is invoking `superpowers:writing-plans` after user approval.
- Not a UI design doc — the design handoff in `design_handoff/src/workout-screens.jsx` and `workout-screens2.jsx` is authoritative for visuals.
- Not a session-execution spec. 4d covers Active Session.
