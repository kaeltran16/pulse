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
  imageSize: { width: 64, height: 64 },
  imageAlign: 'center',
  deepLinkUrl: '/move/active',
};
