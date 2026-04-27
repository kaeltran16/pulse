import { dayKey, dayKeyForMs, previousDayKey } from './dayKey';

export { dayKey, dayKeyForMs, previousDayKey };

export interface StreakInput {
  ritualEntries: { ritualId: number; occurredAt: number }[];
  ritualId: number;
  asOf: Date;
}

export function streakForRitual(input: StreakInput): number {
  const days = new Set<string>();
  for (const e of input.ritualEntries) {
    if (e.ritualId !== input.ritualId) continue;
    days.add(dayKeyForMs(e.occurredAt));
  }
  if (days.size === 0) return 0;

  const todayKey = dayKey(input.asOf);
  // Anchor: today if logged, otherwise yesterday if logged, else 0.
  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else {
    const y = previousDayKey(todayKey);
    if (!days.has(y)) return 0;
    cursor = y;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}
