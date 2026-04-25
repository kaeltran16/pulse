export interface StreakInput {
  ritualEntries: { ritualId: number; occurredAt: number }[];
  ritualId: number;
  asOf: Date;
}

/** ISO-like local-day key, e.g. "2026-04-25". */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyForMs(ms: number): string {
  return dayKey(new Date(ms));
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Construct at noon to dodge DST hour shifts.
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return dayKey(prev);
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
