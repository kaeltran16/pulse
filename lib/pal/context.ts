import { eq } from 'drizzle-orm';
import { goals, rituals, spendingEntries, movementEntries, ritualEntries } from '../db/schema';
import { getTodayAggregates, type TodayAggregates } from '../db/queries/today';
import { getRecentEntries, type RecentEntry } from '../db/queries/recentEntries';
import type { AnyDb } from '../db/queries/onboarding';

export type PalContext = {
  today: TodayAggregates;
  recentEntries: RecentEntry[];
};

export async function buildContext(db: AnyDb, asOf: Date = new Date()): Promise<PalContext> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const [g] = await dx.select().from(goals).where(eq(goals.id, 1));
  const activeRituals = await dx.select({ id: rituals.id }).from(rituals).where(eq(rituals.active, true));
  const spending = await dx.select({ cents: spendingEntries.cents, occurredAt: spendingEntries.occurredAt }).from(spendingEntries);
  const movement = await dx.select({ minutes: movementEntries.minutes, occurredAt: movementEntries.occurredAt }).from(movementEntries);
  const rEntries = await dx.select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt }).from(ritualEntries);

  const today = getTodayAggregates({
    asOf,
    goals: g ? {
      dailyBudgetCents: g.dailyBudgetCents,
      dailyMoveMinutes: g.dailyMoveMinutes,
      dailyRitualTarget: g.dailyRitualTarget,
    } : { dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 0 },
    activeRituals,
    spending,
    movement,
    ritualEntries: rEntries,
  });

  const recentEntries = await getRecentEntries(db, 20);
  return { today, recentEntries };
}
