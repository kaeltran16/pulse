export interface DayBounds {
  startMs: number;
  endMs: number;
}

export function localDayBounds(asOf: Date): DayBounds {
  const start = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate(),
    0, 0, 0, 0,
  );
  const end = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate() + 1,
    0, 0, 0, 0,
  );
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export interface TodayAggregateInput {
  asOf: Date;
  goals: { dailyBudgetCents: number; dailyMoveMinutes: number; dailyRitualTarget: number };
  activeRituals: { id: number }[];
  spending: { cents: number; occurredAt: number }[];
  movement: { minutes: number; occurredAt: number }[];
  ritualEntries: { ritualId: number; occurredAt: number }[];
}

export interface TodayAggregates {
  spentCents: number;
  moveMinutes: number;
  ritualsDone: number;
  activeRitualCount: number;
}

export function getTodayAggregates(input: TodayAggregateInput): TodayAggregates {
  const { startMs, endMs } = localDayBounds(input.asOf);
  const inToday = (ms: number) => ms >= startMs && ms < endMs;

  const spentCents = input.spending
    .filter((r) => inToday(r.occurredAt))
    .reduce((acc, r) => acc + r.cents, 0);

  const moveMinutes = input.movement
    .filter((r) => inToday(r.occurredAt))
    .reduce((acc, r) => acc + r.minutes, 0);

  const activeIds = new Set(input.activeRituals.map((r) => r.id));
  const doneToday = new Set<number>();
  for (const e of input.ritualEntries) {
    if (!inToday(e.occurredAt)) continue;
    if (!activeIds.has(e.ritualId)) continue;
    doneToday.add(e.ritualId);
  }

  return {
    spentCents,
    moveMinutes,
    ritualsDone: doneToday.size,
    activeRitualCount: activeIds.size,
  };
}
