export type ReviewPeriod = 'weekly' | 'monthly';

export type PeriodBounds = {
  startMs: number;
  endMs: number; // exclusive
  key: string;   // 'YYYY-Www' | 'YYYY-MM'
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ISO week: Monday = day 1; week containing Jan 4 is week 1.
function isoWeekParts(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: target.getUTCFullYear(), week };
}

function startOfMondayLocal(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 0, 0, 0, 0);
  return out;
}

function startOfMonthLocal(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

export function periodBounds(period: ReviewPeriod, anchor: Date, offset: number): PeriodBounds {
  if (period === 'weekly') {
    const monAnchor = startOfMondayLocal(anchor);
    const start = new Date(monAnchor.getFullYear(), monAnchor.getMonth(), monAnchor.getDate() + 7 * offset, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);
    const { year, week } = isoWeekParts(start);
    return { startMs: start.getTime(), endMs: end.getTime(), key: `${year}-W${pad2(week)}` };
  }
  // monthly
  const m0 = startOfMonthLocal(anchor.getFullYear(), anchor.getMonth());
  const start = startOfMonthLocal(m0.getFullYear(), m0.getMonth() + offset);
  const end = startOfMonthLocal(start.getFullYear(), start.getMonth() + 1);
  return { startMs: start.getTime(), endMs: end.getTime(), key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}` };
}

export function lastCompletedPeriodKey(period: ReviewPeriod, asOf: Date): string {
  return periodBounds(period, asOf, -1).key;
}

import { and, asc, eq, gte, lt } from 'drizzle-orm';
import {
  goals as goalsTable,
  rituals,
  ritualEntries,
  spendingEntries,
  sessions,
  prs,
  type RitualColor,
} from '../schema';
import { streakForRitual } from './streaks';
import type { ReviewAggregates } from '../../api-types';
import { type AnyDb } from './onboarding';

function parseKey(period: ReviewPeriod, periodKey: string): { year: number; index: number } {
  if (period === 'weekly') {
    const m = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!m) throw new Error(`bad weekly key: ${periodKey}`);
    return { year: Number(m[1]), index: Number(m[2]) };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!m) throw new Error(`bad monthly key: ${periodKey}`);
  return { year: Number(m[1]), index: Number(m[2]) };
}

function boundsForKey(period: ReviewPeriod, periodKey: string): PeriodBounds {
  if (period === 'monthly') {
    const { year, index } = parseKey('monthly', periodKey);
    const start = new Date(year, index - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, index, 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime(), key: periodKey };
  }
  const { year } = parseKey('weekly', periodKey);
  const probe = new Date(year, 0, 4, 12); // Jan 4 always in week 1
  for (let i = -1; i <= 53; i++) {
    const b = periodBounds('weekly', probe, i);
    if (b.key === periodKey) return b;
  }
  throw new Error(`no bounds for weekly key ${periodKey}`);
}

function daysInPeriod(b: PeriodBounds): number {
  return Math.round((b.endMs - b.startMs) / 86400000);
}

function dayOfWeekIndex(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}

export async function computeReviewAggregates(
  db: AnyDb,
  period: ReviewPeriod,
  periodKey: string,
): Promise<ReviewAggregates> {
  const bounds = boundsForKey(period, periodKey);
  const { startMs, endMs } = bounds;

  // ─── Spend ──────────────────────────────────────────
  const spendRows = (db as any)
    .select({
      cents: spendingEntries.cents,
      category: spendingEntries.category,
      merchant: spendingEntries.merchant,
      currency: spendingEntries.currency,
      occurredAt: spendingEntries.occurredAt,
    })
    .from(spendingEntries)
    .where(and(gte(spendingEntries.occurredAt, startMs), lt(spendingEntries.occurredAt, endMs)))
    .all() as Array<{ cents: number; category: string | null; merchant: string | null; currency: string; occurredAt: number }>;

  let totalMinor = 0;
  const byCategory: Record<string, number> = {};
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const merchantTotals = new Map<string, number>();
  let currency = 'USD';
  for (const row of spendRows) {
    totalMinor += row.cents;
    if (row.category) byCategory[row.category] = (byCategory[row.category] ?? 0) + row.cents;
    byDayOfWeek[dayOfWeekIndex(row.occurredAt)] += row.cents;
    if (row.merchant) merchantTotals.set(row.merchant, (merchantTotals.get(row.merchant) ?? 0) + row.cents);
    currency = row.currency;
  }
  let topMerchant: { name: string; totalMinor: number } | null = null;
  for (const [name, total] of merchantTotals.entries()) {
    if (!topMerchant || total > topMerchant.totalMinor) topMerchant = { name, totalMinor: total };
  }

  // ─── Rituals ────────────────────────────────────────
  const ritualRows = (db as any)
    .select({ id: rituals.id, title: rituals.title, color: rituals.color })
    .from(rituals)
    .where(eq(rituals.active, true))
    .orderBy(asc(rituals.position))
    .all() as Array<{ id: number; title: string; color: RitualColor }>;

  const entriesInPeriod = (db as any)
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .where(and(gte(ritualEntries.occurredAt, startMs), lt(ritualEntries.occurredAt, endMs)))
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  const allRitualEntries = (db as any)
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  const asOf = new Date(endMs - 1);
  const perRitual = ritualRows.map((r) => ({
    id: r.id,
    name: r.title,
    color: r.color,
    kept: entriesInPeriod.filter((e) => e.ritualId === r.id).length,
    streak: streakForRitual({ ritualEntries: allRitualEntries, ritualId: r.id, asOf }),
  }));
  const kept = entriesInPeriod.length;

  const goalsRow = (db as any).select().from(goalsTable).limit(1).all() as Array<{ dailyRitualTarget: number }>;
  const dailyTarget = goalsRow[0]?.dailyRitualTarget ?? 0;
  const goalTotal = dailyTarget * daysInPeriod(bounds);

  let bestStreakRitual: { name: string; streak: number; color: string } | null = null;
  for (const r of perRitual) {
    if (r.streak >= 1 && (!bestStreakRitual || r.streak > bestStreakRitual.streak)) {
      bestStreakRitual = { name: r.name, streak: r.streak, color: r.color };
    }
  }

  // ─── Workouts ───────────────────────────────────────
  const sessionsInPeriod = (db as any)
    .select({ id: sessions.id, prCount: sessions.prCount })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'completed'),
        gte(sessions.startedAt, startMs),
        lt(sessions.startedAt, endMs),
      ),
    )
    .all() as Array<{ id: number; prCount: number }>;
  const sessionCount = sessionsInPeriod.length;

  const prsInPeriod = (db as any)
    .select({ id: prs.id })
    .from(prs)
    .where(and(gte(prs.achievedAt, startMs), lt(prs.achievedAt, endMs)))
    .all() as Array<{ id: number }>;
  const prCount = prsInPeriod.length;

  return {
    spend: { totalMinor, currency, byCategory, byDayOfWeek, topMerchant },
    rituals: { kept, goalTotal, perRitual, bestStreakRitual },
    workouts: { sessions: sessionCount, prCount },
  };
}
