# SP4g — Live Activities (rest timer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a lock-screen / Dynamic Island Live Activity for the rest timer between strength sets, using `expo-live-activity`'s canned widget. Visual verification on iPhone is deferred per parent meta-spec §7.

**Architecture:** Three new files under `lib/live-activity/` (`config.ts`, `projection.ts`, `index.ts`) plus a unit-test file for the projection. One new image asset under `assets/liveActivity/rest_timer.png`. Modifications to `package.json` (dependency), `app.json` (plugin entry), `jest.setup.js` (mock), and `lib/state/activeSessionStore.ts` (bridge calls in `completeSet`, `addRestTime`, `skipRest`, `finishSession`, `discardSession`). No DB schema delta, no backend change.

**Tech Stack:** TypeScript + React Native 0.81 (Expo SDK 54), `expo-live-activity@^0.4.2`, Zustand 5, Jest 29 with `jest-expo`. iOS-only feature; web/Android shimmed to no-op via `Platform.OS` guard.

**Spec:** `docs/superpowers/specs/2026-04-26-sp4g-live-activities-design.md`

---

## Conventions used throughout

- **iOS tests** are Jest, live in `__tests__` directories next to the source. Files start with `/** @jest-environment node */`.
- **Run iOS tests:** `npm test -- <pattern>` (from repo root).
- **iOS typecheck:** `npx tsc --noEmit`.
- **Commit message format:** `feat(sp4g): <short summary>` for code, `test(sp4g): <short summary>` for test-only commits, `chore(sp4g): <short summary>` for tooling, `docs(sp4g): <short summary>` for spec/plan updates. **Project CLAUDE.md prohibits `Co-Authored-By: Claude` — do not add it.** Author is the user only.
- **Each task ends with a commit step.** Stage only the files the task touched; avoid `git add -A`.
- **No backend work in this plan.** The slice is iOS-only.
- **No DB migration.** No `drizzle-kit generate` runs anywhere in this plan.

---

## File structure (recap of spec §11)

**New files:**
- `lib/live-activity/config.ts` — static `LiveActivityConfig` constant.
- `lib/live-activity/projection.ts` — pure function `projectRestActivity(state) → LiveActivityState | null`.
- `lib/live-activity/index.ts` — no-op wrapper for non-iOS platforms (web, Android, Jest). Uses the same exported function names so callers don't need platform-aware imports.
- `lib/live-activity/index.ios.ts` — iOS implementation with the actual `expo-live-activity` calls and the single in-flight activity ID. Metro picks this file automatically when bundling for iOS.
- `lib/live-activity/__tests__/projection.test.ts` — seven cases per spec §8.
- `assets/liveActivity/rest_timer.png` — placeholder PNG referenced by the canned widget.

**Why a `.ios.ts` split rather than runtime `Platform.OS` guards:** Metro statically resolves every `require()` and `import` regardless of conditional gates, so a runtime guard around `require('expo-live-activity')` would still bundle the package on web and Android. Platform-specific filename extensions are the canonical React Native solution — Metro picks the right file per platform target. iOS bundles include `index.ios.ts`; everything else gets `index.ts`.

**Modified files:**
- `package.json` — adds `expo-live-activity` to dependencies.
- `app.json` — appends one plugin entry.
- `jest.setup.js` — mocks `expo-live-activity` (mirrors the existing `@kingstinct/react-native-healthkit` mock).
- `lib/state/activeSessionStore.ts` — bridge calls in five existing actions.

---

## Task 1: Install `expo-live-activity` and register the config plugin

**Files:**
- Modify: `package.json`
- Modify: `app.json`
- Modify: `jest.setup.js`

**Context:** `expo-live-activity` is a Software Mansion package published at `expo-live-activity` on npm (not under the `@software-mansion-labs` scope despite the GitHub org). Latest version at the time of this plan: `0.4.2`, published 2025-11-18. It ships an Expo config plugin that wires the iOS Live Activity widget extension during `expo prebuild`. We register the plugin with `enablePushNotifications: false` because all updates fire from the local store (spec §2). We also mock the module in Jest setup, mirroring the pattern used for `react-native-healthkit` — Nitro-style modules can't load in Node.

- [ ] **Step 1: Install the package**

```bash
npm install expo-live-activity
```

Expected: `expo-live-activity` is added to `package.json` `dependencies`. The exact version range npm picks (e.g., `^0.4.2`) is fine.

- [ ] **Step 2: Verify Expo SDK 54 compatibility**

```bash
npx expo-doctor
```

Expected: passes, or the only warnings are unrelated to `expo-live-activity`. If it complains about the version, pin to whatever version it suggests instead — but this package targets Expo SDK 54+, so 0.4.x should work as-is.

- [ ] **Step 3: Append the plugin entry to `app.json`**

Edit `app.json`. The `plugins` array currently ends at line 51 with the `@kingstinct/react-native-healthkit` plugin. Add the new entry as the last element:

```json
"plugins": [
  "expo-router",
  [
    "expo-splash-screen",
    {
      "image": "./assets/images/splash-icon.png",
      "imageWidth": 200,
      "resizeMode": "contain",
      "backgroundColor": "#ffffff",
      "dark": {
        "backgroundColor": "#000000"
      }
    }
  ],
  "expo-sqlite",
  [
    "@kingstinct/react-native-healthkit",
    {
      "NSHealthShareUsageDescription": "Pulse reads your heart rate during workouts to show live BPM in the active-session screen.",
      "NSHealthUpdateUsageDescription": "Pulse saves completed workouts to the Health app so they appear alongside your other activity."
    }
  ],
  ["expo-live-activity", { "enablePushNotifications": false }]
]
```

Only the last array element is new; everything else is unchanged.

- [ ] **Step 4: Add a Jest mock for `expo-live-activity`**

Edit `jest.setup.js`. After the existing `@kingstinct/react-native-healthkit` mock block (ends around line 16), append:

```js
// Stub expo-live-activity so any code path that imports lib/live-activity (or
// transitively reaches it via activeSessionStore) doesn't crash in node.
jest.mock('expo-live-activity', () => ({
  __esModule: true,
  startActivity: jest.fn().mockReturnValue('mock-activity-id'),
  updateActivity: jest.fn(),
  stopActivity: jest.fn(),
}));
```

- [ ] **Step 5: Sanity-run existing tests + typecheck**

```bash
npm test -- --testPathPattern=rest-timer
```

Expected: PASS. The existing rest-timer tests still pass with the new mock loaded.

```bash
npx tsc --noEmit
```

Expected: PASS. (No new code yet, just dependency + config.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json app.json jest.setup.js
git commit -m "chore(sp4g): install expo-live-activity and register plugin"
```

---

## Task 2: Add the static `LiveActivityConfig`

**Files:**
- Create: `lib/live-activity/config.ts`

**Context:** The canned widget is configured once with colors, timer style, padding, and deep link. We isolate this constant in its own file so the projection and wrapper don't need to re-import it from the store and so future tweaks don't ripple. Colors are dark-mode-flavored solid hex values; iOS handles the surrounding lock-screen chrome (spec §5).

- [ ] **Step 1: Create `lib/live-activity/config.ts`**

```ts
import type { LiveActivityConfig } from 'expo-live-activity';

// Static configuration for the rest-timer Live Activity. Mirrors the in-app
// rest pill: digital countdown on a dark surface, tinted with `move` green
// (Apple's #30D158). Colors are flat hex; the canned widget renders the same
// chrome regardless of system theme.
export const REST_ACTIVITY_CONFIG: LiveActivityConfig = {
  backgroundColor: '#1C1C1E',          // tokens.dark.surface
  titleColor: '#FFFFFF',               // tokens.dark.ink
  subtitleColor: '#EBEBF5',            // ~tokens.dark.ink2 flattened to opaque
  progressViewTint: '#30D158',         // tokens.dark.move
  progressViewLabelColor: '#FFFFFF',
  timerType: 'digital',
  padding: 16,
  imagePosition: 'left',
  imageSize: 64,
  imageAlign: 'center',
  deepLinkUrl: '/move/active',
};
```

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS. The `LiveActivityConfig` type comes from the package's `.d.ts`; the `import type` is erased at runtime, so this file safely loads in any environment.

- [ ] **Step 3: Commit**

```bash
git add lib/live-activity/config.ts
git commit -m "feat(sp4g): static LiveActivityConfig for the rest timer"
```

---

## Task 3: Projection — failing tests first

**Files:**
- Create: `lib/live-activity/__tests__/projection.test.ts`

**Context:** Per spec §8, seven cases describe the projection. We write all seven failing tests first, then implement in the next task. The tests reference a function `projectRestActivity` that doesn't exist yet — that's intentional. Each test constructs an `ActiveSessionState` via a `baseState()` helper and asserts the returned `LiveActivityState | null`.

The `ActiveSessionState` type is exported from `lib/state/activeSessionStore.ts` (spec §4). It includes the action functions, but for tests we only care about the data fields — so we cast a partial object via `as ActiveSessionState`.

- [ ] **Step 1: Create the test file with all seven cases**

```ts
/** @jest-environment node */
import { projectRestActivity } from '../projection';
import type { ActiveSessionState, ExerciseInSession } from '@/lib/state/activeSessionStore';
import type { SessionSetDraft } from '@/lib/db/queries/sessions';

const exercise = (
  id: string,
  name: string,
  prescribed: Array<{ reps: number | null; weightKg: number | null }>,
  position = 0,
): ExerciseInSession => ({
  exerciseId: id,
  position,
  prescribedSets: prescribed.map((p) => ({
    reps: p.reps,
    weightKg: p.weightKg,
    durationSeconds: null,
    distanceKm: null,
  })),
  meta: {
    name,
    equipment: 'barbell',
    muscle: 'chest',
    sfSymbol: 'dumbbell.fill',
    kind: 'strength',
  },
});

const draft = (exPos: number, setPos: number): SessionSetDraft => ({
  exerciseId: `ex-${exPos}`,
  exercisePosition: exPos,
  setPosition: setPos,
  reps: 8,
  weightKg: 80,
  durationSeconds: null,
  distanceKm: null,
});

function baseState(overrides: Partial<ActiveSessionState>): ActiveSessionState {
  return {
    phase: 'active',
    mode: 'strength',
    sessionId: 1,
    routineId: 1,
    routineNameSnapshot: 'Test routine',
    restDefaultSeconds: 120,
    startedAt: 1_000,
    exercises: [],
    currentExerciseIdx: 0,
    prSnapshot: new Map(),
    setDrafts: [],
    rest: { status: 'idle' },
    // The action methods are unused by projection — cast keeps the type happy.
    ...overrides,
  } as ActiveSessionState;
}

describe('projectRestActivity', () => {
  it('rest running mid-exercise → next-set subtitle with weight × reps', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [
      { reps: 8, weightKg: 80 },
      { reps: 8, weightKg: 80 },
      { reps: 8, weightKg: 80 },
    ]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0), draft(0, 1)],
      rest: { status: 'running', startedAt: 5_000, durationMs: 90_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Bench Press');
    expect(out!.subtitle).toBe('Set 3 of 3 · 80 kg × 8');
    expect(out!.progressBar?.date).toBe(5_000 + 90_000);
    expect(out!.imageName).toBe('rest_timer');
    expect(out!.dynamicIslandImageName).toBe('rest_timer');
  });

  it('rest running, just auto-advanced to next exercise → "Set 1 of N" subtitle', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const ex1 = exercise(
      'ex-1',
      'Overhead Press',
      [{ reps: 5, weightKg: 50 }, { reps: 5, weightKg: 50 }],
      1,
    );
    const state = baseState({
      exercises: [ex0, ex1],
      currentExerciseIdx: 1,                       // store auto-advanced
      setDrafts: [draft(0, 0)],                    // no sets logged on ex1 yet
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Overhead Press');
    expect(out!.subtitle).toBe('Set 1 of 2 · 50 kg × 5');
  });

  it('last rest of last exercise → "Last rest · finish when ready"', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0)],                    // all prescribed sets logged
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out).not.toBeNull();
    expect(out!.title).toBe('Bench Press');
    expect(out!.subtitle).toBe('Last rest · finish when ready');
  });

  it('prescribed weight is null → drops "kg ×" segment', () => {
    const ex0 = exercise('ex-0', 'Pull-ups', [
      { reps: 8, weightKg: null },
      { reps: 8, weightKg: null },
      { reps: 8, weightKg: null },
    ]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      setDrafts: [draft(0, 0), draft(0, 1)],
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    const out = projectRestActivity(state);

    expect(out!.subtitle).toBe('Set 3 of 3 · 8 reps');
  });

  it('cardio session → returns null', () => {
    const state = baseState({
      mode: 'cardio',
      rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
    });

    expect(projectRestActivity(state)).toBeNull();
  });

  it('rest idle → returns null', () => {
    const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
    const state = baseState({
      exercises: [ex0],
      currentExerciseIdx: 0,
      rest: { status: 'idle' },
    });

    expect(projectRestActivity(state)).toBeNull();
  });

  it.each(['idle', 'hydrating', 'finalizing'] as const)(
    'phase=%s → returns null',
    (phase) => {
      const ex0 = exercise('ex-0', 'Bench Press', [{ reps: 8, weightKg: 80 }]);
      const state = baseState({
        phase,
        exercises: [ex0],
        rest: { status: 'running', startedAt: 5_000, durationMs: 60_000 },
      });

      expect(projectRestActivity(state)).toBeNull();
    },
  );
});
```

Note the `null-weight` case asserts `'Set 3 of 3 · 8 reps'`, not `'Set 3 of 3 · × 8'`. The spec said "drop the `{weight} kg ×` segment" — but a bare `· × 8` reads strangely on the lock screen. We use `'8 reps'` as the cleaner fallback when weight is missing. This is a minor refinement of spec §4's formatting rule that the test now pins down.

- [ ] **Step 2: Run the tests; expect them to fail**

```bash
npm test -- --testPathPattern=projection
```

Expected: FAIL with "Cannot find module '../projection'" or similar — the import target doesn't exist yet.

- [ ] **Step 3: Commit the failing tests**

```bash
git add lib/live-activity/__tests__/projection.test.ts
git commit -m "test(sp4g): failing tests for rest-activity projection"
```

---

## Task 4: Implement the projection to make the tests pass

**Files:**
- Create: `lib/live-activity/projection.ts`

**Context:** Pure function over `ActiveSessionState`. Returns `null` for any state that shouldn't show the activity. Otherwise constructs a `LiveActivityState` whose `progressBar.date` is `rest.startedAt + rest.durationMs`. Subtitle formatting per spec §4 with the test-pinned null-weight refinement (use `'N reps'` when weight is absent).

- [ ] **Step 1: Create `lib/live-activity/projection.ts`**

```ts
import type { LiveActivityState } from 'expo-live-activity';
import type { ActiveSessionState } from '@/lib/state/activeSessionStore';

const IMAGE_NAME = 'rest_timer';
const LAST_REST_SUBTITLE = 'Last rest · finish when ready';

export function projectRestActivity(s: ActiveSessionState): LiveActivityState | null {
  if (s.phase !== 'active') return null;
  if (s.mode !== 'strength') return null;
  if (s.rest.status !== 'running') return null;

  const exercise = s.exercises[s.currentExerciseIdx];
  if (!exercise) return null;

  const loggedAtCurrent = s.setDrafts.filter(
    (d) => d.exercisePosition === s.currentExerciseIdx,
  ).length;
  const prescribedAtCurrent = exercise.prescribedSets.length;

  const subtitle = subtitleFor(exercise, loggedAtCurrent, prescribedAtCurrent);
  const endsAt = s.rest.startedAt + s.rest.durationMs;

  return {
    title: exercise.meta.name,
    subtitle,
    progressBar: { date: endsAt },
    imageName: IMAGE_NAME,
    dynamicIslandImageName: IMAGE_NAME,
  };
}

function subtitleFor(
  exercise: ActiveSessionState['exercises'][number],
  loggedAtCurrent: number,
  prescribedAtCurrent: number,
): string {
  if (loggedAtCurrent >= prescribedAtCurrent) return LAST_REST_SUBTITLE;

  const next = exercise.prescribedSets[loggedAtCurrent];
  const setLabel = `Set ${loggedAtCurrent + 1} of ${prescribedAtCurrent}`;

  if (next.weightKg !== null && next.reps !== null) {
    return `${setLabel} · ${next.weightKg} kg × ${next.reps}`;
  }
  if (next.reps !== null) {
    return `${setLabel} · ${next.reps} reps`;
  }
  if (next.weightKg !== null) {
    return `${setLabel} · ${next.weightKg} kg`;
  }
  return setLabel;
}
```

- [ ] **Step 2: Run the tests; expect them to pass**

```bash
npm test -- --testPathPattern=projection
```

Expected: PASS — all seven cases (the `it.each` counts as three).

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/live-activity/projection.ts
git commit -m "feat(sp4g): pure projection from session state to LiveActivityState"
```

---

## Task 5: Wrapper module — `.ios.ts` for the real calls, `.ts` no-op for everywhere else

**Files:**
- Create: `lib/live-activity/index.ts`
- Create: `lib/live-activity/index.ios.ts`

**Context:** Per spec §6, the wrapper exposes `startRestActivity` / `updateRestActivity` / `stopRestActivity` taking non-nullable `LiveActivityState`. Callers (the store) project + null-check upstream. The wrapper is **not** unit-tested (spec §8); `tsc` and the integration paths through the store cover it.

The two-file split (see "Why a `.ios.ts` split…" in the file structure section above) is what keeps `expo-live-activity` out of web/Android/Jest bundles. Metro picks `index.ios.ts` only for iOS targets; every other platform gets `index.ts` (the stub). The Jest mock from Task 1 is belt-and-suspenders — Jest's resolver under `jest-expo` typically picks the no-suffix file, but the mock guards against config drift.

A few correctness details that apply only to the `.ios.ts` file:
- `startRestActivity` enforces single in-flight by stopping any current activity first, defensively. The cost is one extra native call on a coding bug.
- `updateRestActivity` and `stopRestActivity` both no-op when no activity is in flight, so call sites don't need to track that.
- The `.ios.ts` file does a normal static `import * as ExpoLiveActivity from 'expo-live-activity'` — Metro is happy because this file is only ever included in iOS bundles.

- [ ] **Step 1: Create the no-op stub at `lib/live-activity/index.ts`**

```ts
import type { LiveActivityState } from 'expo-live-activity';

// Non-iOS no-op stub. Metro picks `index.ios.ts` for iOS bundles;
// web, Android, and Jest get this file. The signatures match `index.ios.ts`
// so callers don't need to know which platform they're on.

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function startRestActivity(_state: LiveActivityState): void {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function updateRestActivity(_state: LiveActivityState): void {}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function stopRestActivity(_finalState: LiveActivityState): void {}
```

The `import type` is erased at build time, so this file never references the native module at runtime.

- [ ] **Step 2: Create the iOS implementation at `lib/live-activity/index.ios.ts`**

```ts
import * as ExpoLiveActivity from 'expo-live-activity';
import type { LiveActivityState } from 'expo-live-activity';
import { REST_ACTIVITY_CONFIG } from './config';

let currentId: string | undefined;

export function startRestActivity(state: LiveActivityState): void {
  // Single in-flight: stop any prior activity defensively.
  if (currentId !== undefined) {
    ExpoLiveActivity.stopActivity(currentId, state);
    currentId = undefined;
  }
  const id = ExpoLiveActivity.startActivity(state, REST_ACTIVITY_CONFIG);
  if (id !== undefined) {
    currentId = id;
  }
}

export function updateRestActivity(state: LiveActivityState): void {
  if (currentId === undefined) return;
  ExpoLiveActivity.updateActivity(currentId, state);
}

export function stopRestActivity(finalState: LiveActivityState): void {
  if (currentId === undefined) return;
  ExpoLiveActivity.stopActivity(currentId, finalState);
  currentId = undefined;
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS. (`tsc` checks every `.ts` file regardless of platform extension, so it validates both the stub and the iOS implementation.)

- [ ] **Step 4: Run the full suite to confirm nothing regressed**

```bash
npm test
```

Expected: PASS — the existing 300+ tests plus the 7 new projection tests.

- [ ] **Step 5: Commit**

```bash
git add lib/live-activity/index.ts lib/live-activity/index.ios.ts
git commit -m "feat(sp4g): platform-split wrapper for the rest live activity"
```

---

## Task 6: Add the placeholder image asset

**Files:**
- Create: `assets/liveActivity/rest_timer.png`

**Context:** The `expo-live-activity` plugin reads from `assets/liveActivity/` during prebuild and copies the asset into the iOS widget extension's bundle. The projection references this file by its name (`'rest_timer'` — no extension). Per spec §10 and the parent meta-spec §7, visual verification on iPhone is deferred — the image just needs to exist and be a valid PNG. We ship a 1×1 transparent placeholder that the user can swap for a real dumbbell glyph after iPhone smoke. The user already has SF Symbols available (project uses `expo-symbols`); a real export takes seconds in Preview/Inkscape and slots in by overwriting this file with the same name.

- [ ] **Step 1: Create the directory and write a 1×1 transparent PNG**

```bash
mkdir -p assets/liveActivity
node -e "require('fs').writeFileSync('assets/liveActivity/rest_timer.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));"
```

Expected: `assets/liveActivity/rest_timer.png` exists, valid PNG. (Source: this is the canonical minimal-transparent-PNG base64; well-known and widely used.)

- [ ] **Step 2: Verify the file is a valid PNG**

```bash
node -e "const b = require('fs').readFileSync('assets/liveActivity/rest_timer.png'); console.log('bytes:', b.length, 'magic:', b.slice(0, 8).toString('hex'));"
```

Expected: `bytes: 70 magic: 89504e470d0a1a0a`. The second value is the PNG signature; if it doesn't match exactly, the base64 didn't decode correctly. The byte count (70) is also informative — any other number means a copy-paste error in step 1.

- [ ] **Step 3: Commit**

```bash
git add assets/liveActivity/rest_timer.png
git commit -m "chore(sp4g): placeholder rest_timer.png for the live activity widget"
```

---

## Task 7: Wire the bridge into `activeSessionStore`

**Files:**
- Modify: `lib/state/activeSessionStore.ts`

**Context:** Per spec §7, five existing actions get bridge calls. We construct a hand-built `finalRestState` once at module top-level for stop call sites — it's identical across `skipRest` / `finishSession` / `discardSession`, with `progressBar.date` recomputed as `Date.now()` per call to ensure iOS reads the activity as already-elapsed.

Current `activeSessionStore.ts` length: ~349 lines. The action functions to modify:
- `completeSet` (lines 230–266) — add bridge call after the existing `startRestTimer` invocation at line 264.
- `addRestTime` (lines 324–337) — add bridge call after the final `set({ rest: next })`.
- `skipRest` (lines 339–342) — stop activity before the reducer transition.
- `finishSession` (lines 202–220) — stop activity at the top of the function.
- `discardSession` (lines 222–228) — stop activity at the top of the function.

`hydrateFromDraft` and `tickRest` get **no** changes (spec §7).

- [ ] **Step 1: Add imports at the top of `lib/state/activeSessionStore.ts`**

The current import block ends around line 16 with `import { type RestTimerState, reduce as reduceRest } from '@/lib/workouts/rest-timer';`. After it, add:

```ts
import {
  startRestActivity,
  updateRestActivity,
  stopRestActivity,
} from '@/lib/live-activity';
import { projectRestActivity } from '@/lib/live-activity/projection';
import type { LiveActivityState } from 'expo-live-activity';
```

- [ ] **Step 2: Add a top-of-file helper for the generic stop state**

After the imports, before the existing `export type SessionPhase = …` line, add:

```ts
function buildFinalRestState(): LiveActivityState {
  return {
    title: 'Rest done',
    subtitle: '',
    progressBar: { date: Date.now() },
    imageName: 'rest_timer',
    dynamicIslandImageName: 'rest_timer',
  };
}
```

- [ ] **Step 3: Wire `completeSet` (strength branch)**

In `completeSet`, the existing strength-branch tail at lines 263–265 reads:

```ts
    if (s.mode === 'strength') {
      get().startRestTimer(s.restDefaultSeconds * 1000);
    }
  },
```

Replace with:

```ts
    if (s.mode === 'strength') {
      get().startRestTimer(s.restDefaultSeconds * 1000);
      const projected = projectRestActivity(get());
      if (projected !== null) startRestActivity(projected);
    }
  },
```

Why this order: `startRestTimer` mutates `rest` to `running`, then `projectRestActivity(get())` sees the updated state and produces the right `LiveActivityState`. We pass the result to `startRestActivity` only when non-null (defensive — should always be non-null right after `startRestTimer` on a strength session, but the guard keeps the wrapper API non-nullable per spec §6).

- [ ] **Step 4: Wire `addRestTime`**

The existing `addRestTime` body (lines 324–337):

```ts
  addRestTime: (secs: number) => {
    if (secs === 30) {
      const next = reduceRest(get().rest, { type: 'ADD_30S' });
      set({ rest: next });
      return;
    }
    let next = get().rest;
    let remaining = secs;
    while (remaining >= 30) {
      next = reduceRest(next, { type: 'ADD_30S' });
      remaining -= 30;
    }
    set({ rest: next });
  },
```

Refactor so both branches share a single update site at the end:

```ts
  addRestTime: (secs: number) => {
    if (secs === 30) {
      const next = reduceRest(get().rest, { type: 'ADD_30S' });
      set({ rest: next });
    } else {
      let next = get().rest;
      let remaining = secs;
      while (remaining >= 30) {
        next = reduceRest(next, { type: 'ADD_30S' });
        remaining -= 30;
      }
      set({ rest: next });
    }
    const projected = projectRestActivity(get());
    if (projected !== null) updateRestActivity(projected);
  },
```

Note the refactor: the original early-`return` is replaced with an `if/else` so the bridge call always runs. Behavior is identical for the reducer — only the sequencing changes.

- [ ] **Step 5: Wire `skipRest`**

The existing body (lines 339–342):

```ts
  skipRest: () => {
    const next = reduceRest(get().rest, { type: 'SKIP' });
    set({ rest: next });
  },
```

Replace with:

```ts
  skipRest: () => {
    stopRestActivity(buildFinalRestState());
    const next = reduceRest(get().rest, { type: 'SKIP' });
    set({ rest: next });
  },
```

The wrapper no-ops if no activity is in flight (spec §6), so this is safe even when `skipRest` is somehow called outside an active rest.

- [ ] **Step 6: Wire `finishSession`**

The existing body (lines 202–220):

```ts
  finishSession: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    set({ phase: 'finalizing' });
    try {
      const result = await finalizeSession(db, s.sessionId, Date.now());
      set({ ...ZERO_STATE });
      router.replace({
        pathname: '/(tabs)/move/post',
        params: {
          sessionId: String(result.sessionId),
          healthSyncFailed: result.healthSyncFailed ? '1' : '0',
        },
      });
    } catch (e) {
      set({ phase: 'active' });
      throw e;
    }
  },
```

Add a `stopRestActivity` call right after the early-return guard, before the `set({ phase: 'finalizing' })`:

```ts
  finishSession: async () => {
    const s = get();
    if (s.phase !== 'active' || s.sessionId === null) return;
    stopRestActivity(buildFinalRestState());
    set({ phase: 'finalizing' });
    try {
      const result = await finalizeSession(db, s.sessionId, Date.now());
      set({ ...ZERO_STATE });
      router.replace({
        pathname: '/(tabs)/move/post',
        params: {
          sessionId: String(result.sessionId),
          healthSyncFailed: result.healthSyncFailed ? '1' : '0',
        },
      });
    } catch (e) {
      set({ phase: 'active' });
      throw e;
    }
  },
```

- [ ] **Step 7: Wire `discardSession`**

The existing body (lines 222–228):

```ts
  discardSession: async () => {
    const s = get();
    if (s.sessionId === null) return;
    await discardDraftSession(db, s.sessionId);
    set({ ...ZERO_STATE });
    router.replace('/(tabs)/move');
  },
```

Add a `stopRestActivity` call right after the guard:

```ts
  discardSession: async () => {
    const s = get();
    if (s.sessionId === null) return;
    stopRestActivity(buildFinalRestState());
    await discardDraftSession(db, s.sessionId);
    set({ ...ZERO_STATE });
    router.replace('/(tabs)/move');
  },
```

- [ ] **Step 8: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 9: Run the full suite**

```bash
npm test
```

Expected: PASS — all existing tests plus the 7 new projection tests. The Jest mock for `expo-live-activity` (Task 1) ensures `startActivity` / `updateActivity` / `stopActivity` are jest.fn stubs, so any path that exercises the store's actions in a test will silently invoke them without needing additional mocking.

- [ ] **Step 10: Commit**

```bash
git add lib/state/activeSessionStore.ts
git commit -m "feat(sp4g): wire rest-timer Live Activity into activeSessionStore"
```

---

## Task 8: Final smoke — typecheck, full suite, web boot, prebuild

**Files:** none modified.

**Context:** The closing smoke per spec §9. Four checks; if all pass, SP4g is done and SP4 closes.

- [ ] **Step 1: Full Jest suite**

```bash
npm test
```

Expected: PASS. Test count should be **previous total + 7** (the projection cases). Note the previous total per the meta-spec's 4f entry was "300 iOS tests" — the new total is **307**.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 3: Web boot smoke**

```bash
npx expo export --platform web --output-dir .expo/sp4g-web-smoke 2>&1 | tail -40
```

Expected: completes without error. The `--platform web` export bundles the entire app for web, which exercises the `Platform.OS !== 'ios'` short-circuit in the wrapper. If it fails with a `Cannot find module 'expo-live-activity'` error on the web side, the lazy-require shim in Task 5 isn't behaving as intended — fix before continuing.

`.expo/` is gitignored, so the output directory leaves no working-tree noise. `expo export` is non-interactive and finite, unlike `expo start` which would block this plan. It may take 30–60 seconds.

After it succeeds, clean up:

```bash
rm -rf .expo/sp4g-web-smoke
```

- [ ] **Step 4: iOS prebuild**

```bash
rm -rf ios
npx expo prebuild --platform ios --clean
```

Expected: completes without error. `ios/` is regenerated. Confirm the regenerated workspace contains:
- A new widget extension target (look under `ios/<projectName>LiveActivityExtension/` or similar — exact directory name depends on the plugin).
- `ios/<projectName>/Info.plist` with `<key>NSSupportsLiveActivities</key><true/>`.
- The `rest_timer.png` referenced from the extension's bundle (the package's plugin is responsible for copying it).

Quick verification:

```bash
grep -r "NSSupportsLiveActivities" ios/ | head
find ios -name "rest_timer*"
```

Expected: at least one match for each.

- [ ] **Step 5: Clean up the regenerated `ios/` directory**

The `ios/` folder is gitignored; we don't commit it. But leaving it can confuse future runs. If the prebuild succeeded, leave it for the user to inspect (the plan doesn't need to remove it). If you regenerated it temporarily and want a clean tree:

```bash
git status --porcelain | head
```

Expected: `ios/` is not listed (it's gitignored). If something else shows up unexpectedly, investigate before continuing.

- [ ] **Step 6: Update the meta-spec status entries**

Two files to update; both mark 4g complete and close out SP4.

**File A: `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md`**

In the §3 "Decomposition" table, change the row that begins:
```
| **4g** | **Live Activities** *(verification deferred)*
```
to:
```
| **4g** ✅ | **Live Activities** *(verification deferred)*
```

In the "Sub-slice status" subsection (right below the table), the line currently reads `- **4g** Pending.` Replace it with:

```
- **4g** ✅ Code complete 2026-04-26 — `expo-live-activity@^0.4.x` installed, plugin registered with `enablePushNotifications: false`. New `lib/live-activity/` module: static `REST_ACTIVITY_CONFIG`, pure projection (7 unit tests), wrapper with single in-flight ID + Platform guard + lazy native require. Bridge wired into `completeSet` / `addRestTime` / `skipRest` / `finishSession` / `discardSession`. Placeholder `assets/liveActivity/rest_timer.png` shipped (1×1 transparent PNG; user can swap for a real dumbbell glyph after iPhone smoke). 307 iOS tests passing, typecheck clean, `expo export --platform web` succeeds, `expo prebuild --platform ios --clean` regenerates `ios/` with `NSSupportsLiveActivities=true` and the widget extension target. Manual iPhone visual verification deferred per parent meta-spec §7. **SP4 closes.**
```

**File B: `docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md`**

In the §8a "Sub-project status" table, the row for sub-project 4 currently begins:
```
| 4 | iOS v2 — workouts | ⏳ In progress 2026-04-26 — meta-spec at …
```
Change `⏳ In progress 2026-04-26` to `✅ Complete 2026-04-26`. Then, at the very end of that same cell (which currently ends with `…4f ✅ code complete 2026-04-26 — POST /generate-routine route + iOS generate screen, transactional save, no schema delta. Backend live deploy + web smoke deferred to user. 4g pending.`), replace `4g pending.` with:

```
4g ✅ code complete 2026-04-26 — `expo-live-activity` rest-timer activity wired through `activeSessionStore` (start on rest-timer start, update on +30s, stop on skip/finish/discard); 7 projection tests; web export + iOS prebuild green. Visual verification on iPhone deferred per §7. **SP4 done.**
```

- [ ] **Step 7: Commit the meta-spec updates**

```bash
git add docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md docs/superpowers/specs/meta/2026-04-25-implementation-process-design.md
git commit -m "docs(sp4g): mark 4g code-complete and SP4 closed in meta specs"
```

---

## Done

After Task 8: SP4 is closed. The remaining work is the user's iPhone visual smoke (deferred per meta-spec §7), which is not gating.

**Reminder for the user (post-merge, when next on iPhone):**
1. EAS-build a fresh dev client (`eas build --profile development --platform ios`).
2. Install on the phone, log a strength set in any routine, watch for the Live Activity to appear on the lock screen and Dynamic Island.
3. If the placeholder PNG looks wrong (likely — it's 1×1 transparent), drop a real ~120×120 dumbbell PNG into `assets/liveActivity/rest_timer.png`, re-prebuild, re-build the dev client.
