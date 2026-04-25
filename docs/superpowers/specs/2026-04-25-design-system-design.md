# Pulse — Sub-project 1: Design System (tokens + theme)

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** [Implementation Process Design](2026-04-25-implementation-process-design.md)
**Sub-project:** 1 of 7

---

## 1. Purpose

Establish the styling foundation Pulse will reuse for the rest of its life: a theme provider, a single source of truth for color and typography tokens, and a NativeWind v4 + Tailwind setup that consumes those tokens.

This is also the project's **toolchain dress rehearsal** — the first AI-generated React Native code, verified visually on a tiny surface. If NativeWind v4, Reanimated 4, or our Jest setup are subtly broken, we want to find that out on this 200-line surface, not on the 5,000-line Today screen.

---

## 2. Non-goals

- **All eight named UI components** (NavBar, InsetSection, ListRow, TabBar, SummaryTile, ActivityRings, ProgressBar, CheckButton). Each will be built when its first consumer screen needs it.
- **Spacing and radius scales.** Tailwind defaults are sufficient until repeat patterns emerge. Codify when patterns repeat.
- **iOS-look helpers** (`expo-symbols`, `expo-blur`). Installed when first component needs them.
- **ActivityRings + Skia.** Installed in sub-project 3a alongside the Today screen.
- **Storybook.** Defer indefinitely — re-evaluate when component variants explode (likely SP4).
- **Persisted theme override.** The Light/Dark/System toggle is in-memory only. No AsyncStorage. Persistence is added if and when a user-facing Settings screen exists.
- **A global state store** (Zustand / Redux / etc.). Drizzle `useLiveQuery` plus Context covers SP1–3; revisit at SP4 (per parent spec §7).

---

## 3. Verification surface

Sub-project 1 is complete when **all four** pass:

1. `npx expo start` boots the app and the preview route loads on web. Expo Go on the user's iPhone loads the same route over LAN if available — the same JS bundle drives both targets, so web is the primary smoke target on Windows.
2. The preview screen renders:
   - Every semantic color from `tokens.ts` as a swatch labeled with its name and resolved hex.
   - Every entry in the typography scale as a sample line of text using that size, weight, and line height.
3. The top-right segmented control (Light / Dark / System) flips the theme. Every swatch and every sample line restyles to match the resolved mode. "System" follows the OS color scheme.
4. `npm test` passes. The parity test confirms `lib/theme/tokens.ts` and the resolved `tailwind.config.js` agree on every semantic color key (light + dark) and every typography entry.

"Code compiles" is not "code works" — all four bullets must be demonstrated.

---

## 4. Tokens

### 4.1 Source of truth

`lib/theme/tokens.ts` is the single source of truth. `tailwind.config.js` `require`s it and constructs its `theme.extend.colors` and `theme.extend.fontSize` from those exports. The parity test asserts that the resolved Tailwind config exactly matches what `tokens.ts` exports — drift becomes a literal mistake, not two divergent files.

### 4.2 Colors

Mirrored from `design_handoff/src/tokens.jsx`. Light and dark palettes use identical semantic keys with different hexes:

```
bg surface surface2
ink ink2 ink3 ink4
hair blur fill
money moneyTint
move moveTint
rituals ritualsTint
accent accentTint
red
```

Dark palette values come from the `dark` block in `tokens.jsx` verbatim. No additional hues introduced.

### 4.3 Typography

Extracted from the handoff and aligned to iOS system text styles. Keys are iOS-conventional names. Each entry carries `size`, `lineHeight`, and `weight`:

| Key | Size / LineHeight / Weight |
|---|---|
| largeTitle | 34 / 41 / 700 |
| title1 | 28 / 34 / 700 |
| title2 | 22 / 28 / 600 |
| title3 | 20 / 25 / 600 |
| headline | 17 / 22 / 600 |
| body | 17 / 22 / 400 |
| callout | 16 / 21 / 400 |
| subhead | 15 / 20 / 400 |
| footnote | 13 / 18 / 400 |
| caption1 | 12 / 16 / 400 |
| caption2 | 11 / 13 / 400 |

Before locking these in, the implementation plan must grep the handoff (`design_handoff/src/*.jsx`) for actual font sizes in use. If the handoff uses a size not in this list, add it. If the handoff diverges from iOS-system numbers, the handoff wins.

### 4.4 NativeWind v4 mode mechanism

NativeWind v4 supports two strategies for "two palettes by mode":

- **(a)** Duplicate semantic keys per mode (`bg-light`, `bg-dark`) and write `bg-bg-light dark:bg-bg-dark` at every call site.
- **(b)** Use NativeWind's CSS-variable theme support so a single class `bg-bg` resolves to the right hex per active scheme.

The plan must verify the v4 docs (via context7) and pick **(b)** if it works as described. (a) is the fallback if (b) has constraints we can't accept. Locking the choice happens in the implementation plan, not here.

---

## 5. Theme provider

### 5.1 API

```ts
// lib/theme/provider.tsx
type Mode = 'light' | 'dark' | 'system';
type Resolved = 'light' | 'dark';

ThemeProvider({ children })       // mounts in app/_layout.tsx
useTheme(): {
  mode: Mode;
  resolved: Resolved;
  setMode(m: Mode): void;
}
```

### 5.2 Behavior

- Initial `mode` is `'system'`.
- `resolved` is `system` when `mode === 'system'` (driven by `useColorScheme()`), otherwise equals `mode`.
- On every `mode` change, the provider calls NativeWind v4's `colorScheme.set(mode)` so that `dark:` variants apply correctly.
- Override state is in-memory only. No persistence.
- The same `resolved` value is what runtime consumers (Skia, Reanimated, anything that can't use a `className`) read from `tokens.ts`.

### 5.3 Consumer pattern

- Static styling: `className="bg-bg text-ink"` (NativeWind reads the active scheme).
- Runtime values: `const { resolved } = useTheme(); const hex = colors[resolved].money;`.

---

## 6. File layout

```
pulse/
  app/
    _layout.tsx              # mounts <ThemeProvider> + global.css
    index.tsx                # preview screen (replaces Expo template)
  lib/
    theme/
      tokens.ts              # source of truth — colors + type scale
      provider.tsx           # ThemeProvider + useTheme()
      __tests__/
        parity.test.ts       # asserts tokens.ts ⇔ resolved tailwind config
  tailwind.config.js         # consumes tokens.ts
  global.css                 # @tailwind base/components/utilities
  babel.config.js            # adds nativewind/babel
  metro.config.js            # withNativeWind(config, { input: './global.css' })
  jest.config.js             # jest-expo preset
  package.json
```

### 6.1 Existing scaffold cleanup

The Expo SDK 54 template ships files that conflict with this design. They are deleted as part of this sub-project:

- `components/themed-text.tsx`
- `components/themed-view.tsx`
- `components/external-link.tsx`
- `components/haptic-tab.tsx`
- `components/hello-wave.tsx`
- `components/parallax-scroll-view.tsx`
- `components/ui/` (entire directory)
- `hooks/use-color-scheme.ts` and `hooks/use-color-scheme.web.ts`
- `constants/theme.ts`
- `app/(tabs)/` (entire directory)
- `app/modal.tsx`

`app/_layout.tsx` is rewritten to mount our `<ThemeProvider>` instead of the React Navigation `<ThemeProvider>` from the template.

---

## 7. Preview screen

`app/index.tsx`. Single scrolling screen, no navigation, no tabs.

**Top-right corner:** segmented control with three options — `Light`, `Dark`, `System`. Tapping calls `setMode`.

**Body, top to bottom:**
1. **Colors** section. Each semantic color renders as a row: a 32px square swatch, the semantic name (e.g., `surface`), the resolved hex string. Group order: surfaces (`bg`, `surface`, `surface2`), inks (`ink`, `ink2`, `ink3`, `ink4`), structure (`hair`, `blur`, `fill`), accents (`money`, `move`, `rituals`, `accent`, `red`), and tinted accent variants (`moneyTint`, `moveTint`, `ritualsTint`, `accentTint`).
2. **Typography** section. Each typography key renders as one line of sample text using its size, weight, and line height, prefixed with the key name in `caption2` for reference.

The screen is functional, not polished. Its only job is to make token regressions and theme-flip bugs immediately visible.

---

## 8. Tests

### 8.1 Parity test (mandatory, TDD)

`lib/theme/__tests__/parity.test.ts`:

- Imports `colors` and `type` from `tokens.ts`.
- Imports `tailwindcss/resolveConfig` and the project's `tailwind.config.js`.
- For every key in `colors.light`: asserts `resolvedConfig.theme.colors[key]` resolves to the same hex (handling whatever NativeWind palette structure we end up with).
- For every key in `colors.dark`: same assertion against the dark palette.
- For every key in `type`: asserts `resolvedConfig.theme.fontSize[key]` carries the matching size and lineHeight.

**Written first.** The implementation plan starts by adding this failing test, then wires up `tokens.ts` + `tailwind.config.js` until it passes.

### 8.2 Other tests

None in this sub-project. The preview screen is verified visually.

---

## 9. Dependencies added

- `nativewind@^4`
- `tailwindcss@^3.4`
- `react-native-reanimated@^4` (peer of NativeWind v4 for some features; also our animation lib going forward)
- `react-native-worklets` (separate package in Reanimated 4)
- `jest`
- `jest-expo`
- `@types/jest`

Versions to be confirmed against context7 in the implementation plan; numbers above are SDK 54-compatible at time of writing.

---

## 10. Risks and accepted tradeoffs

- **NativeWind v4 + RN web parity.** Some NativeWind features behave differently on web vs native. The preview screen avoids any feature beyond colors and font sizes precisely to keep this surface narrow.
- **Reanimated 4 in SDK 54.** Worklets are a separate package in v4. The plan must run `npx expo install` (not `npm install`) for these so version pinning matches the SDK.
- **Typography numbers may need revision.** §4.3 commits to a tentative scale. The plan will verify against the handoff before locking values.
- **The preview screen is throwaway.** It will be deleted (or repurposed as a debug route) once real screens land in SP3a. That is the intended lifecycle.

---

## 11. Parent meta-spec amendments

Applied as part of writing this spec:

- §3 table, row "1 — Design system":
  - Verification surface: replaced "Demo screen showing every shared component (NavBar, InsetSection, ListRow, TabBar, SummaryTile, **ActivityRings**, ProgressBar, CheckButton) in light + dark + all 8 accents, viewable in Android emulator and Expo Go" with "Preview screen renders all color tokens and the type scale; Light/Dark/System toggle flips the theme; `npm test` passes the token parity test. Targets: web (primary on Windows) and Expo Go on iPhone (when available)."
  - TDD scope: replaced "Theme token correctness; ring math" with "Theme token parity (`tokens.ts` ⇔ resolved Tailwind config)."
- §7 already amended with the global-state-store deferral.

---

## 12. Out-of-scope, picked up by later sub-projects

| Concern | Where it lands |
|---|---|
| `NavBar`, `ListRow`, `TabBar`, `SummaryTile`, `InsetSection`, `ProgressBar`, `CheckButton` | Built in 3a / 3b alongside their first consumer screen |
| `ActivityRings` + Skia integration | 3a (Today screen) |
| Spacing and radius scales | Codified when patterns repeat — likely 3a |
| `expo-symbols`, `expo-blur` | First component that needs them — likely 3a |
| Settings → Appearance toggle (persisted theme override) | Not in current roadmap; adds AsyncStorage + a screen if requested |
| Global state store decision | SP4 brainstorm |
