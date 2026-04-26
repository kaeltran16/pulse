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
