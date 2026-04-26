# Pulse — iOS v2 (Workouts) Meta-Spec

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** [`./2026-04-25-implementation-process-design.md`](./2026-04-25-implementation-process-design.md) §3 row 4
**Scope:** Defines the decomposition of sub-project 4 (iOS v2 — workouts) into child sub-projects. This is a *map*, not a product spec. Each child below gets its own spec → plan → execute → review cycle.

---

## 1. What SP4 ships

End-to-end workout flow: **pick routine → log sets → rest timer → finish → Post-Workout summary → Workout Detail**, plus AI routine generation, in-app routine editing, an exercise library browser, and HealthKit integration (write completed workouts; read live heart rate during sessions). Live Activities code is written but visual verification is deferred per parent meta-spec §7.

The design handoff for these screens lives at:
- `design_handoff/src/workout-screens.jsx` — PreWorkout, ActiveSession, PostWorkout
- `design_handoff/src/workout-screens2.jsx` — RoutineEditor, ExerciseLibrary, WorkoutDetail
- `design_handoff/src/routine-generator.jsx` — AI generator
- `design_handoff/src/workout-data.jsx` — sample exercise catalog and routines

---

## 2. Locked decisions

These are settled inputs to the child specs and are **not** open for relitigation in those specs.

| Decision | Choice | Reason |
|---|---|---|
| PR definition | Best `weight × reps` per exercise | Trivial semantics, no formula to hallucinate. Estimated 1RM is a derived view over the same data if ever needed. |
| Units | kg, locked | User is a kg user; design is in kg. Toggle is YAGNI for v2. |
| HealthKit role | Write completed workouts + subscribe live HR during session | User has Apple Watch; HR readout is part of the Active Session design. |
| Exercise catalog | Seeded and read-only in v2 (browser, not editor) | Custom exercises are a v3+ ask; not in design handoff for v2. |
| Cardio routines | In scope (duration/distance/pace) | "Everything in design handoff" was confirmed; cardio routines exist in `workout-data.jsx`. |
| AI generator UX | One-shot prompt → backend → save | Matches `routine-generator.jsx`. Not conversational. |

---

## 3. Decomposition

Seven child sub-projects. Order is dependency-driven; each from 4c onward consumes earlier slices.

| # | Slice | Surface | TDD applies to | Smoke test |
|---|---|---|---|---|
| **4a** ✅ | **Workout data foundation** | Drizzle schema (exercises, routines, routine_exercises, routine_sets, sessions, session_sets, prs), seeded catalog from `design_handoff/src/workout-data.jsx`, queries. No UI. | Volume math, PR detection (best `weight × reps`), routine progression, schema migrations | Tests green; dev seed populates DB; queries return expected shapes from a Node test runner. |
| **4b** ✅ | **EAS custom dev client + HealthKit shell** | First custom dev client built via EAS; HealthKit permission flow via `@kingstinct/react-native-healthkit`; thin modules for `writeWorkout()` and `subscribeHeartRate()`. No app feature UI. | HealthKit module thin contracts (input shape, error paths), permission state machine | Custom dev client installs on the user's iPhone; permission prompt appears once; a stub `writeWorkout()` round-trip puts a record in Health.app; `subscribeHeartRate()` logs samples to console with watch worn. |
| **4c** ✅ | **Routine browse + edit** | PreWorkout (routine list), RoutineEditor (edit a routine's exercises and sets), ExerciseLibrary (browse seeded catalog by muscle group). | None (UI screens; visual verification) | List routines from 4a; open a routine; add/remove an exercise from the library; adjust a set's reps/weight; persist; reopen and see the change. |
| **4d** ✅ | **Active Session** (the heart) | Rest timer state machine, set logging UI, in-flight PR detection, live HR readout via 4b. Cardio variant of the Active Session for cardio routines (duration/distance/pace input). | Rest timer state machine, in-flight PR detection against 4a's PRs table, set-completion side effects | Start a session from 4c → log sets → timer counts down per set → PR badge fires when a set beats prior best → HR shows with watch worn. Cardio variant: log a duration/distance row. |
| **4e** ✅ | **Post-Workout + History** | PostWorkout summary (writes the session row locally + pushes a Health record via 4b), WorkoutDetail screen for past sessions. | Post-session aggregate (total volume, set count, PRs unlocked, duration), HealthKit payload assembly | Finish a session in 4d → summary screen shows correct volume/duration/PR count → row appears in WorkoutDetail history → record appears in Health.app with the right type and duration. |
| **4f** | **AI Routine Generator** | RoutineGenerator screen → backend `/parse` (already deployed in SP2) → save returned routine to 4a's tables. | Generator response validation (schema check, exercise-id resolution against catalog, save path), error states | Type a prompt → backend round-trip → routine appears in 4c's list and is editable. |
| **4g** | **Live Activities** *(verification deferred)* | Lock-screen workout timer via `@software-mansion-labs/expo-live-activity` driven by 4d's session state. | None — visual verify is deferred per parent meta-spec §7 | Code present, type-checks, app builds with the dev client. No visual smoke test required for SP4 to close. |

### Why this order

- **4a first.** Everything else reads/writes the workout data layer. Doing schema and TDD'd math against zero UI means the math is right before any screen has the chance to obscure it.
- **4b second.** The first EAS custom dev client build is the highest-novelty toolchain step in the whole project. Doing it on a thin native-module shell — not mixed with feature work — keeps the failure surface small. Once 4b passes, 4d and 4e are pure feature code.
- **4c before 4d.** Active Session needs a routine to start from; 4c provides the picker and the editor. Smaller, lower-stakes UI on the way in.
- **4d before 4e.** Post-Workout summarizes a session; you need a session to summarize.
- **4f after 4e.** Generator depends on 4a (save target) and 4c (where saved routines render). It does not depend on 4d/4e, so it could in principle move earlier; it's placed late because it's the only network-dependent slice and we want the local flow proven first.
- **4g last.** Smallest scope, deferred verification, safest to slip if SP4 runs long.

### Sub-slice status

- **4a** ✅ Code complete 2026-04-25.
- **4b** ✅ Windows-side complete 2026-04-25 — HealthKit shell + dev smoke screen; iPhone dev-client verification deferred.
- **4c** ✅ Code complete 2026-04-25 — three-screen flow shipped, Zustand editor store, transactional `updateRoutine`, full CRUD + duplicate + rename. Migration `0002_late_tempest` adds `rest_default_seconds` / `warmup_reminder` / `auto_progress` to `routines`. 162 tests passing. iPhone Expo Go verification deferred (carries until 4b dev client lands).
- **4d** ✅ Code complete 2026-04-26 — ActiveSession route (strength + cardio), rest-timer reducer, in-flight PR badges, Zustand `activeSessionStore` with per-set write-through draft persistence + resume-on-launch, `DiscardConfirmModal`, `SetEditSheet` (with remove-set), `LiveHRChip`, PostWorkout stub. Lifecycle replaces `insertCompletedSession` with `getOpenDraft` / `startDraftSession` / `upsertDraftSet` / `deleteDraftSet` / `discardDraftSession` / `finalizeSession`. Migration `0003_omniscient_puck` adds `sessions.status`, relaxes `finished_at` to nullable, and adds the `idx_sessions_one_draft` partial unique index. 216 tests passing. Manual web/iPhone smoke (steps 3–7 of the plan) deferred to user — typecheck and unit suite are green.
- **4e** ✅ Code complete 2026-04-26 — full PostWorkout route (strength + cardio variants with `CompleteHero` / `StatGrid` / `PrHighlightCard` / `MuscleBars` / `ExerciseRecapCard` / `CardioRecapCard`), WorkoutDetail at `/move/[sessionId]` (4-tile stat grid + 8-week volume chart + per-exercise table), `/move/history` filtered list (All / Strength / Cardio), `RecentSection` on PreWorkout. Pure helpers: `computeMuscleDistribution`, `computeWeeklyVolumeSeries`, `selectTopPRs`, `formatRelativeDate`, `activityTypeFor`. Extended `getSession` with `mode` + `exerciseMetaById`; new `getRecentSessions`, `listAllSessions`, `getWeeklyVolumeSeries` queries. `finalizeSession` now writes a HealthKit workout post-commit (with optional `distanceKm` for cardio) and surfaces `healthSyncFailed` through the route params; `requestPermissions` extended with `HKQuantityTypeIdentifierDistanceWalkingRunning`. No schema delta. 270 tests passing (54 new). Manual web smoke + iPhone HealthKit verification deferred to user — typecheck clean on sp4e files, full unit suite green.
- **4f–4g** Pending.

---

## 4. Cross-cutting dependencies

| Dependency | Where consumed | Status |
|---|---|---|
| Backend `/parse` endpoint | 4f only | Deployed in SP2; live-deploy still pending API key per parent meta-spec §8a row 2. **4f is blocked on a live `/parse` deploy**, but 4a–4e are not blocked. |
| EAS Build account | 4b first; reused thereafter | Confirmed in parent meta-spec §6; account verification happens in 4b's plan. |
| Apple Health permissions | 4b, 4d, 4e | Permission prompt designed in 4b. |
| `expo-live-activity` package | 4g | Verified deferred. |
| Skia rendering for Activity Rings carryover | None in SP4 (rings are SP3a) | No new Skia work in SP4. |

---

## 5. Verification posture for SP4

The parent meta-spec's "C" cadence (build the whole sub-project, then verify) applies to **each child**, not to SP4 as a whole. Each of 4a–4f has its own smoke test (above). SP4 is closed when 4a–4f all pass their smoke tests and 4g's code compiles.

The user's iPhone is the verification target from 4b onward. Web target is sufficient for 4a only (it's pure data + math). 4c–4f require the dev client on iPhone.

---

## 6. Scope cuts

Explicitly cut from SP4, even though plausible:

| Item | Reason |
|---|---|
| Custom (user-defined) exercises | Not in design handoff for v2; ExerciseLibrary is a browser, not an editor. v3+ if requested. |
| Lb / kg toggle | Locked to kg per §2. |
| Imported workout history from Apple Health | Pulse is the source of truth for sets/reps/PRs. Pre-Pulse history stays in Health.app. |
| Estimated 1RM tracking | Derived view over weight×reps; deferrable. |
| Workout sharing / social | Personal-use app. |
| Apple Watch app | Companion app is its own multi-week project; out of scope. |
| Live Activity *visual* verification | Deferred per parent §7; code lands in 4g. |
| Workout reminders / scheduled routines | Not in design handoff for v2. |

---

## 7. Open items requiring user input before 4a starts

- **Rest timer defaults.** Per-set on the routine template, per-routine default, or hardcoded constant by exercise group? Resolves in 4a's spec.
- **Routine progression rule.** What does "auto-progression" mean? Add 2.5 kg when the user completes all sets at the prescribed reps? Or no auto-progression and the user edits manually? Resolves in 4a's spec.
- **PR scope at session start.** When a routine starts, do we snapshot the PRs table for the exercises in that session (so mid-session PRs compare against pre-session bests, even after a new PR is set), or compare live? Resolves in 4d's spec.

These are not blockers for *this* meta-spec; they're inputs to the child specs that touch them.

---

## 8. What this spec is NOT

- Not a product spec for any of 4a–4g. Each child gets its own spec.
- Not an implementation plan. The next step is invoking `superpowers:writing-plans` to produce **the plan for 4a** (workout data foundation). Each subsequent child gets its own spec → plan cycle.
- Not a schedule. Pace is unknown.
