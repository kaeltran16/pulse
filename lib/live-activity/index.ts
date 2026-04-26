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
