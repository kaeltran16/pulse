/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { makeTestDb } from '../../db/__tests__/test-helpers';
import { rituals, ritualEntries, goals } from '../../db/schema';
import { bumpHwmIfHigher, getHwm } from '../../db/queries/streakHighWater';
import { markDismissedToday } from '../../db/queries/closeOutDismissals';
import { dayKey } from '../../db/queries/dayKey';
import {
  __resetInflightForTests,
  runForegroundChecks,
} from '../foregroundChecks';

type DbHandle = ReturnType<typeof makeTestDb>;

function seedRitual(db: DbHandle['db'], title: string, position: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color: 'rituals', position })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

function seedEntries(db: DbHandle['db'], ritualId: number, msList: number[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  for (const ms of msList) {
    dx.insert(ritualEntries).values({ ritualId, occurredAt: ms }).run();
  }
}

function seedGoals(db: DbHandle['db'], dailyRitualTarget: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).insert(goals).values({
    id: 1,
    dailyBudgetCents: 0,
    dailyMoveMinutes: 0,
    dailyRitualTarget,
  }).run();
}

function makeRouter() {
  const calls: Array<{ pathname: string; params?: Record<string, unknown> }> = [];
  return {
    calls,
    push: (pathname: string, params?: Record<string, unknown>) => {
      calls.push({ pathname, params });
    },
  };
}

function nDaysAgo(now: Date, n: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

describe('runForegroundChecks', () => {
  beforeEach(() => __resetInflightForTests());

  describe('Celebration', () => {
    it('fires when one ritual breaks its HWM; navigates to /celebration with winner params', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      await bumpHwmIfHigher(db, id, 1, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(id), streak: '3', previousHwm: '1' } },
      ]);
      expect(await getHwm(db, id)).toBe(3);
    });

    it('coalesces multiple broken HWMs — picks winner with highest streak; bumps all losers silently', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const a = seedRitual(db, 'a', 0);
      const b = seedRitual(db, 'b', 1);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, a, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      seedEntries(db, b, [
        nDaysAgo(now, 4),
        nDaysAgo(now, 3),
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(b), streak: '5', previousHwm: '0' } },
      ]);
      expect(await getHwm(db, a)).toBe(3);
      expect(await getHwm(db, b)).toBe(5);
    });

    it('tiebreak on equal streaks — highest delta wins; lowest ritualId on equal delta', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const a = seedRitual(db, 'a', 0);
      const b = seedRitual(db, 'b', 1);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, a, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      seedEntries(db, b, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      await bumpHwmIfHigher(db, a, 2, 0);
      await bumpHwmIfHigher(db, b, 1, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(b), streak: '3', previousHwm: '1' } },
      ]);
    });

    it('does not fire when no ritual breaks its HWM', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, id, [new Date(now).setHours(8, 0, 0, 0)]);
      await bumpHwmIfHigher(db, id, 5, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('skips inactive rituals', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).update(rituals).set({ active: false }).where(eq(rituals.id, id)).run();
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });
  });

  describe('Close-Out', () => {
    it('fires when localHour >= 21 AND count < goal AND not dismissed', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      void id;

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([{ pathname: '/close-out' }]);
    });

    it('blocked by celebration-navigated', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(id), streak: '3', previousHwm: '0' } },
      ]);
    });

    it('blocked by localHour < 21', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 20, 59, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('blocked by count >= goal', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 1);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      seedEntries(db, id, [new Date(now).setHours(8, 0, 0, 0)]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls.find((c) => c.pathname === '/close-out')).toBeUndefined();
    });

    it('blocked by isDismissedToday', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      await markDismissedToday(db, dayKey(now), 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('counts distinct rituals logged today (multiple entries for one ritual count once)', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 2);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      seedEntries(db, id, [
        new Date(now).setHours(8, 0, 0, 0),
        new Date(now).setHours(12, 0, 0, 0),
      ]);
      // Pre-seed HWM so the (single-day) streak does not trigger Celebration —
      // we want to assert Close-Out logic on its own.
      await bumpHwmIfHigher(db, id, 10, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([{ pathname: '/close-out' }]);
    });
  });

  describe('re-entrance guard', () => {
    it('second concurrent call resolves to the same in-flight promise', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p1 = runForegroundChecks({ db: db as any, router, now: new Date(2026, 3, 29, 9, 0, 0) });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p2 = runForegroundChecks({ db: db as any, router, now: new Date(2026, 3, 29, 9, 0, 0) });
      expect(p1).toBe(p2);
      await Promise.all([p1, p2]);
    });
  });
});
