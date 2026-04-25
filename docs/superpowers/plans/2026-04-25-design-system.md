# Pulse Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up Pulse's styling foundation — a `tokens.ts` source of truth, NativeWind v4 + Tailwind wired through CSS variables, an in-memory `ThemeProvider`, and a preview screen — verified by a TDD parity test plus visual smoke on web and Expo Go.

**Architecture:** `lib/theme/tokens.ts` exports semantic colors (light + dark) and an iOS-aligned typography scale. `tailwind.config.js` consumes those tokens, declares each color as `var(--<key>)`, and ships a plugin that writes `:root` (light) and `.dark` (dark) CSS variable blocks. NativeWind v4's `colorScheme.set()` toggles the `dark` class. `ThemeProvider` exposes `{mode, resolved, setMode}` over Context. A preview screen (`app/index.tsx`) shows every swatch + every type sample with a Light/Dark/System segmented control top-right.

**Tech Stack:** Expo SDK 54, expo-router, React Native 0.81, NativeWind v4, Tailwind 3.4, Reanimated 4 + worklets (already installed), Jest + jest-expo, TypeScript.

---

## File Structure

**Created:**
- `lib/theme/tokens.ts` — colors (light + dark) and typography scale
- `lib/theme/provider.tsx` — `ThemeProvider`, `useTheme()`
- `lib/theme/__tests__/parity.test.ts` — TDD parity test
- `lib/theme/build-css-vars.ts` — pure helper turning tokens → CSS-var blocks (importable by both `tailwind.config.js` and the parity test, so the test asserts the same data the plugin emits)
- `tailwind.config.js`
- `global.css` — `@tailwind base/components/utilities`
- `babel.config.js` — adds `nativewind/babel` and `react-native-worklets/plugin`
- `metro.config.js` — `withNativeWind(config, { input: './global.css' })`
- `jest.config.js` — `jest-expo` preset

**Rewritten:**
- `app/_layout.tsx` — mounts `<ThemeProvider>` and imports `global.css`
- `app/index.tsx` — preview screen (replaces Expo template index inside the deleted `(tabs)` group)

**Modified:**
- `app.json` — add `"userInterfaceStyle": "automatic"` (required for NativeWind dark mode on Expo)
- `package.json` — new deps + `"test": "jest"` script
- `tsconfig.json` — verify `@/*` path alias still resolves (already in template)

**Deleted (Expo template scaffold, per spec §6.1):**
- `components/themed-text.tsx`, `components/themed-view.tsx`, `components/external-link.tsx`, `components/haptic-tab.tsx`, `components/hello-wave.tsx`, `components/parallax-scroll-view.tsx`
- `components/ui/` (entire directory)
- `hooks/use-color-scheme.ts`, `hooks/use-color-scheme.web.ts`, `hooks/use-theme-color.ts`
- `constants/theme.ts` (and the `constants/` dir if empty)
- `app/(tabs)/` (entire directory)
- `app/modal.tsx`

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + dev dependencies via Expo**

`expo install` (not `npm install`) is required for Expo-aware version pinning of any package Expo SDK 54 ships a constraint for. Tailwind and Jest are not Expo-aware, so plain `npm install -D` is fine.

Run:
```bash
npx expo install nativewind tailwindcss
npm install --save-dev jest jest-expo @types/jest
```

Verify `package.json` ended up with (versions may resolve slightly differently — accept whatever `expo install` chose):
- `nativewind` ≥ 4.x
- `tailwindcss` ≥ 3.4 (NativeWind v4 does NOT support Tailwind 4.x)
- `jest`, `jest-expo`, `@types/jest` in `devDependencies`

`react-native-reanimated@~4.1.1` and `react-native-worklets@0.5.1` are already present per the SDK 54 scaffold — do not reinstall.

- [ ] **Step 2: Add the test script**

Edit `package.json`, add to `scripts`:
```json
"test": "jest"
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(deps): add nativewind, tailwind, jest for design system"
```

---

## Task 2: Configure Expo for NativeWind dark mode

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Set `userInterfaceStyle` to `automatic`**

NativeWind v4's docs require `userInterfaceStyle: "automatic"` so the OS color scheme propagates to JS (otherwise `useColorScheme()` always returns `light`).

Open `app.json`. Inside the `expo` block, add (or update if present):
```json
"userInterfaceStyle": "automatic"
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "chore(expo): set userInterfaceStyle to automatic for NativeWind"
```

---

## Task 3: Delete template scaffold

**Files:**
- Delete: see list under "File Structure" above

- [ ] **Step 1: Remove the template files and directories**

Run (bash on Windows uses forward slashes; these are git-tracked deletions, no `-f` needed):
```bash
rm -r app/(tabs) components/ui
rm app/modal.tsx
rm components/themed-text.tsx components/themed-view.tsx components/external-link.tsx components/haptic-tab.tsx components/hello-wave.tsx components/parallax-scroll-view.tsx
rm hooks/use-color-scheme.ts hooks/use-color-scheme.web.ts hooks/use-theme-color.ts
rm constants/theme.ts
rmdir components hooks constants 2>/dev/null || true
```

The trailing `rmdir` line removes the now-empty directories; ignore failures if any directory still has files.

- [ ] **Step 2: Make `app/_layout.tsx` and `app/index.tsx` valid placeholders**

The template's `_layout.tsx` imports `@/hooks/use-color-scheme` (now deleted) and references `(tabs)` (now deleted). It will be fully rewritten in Task 9; for now, replace it with a minimal stub so `expo start` does not crash mid-plan.

Overwrite `app/_layout.tsx`:
```tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `app/index.tsx` as a minimal placeholder (will be rewritten in Task 10):
```tsx
import { Text, View } from 'react-native';

export default function Index() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>Pulse — preview pending</Text>
    </View>
  );
}
```

- [ ] **Step 3: Run typecheck to confirm nothing else imported the deleted files**

Run: `npx tsc --noEmit`
Expected: zero errors. If there are unresolved imports referencing the deleted files (e.g., another scaffold file still pointing at `@/components/themed-text`), delete those references — do not restore the deleted file.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete Expo template scaffold ahead of design system"
```

---

## Task 4: Write `tokens.ts`

**Files:**
- Create: `lib/theme/tokens.ts`

- [ ] **Step 1: Verify typography sizes against the handoff**

Spec §4.3 mandates a grep before locking the type scale. Run:
```bash
grep -hoE 'fontSize:\s*[0-9]+' design_handoff/src/*.jsx | sort -u
```

The handoff today shows these sizes in use: 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 40, 44, 46, 48, 72, 140.

Lock the typography scale as the iOS-aligned 11 entries from spec §4.3. Display sizes (≥40) seen in the handoff are one-off numeric readouts and will be applied via inline style at the call site, not promoted to the scale — promoting them would balloon the token surface for values used in one place. Sizes 14, 18, 24, 26, 30, 32 likewise appear in chrome (badges, buttons, big-number deltas) rather than as text styles; same treatment. If a future component needs a recurring size that is missing, add it then.

If the user disagrees, ask before continuing — the spec ("if the handoff uses a size not in this list, add it") is strict. Default behavior in this plan is the narrow scale above.

- [ ] **Step 2: Write `lib/theme/tokens.ts`**

Create `lib/theme/tokens.ts`:
```ts
// Single source of truth for Pulse design tokens.
// Mirrored from design_handoff/src/tokens.jsx; do not edit colors here without
// updating the handoff (or vice versa) — the parity test only checks
// tokens.ts ⇔ tailwind.config.js, not tokens.ts ⇔ handoff.

export const colors = {
  light: {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    ink: '#000000',
    ink2: 'rgba(60,60,67,0.85)',
    ink3: 'rgba(60,60,67,0.6)',
    ink4: 'rgba(60,60,67,0.3)',
    hair: 'rgba(60,60,67,0.12)',
    blur: 'rgba(242,242,247,0.72)',
    fill: 'rgba(120,120,128,0.12)',
    money: '#FF9500',
    moneyTint: 'rgba(255,149,0,0.14)',
    move: '#34C759',
    moveTint: 'rgba(52,199,89,0.14)',
    rituals: '#AF52DE',
    ritualsTint: 'rgba(175,82,222,0.14)',
    accent: '#007AFF',
    accentTint: 'rgba(0,122,255,0.14)',
    red: '#FF3B30',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    ink: '#FFFFFF',
    ink2: 'rgba(235,235,245,0.85)',
    ink3: 'rgba(235,235,245,0.6)',
    ink4: 'rgba(235,235,245,0.3)',
    hair: 'rgba(84,84,88,0.65)',
    blur: 'rgba(0,0,0,0.72)',
    fill: 'rgba(120,120,128,0.24)',
    money: '#FF9F0A',
    moneyTint: 'rgba(255,159,10,0.18)',
    move: '#30D158',
    moveTint: 'rgba(48,209,88,0.18)',
    rituals: '#BF5AF2',
    ritualsTint: 'rgba(191,90,242,0.18)',
    accent: '#0A84FF',
    accentTint: 'rgba(10,132,255,0.18)',
    red: '#FF453A',
  },
} as const;

export type ColorKey = keyof typeof colors.light;

export const type = {
  largeTitle: { size: 34, lineHeight: 41, weight: '700' },
  title1:     { size: 28, lineHeight: 34, weight: '700' },
  title2:     { size: 22, lineHeight: 28, weight: '600' },
  title3:     { size: 20, lineHeight: 25, weight: '600' },
  headline:   { size: 17, lineHeight: 22, weight: '600' },
  body:       { size: 17, lineHeight: 22, weight: '400' },
  callout:    { size: 16, lineHeight: 21, weight: '400' },
  subhead:    { size: 15, lineHeight: 20, weight: '400' },
  footnote:   { size: 13, lineHeight: 18, weight: '400' },
  caption1:   { size: 12, lineHeight: 16, weight: '400' },
  caption2:   { size: 11, lineHeight: 13, weight: '400' },
} as const;

export type TypeKey = keyof typeof type;
```

- [ ] **Step 3: Verify `tokens.ts` compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add lib/theme/tokens.ts
git commit -m "feat(theme): add tokens.ts source of truth (colors + type scale)"
```

---

## Task 5: Write the `build-css-vars` helper

This helper is shared by `tailwind.config.js` (which feeds Tailwind's `addBase`) and the parity test (which asserts the same data). Sharing keeps the test honest: if the helper is wrong, the same wrongness ships in production.

**Files:**
- Create: `lib/theme/build-css-vars.ts`

- [ ] **Step 1: Write the helper**

Create `lib/theme/build-css-vars.ts`:
```ts
import { colors, type } from './tokens';
import type { ColorKey } from './tokens';

/**
 * Returns the two CSS-variable blocks fed to Tailwind's `addBase`:
 * `:root` for light mode, `.dark` for the dark-class override.
 */
export function buildColorVars() {
  const toBlock = (palette: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(palette).map(([k, v]) => [`--${k}`, v]),
    );
  return {
    ':root':  toBlock(colors.light),
    '.dark':  toBlock(colors.dark),
  };
}

/**
 * Returns the `theme.extend.colors` object: every semantic key maps to
 * `var(--<key>)`. NativeWind reads the active scheme via the `dark` class
 * NativeWind v4 toggles when `colorScheme.set('dark')` is called.
 */
export function buildColorVarMap(): Record<ColorKey, string> {
  const keys = Object.keys(colors.light) as ColorKey[];
  return Object.fromEntries(keys.map((k) => [k, `var(--${k})`])) as Record<
    ColorKey,
    string
  >;
}

/**
 * Returns the `theme.extend.fontSize` object Tailwind expects:
 * `[size, { lineHeight, fontWeight }]` per key.
 */
export function buildFontSizeMap() {
  return Object.fromEntries(
    Object.entries(type).map(([k, v]) => [
      k,
      [`${v.size}px`, { lineHeight: `${v.lineHeight}px`, fontWeight: v.weight }],
    ]),
  ) as Record<
    keyof typeof type,
    [string, { lineHeight: string; fontWeight: string }]
  >;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/theme/build-css-vars.ts
git commit -m "feat(theme): add build-css-vars helper shared by tailwind + tests"
```

---

## Task 6: Write the failing parity test (TDD)

**Files:**
- Create: `lib/theme/__tests__/parity.test.ts`
- Create: `jest.config.js`

- [ ] **Step 1: Write `jest.config.js`**

Create `jest.config.js`:
```js
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
};
```

- [ ] **Step 2: Write the failing test**

Create `lib/theme/__tests__/parity.test.ts`:
```ts
import resolveConfig from 'tailwindcss/resolveConfig';
import tailwindConfig from '../../../tailwind.config.js';
import { colors, type } from '../tokens';
import {
  buildColorVarMap,
  buildColorVars,
  buildFontSizeMap,
} from '../build-css-vars';

const resolved = resolveConfig(tailwindConfig as any) as any;

describe('tokens.ts ⇔ tailwind.config.js parity', () => {
  describe('colors — every semantic key maps to var(--<key>)', () => {
    const expected = buildColorVarMap();
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      it(`colors.${key} resolves to ${expected[key]}`, () => {
        expect(resolved.theme.colors[key]).toBe(expected[key]);
      });
    }
  });

  describe('CSS variable blocks emitted by the tailwind plugin', () => {
    // The tailwind config exposes the addBase data via a named export
    // for this test (see tailwind.config.js Task 7).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { __cssVarBlocksForTest } = require('../../../tailwind.config.js');
    const expected = buildColorVars();

    it(':root block matches every light token', () => {
      for (const [k, v] of Object.entries(colors.light)) {
        expect(__cssVarBlocksForTest[':root'][`--${k}`]).toBe(v);
      }
    });

    it('.dark block matches every dark token', () => {
      for (const [k, v] of Object.entries(colors.dark)) {
        expect(__cssVarBlocksForTest['.dark'][`--${k}`]).toBe(v);
      }
    });

    it('.dark and :root cover identical key sets', () => {
      const lightKeys = Object.keys(expected[':root']).sort();
      const darkKeys = Object.keys(expected['.dark']).sort();
      expect(darkKeys).toEqual(lightKeys);
    });
  });

  describe('typography — every type key matches', () => {
    const expected = buildFontSizeMap();
    for (const key of Object.keys(type) as (keyof typeof type)[]) {
      it(`fontSize.${key} matches`, () => {
        const got = resolved.theme.fontSize[key];
        const exp = expected[key];
        // Tailwind shape: ['17px', { lineHeight: '22px', fontWeight: '400' }]
        expect(got[0]).toBe(exp[0]);
        expect(got[1].lineHeight).toBe(exp[1].lineHeight);
        expect(got[1].fontWeight).toBe(exp[1].fontWeight);
      });
    }
  });
});
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `npm test -- --testPathPattern=parity`
Expected: FAIL — `Cannot find module '../../../tailwind.config.js'` (config doesn't exist yet).

If the failure is something else (e.g., `jest-expo preset not found`), fix the harness before continuing — the next task assumes the test runs and fails on the missing config alone.

- [ ] **Step 4: Commit**

```bash
git add jest.config.js lib/theme/__tests__/parity.test.ts
git commit -m "test(theme): add parity test (failing) for tokens ⇔ tailwind"
```

---

## Task 7: Write `tailwind.config.js` and make the parity test pass

**Files:**
- Create: `tailwind.config.js`
- Create: `global.css`
- Create: `babel.config.js`
- Create: `metro.config.js`

- [ ] **Step 1: Write `tailwind.config.js`**

Note: requires the TS helper. This works because `jest-expo` preset uses `babel-jest` with `babel-preset-expo`, which transpiles TS imports from JS. For Tailwind CLI / Metro at build time, NativeWind handles `.ts` imports through Metro's resolver. If issues arise, swap the helper to `.js` (no type changes are needed; types are only for the test file).

Actually — Tailwind's CLI runs in Node and does NOT transpile `.ts` by default. To keep the helper reusable from both Node-side Tailwind and Jest, port the helper to plain `.js`. Update `lib/theme/build-css-vars.ts` → `lib/theme/build-css-vars.js` (delete the `.ts`, replace with the same logic in JS, drop the type annotations) before writing `tailwind.config.js`.

Replace `lib/theme/build-css-vars.ts` with `lib/theme/build-css-vars.js`:
```js
const { colors, type } = require('./tokens.cjs');

function buildColorVars() {
  const toBlock = (palette) =>
    Object.fromEntries(Object.entries(palette).map(([k, v]) => [`--${k}`, v]));
  return {
    ':root': toBlock(colors.light),
    '.dark': toBlock(colors.dark),
  };
}

function buildColorVarMap() {
  return Object.fromEntries(
    Object.keys(colors.light).map((k) => [k, `var(--${k})`]),
  );
}

function buildFontSizeMap() {
  return Object.fromEntries(
    Object.entries(type).map(([k, v]) => [
      k,
      [`${v.size}px`, { lineHeight: `${v.lineHeight}px`, fontWeight: v.weight }],
    ]),
  );
}

module.exports = { buildColorVars, buildColorVarMap, buildFontSizeMap };
```

Tailwind config also runs in Node, so `tokens.ts` needs a Node-readable companion. Create `lib/theme/tokens.cjs`:
```js
// Auto-mirrored from tokens.ts. Edit tokens.ts as the source of truth;
// this file exists only because tailwind.config.js runs in Node and cannot
// import .ts directly. The parity test guarantees they stay aligned.

const colors = {
  light: {
    bg: '#F2F2F7',
    surface: '#FFFFFF',
    surface2: '#F2F2F7',
    ink: '#000000',
    ink2: 'rgba(60,60,67,0.85)',
    ink3: 'rgba(60,60,67,0.6)',
    ink4: 'rgba(60,60,67,0.3)',
    hair: 'rgba(60,60,67,0.12)',
    blur: 'rgba(242,242,247,0.72)',
    fill: 'rgba(120,120,128,0.12)',
    money: '#FF9500',
    moneyTint: 'rgba(255,149,0,0.14)',
    move: '#34C759',
    moveTint: 'rgba(52,199,89,0.14)',
    rituals: '#AF52DE',
    ritualsTint: 'rgba(175,82,222,0.14)',
    accent: '#007AFF',
    accentTint: 'rgba(0,122,255,0.14)',
    red: '#FF3B30',
  },
  dark: {
    bg: '#000000',
    surface: '#1C1C1E',
    surface2: '#2C2C2E',
    ink: '#FFFFFF',
    ink2: 'rgba(235,235,245,0.85)',
    ink3: 'rgba(235,235,245,0.6)',
    ink4: 'rgba(235,235,245,0.3)',
    hair: 'rgba(84,84,88,0.65)',
    blur: 'rgba(0,0,0,0.72)',
    fill: 'rgba(120,120,128,0.24)',
    money: '#FF9F0A',
    moneyTint: 'rgba(255,159,10,0.18)',
    move: '#30D158',
    moveTint: 'rgba(48,209,88,0.18)',
    rituals: '#BF5AF2',
    ritualsTint: 'rgba(191,90,242,0.18)',
    accent: '#0A84FF',
    accentTint: 'rgba(10,132,255,0.18)',
    red: '#FF453A',
  },
};

const type = {
  largeTitle: { size: 34, lineHeight: 41, weight: '700' },
  title1:     { size: 28, lineHeight: 34, weight: '700' },
  title2:     { size: 22, lineHeight: 28, weight: '600' },
  title3:     { size: 20, lineHeight: 25, weight: '600' },
  headline:   { size: 17, lineHeight: 22, weight: '600' },
  body:       { size: 17, lineHeight: 22, weight: '400' },
  callout:    { size: 16, lineHeight: 21, weight: '400' },
  subhead:    { size: 15, lineHeight: 20, weight: '400' },
  footnote:   { size: 13, lineHeight: 18, weight: '400' },
  caption1:   { size: 12, lineHeight: 16, weight: '400' },
  caption2:   { size: 11, lineHeight: 13, weight: '400' },
};

module.exports = { colors, type };
```

Update `lib/theme/tokens.ts` to re-export from the `.cjs` (so `tokens.ts` stays the canonical TypeScript surface for app code, and the data lives in one place):
```ts
// Single source of truth — the actual data lives in tokens.cjs so
// tailwind.config.js (Node) can require it. tokens.ts re-exports with TS
// types so app code keeps autocomplete + structural checks. The parity test
// asserts both surfaces stay aligned with the resolved Tailwind config.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const data = require('./tokens.cjs') as {
  colors: {
    light: Record<string, string>;
    dark: Record<string, string>;
  };
  type: Record<
    string,
    { size: number; lineHeight: number; weight: string }
  >;
};

export const colors = data.colors as {
  light: Readonly<Record<ColorKey, string>>;
  dark: Readonly<Record<ColorKey, string>>;
};
export const type = data.type as Readonly<Record<TypeKey, {
  size: number; lineHeight: number; weight: string;
}>>;

export type ColorKey =
  | 'bg' | 'surface' | 'surface2'
  | 'ink' | 'ink2' | 'ink3' | 'ink4'
  | 'hair' | 'blur' | 'fill'
  | 'money' | 'moneyTint'
  | 'move' | 'moveTint'
  | 'rituals' | 'ritualsTint'
  | 'accent' | 'accentTint'
  | 'red';

export type TypeKey =
  | 'largeTitle' | 'title1' | 'title2' | 'title3'
  | 'headline' | 'body' | 'callout' | 'subhead'
  | 'footnote' | 'caption1' | 'caption2';
```

Delete the now-stale `.ts` helper:
```bash
rm lib/theme/build-css-vars.ts
```

Update the parity test import (Task 6 wrote `from '../build-css-vars'` — this still resolves to the `.js` file since both Jest and Node prefer `.js` when both extensions exist).

- [ ] **Step 2: Write `tailwind.config.js`**

Create `tailwind.config.js`:
```js
const {
  buildColorVarMap,
  buildColorVars,
  buildFontSizeMap,
} = require('./lib/theme/build-css-vars');

const cssVarBlocks = buildColorVars();

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './lib/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class', // NativeWind v4 toggles the `dark` class via colorScheme.set
  theme: {
    extend: {
      colors: buildColorVarMap(),
      fontSize: buildFontSizeMap(),
    },
  },
  plugins: [
    ({ addBase }) => addBase(cssVarBlocks),
  ],
};

// Exposed for the parity test only — not consumed by Tailwind itself.
module.exports.__cssVarBlocksForTest = cssVarBlocks;
```

- [ ] **Step 3: Write `global.css`**

Create `global.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Write `babel.config.js`**

Create `babel.config.js`:
```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: ['react-native-worklets/plugin'],
  };
};
```

`react-native-worklets/plugin` MUST be the last plugin (Reanimated 4 requirement).

- [ ] **Step 5: Write `metro.config.js`**

Create `metro.config.js`:
```js
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: './global.css' });
```

- [ ] **Step 6: Run the parity test and verify it passes**

Run: `npm test -- --testPathPattern=parity`
Expected: PASS — every color key, every typography key, both `:root` and `.dark` blocks aligned.

If it fails because the test imports `../build-css-vars` and Jest can't resolve `.js` after the helper rename, change the import to `'../build-css-vars.js'` explicitly. Do not change the runtime behavior to make the test pass — fix the import or the helper.

- [ ] **Step 7: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add lib/theme/tokens.ts lib/theme/tokens.cjs lib/theme/build-css-vars.js tailwind.config.js global.css babel.config.js metro.config.js
git rm lib/theme/build-css-vars.ts
git commit -m "feat(theme): wire tokens through tailwind via CSS variables"
```

---

## Task 8: Write `ThemeProvider`

**Files:**
- Create: `lib/theme/provider.tsx`

- [ ] **Step 1: Write the provider**

Create `lib/theme/provider.tsx`:
```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';

export type Mode = 'light' | 'dark' | 'system';
export type Resolved = 'light' | 'dark';

type ThemeContextValue = {
  mode: Mode;
  resolved: Resolved;
  setMode: (m: Mode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<Mode>('system');
  const systemScheme = useRNColorScheme(); // 'light' | 'dark' | null

  const resolved: Resolved =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  // Keep NativeWind in sync. Passing 'system' to colorScheme.set restores
  // OS-driven behavior; otherwise it pins.
  useEffect(() => {
    nwColorScheme.set(mode);
  }, [mode]);

  const setMode = useCallback((m: Mode) => setModeState(m), []);

  const value = useMemo(
    () => ({ mode, resolved, setMode }),
    [mode, resolved, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/theme/provider.tsx
git commit -m "feat(theme): add ThemeProvider with in-memory mode override"
```

---

## Task 9: Rewrite `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: Mount `ThemeProvider` and import `global.css`**

Overwrite `app/_layout.tsx`:
```tsx
import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ThemeProvider } from '@/lib/theme/provider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
```

The `import '../global.css'` line is the trigger that registers Tailwind utilities with NativeWind on every platform.

- [ ] **Step 2: Verify `tsconfig.json` has the `@/*` alias**

Run: `grep -A2 '"paths"' tsconfig.json`
Expected: a `"@/*": ["./*"]` (or equivalent) entry. If missing, add it under `compilerOptions`. The Expo SDK 54 template includes it by default.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(app): mount ThemeProvider + global.css in root layout"
```

---

## Task 10: Build the preview screen

**Files:**
- Modify: `app/index.tsx`

- [ ] **Step 1: Write the preview screen**

Overwrite `app/index.tsx`:
```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme, type Mode } from '@/lib/theme/provider';
import { colors, type, type ColorKey, type TypeKey } from '@/lib/theme/tokens';

const COLOR_GROUPS: { label: string; keys: ColorKey[] }[] = [
  { label: 'Surfaces',         keys: ['bg', 'surface', 'surface2'] },
  { label: 'Inks',             keys: ['ink', 'ink2', 'ink3', 'ink4'] },
  { label: 'Structure',        keys: ['hair', 'blur', 'fill'] },
  { label: 'Accents',          keys: ['money', 'move', 'rituals', 'accent', 'red'] },
  { label: 'Tinted accents',   keys: ['moneyTint', 'moveTint', 'ritualsTint', 'accentTint'] },
];

const TYPE_KEYS = Object.keys(type) as TypeKey[];

const MODES: Mode[] = ['light', 'dark', 'system'];

function ModeToggle() {
  const { mode, setMode } = useTheme();
  return (
    <View className="flex-row rounded-lg border border-hair overflow-hidden">
      {MODES.map((m) => {
        const active = m === mode;
        return (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            className={active ? 'bg-accent px-3 py-1.5' : 'bg-surface px-3 py-1.5'}
          >
            <Text className={active ? 'text-surface' : 'text-ink2'} style={{ fontSize: 13 }}>
              {m[0].toUpperCase() + m.slice(1)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Swatch({ name, hex }: { name: ColorKey; hex: string }) {
  return (
    <View className="flex-row items-center py-1.5">
      <View
        className="w-8 h-8 rounded border border-hair mr-3"
        style={{ backgroundColor: hex }}
      />
      <Text className="text-ink" style={{ fontSize: 15, fontWeight: '600', minWidth: 120 }}>
        {name}
      </Text>
      <Text className="text-ink3" style={{ fontSize: 13 }}>
        {hex}
      </Text>
    </View>
  );
}

function TypeSample({ name }: { name: TypeKey }) {
  const t = type[name];
  return (
    <View className="py-2">
      <Text className="text-ink3" style={{ fontSize: 11 }}>
        {name} · {t.size}/{t.lineHeight}/{t.weight}
      </Text>
      <Text
        className="text-ink"
        style={{ fontSize: t.size, lineHeight: t.lineHeight, fontWeight: t.weight as any }}
      >
        The quick brown fox jumps
      </Text>
    </View>
  );
}

export default function Preview() {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row justify-between items-center px-4 py-3">
        <Text className="text-ink" style={{ fontSize: 22, fontWeight: '700' }}>
          Pulse — preview
        </Text>
        <ModeToggle />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 48 }}>
        <Text className="text-ink2 mt-2 mb-1" style={{ fontSize: 17, fontWeight: '600' }}>
          Colors ({resolved})
        </Text>
        {COLOR_GROUPS.map((group) => (
          <View key={group.label} className="mb-3">
            <Text className="text-ink3 mt-2 mb-1" style={{ fontSize: 12 }}>
              {group.label}
            </Text>
            {group.keys.map((k) => (
              <Swatch key={k} name={k} hex={palette[k]} />
            ))}
          </View>
        ))}

        <Text className="text-ink2 mt-4 mb-1" style={{ fontSize: 17, fontWeight: '600' }}>
          Typography
        </Text>
        {TYPE_KEYS.map((k) => (
          <TypeSample key={k} name={k} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

The `className="bg-bg"` etc. depend on Task 7 wiring. The screen mixes `className` (for theme-aware background/ink) and inline `style` (for size/weight/lineHeight), since the `fontSize` keys in Tailwind would need utility classes like `text-headline` — usable, but inline styles let the screen self-document the actual numbers. That choice is intentional for a preview surface.

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/index.tsx
git commit -m "feat(app): preview screen with all tokens + Light/Dark/System toggle"
```

---

## Task 11: Visual verification (web + Expo Go)

This is the manual gate from spec §3 bullets 1–3. None of it is automated. The agent executing this plan should pause and present the surface to the user for confirmation; do not mark Task 11 complete on the agent's behalf.

**Files:** none modified.

- [ ] **Step 1: Boot the web target**

Run (in a separate terminal): `npx expo start --web`
Expected: a browser tab opens on `http://localhost:8081` (or similar) and renders the preview screen with light-mode swatches and type samples.

If the tab is blank or shows a Metro error referencing `withNativeWind`, the most common cause is `userInterfaceStyle` missing from `app.json` (Task 2) or `babel.config.js` not loading the worklets plugin last. Verify both before deeper debugging. Use the systematic-debugging skill if neither fixes it.

- [ ] **Step 2: Verify swatch + typography content**

In the web tab, scroll the preview and confirm:
- Each color group from `COLOR_GROUPS` is present with the keys listed in spec §7.
- Each typography key from `type` renders one sample line.
- The hex shown next to each swatch matches the value in `lib/theme/tokens.cjs` for the currently active mode.

- [ ] **Step 3: Verify the Light/Dark/System toggle**

Tap each segment in the top-right control. Expected on each tap:
- Backgrounds, ink colors, and hex strings all update to the new mode's palette.
- "System" follows the OS scheme. On web, change the OS appearance preference (or the browser's emulated `prefers-color-scheme` via DevTools) and confirm the screen restyles within ~1s.

- [ ] **Step 4: Verify on Expo Go (iPhone, optional but preferred)**

If the user's iPhone is on the same LAN as the dev machine, scan the QR shown by `npx expo start`. Expected: the same preview screen renders, the toggle works, and "System" follows iOS Settings → Display → Appearance.

If the iPhone cannot reach the dev machine, skip this step and call it out in the completion notes — web is the primary smoke target on Windows per spec §3 bullet 1.

- [ ] **Step 5: Confirm `npm test` passes**

Run: `npm test`
Expected: parity test suite passes; no other tests exist yet.

- [ ] **Step 6: Hand off to user for sign-off**

Do not commit anything in this task. Pause and request user verification of bullets 1–4 of spec §3 before the plan is considered complete.

---

## Task 12: Final commit and self-review

**Files:**
- Modify: `STACK.md` if it still says "design system pending" — leave as-is otherwise. The status table in the parent meta-spec is updated in a follow-up commit, not here.

- [ ] **Step 1: Run the full verification battery**

Run all in sequence:
```bash
npx tsc --noEmit
npm test
```
Expected: zero errors, all tests pass.

- [ ] **Step 2: Check for stray template artifacts**

Run: `git ls-files components hooks constants 2>/dev/null`
Expected: no output (those directories should be gone). If anything remains, delete it and commit.

- [ ] **Step 3: Final commit (only if uncommitted changes remain)**

```bash
git status
# if anything is dirty:
git add -A
git commit -m "chore(theme): cleanup post-design-system rollout"
```

---

## Self-review notes

**Spec coverage:**
- §3 verification bullets → Task 11 manual gate + Task 6/7 parity test.
- §4.1 single source of truth → Task 4 (`tokens.ts`/`tokens.cjs`) + Task 7 (Tailwind consumes via `build-css-vars`).
- §4.2 colors → Task 4 mirrors `tokens.jsx` verbatim.
- §4.3 typography → Task 4 step 1 enforces the grep-vs-handoff reconciliation; the plan defaults to the spec's narrow scale and asks the user before expanding.
- §4.4 NativeWind v4 mode mechanism → Task 7 picks (b): `var(--<key>)` + `addBase` blocks + `darkMode: 'class'` toggled by `colorScheme.set`.
- §5 ThemeProvider API + behavior → Task 8.
- §6.1 scaffold cleanup → Task 3.
- §7 preview screen → Task 10.
- §8.1 parity test (TDD) → Tasks 6 + 7.
- §9 dependencies → Task 1.

**Tradeoffs locked here that the spec left open:**
- Helper is `.js`, not `.ts`, so Tailwind (Node) and Jest both consume the same module. `tokens.cjs` carries the data; `tokens.ts` re-exports with types. The parity test is what keeps the two surfaces honest.
- Display-only sizes from the handoff (≥40px) are NOT promoted to typography keys; they will be applied inline at the call site. Documented in Task 4 step 1 with an escape hatch ("ask user if disagrees").
- Preview screen mixes `className` (theme-aware) and inline `style` (typography sizes) deliberately — the preview self-documents the actual numbers, and we have not yet decided which `text-<key>` utilities to expose.

**Known risks called out in spec §10 the plan addresses:**
- Reanimated 4 worklets plugin ordering → Task 7 step 4 puts `react-native-worklets/plugin` last.
- `expo install` for SDK-pinned deps → Task 1 step 1.
- NativeWind v4 + RN web parity → preview surface stays minimal (colors + sizes), per Task 10 design.
