# SP4d — Active Session (Design)

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-25-ios-v2-workouts-design.md`](./meta/2026-04-25-ios-v2-workouts-design.md) §3 row 4d
**Scope:** The Active Session screen — strength variant per `design_handoff/src/workout-screens.jsx` and a cardio variant (no handoff mockup; designed here). Includes draft persistence, rest timer state machine, in-flight PR detection, and a placeholder PostWorkout screen sufficient to close the navigation contract. Does **not** include the real PostWorkout summary, HealthKit workout writes, AI generation, or Live Activities — those belong to 4e/4f/4g.

---

## 1. What ships

- **ActiveSession** at `/(tabs)/move/active` — full-screen route reached from PreWorkout (4c) when a routine is started, or auto-routed on launch when a draft session exists.
- **PostWorkout stub** at `/(tabs)/move/post?sessionId=N` — minimal summary ("Session #N saved — N sets, N kg, N PR(s)") with a Done button popping back to `/move`. Replaced wholesale in 4e.
- **Rest timer** as a pure-function state machine consumed by ActiveSession.
- **Draft persistence**: every Complete-set or Edit-set writes through to the DB; the session row carries a new `status: 'draft' | 'completed'` column. Discard cleans up.
- **Resume on launch**: `app/_layout.tsx` checks for an open draft after migrations + seed and pushes `/move/active` if one exists. No "Resume?" modal — be back where you were.
- **Live HR chip**: subscribes to 4b's `useLiveHeartRate`, shown when a sample exists and is ≤30s old. Hidden silently otherwise.

### Smoke test (per SP4 meta §3 row 4d, with 4d-spec specifics)

1. From PreWorkout (4c), tap a strength routine → Active Session opens, draft row created, elapsed timer ticks.
2. Log set 1 → set card collapses to "done" → rest banner counts down from `routine.rest_default_seconds`.
3. Tap "+30s" → display jumps by 30s. Tap Skip → banner hides.
4. Log set 2 with weight×reps that beats the prior PR → PR badge fires inline on that set's card.
5. Tap a previously-done set → SetEditSheet → change reps → Save → set card updates; in-flight badges recompute.
6. Tap "..." on the active exercise → Skip → next exercise becomes active.
7. With Apple Watch worn, the HR chip appears in the active card; remove the watch / wait 30s → chip disappears.
8. Tap Finish → spinner → PostWorkout stub renders with correct totals → Done returns to PreWorkout.
9. **Cardio variant:** start the treadmill routine → live elapsed clock ticks up → enter distance 3.5 km → Finish → stub shows duration + distance.
10. **Resume variant:** start a session, log 2 sets, kill the app from the iOS app switcher, reopen → land directly on Active Session with both sets present and the elapsed timer showing wall-clock since `startedAt`.
11. **Discard:** mid-session, tap Back on the header → confirm modal → Discard → draft row is deleted; PreWorkout shows no session pending.

**Verification surface:** iPhone via the dev client built in 4b — 4d is the slice that pays back the deferred 4b/4c iPhone verification cost. Web target is acceptable for the math + state-machine smoke; HR + draft persistence-across-app-kill require the device.

---

## 2. Locked decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | PR scope mid-session | Snapshot at session start; every set beating the snapshot badges | Matches what `detectSessionPRs` already persists at finish (every beating set has `isPr=1`). In-flight UX matches saved truth. Tells a fuller story than "only the best one counts." |
| 2 | Persistence model | New `sessions.status` column; per-set draft writes through; finalize is a transactional promote | Real failure mode is iOS background-kill, not crash. Losing a 45-min logged workout is "delete the app" tier. Cheap insurance: each set is ~50 bytes; one upsert per Complete-set tap. |
| 3 | Rest timer | Auto-start on Complete-set with `routine.rest_default_seconds`; +30s and Skip; **no notification, no haptic**; banner does not auto-dismiss at zero | YAGNI cut. Notification was tempting but adds an `expo-notifications` permission flow; user opted minimal. |
| 4 | Cardio variant | Shared `SessionHeader` + `Finish` chrome; `<CardioBody />` replaces ExerciseCard / RestBanner / UpNext for cardio routines; **single exercise per cardio routine in v2** | All seeded cardio routines are already single-exercise. Avoids forcing a multi-set list onto a one-set activity. |
| 5 | State store | Zustand at `lib/state/activeSessionStore.ts` | Matches 4c's `lib/state/editorStore.ts` (Zustand). Parent meta-spec §7 explicitly greenlit picking it here. |
| 6 | Mid-session add new exercise | **Cut** | Routines are the unit. Edit the routine before next time. v3+ if requested. |
| 7 | Mid-session reorder | **Cut** | YAGNI. |
| 8 | Mid-session add set | **Yes** — handoff already shows the dashed "+ Add set" CTA | Trivial; common need (one extra rep, log the bonus). |
| 9 | Mid-session edit completed set | **Yes** — tap done set → SetEditSheet | Mistypes happen; cheaper to fix in-session than via WorkoutDetail post-hoc. |
| 10 | Mid-session skip exercise | **Yes** — "..." menu → Skip; skipped exercise just has no logged sets | Real gym scenario (machine busy). No schema change. |
| 11 | Discard (back button) | Confirm modal: "Discard this workout? You'll lose N logged sets." → cascade-delete the draft session row + its `session_sets` | Destructive, must confirm. Single-tap-back on the header is the trigger. |
| 12 | Background → resume | Auto-route to `/move/active` on launch when an open draft exists; no "Resume?" prompt | The draft *is* the resume. The user knows they were mid-workout. |
| 13 | Live HR display | Show `LiveHRChip` when `useLiveHeartRate().current` exists and `sampledAt ≥ now − 30s`; render `null` otherwise (no placeholder) | Watch worn = chip; watch off = chip gone. Zero UI knobs. |
| 14 | At most one open draft | Enforced by partial unique index `WHERE status='draft'` AND by `startDraftSession` throwing | Belt-and-braces. Single-device, single-active-workout. |
| 15 | Delete a completed set | **Yes** — `SetEditSheet` has a destructive "Remove set" action (no confirm) | The "Add set" affordance creates accidental extra rows; needs an inverse. No-confirm because an accidental delete is recoverable in seconds (re-add and re-enter). |

---

## 3. Schema delta

Migration `0003_<generated>` (Drizzle picks the suffix). All other workout tables ship as-is from 4a/4c.

**Changes to `sessions`:**

```sql
ALTER TABLE sessions ADD COLUMN status TEXT NOT NULL DEFAULT 'completed';
-- Drizzle re-emits the table to relax NOT NULL on finished_at:
--   finished_at INTEGER  (was: INTEGER NOT NULL)
CREATE UNIQUE INDEX idx_sessions_one_draft ON sessions (status) WHERE status = 'draft';
```

- `status` ∈ `'draft' | 'completed'`. Default `'completed'` so existing rows backfill correctly.
- `finished_at` becomes nullable; only set on finalize. `duration_seconds`, `total_volume_kg`, `pr_count` stay NOT NULL with default 0; meaningful only when `status='completed'`.
- Partial unique index enforces at-most-one open draft. SQLite supports partial indexes natively; Drizzle ≥0.30 emits them via `.where()` on the index builder.

**No schema changes** to `session_sets`, `prs`, `routines`, `routine_exercises`, `routine_sets`, `exercises`, or `movement_entries`.

---

## 4. Query module changes (`lib/db/queries/sessions.ts`)

The existing `insertCompletedSession` is replaced by a five-function lifecycle. The exported types (`CompletedSessionDraft`, `CompletedSessionResult`, `SessionSummary`, `SessionFull`) stay; one new type joins.

| Function | Signature | Behavior |
|---|---|---|
| `getOpenDraft(db)` | `→ Promise<DraftSession \| null>` | Reads the lone `status='draft'` row, joins `session_sets`. Returns hydrated draft for `hydrateFromDraft`. |
| `startDraftSession(db, args)` | `args: { routineId, routineNameSnapshot, startedAt } → Promise<{ sessionId }>` | Inserts session row with `status='draft'`, `finishedAt=null`. Throws `DraftAlreadyOpenError` if the partial index trips. |
| `upsertDraftSet(db, sessionId, setDraft)` | `setDraft: SessionSetDraft → Promise<void>` | Insert-or-replace `session_sets` keyed by `(sessionId, exercisePosition, setPosition)`. Used for both Complete-set and Edit-set. `isPr` always written as 0 — set at finalize. |
| `discardDraftSession(db, sessionId)` | `→ Promise<void>` | Cascade-delete the draft session + its `session_sets`. |
| `finalizeSession(db, sessionId, finishedAt)` | `→ Promise<CompletedSessionResult>` | Atomic transaction: load `session_sets`; build a fresh PR snapshot for the exercises in the session; recompute `totalVolumeKg` (existing `computeStrengthVolume`), per-set `isPr` and `newPRs` (existing `detectSessionPRs`); UPDATE the sessions row (`status='completed'`, `finishedAt`, `durationSeconds`, `totalVolumeKg`, `prCount`); UPDATE per-set `isPr` flags; UPSERT `prs` table; INSERT into `movement_entries` (kind=`workout`, minutes, note=routineNameSnapshot, occurredAt=finishedAt). Returns `{ sessionId, prCount, totalVolumeKg }`. |

**Callers that need a one-line change** (filter to completed):
- `listSessions(db, args)` — add `where(eq(sessions.status, 'completed'))`.
- Any aggregate that reads `sessions` for derived stats — add the same filter. Plan will grep these and patch each.

---

## 5. Architecture

```
app/
  _layout.tsx                      # adds resume hook: getOpenDraft → router.push('/move/active')
  (tabs)/move/
    index.tsx                      # PreWorkout (from 4c) — start routine → /move/active
    active.tsx                     # NEW — Active Session route
    post.tsx                       # NEW — PostWorkout stub (replaced in 4e)

lib/
  state/
    activeSessionStore.ts          # NEW — Zustand store, see §6
  workouts/
    rest-timer.ts                  # NEW — pure reducer, TDD'd, see §7
    in-flight-pr.ts                # NEW — wrapper over detectSessionPRs, TDD'd, see §8
    cardio-aggregate.ts            # NEW — pace math + duration formatting, TDD'd
  db/queries/
    sessions.ts                    # CHANGED — five new functions, see §4
  health/
    heart-rate.ts                  # CONSUMED as-is from 4b (no change)

components/
  active-session/
    SessionHeader.tsx              # gradient banner, elapsed timer, exercise dots, Sets/Volume chips, Finish/Back
    RestBanner.tsx                 # auto-counting banner (strength only)
    ExerciseCard.tsx               # current exercise hero (strength)
    SetCard.tsx                    # done | active | upcoming states
    SetEditSheet.tsx               # bottom sheet for editing a completed set
    CardioBody.tsx                 # cardio replacement for ExerciseCard + RestBanner + UpNext
    UpNextRow.tsx                  # small "NEXT" preview row (strength)
    LiveHRChip.tsx                 # subscribes useLiveHeartRate; null if stale or absent
    DiscardConfirmModal.tsx        # native iOS confirm for Back-button
```

**Data flow on Complete-set:**

1. UI dispatches `completeSet(exPos, setPos, payload)` to the store.
2. Store appends the set draft to `setDrafts`, recomputes in-flight badges, advances `currentExerciseIdx` if all sets of the current exercise are done.
3. Side effect: `await upsertDraftSet(db, sessionId, draft)` — durable.
4. Side effect: `startRestTimer(routine.restDefaultSeconds * 1000)` (strength only; cardio doesn't auto-start a timer).
5. Re-render. Badge shows on the just-logged set if `isPr`.

UI is **optimistic**. If `upsertDraftSet` throws, surface a toast ("Couldn't save set — your data is still here.") but do not roll back local state; let the user keep going. Worst case: in-memory has a set the DB doesn't, and on next launch the resumed draft is one set behind. Acceptable for v2.

---

## 6. Zustand store shape

```ts
type SessionPhase = 'idle' | 'hydrating' | 'active' | 'finalizing';
type SessionMode  = 'strength' | 'cardio';

interface ExerciseInSession {
  exerciseId: string;
  position: number;                  // exercisePosition in session_sets
  prescribedSets: { reps: number | null; weightKg: number | null;
                    durationSeconds: number | null; distanceKm: number | null }[];
  meta: { name: string; equipment: string; muscle: string; sf: string; kind: 'strength' | 'cardio' };
}

interface SessionSetDraft {
  exercisePosition: number;
  setPosition: number;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceKm: number | null;
}

interface ActiveSessionState {
  phase: SessionPhase;
  mode: SessionMode;
  sessionId: number | null;
  routineId: number | null;
  routineNameSnapshot: string;
  restDefaultSeconds: number;
  startedAt: number;
  exercises: ExerciseInSession[];
  currentExerciseIdx: number;
  prSnapshot: PRSnapshot;            // frozen at start; PRSnapshot from lib/workouts/pr-detection.ts
  setDrafts: SessionSetDraft[];      // ordered by (exPos, setPos)
  rest: RestTimerState;              // see §7

  startSession(routineId: number): Promise<void>;
  hydrateFromDraft(draft: DraftSession): Promise<void>;
  completeSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  editSet(exPos: number, setPos: number, payload: CompleteSetPayload): Promise<void>;
  addSetToCurrent(): Promise<void>;
  skipExercise(): void;              // local only
  goToNextExercise(): void;
  finishSession(): Promise<CompletedSessionResult>;
  discardSession(): Promise<void>;
  startRestTimer(durationMs: number): void;
  addRestTime(secs: number): void;
  skipRest(): void;
}
```

**Selectors** (consumed by components, kept thin):

| Selector | Returns |
|---|---|
| `usePhase()` | `state.phase` |
| `useMode()` | `state.mode` |
| `useExercises()` | `state.exercises` |
| `useCurrentExercise()` | `state.exercises[state.currentExerciseIdx]` |
| `useCurrentExerciseSets()` | drafts filtered by current exPos, plus a synthesized "active" placeholder for the next-not-yet-logged set |
| `useElapsedSeconds()` | `(now - state.startedAt) / 1000` (component-local 1s ticker) |
| `useRestTimer()` | `state.rest` |
| `useInFlightBadges()` | memoized `getInFlightBadges(state.prSnapshot, state.setDrafts)` |

**Phases and their invariants:**

```
idle ─[startSession]──> hydrating ─[draft created]──> active
idle ─[hydrateFromDraft on launch]──> hydrating ──> active
active ─[finishSession]──> finalizing ─[finalizeSession resolves]──> idle (+ navigate /move/post)
active ─[discardSession]──> idle (+ navigate /move)
```

- `phase==='active'` ⟺ `sessionId !== null` AND a draft row exists in DB.
- `phase==='idle'` ⟺ no draft row AND store fields are zeroed.
- During `finalizing`, the Finish button is disabled (spinner); the Back button blocks navigation.

---

## 7. Rest timer state machine (TDD'd)

Pure reducer in `lib/workouts/rest-timer.ts`.

```ts
type RestTimerState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number; durationMs: number };

type RestTimerEvent =
  | { type: 'START';    now: number; durationMs: number }
  | { type: 'TICK';     now: number }
  | { type: 'ADD_30S' }
  | { type: 'SKIP' };

function reduce(state: RestTimerState, event: RestTimerEvent): RestTimerState;
```

**Transition table (each row a TDD case):**

| Event | From | To | Notes |
|---|---|---|---|
| `START` | any | `running { startedAt: now, durationMs }` | New START always replaces — covers "log next set during rest" (timer restarts). |
| `TICK` | running, `now < startedAt + durationMs` | unchanged | Reducer no-op; UI re-renders via subscription. |
| `TICK` | running, `now ≥ startedAt + durationMs` | unchanged | Banner stays visible with "Rest's up"; no auto-dismiss. |
| `TICK` | idle | unchanged | No-op. |
| `ADD_30S` | running | `running { startedAt, durationMs: durationMs + 30000 }` | Bumps target. |
| `ADD_30S` | idle | unchanged | Defensive no-op. |
| `SKIP` | running | `idle` | Banner hides. Active set card unchanged. |
| `SKIP` | idle | unchanged | Defensive no-op. |

**Display values are derived in the component, not the reducer:**
- `remainingMs = max(0, durationMs - (now - startedAt))`
- `isOvertime = remainingMs === 0`
- Display string: `remainingMs > 0` → `mm:ss`; else `"Rest's up"`.

The store wraps the reducer in a `setInterval(1000)` ticker that dispatches `TICK`. Ticker is unit-untested (trivial wrapper).

---

## 8. PR detection in-flight

`lib/workouts/in-flight-pr.ts` is a thin wrapper over the existing `detectSessionPRs` from `lib/workouts/pr-detection.ts`:

```ts
export function getInFlightBadges(
  snapshot: PRSnapshot,
  drafts: SessionSetDraft[],
): boolean[];   // parallel to drafts; true where the set beats the snapshot

export function wouldThisSetBeAPR(
  snapshot: PRSnapshot,
  exerciseId: string,
  reps: number | null,
  weightKg: number | null,
): boolean;     // for the optimistic "Beat it today?" copy on the active set card
```

Both are pure; both delegate the math to `detectSessionPRs` so in-flight UX and persisted truth are unified by construction. Cardio sets (`reps === null` or `weightKg === null`) are filtered out by the existing function — no special-casing needed.

The store calls `getInFlightBadges` whenever `setDrafts` changes and exposes the result via `useInFlightBadges()`.

`session_sets.isPr` stays `0` for drafts. Source of truth for **history** is `session_sets.isPr`, set at finalize. Source of truth for **in-flight UX** is the in-memory snapshot. They converge at finalize because both run `detectSessionPRs` against the same snapshot — the snapshot frozen in memory at session start matches the one read inside the `finalizeSession` transaction (single-device, single workout at a time, partial unique index enforces this).

---

## 9. Cardio variant

Routing is the same — `/move/active`. The store's `startSession(routineId)` inspects the routine's first exercise and sets `mode: 'strength' | 'cardio'`. The screen branches on `mode`:

- **Shared:** `SessionHeader`, `LiveHRChip`, Finish button, Back-with-confirm, draft persistence, resume-on-launch, `finalizeSession`.
- **Strength-only:** `RestBanner`, `ExerciseCard` + `SetCard` list, `UpNextRow`, exercise progress dots, in-flight PR badges.
- **Cardio-only:** `<CardioBody />` — live elapsed clock for the activity (mirrors `useElapsedSeconds`), distance input (defaults to routine target, editable), derived pace display when distance > 0.

**Detection rule:** `mode = 'cardio'` iff `exercises[0].meta.kind === 'cardio'`. Locked: cardio routines are single-exercise in v2.

**State for cardio:** a single `setDrafts[0]` row carrying:
- `durationSeconds`: `null` while the session is in `draft` status; finalized to `(finishedAt - startedAt) / 1000` on Finish. Display while active is computed live from `(now - startedAt)`, not from the draft.
- `distanceKm`: user input. Persisted to the draft via `upsertDraftSet` on input blur, so it survives backgrounding.
- `weightKg = null`, `reps = null` throughout.

**Header chip swap:** for cardio, the Sets / Volume / Exercise chips in `SessionHeader` become Distance / Pace / — (third slot hidden). Rest banner is never rendered. PR detection runs inside `finalizeSession` and produces no badges (cardio sets fail the `weightKg × reps` check).

**Pace math** in `lib/workouts/cardio-aggregate.ts`: `pace = (durationSeconds / 60) / distanceKm` minutes-per-km, formatted as `m:ss`. Returns `null` when `distanceKm <= 0`. TDD'd.

---

## 10. Live HR integration

`<LiveHRChip />` subscribes to `useLiveHeartRate()` from `lib/health/heart-rate.ts` (4b). On mount, calls `start()`; on unmount, `stop()`.

Render rule:
```ts
if (!current) return null;
if (current.sampledAt < Date.now() - 30_000) return null;
return <Text>{current.bpm} bpm</Text>;
```

No "—" placeholder, no "tap to start," no permission UI. Permission is a 4b concern; if denied, `current` stays null forever and the chip never appears. Acceptable.

---

## 11. TDD scope

| Module | Tests | Approx. count |
|---|---|---|
| `lib/workouts/rest-timer.ts` | All 8 transitions in §7 + a derived-display sanity case | ~10 |
| `lib/workouts/in-flight-pr.ts` | Snapshot + sets → badge array; `wouldThisSetBeAPR` predicate; cardio sets ignored | ~6 |
| `lib/workouts/cardio-aggregate.ts` | Pace math, zero-distance guard, duration string formatting | ~4 |
| `lib/db/queries/sessions.ts` (new) | `startDraftSession` happy + uniqueness throw; `upsertDraftSet` insert + replace; `discardDraftSession` cascade; `finalizeSession` end-to-end (volume, PRs, movement entry, status flip, finishedAt set, durationSeconds set); `getOpenDraft` returns null when none / row when one; `listSessions` excludes drafts | ~12 |
| `app/_layout.tsx` resume hook | Mock `getOpenDraft` → router push assertion when draft exists; no push when null | ~2 |

**Not TDD'd** (per meta-spec §3 row 4d, "TDD applies to … set-completion side effects" — UI is visual-verify):
- Components in `components/active-session/`.
- The `setInterval` ticker in `activeSessionStore`.
- The `useLiveHeartRate` subscription wrapper.
- `_layout.tsx` resume hook beyond the assertion above.

---

## 12. Error handling

| Failure | Behavior |
|---|---|
| `upsertDraftSet` throws | Toast: "Couldn't save set — your data is still here." Local state already updated. User keeps going. |
| `startDraftSession` throws (orphan draft from prior crash) | Recovery sheet: "Found an unfinished workout. Resume or discard?" Resume hydrates the orphan; Discard calls `discardDraftSession` then retries. |
| `finalizeSession` throws | Re-enable Finish button (exit `finalizing` phase). Toast: "Couldn't save workout — try again." Draft remains. |
| HR subscription throws / no permission | `LiveHRChip` renders null. No toast — permission UX is 4b's. |
| Watch sample older than 30s | `LiveHRChip` renders null. No staleness indicator. |
| Back during `finalizing` | Block navigation. |
| Resume hook fires but `getOpenDraft` throws | Log + toast on PreWorkout next render: "Couldn't restore previous workout." Don't auto-navigate. |

---

## 13. Scope cuts

Explicitly cut from 4d:

| Item | Reason |
|---|---|
| Add new exercise mid-session | Routines are the unit. v3+ if requested. |
| Reorder exercises mid-session | YAGNI. |
| Per-exercise rest override on the routine | `routine_exercises.rest_seconds` exists in 4a; consumption deferred to 4c-or-later editor wiring. 4d uses `routine.rest_default_seconds` as a flat default. |
| Rest timer notification / haptic | Q3 minimal. Add later if the silent banner proves insufficient. |
| Pause rest timer | YAGNI; Skip + restart-on-next-Complete-set is sufficient. |
| Multi-exercise cardio routines | Locked single-exercise per §2 row 4. |
| Cardio PR tracking | PRs are weight×reps; cardio doesn't fit the model. Personal-best pace/distance is a v3 feature. |
| Real PostWorkout summary | 4e ships it. |
| HealthKit workout write at finalize | 4e ships it. |
| Live Activities driver | 4g ships it. |
| Workout history / WorkoutDetail screens | 4e ships them. |

---

## 14. What this spec is NOT

- Not a product spec for 4e/4f/4g.
- Not an implementation plan. The next step (after user review of this spec) is invoking `superpowers:writing-plans` to produce the plan for 4d.
- Not a schedule.
