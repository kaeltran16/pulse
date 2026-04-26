import type { HKActivityType } from './types';

export function activityTypeFor(
  session: { mode: 'strength' | 'cardio' },
  exercises: { equipment: string }[],
): HKActivityType {
  if (session.mode === 'strength') return 'traditionalStrengthTraining';
  const equipment = exercises[0]?.equipment?.toLowerCase() ?? '';
  if (equipment.includes('rower')) return 'rowing';
  if (equipment.includes('treadmill') || equipment.includes('outdoor run')) return 'running';
  return 'other';
}
