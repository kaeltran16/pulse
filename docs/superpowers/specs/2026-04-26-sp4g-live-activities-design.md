# SP4g — Live Activities (rest timer)

**Date:** 2026-04-26
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-25-ios-v2-workouts-design.md`](./meta/2026-04-25-ios-v2-workouts-design.md) §3 row 4g
**Scope:** A lock-screen / Dynamic Island Live Activity that surfaces the rest-timer countdown between strength sets. Driven entirely from `activeSessionStore`. Uses the canned widget shipped by Software Mansion's `expo-live-activity` package (published at https://www.npmjs.com/package/expo-live-activity). Visual verification on iPhone is deferred per parent meta-spec §7.

After this slice, **SP4 closes**.

---

## 1. What this slice ships

A complete, functional Live Activity for the rest timer:

- **Plugin install + native config.** `expo-live-activity` added to `package.json` and registered in `app.json`'s `plugins`. `npx expo prebuild --platform ios --clean` regenerates `ios/` with the package's widget extension target and the required `Info.plist` keys.
- **JS wrapper** at `lib/live-activity/index.ts` — single in-flight activity at a time, platform-guarded, no-op on web/Android.
- **Pure projection** at `lib/live-activity/projection.ts` — turns `ActiveSessionState` into a `LiveActivityState`, or `null` when no activity should be visible.
- **Static config** at `lib/live-activity/config.ts` — colors, timer style, deep link, image layout. Values mirror existing tokens.
- **One image asset** at `assets/liveActivity/rest_timer.png` — generic dumbbell glyph, 120×120, transparent PNG.
- **Lifecycle wiring** in `lib/state/activeSessionStore.ts` — start on rest-timer start, update on `+30s`, stop on skip / finish / discard.
- **Pure-function tests** for `projection.ts` (TDD does not apply per meta-spec, but cheap coverage).

The Activity actually works on the user's phone the next time they launch a strength session in a custom dev client. **It is not visually verified during this slice.** SP4 closes on type-check + prebuild + unit tests passing.

---

## 2. Locked decisions (from brainstorm)

These are settled inputs to the plan and are **not** open for relitigation.

| Decision | Choice | Reason |
|---|---|---|
| Activity scope | **Rest-timer only.** Strength sessions only; cardio shows nothing. | Matches the meta-spec's "lock-screen workout timer" framing, smallest ActivityKit surface, cleanest fit with the existing rest reducer. Whole-session ambient activity is a v3 ask. |
| Completeness level | **Baseline (functional, unverified).** | MVP-skeleton would close the smoke test on a technicality and ship dead code. Resume-aware Full level is YAGNI for v2 — iOS keeps activities alive across app death natively. |
| Widget shape | **Canned widget from `expo-live-activity`** — no custom Swift extension. | The package's API only exposes `LiveActivityState` (title/subtitle/progressBar/imageName) and `LiveActivityConfig`. Writing a hand-rolled widget extension would be a v3 swap, not a v2 expansion. |
| Update budget | **Zero per-second pushes.** Countdown is animated by iOS from `progressBar.date`. | ActivityKit's recommended pattern. The in-app rest reducer's `tickRest` does not touch the activity. |
| Push notifications | **Disabled.** `enablePushNotifications: false` in the plugin. | All updates fire from the local `activeSessionStore`. APNs would require a server token round-trip and is out of scope for v2. |
| Resume reconciliation | **Not implemented.** `hydrateFromDraft` does not re-acquire any in-flight activity. | Cold-starting the app mid-rest is rare; iOS keeps the existing activity alive on its own. JS-side reconciliation is v3 polish. |
| Wrapper API surface | `startRestActivity` / `updateRestActivity` / `stopRestActivity` — single in-flight ID held in module-local state | Call sites in the store stay free of ID plumbing. |
| Visual verification | **Deferred per parent meta-spec §7.** | The user verifies on phone next time they pick it up. SP4 does not block on it. |

---

## 3. Architecture

```
┌─ iOS (Expo Router) ──────────────────────────────────────────────────────┐
│  app/(tabs)/move/active.tsx  ── existing route from SP4d                 │
│        │                                                                  │
│        ▼                                                                  │
│  lib/state/activeSessionStore.ts  ── existing Zustand store               │
│        │  Actions wrapped with bridge calls:                              │
│        │    • completeSet → after startRestTimer → startRestActivity      │
│        │    • addRestTime  → updateRestActivity                           │
│        │    • skipRest     → stopRestActivity                             │
│        │    • finishSession / discardSession → stopRestActivity (if any)  │
│        ▼                                                                  │
│  lib/live-activity/ ── NEW                                                │
│   ├─ projection.ts  (pure: ActiveSessionState → LiveActivityState | null) │
│   ├─ config.ts      (static LiveActivityConfig — colors, timerType, …)   │
│   └─ index.ts       (typed wrapper; module-local activity ID;            │
│                       Platform.OS guard; try/catch import shim)          │
│        │                                                                  │
│        ▼                                                                  │
│  expo-live-activity  ── package's canned widget extension (Swift,         │
│                          generated on `expo prebuild`)                    │
│        │                                                                  │
│        ▼                                                                  │
│   iOS ActivityKit  ── lock-screen + Dynamic Island countdown,             │
│                        animated natively from progressBar.date            │
└──────────────────────────────────────────────────────────────────────────┘
```

**Why a wrapper module rather than calling `expo-live-activity` directly from the store:**
1. Owns the platform guard so the store stays cross-platform-clean.
2. Owns the module-local activity ID so call sites only deal with start/update/stop semantics.
3. Owns the try/catch import so the test environment (where the native module isn't linked) doesn't crash.

This mirrors how HealthKit is wired today: the store calls `finalizeSession`, which knows about the native HK call and returns a typed result. `activeSessionStore` does not import HealthKit directly, and it will not import `expo-live-activity` directly.

---

## 4. Data flow — the projection function

`projection.ts` is a single pure function:

```ts
import { type ActiveSessionState } from '@/lib/state/activeSessionStore';
import { type LiveActivityState } from 'expo-live-activity';

export function projectRestActivity(s: ActiveSessionState): LiveActivityState | null;
```

**Returns `null`** (no activity) when:
- `s.phase !== 'active'`
- `s.mode === 'cardio'`
- `s.rest.status !== 'running'`

**Otherwise** projects the following:

| Field | Source |
|---|---|
| `title` | `s.exercises[s.currentExerciseIdx].meta.name` |
| `subtitle` | `nextSetSummary(s)` — see below |
| `progressBar.date` | `s.rest.startedAt + s.rest.durationMs` (epoch ms) |
| `imageName` | `'rest_timer'` |
| `dynamicIslandImageName` | `'rest_timer'` |

**`nextSetSummary(s)`** computes the upcoming set's context. There are only two cases — `completeSet` already advances `currentExerciseIdx` to the next exercise when an exercise is exhausted (store, lines 245–252), so by the time we project, `currentExerciseIdx` is always pointing at the *upcoming* exercise; an "Up next: other exercise" branch is unreachable.

1. Compute `loggedAtCurrent = s.setDrafts.filter(d => d.exercisePosition === s.currentExerciseIdx).length` and `prescribedAtCurrent = s.exercises[s.currentExerciseIdx].prescribedSets.length`.
2. If `loggedAtCurrent < prescribedAtCurrent`:
   - Subtitle: `"Set {loggedAtCurrent + 1} of {prescribedAtCurrent} · {weight} kg × {reps}"` from `prescribedSets[loggedAtCurrent]`. If `weight` is `null`, drop the `"{weight} kg × "` segment. If `reps` is `null`, drop `" × {reps}"`. If both are `null`, drop the trailing ` · …` entirely.
3. Else (we just finished the final set of the final exercise; the auto-advance had nowhere to go):
   - Subtitle: `"Last rest · finish when ready"`.

The `title` (always `s.exercises[s.currentExerciseIdx].meta.name`) already conveys "you're about to do this exercise" — so when an exercise auto-advances (e.g., set 3 of 3 done on exercise 0 → idx becomes 1), the new title carries the exercise name and the subtitle reads `"Set 1 of N · …"`. No explicit "Up next:" prefix is needed.

---

## 5. Visuals — `LiveActivityConfig`

Static across the app's lifetime; defined once in `lib/live-activity/config.ts`:

```ts
export const REST_ACTIVITY_CONFIG: LiveActivityConfig = {
  backgroundColor: '#1C1C1E',          // tokens.dark.surface (single, not theme-reactive)
  titleColor:      '#FFFFFF',          // tokens.dark.ink
  subtitleColor:   '#EBEBF5',          // ~tokens.dark.ink2 flattened to opaque
  progressViewTint:        '#30D158',  // tokens.dark.move (Apple green; matches in-app rest pill)
  progressViewLabelColor:  '#FFFFFF',
  timerType:    'digital',             // matches the in-app rest pill's "1:32" rendering
  padding:      16,
  imagePosition:'left',
  imageSize:    64,
  imageAlign:   'center',
  deepLinkUrl:  '/move/active',
};
```

**Why static colors rather than light/dark-reactive:** `expo-live-activity` accepts flat hex strings, not pairs. The lock screen has its own background; the activity card sits on top. Dark-mode values render acceptably in both light and dark contexts and match the in-app rest pill, which is the closest visual reference.

**Why `'digital'` timer:** mirrors the in-app pill's `0:00` numeric format. `'circular'` would introduce a second rest-timer style we'd then have to keep visually consistent with.

**Final state on stop:** `title: 'Rest done'`, `subtitle` carrying the last next-set context (or empty for "Last rest"), `progressBar.date: Date.now()` so iOS reads `0:00`. iOS auto-dismisses within a few minutes.

---

## 6. Wrapper API (`lib/live-activity/index.ts`)

```ts
import { Platform } from 'react-native';

export function startRestActivity(state: LiveActivityState): void;
export function updateRestActivity(state: LiveActivityState): void;
export function stopRestActivity(finalState: LiveActivityState): void;
```

**Implementation contract:**
- Single in-flight activity ID held in module-local state (`let currentId: string | undefined`).
- All three functions early-return when `Platform.OS !== 'ios'`.
- The `expo-live-activity` import is `require()`'d inside an `if (Platform.OS === 'ios')` branch, wrapped in a `try { ... } catch { /* not linked */ }` so Jest and `npm run web` don't crash.
- `startRestActivity`: if `currentId` is set, calls `stopRestActivity(state)` first to enforce single in-flight (defensive — call sites should never overlap, but the cost is one extra native call on a coding bug).
- `updateRestActivity`: no-op when `currentId` is undefined.
- `stopRestActivity`: no-op when `currentId` is undefined; clears `currentId` after.

The wrapper takes a non-nullable `LiveActivityState`. Callers (the store's actions) are responsible for projecting the store state and only invoking `start` / `update` when projection returns non-null. For `stop` call sites, the final state is built by hand (see §7) — never via projection, since by stop-time the store may already have transitioned out of the running-rest state.

---

## 7. Lifecycle wiring (call sites in `activeSessionStore`)

| Existing action | Existing behavior | New behavior added |
|---|---|---|
| `completeSet` (strength branch) | calls `startRestTimer(restDefaultSeconds * 1000)` after upserting the draft | After `startRestTimer`, call `startRestActivity(projectRestActivity(get()))` if the projection is non-null. |
| `addRestTime` | adds 30-second increments to `rest.durationMs` | After the reducer updates, project from `get()` and call `updateRestActivity(projected)` if non-null. |
| `skipRest` | transitions rest to `idle` | Build a generic final state by hand (`title: 'Rest done'`, `subtitle: ''`, `progressBar.date: Date.now()`, `imageName: 'rest_timer'`) and call `stopRestActivity(finalState)`. The reducer transition can run before or after — projection isn't used. |
| `finishSession` | finalizes session, navigates | Same generic final state as `skipRest`. Stop before `finalizeSession`. |
| `discardSession` | discards draft, navigates | Same generic final state. Stop before discard. |
| `tickRest` | reducer no-op (visual only) | **No bridge call.** Countdown animates from `progressBar.date`. |
| `hydrateFromDraft` | resumes a draft session | **No bridge call.** Resume reconciliation is out of scope (§2). |

Stop call sites do not depend on projection succeeding — the final state is a small hand-built `LiveActivityState` (constant up to the `Date.now()` value). The wrapper is a no-op if no activity is in flight, so call sites don't need to track that themselves.

`startRestTimer` itself (the standalone action) intentionally does **not** touch the activity. Rest can be started programmatically from `completeSet`'s strength branch or by other future callers; only `completeSet` knows the next-set context. If a future caller starts a rest without that context, no activity appears, which is the safer default.

---

## 8. Off-iOS / dev client / asset / testing

**Web/Android shim.** Module-local `if (Platform.OS !== 'ios') return;` at the top of each wrapper function. The `expo-live-activity` import lives behind a `require()` inside an `if (Platform.OS === 'ios')` branch with try/catch, so:
- `npm run web` keeps booting (no native module crash on import).
- `npm test` (Jest, Node environment) keeps passing (the `require` is gated; even if it throws, the catch swallows).
- Android dev client keeps building (no iOS-only symbols leak).

**Plugin config (`app.json`):**

```jsonc
{
  "expo": {
    "plugins": [
      // … existing plugins …
      ["expo-live-activity", { "enablePushNotifications": false }]
    ]
  }
}
```

This is the only `app.json` edit. The plugin handles `Info.plist` `NSSupportsLiveActivities = true` and the widget extension target during prebuild. No manual Xcode work.

**Asset.** `assets/liveActivity/rest_timer.png`, ~120×120, transparent background, white dumbbell glyph. Source: SF Symbol `"dumbbell.fill"` exported as PNG, or a hand-drawn glyph at the same size. The file lives outside `assets/images/` because `expo-live-activity` looks at `assets/liveActivity/` specifically (per package docs). One file is sufficient; the canned widget reuses it for both lock-screen and Dynamic Island contexts.

**Tests** (`lib/live-activity/__tests__/projection.test.ts`):

| Case | Setup | Assertion |
|---|---|---|
| Rest running mid-exercise | `phase: 'active'`, `mode: 'strength'`, `currentExerciseIdx: 0`, two sets logged of three prescribed, `rest.status: 'running'` | Returns `LiveActivityState` with `title === exercise.name`, `subtitle === 'Set 3 of 3 · 80 kg × 8'`, `progressBar.date === startedAt + durationMs`. |
| Rest running, just auto-advanced to next exercise | All sets of exercise 0 logged, store auto-advanced `currentExerciseIdx` to 1, no sets logged for exercise 1 yet, rest running | `title === exercises[1].meta.name`, `subtitle === 'Set 1 of N · {weight} kg × {reps}'`. |
| Last rest of last exercise | `currentExerciseIdx: lastIdx`, all prescribed sets logged at lastIdx, rest running | `subtitle === 'Last rest · finish when ready'`. |
| Prescribed weight is null | Same as mid-exercise case but `prescribedSets[next].weightKg === null` | `subtitle === 'Set 3 of 3 · × 8'` (no `kg ×` segment). |
| Cardio session | `mode: 'cardio'`, rest status irrelevant | Returns `null`. |
| Rest idle | `phase: 'active'`, `mode: 'strength'`, `rest.status: 'idle'` | Returns `null`. |
| Phase not active | `phase: 'finalizing'` or `'idle'` or `'hydrating'` | Returns `null`. |

Seven cases. The wrapper itself is not tested — `tsc --noEmit` and `expo prebuild` cover its compile-time correctness; runtime correctness depends on iOS state we cannot exercise from Jest.

---

## 9. Smoke test (closes 4g and SP4)

1. **`npm test`** — full suite green, including the seven new projection tests.
2. **`npx tsc --noEmit`** — clean, no new errors.
3. **`npm run web`** — boots without crashing (verifies the no-op shim).
4. **`npx expo prebuild --platform ios --clean`** — completes without error. The regenerated `ios/` folder contains:
   - The `expo-live-activity` widget extension target.
   - `Info.plist` entry `NSSupportsLiveActivities = true`.
   - The `assets/liveActivity/rest_timer.png` referenced from the extension's bundle.

Visual rendering on iPhone is **deferred per parent meta-spec §7** and is the user's verification step at their convenience. If the prebuild succeeds, the EAS dev-client build is expected to succeed (the failure modes that prebuild catches are the high-novelty ones — config schema, plugin init, asset references).

---

## 10. Out of scope (explicit cuts)

| Item | Why deferred |
|---|---|
| Visual verification on iPhone | Per parent meta-spec §7. User verifies next time they pick up the phone. |
| Resume reconciliation on cold-start | iOS keeps activities alive across app death natively. JS-side awareness is v3 polish. |
| Push-driven updates (APNs) | All updates fire from the local store. Adding APNs would require a server-side token loop. v3+. |
| Cardio activity | Cardio doesn't trigger `startRestTimer`; nothing to render. |
| Whole-session ambient activity | Option B from brainstorm. Different lifecycle. v3 ask if requested. |
| Custom widget views | `expo-live-activity` is canned. Hand-rolled extension is a v3 swap. |
| JS wrapper unit tests | All platform-mocking, no signal. `tsc` and `prebuild` cover. |
| EAS dev-client build during this slice | Smoke test stops at prebuild. EAS build can happen any time after; not gating. |

---

## 11. Files touched

**New:**
- `lib/live-activity/index.ts`
- `lib/live-activity/projection.ts`
- `lib/live-activity/config.ts`
- `lib/live-activity/__tests__/projection.test.ts`
- `assets/liveActivity/rest_timer.png`

**Modified:**
- `package.json` — adds `expo-live-activity` (version pinned in plan)
- `app.json` — adds plugin entry
- `lib/state/activeSessionStore.ts` — bridge calls in `completeSet` (strength branch), `addRestTime`, `skipRest`, `finishSession`, `discardSession`

No schema delta. No backend change. No design-token change.

---

## 12. What this spec is NOT

- Not a plan. The next step (after user review) is invoking `superpowers:writing-plans` to produce the implementation plan.
- Not a v3 specification for richer Live Activities. v3 ambient activity / push-driven updates / custom widget views are documented as out-of-scope (§10), not designed.
- Not a binding on SP4 closure. SP4 closes when this slice's smoke test (§9) passes; visual verification is the user's call.
