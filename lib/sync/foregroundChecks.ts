import { and, eq, gte, lt } from 'drizzle-orm';

import { type AnyDb } from '../db/queries/onboarding';
import { dayKey } from '../db/queries/dayKey';
import { isDismissedToday } from '../db/queries/closeOutDismissals';
import { bumpHwmIfHigher, getHwm } from '../db/queries/streakHighWater';
import { streakForRitual } from '../db/queries/streaks';
import { goals, rituals, ritualEntries } from '../db/schema';

interface RouterLike {
  push: (pathname: string, params?: Record<string, unknown>) => void;
}

interface Args {
  db: AnyDb;
  router: RouterLike;
  now?: Date;
}

let inFlight: Promise<void> | null = null;

export function __resetInflightForTests(): void {
  inFlight = null;
}

export function runForegroundChecks(args: Args): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doChecks(args).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doChecks({ db, router, now = new Date() }: Args): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  const activeRituals = dx
    .select({ id: rituals.id })
    .from(rituals)
    .where(eq(rituals.active, true))
    .all() as Array<{ id: number }>;
  const allEntries = dx
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  const broken: Array<{ ritualId: number; streak: number; hwm: number; delta: number }> = [];
  for (const r of activeRituals) {
    const streak = streakForRitual({ ritualEntries: allEntries, ritualId: r.id, asOf: now });
    const hwm = await getHwm(db, r.id);
    if (streak > hwm) {
      broken.push({ ritualId: r.id, streak, hwm, delta: streak - hwm });
    }
  }

  if (broken.length > 0) {
    const nowMs = now.getTime();
    for (const b of broken) {
      await bumpHwmIfHigher(db, b.ritualId, b.streak, nowMs);
    }
    broken.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.delta  !== a.delta)  return b.delta  - a.delta;
      return a.ritualId - b.ritualId;
    });
    const winner = broken[0];
    router.push('/celebration', {
      ritualId: String(winner.ritualId),
      streak: String(winner.streak),
      previousHwm: String(winner.hwm),
    });
    return;
  }

  if (now.getHours() < 21) return;

  const goalRows = dx
    .select({ target: goals.dailyRitualTarget })
    .from(goals)
    .where(eq(goals.id, 1))
    .all() as Array<{ target: number }>;
  const target = goalRows[0]?.target;
  if (!target || target <= 0) return;

  const todayKey = dayKey(now);
  if (await isDismissedToday(db, todayKey)) return;

  const todayBoundsStart = new Date(now);
  todayBoundsStart.setHours(0, 0, 0, 0);
  const todayBoundsEnd = new Date(todayBoundsStart);
  todayBoundsEnd.setDate(todayBoundsEnd.getDate() + 1);
  const todayEntries = dx
    .select({ ritualId: ritualEntries.ritualId })
    .from(ritualEntries)
    .where(and(
      gte(ritualEntries.occurredAt, todayBoundsStart.getTime()),
      lt(ritualEntries.occurredAt, todayBoundsEnd.getTime()),
    ))
    .all() as Array<{ ritualId: number }>;
  const distinctToday = new Set(todayEntries.map((e) => e.ritualId)).size;

  if (distinctToday >= target) return;

  router.push('/close-out');
}
