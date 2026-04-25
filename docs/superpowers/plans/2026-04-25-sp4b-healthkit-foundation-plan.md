# SP4b — HealthKit Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the local Mac → iPhone dev-client toolchain and a thin HealthKit wrapper module (`lib/health/*`) verified by a dev-only smoke screen on the user's iPhone.

**Architecture:** Add `@kingstinct/react-native-healthkit` (Nitro, new-arch) via its Expo config plugin. Wrap the library behind a narrow API (`requestPermissions`, `writeWorkout`, `useLiveHeartRate`) so SP4d/4e consume one local module, not a sprawling library. Verification is a dev screen on a real iPhone — not Jest. Build path is `expo prebuild` + Xcode + personal-team signing on the user's Mac.

**Tech Stack:** Expo SDK 54, React Native new arch, `@kingstinct/react-native-healthkit` v9, `react-native-nitro-modules`, Xcode (Mac), TypeScript.

**Spec:** [`../specs/2026-04-25-sp4b-healthkit-foundation-design.md`](../specs/2026-04-25-sp4b-healthkit-foundation-design.md)

---

## Plan deviation from spec (small, intentional)

The spec §2 named "anchored-object query polling ~5 s" as the read approach. While writing the plan we confirmed the library exposes `useMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate')`, which gives reactive most-recent-sample updates with no manual polling. The spec's intent ("live BPM during session") is preserved; the implementation uses the library primitive. SP4d will pick the final session-HR strategy regardless.

---

## Cross-platform note (Windows + Mac)

The user works primarily on Windows but has a Mac for iOS. Tasks 1–8 are Windows-friendly (TypeScript + config). Tasks 9–13 require the Mac. Each task header marks **[Windows]** or **[Mac]**. The `git push`/`git pull` between Tasks 8 and 9 is the handoff point.

---

## File map

**Created**
- `lib/health/types.ts` — `WorkoutWritePayload`, `HRSample`, `HKActivityType`
- `lib/health/permissions.ts` — `requestPermissions()`
- `lib/health/workouts.ts` — `writeWorkout()`
- `lib/health/heart-rate.ts` — `useLiveHeartRate()` hook
- `lib/health/index.ts` — public re-exports
- `app/dev/healthkit.tsx` — dev smoke screen
- `__tests__/health.types.test.ts` — type/shape sanity tests (Jest — what's testable without the device)

**Modified**
- `app.json` — kingstinct plugin entry + usage strings
- `package.json` — new deps + `ios:prebuild` script
- `.gitignore` — confirm `ios/` and `android/` are ignored
- `app/(tabs)/today.tsx` (or wherever `DevSeedButton` sits) — add a small "HealthKit dev" link button (dev builds only)
- `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md` — flip SP4b status row at the end

**Generated, NOT committed**
- `ios/` — produced by `expo prebuild`

---

## Task 1: Install dependencies [Windows]

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

Run from project root:

```bash
npm install @kingstinct/react-native-healthkit react-native-nitro-modules
```

Expected: both packages added to `dependencies` in `package.json`. No errors. (Peer-dep warnings about iOS-only are normal — nothing wired up yet.)

- [ ] **Step 2: Verify install + lockfile updated**

```bash
npm ls @kingstinct/react-native-healthkit react-native-nitro-modules
```

Expected: both resolve to single versions. If `npm ls` reports peer-dep conflicts with `expo@~54.0.33`, stop and surface the conflict before continuing — see spec §6 risk row 2.

- [ ] **Step 3: Add `ios:prebuild` script to `package.json`**

In the `"scripts"` block, add:

```json
"ios:prebuild": "expo prebuild --platform ios --clean"
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. (Adding deps doesn't change TS surface yet.)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(sp4b): add HealthKit deps (kingstinct + nitro)"
```

---

## Task 2: Configure the Expo HealthKit plugin [Windows]

**Files:**
- Modify: `app.json`
- Modify: `.gitignore`

- [ ] **Step 1: Add the plugin entry to `app.json`**

In `expo.plugins`, after the existing entries, add the kingstinct plugin block. The full `plugins` array should now read:

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
      "dark": { "backgroundColor": "#000000" }
    }
  ],
  "expo-sqlite",
  [
    "@kingstinct/react-native-healthkit",
    {
      "NSHealthShareUsageDescription": "Pulse reads your heart rate during workouts to show live BPM in the active-session screen.",
      "NSHealthUpdateUsageDescription": "Pulse saves completed workouts to the Health app so they appear alongside your other activity."
    }
  ]
]
```

Notes:
- `background: true` is **not** set. Background delivery may need a paid Apple Developer account (spec §6) and SP4b doesn't require it.
- The plugin auto-injects `HealthKit` capability into the generated entitlements file; we do not edit `app.json` to add a separate entitlements key.

- [ ] **Step 2: Confirm `.gitignore` excludes generated native dirs**

Open `.gitignore` and verify these lines exist (add if missing):

```
ios/
android/
```

If `ios/` is currently committed, that's a separate concern — for SP4b it should be gitignored. If you discover `ios/` is checked in, stop and ask the user before deleting it.

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app.json .gitignore
git commit -m "chore(sp4b): configure kingstinct healthkit plugin + usage strings"
```

---

## Task 3: Wrapper types [Windows]

**Files:**
- Create: `lib/health/types.ts`
- Create: `__tests__/health.types.test.ts`

- [ ] **Step 1: Write the failing shape test**

Create `__tests__/health.types.test.ts`:

```ts
import type { WorkoutWritePayload, HRSample, HKActivityType } from '@/lib/health/types';

describe('health types', () => {
  it('WorkoutWritePayload accepts the four supported activity types', () => {
    const types: HKActivityType[] = [
      'traditionalStrengthTraining',
      'running',
      'rowing',
      'other',
    ];
    for (const activityType of types) {
      const p: WorkoutWritePayload = {
        activityType,
        start: new Date(0),
        end: new Date(60_000),
      };
      expect(p.activityType).toBe(activityType);
    }
  });

  it('HRSample has bpm:number and sampledAt:Date', () => {
    const s: HRSample = { bpm: 72, sampledAt: new Date() };
    expect(typeof s.bpm).toBe('number');
    expect(s.sampledAt).toBeInstanceOf(Date);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx jest __tests__/health.types.test.ts
```

Expected: FAIL — module `@/lib/health/types` not found (or TS errors on the imports).

- [ ] **Step 3: Implement the types module**

Create `lib/health/types.ts`:

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
};

export type HRSample = {
  bpm: number;
  sampledAt: Date;
};
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx jest __tests__/health.types.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/health/types.ts __tests__/health.types.test.ts
git commit -m "feat(sp4b): health types — WorkoutWritePayload, HRSample, HKActivityType"
```

---

## Task 4: Permissions wrapper [Windows]

**Files:**
- Create: `lib/health/permissions.ts`

The wrapper is a thin pass-through. It cannot be unit-tested without the native module (mocking would be testing the mock). The smoke test in Task 12 is the real verification. Honest tasks, no fake tests.

- [ ] **Step 1: Implement `lib/health/permissions.ts`**

```ts
import { requestAuthorization } from '@kingstinct/react-native-healthkit';

const READ_TYPES = ['HKQuantityTypeIdentifierHeartRate'] as const;
const WRITE_TYPES = ['HKWorkoutTypeIdentifier'] as const;

export async function requestPermissions(): Promise<{ granted: boolean }> {
  // iOS deliberately hides per-type grants; we treat "user responded to sheet"
  // as granted=true. Real failures surface as thrown errors at write/read time.
  try {
    await requestAuthorization(WRITE_TYPES, READ_TYPES);
    return { granted: true };
  } catch {
    return { granted: false };
  }
}
```

If the imperative function name differs in the installed library version (the library also exports a `useHealthkitAuthorization` hook variant), use the imperative one. Quick check:

```bash
node -e "console.log(Object.keys(require('@kingstinct/react-native-healthkit')))" 2>&1 | head -3
```

If `requestAuthorization` is not exported but a different imperative function is (e.g. `requestAuthorizationAsync`), use that name and update the import. Do not switch to the hook variant — the smoke screen calls this from a button handler, which a hook can't model cleanly.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. The native lib's `.d.ts` resolves cleanly on Windows even without the native binary.

- [ ] **Step 3: Commit**

```bash
git add lib/health/permissions.ts
git commit -m "feat(sp4b): requestPermissions wrapper"
```

---

## Task 5: Workouts wrapper [Windows]

**Files:**
- Create: `lib/health/workouts.ts`

- [ ] **Step 1: Implement `lib/health/workouts.ts`**

```ts
import { saveWorkoutSample } from '@kingstinct/react-native-healthkit';
import type { HKActivityType, WorkoutWritePayload } from './types';

// HKWorkoutActivityType numeric IDs (Apple HealthKit constants).
// Source: https://developer.apple.com/documentation/healthkit/hkworkoutactivitytype
const ACTIVITY_TYPE_ID: Record<HKActivityType, number> = {
  traditionalStrengthTraining: 50,
  running: 37,
  rowing: 35,
  other: 3000,
};

export async function writeWorkout(p: WorkoutWritePayload): Promise<void> {
  const id = ACTIVITY_TYPE_ID[p.activityType];
  await saveWorkoutSample(id, [], p.start, { end: p.end });
}
```

If the installed library version exports `saveWorkoutSample` under a different name (e.g. `HealthKit.saveWorkoutSample` namespace import), adjust the import accordingly — the same `node -e` introspection from Task 4 Step 1 surfaces it.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/health/workouts.ts
git commit -m "feat(sp4b): writeWorkout wrapper"
```

---

## Task 6: Live heart-rate hook [Windows]

**Files:**
- Create: `lib/health/heart-rate.ts`

- [ ] **Step 1: Implement `lib/health/heart-rate.ts`**

```ts
import { useState } from 'react';
import { useMostRecentQuantitySample } from '@kingstinct/react-native-healthkit';
import type { HRSample } from './types';

export function useLiveHeartRate(): {
  current: HRSample | null;
  isStreaming: boolean;
  start: () => void;
  stop: () => void;
} {
  const [isStreaming, setStreaming] = useState(false);

  // Library hook subscribes/unsubscribes based on the type id.
  // When isStreaming is false we still call the hook (rules of hooks)
  // but ignore its result.
  const sample = useMostRecentQuantitySample('HKQuantityTypeIdentifierHeartRate');

  const current: HRSample | null =
    isStreaming && sample
      ? {
          bpm: sample.quantity,
          sampledAt: new Date(sample.endDate),
        }
      : null;

  return {
    current,
    isStreaming,
    start: () => setStreaming(true),
    stop: () => setStreaming(false),
  };
}
```

Notes:
- The kingstinct hook returns a sample shaped like `{ quantity: number, startDate, endDate, ... }`. If the installed version uses different field names (e.g. `value` instead of `quantity`), adjust at implementation time — TS errors will tell you exactly what to change.
- We don't drop the underlying subscription on `stop()`; we just stop reporting. Idempotent toggling is fine for the smoke screen.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors. If TS complains about `sample.quantity`, inspect the type and adjust the field name; commit either way.

- [ ] **Step 3: Commit**

```bash
git add lib/health/heart-rate.ts
git commit -m "feat(sp4b): useLiveHeartRate hook"
```

---

## Task 7: Public API barrel [Windows]

**Files:**
- Create: `lib/health/index.ts`

- [ ] **Step 1: Write the barrel**

```ts
export { requestPermissions } from './permissions';
export { writeWorkout } from './workouts';
export { useLiveHeartRate } from './heart-rate';
export type {
  WorkoutWritePayload,
  HRSample,
  HKActivityType,
} from './types';
```

- [ ] **Step 2: Type-check + run all tests**

```bash
npx tsc --noEmit
npx jest
```

Expected: tsc clean, all existing tests still pass (SP3a/SP4a regression check).

- [ ] **Step 3: Commit**

```bash
git add lib/health/index.ts
git commit -m "feat(sp4b): public lib/health barrel"
```

---

## Task 8: Dev smoke screen [Windows]

**Files:**
- Create: `app/dev/healthkit.tsx`

- [ ] **Step 1: Write the screen**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import {
  requestPermissions,
  writeWorkout,
  useLiveHeartRate,
} from '@/lib/health';

type LogEntry = { ts: Date; msg: string };

export default function HealthKitDevScreen() {
  const [log, setLog] = useState<LogEntry[]>([]);
  const hr = useLiveHeartRate();

  const append = (msg: string) =>
    setLog((prev) => [{ ts: new Date(), msg }, ...prev].slice(0, 20));

  const onRequestPerms = async () => {
    try {
      const { granted } = await requestPermissions();
      append(`requestPermissions → granted=${granted}`);
    } catch (e) {
      append(`requestPermissions THREW: ${String(e)}`);
    }
  };

  const onWrite = async () => {
    const start = new Date(Date.now() - 5 * 60 * 1000);
    const end = new Date();
    try {
      await writeWorkout({
        activityType: 'traditionalStrengthTraining',
        start,
        end,
      });
      append(`writeWorkout OK — 5min strength @ ${end.toISOString()}`);
    } catch (e) {
      append(`writeWorkout THREW: ${String(e)}`);
    }
  };

  return (
    <ScrollView className="flex-1 bg-black p-6">
      <Text className="text-white text-2xl mb-4">HealthKit Dev</Text>

      <View className="gap-3 mb-6">
        <Pressable
          onPress={onRequestPerms}
          className="bg-blue-600 rounded-lg p-4"
        >
          <Text className="text-white text-center">Request permissions</Text>
        </Pressable>

        <Pressable
          onPress={onWrite}
          className="bg-green-700 rounded-lg p-4"
        >
          <Text className="text-white text-center">
            Write 5-min strength workout
          </Text>
        </Pressable>

        <Pressable
          onPress={hr.isStreaming ? hr.stop : hr.start}
          className="bg-red-700 rounded-lg p-4"
        >
          <Text className="text-white text-center">
            {hr.isStreaming ? 'Stop HR' : 'Start HR'}
          </Text>
        </Pressable>

        <Text className="text-white text-lg">
          HR: {hr.current ? `${hr.current.bpm.toFixed(0)} bpm` : '—'}
        </Text>
      </View>

      <Text className="text-white text-lg mb-2">Log</Text>
      {log.map((e, i) => (
        <Text key={i} className="text-white text-xs mb-1">
          {e.ts.toLocaleTimeString()} {e.msg}
        </Text>
      ))}
    </ScrollView>
  );
}
```

NativeWind classes are used per project convention. If a class fails to apply on iPhone, fall back to inline `style={{}}` — but verify the existing Today screen still uses NativeWind first.

- [ ] **Step 2: Add a dev-only entry point**

The smallest reachable entry: in whichever screen contains `DevSeedButton`, add a sibling button (only render in `__DEV__`):

```tsx
import { Link } from 'expo-router';
// ... within the dev region of the screen:
{__DEV__ && (
  <Link href="/dev/healthkit" asChild>
    <Pressable className="bg-purple-700 rounded-lg p-3">
      <Text className="text-white text-center">HealthKit dev</Text>
    </Pressable>
  </Link>
)}
```

If `DevSeedButton` is not yet on any visible screen (it was created in SP3a's plan but may live elsewhere), put the link directly on `app/(tabs)/today.tsx` inside a `{__DEV__ && ...}` guard.

- [ ] **Step 3: Type-check + lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 4: Web sanity check (will fail at runtime — that's OK)**

```bash
npm run web
```

Open the dev screen. The page will render but the buttons will throw on tap (HealthKit doesn't exist on web). Confirm:
- The screen mounts without a render-time crash.
- The "HR: —" line renders.
- Other tabs (Today, etc.) still render — no regressions.

Stop the web server.

- [ ] **Step 5: Commit + push**

```bash
git add app/dev/healthkit.tsx app/\(tabs\)/today.tsx
git commit -m "feat(sp4b): healthkit dev smoke screen"
git push origin main
```

The push is the **handoff to the Mac**. Tasks 9+ run on the Mac.

---

## Task 9: Sync repo on the Mac and run prebuild [Mac]

**Files:**
- Generated: `ios/` (NOT committed)

- [ ] **Step 1: Sync the Mac**

On the Mac:

```bash
cd ~/Projects/pulse   # adjust to actual path; clone if first time
git pull origin main
npm install
```

Expected: `node_modules` populated with the new HealthKit deps.

- [ ] **Step 2: Run prebuild**

```bash
npm run ios:prebuild
```

Expected: `ios/` directory generated. Output mentions running the kingstinct config plugin.

- [ ] **Step 3: Verify the entitlements file**

```bash
cat ios/Pulse/Pulse.entitlements
```

Expected output includes:

```xml
<key>com.apple.developer.healthkit</key>
<true/>
```

If the file is missing or the key is absent, the plugin failed silently. Re-run with `--clean` and inspect the output. If still missing, check the plugin entry in `app.json` matches Task 2 Step 1 exactly.

- [ ] **Step 4: Verify the Info.plist usage strings**

```bash
plutil -p ios/Pulse/Info.plist | grep -E 'NSHealth(Share|Update)UsageDescription'
```

Expected: both keys present with the descriptions from Task 2.

(No commit. `ios/` is gitignored; nothing to add.)

---

## Task 10: Configure Xcode signing [Mac]

This task is manual — Xcode UI clicks. Document each click; do not assume the engineer knows the Xcode signing tab.

- [ ] **Step 1: Open the workspace**

```bash
open ios/Pulse.xcworkspace
```

(Note: open the `.xcworkspace`, not the `.xcodeproj`.)

- [ ] **Step 2: Select the project + target**

In the left sidebar, click the blue `Pulse` project icon at the top. In the editor pane, select target **Pulse** under TARGETS.

- [ ] **Step 3: Switch to "Signing & Capabilities" tab**

- [ ] **Step 4: Set signing**

- Check **"Automatically manage signing"**.
- **Team:** select your personal Apple ID team (shows up as "Your Name (Personal Team)"). If none listed, click "Add an Account…" and sign in with your Apple ID.
- **Bundle Identifier:** confirm `com.kael.pulse`.

- [ ] **Step 5: Confirm HealthKit capability is present**

Below the signing section, the **HealthKit** capability should already be listed (the plugin added it via the entitlements file). If it's missing, click **+ Capability** and add HealthKit.

- [ ] **Step 6: First-run "trust" caveat**

When you build to the iPhone in Task 11, iOS may prompt the user to trust the developer profile. On the iPhone: **Settings → General → VPN & Device Management → Developer App → trust your Apple ID**.

- [ ] (No commit — Xcode signing config is not file-tracked beyond the entitlements file already verified.)

---

## Task 11: First Xcode build to iPhone — regression check [Mac]

- [ ] **Step 1: Connect iPhone via USB and unlock**

Trust the Mac if prompted on the phone.

- [ ] **Step 2: Pick the device in Xcode's run destination**

Top toolbar → the destination dropdown → select your iPhone (not a simulator).

- [ ] **Step 3: Build and run**

Click ▶ (or Cmd-R). First build will be slow (5–10 minutes; Nitro modules compile native code).

Expected: app launches on iPhone. The existing Today screen renders — three rings, stat blocks, FAB. No new HealthKit prompts at launch (we only request permission on the dev screen's button).

If build fails:
- Signing error → revisit Task 10.
- Nitro / new-arch build error → check `Podfile` was generated with new-arch enabled (it should be — `app.json` has `newArchEnabled: true`).
- "Provisioning profile doesn't include com.apple.developer.healthkit" → personal team may not support HealthKit. If reproduced after a clean rebuild, this is the spec §6 row 1 risk; stop and surface to user.

- [ ] **Step 4: Smoke the existing app surfaces (regression)**

On the iPhone:
- Today tab renders (rings + stats).
- Tab switcher works (Today / Move / Rituals / You stubs).
- DevSeedButton (if present) still seeds without errors.

If any of these regressed compared to SP4a's last known good state, stop and investigate before continuing.

- [ ] (No commit yet — the app is built and proven, but the smoke test for SP4b's actual feature is Task 12.)

---

## Task 12: Run the SP4b smoke verification [Mac + iPhone]

Spec §1 success criteria, executed on the iPhone:

- [ ] **Step 1: Navigate to the dev HealthKit screen**

Tap the "HealthKit dev" link added in Task 8 Step 2. Screen renders with three buttons and "HR: —".

- [ ] **Step 2: Tap "Request permissions"**

Expected: Apple's HealthKit permission sheet appears. Toggle ON for Heart Rate (read) and Workouts (write). Tap "Allow".

The log should show: `requestPermissions → granted=true`.

If the sheet doesn't appear:
- Check console output via `npx react-native log-ios` (run from project root on Mac).
- Common cause: permission already granted in a prior install; re-tapping is a no-op. Uninstall + reinstall to re-trigger.

If `requestPermissions THREW: ...` is logged: read the error. "Authorization not determined" is normal on first call and resolves after the user taps Allow. Other errors → flag.

- [ ] **Step 3: Tap "Write 5-min strength workout"**

Expected log line: `writeWorkout OK — 5min strength @ 2026-...`.

Open the iPhone's Health app → Browse → Activity → Workouts. The new entry appears with type "Traditional Strength Training", duration 5 min, the timestamp matching the log line.

- [ ] **Step 4: Tap "Start HR" while wearing Apple Watch**

Expected: within ~5–15 seconds, the "HR: — bpm" line updates to a real BPM (60–100 typical resting). Number updates as new samples arrive.

If "HR: —" never updates:
- Confirm the Apple Watch is on-wrist and unlocked.
- Confirm Watch heart rate is recording (open the Heart app on the Watch — value visible).
- Confirm permissions were granted for Heart Rate read in Step 2.
- The library may need a restart of the dev client to pick up newly granted read permissions; quit the app fully and re-launch.

- [ ] **Step 5: Tap "Stop HR"**

Expected: the displayed BPM clears to `—`. Tapping "Start HR" again resumes.

- [ ] **Step 6: All five smoke criteria green?**

If yes → continue to Task 13. If no → diagnose, fix in the corresponding earlier task, and re-run from the failing step.

(No commit — verification only.)

---

## Task 13: Update meta-spec status row + final commit [Windows or Mac]

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md`

- [ ] **Step 1: Find the SP4b row in the meta-spec**

Open the file. Locate the section listing 4a–4g status (around §3 Decomposition or a status table further down).

- [ ] **Step 2: Update SP4b's status**

Replace the current "Pending" / placeholder cell for 4b with:

```
✅ Complete 2026-MM-DD — local Mac → iPhone toolchain proven (expo prebuild + Xcode + personal team), kingstinct/react-native-healthkit v9 wired with config plugin, lib/health wrapper (requestPermissions, writeWorkout, useLiveHeartRate) verified by dev smoke screen on iPhone: HealthKit permission sheet → workout written and visible in Health.app → live HR streamed from Apple Watch.
```

Replace `MM-DD` with the actual completion date.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-25-ios-v2-workouts-design.md
git commit -m "docs(sp4b): mark slice 4b complete in SP4 meta-spec"
git push origin main
```

- [ ] **Step 4: Tick all the boxes in this plan file**

Mark every `- [ ]` above as `- [x]`. Commit:

```bash
git add docs/superpowers/plans/2026-04-25-sp4b-healthkit-foundation-plan.md
git commit -m "docs: mark SP4b plan tasks complete"
git push origin main
```

SP4b is done. Next slice is SP4c (Routine browse + edit) — its own spec → plan cycle.

---

## Self-review notes

**Spec coverage:**
- §1 toolchain proven → Tasks 1, 2, 9, 10, 11.
- §1 kingstinct wired → Tasks 1, 2, 9.
- §1 wrapper module → Tasks 3–7.
- §1 dev screen → Task 8.
- §1 smoke test (5 criteria) → Task 12 steps 1–5.
- §2 locked decisions: build path (Tasks 9–11), library (Tasks 1–6), smoke surface (Task 8), payload shape (Task 5), HR approach (Task 6 — adjusted per "Plan deviation" note above), `ios/` gitignored (Task 2 Step 2), `requestPermissions` boolean (Task 4).
- §3 file map → all files in plan file map.
- §4 toolchain steps preview → Tasks 1, 2, 9, 10, 11, 6–8, 12, 13.
- §5 wrapper API surface → Tasks 3–7 implement exactly the signatures shown.
- §6 risks called out at relevant decision points (Task 1 Step 2, Task 9 Step 3, Task 11 Step 3).
- §7 verification posture → Task 12 explicitly runs the iPhone smoke per spec §1.

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling"/"similar to Task N" patterns.

**Type consistency:** `WorkoutWritePayload`, `HRSample`, `HKActivityType` defined in Task 3 and consumed unchanged in Tasks 4–8. Function signatures (`requestPermissions`, `writeWorkout`, `useLiveHeartRate`) match between definition tasks and the dev-screen consumer.
