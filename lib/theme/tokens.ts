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
    cyan: '#5AC8FA',
    cyanTint: 'rgba(90,200,250,0.14)',
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
    cyan: '#64D2FF',
    cyanTint: 'rgba(100,210,255,0.18)',
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
