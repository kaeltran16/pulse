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
