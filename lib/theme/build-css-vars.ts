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
