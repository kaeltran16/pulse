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
