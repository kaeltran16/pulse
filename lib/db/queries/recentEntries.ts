import { desc, eq } from 'drizzle-orm';
import { spendingEntries, movementEntries, ritualEntries, rituals } from '../schema';
import type { AnyDb } from './onboarding';

export type RecentEntry = {
  at: number;
  kind: 'spend' | 'move' | 'ritual';
  summary: string;
};

function fmtSpend(cents: number, note: string | null, category: string | null): string {
  const dollars = (cents / 100).toFixed(2);
  const label = note ?? category ?? 'Spent';
  return `${label} · -$${dollars}`;
}

function fmtMove(minutes: number, kind: string | null): string {
  return `${kind ?? 'Movement'} · ${minutes}m`;
}

export async function getRecentEntries(db: AnyDb, limit: number): Promise<RecentEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  const spends: Array<{ cents: number; note: string | null; category: string | null; occurredAt: number }> =
    await dx.select().from(spendingEntries).orderBy(desc(spendingEntries.occurredAt)).limit(limit);

  const moves: Array<{ minutes: number; kind: string | null; occurredAt: number }> =
    await dx.select().from(movementEntries).orderBy(desc(movementEntries.occurredAt)).limit(limit);

  const ritEntries: Array<{ ritualId: number; occurredAt: number; title: string | null }> =
    await dx.select({
      ritualId: ritualEntries.ritualId,
      occurredAt: ritualEntries.occurredAt,
      title: rituals.title,
    })
      .from(ritualEntries)
      .leftJoin(rituals, eq(ritualEntries.ritualId, rituals.id))
      .orderBy(desc(ritualEntries.occurredAt))
      .limit(limit);

  const merged: RecentEntry[] = [
    ...spends.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'spend', summary: fmtSpend(r.cents, r.note, r.category) })),
    ...moves.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'move', summary: fmtMove(r.minutes, r.kind) })),
    ...ritEntries.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'ritual', summary: r.title ?? 'Ritual' })),
  ];

  merged.sort((a, b) => b.at - a.at);
  return merged.slice(0, limit);
}
