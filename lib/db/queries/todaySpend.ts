import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { goals, spendingEntries } from '../schema';
import { localDayBounds } from './today';
import type { AnyDb } from './onboarding';

export type TodaySpend = {
  totalCents: number;
  budgetCents: number;
  entries: Array<{
    id: number;
    cents: number;
    note: string | null;
    category: string | null;
    occurredAt: number;
  }>;
};

export async function getTodaySpend(db: AnyDb, asOf: Date): Promise<TodaySpend> {
  const { startMs, endMs } = localDayBounds(asOf);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  const goalRows = await dx.select({ b: goals.dailyBudgetCents }).from(goals).where(eq(goals.id, 1));
  const budgetCents = goalRows[0]?.b ?? 0;

  const entries = await dx.select()
    .from(spendingEntries)
    .where(and(gte(spendingEntries.occurredAt, startMs), lt(spendingEntries.occurredAt, endMs)))
    .orderBy(desc(spendingEntries.occurredAt));

  const totalCents = entries.reduce((acc: number, r: { cents: number }) => acc + r.cents, 0);
  return { totalCents, budgetCents, entries };
}
