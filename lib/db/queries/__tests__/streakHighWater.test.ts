/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import {
  getHwm,
  bumpHwmIfHigher,
  clearHwm,
} from '../streakHighWater';

function seedRitual(db: ReturnType<typeof makeTestDb>['db'], title = 'r1'): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color: 'rituals', position: 0 })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

describe('streakHighWater', () => {
  describe('getHwm', () => {
    it('returns 0 when no row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      expect(await getHwm(db, id)).toBe(0);
    });

    it('returns the stored hwm when row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, new Date(2026, 3, 28, 12).getTime());
      expect(await getHwm(db, id)).toBe(5);
    });
  });

  describe('bumpHwmIfHigher', () => {
    it('first call: writes the row, returns wasBroken=true with previous=0', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      const result = await bumpHwmIfHigher(db, id, 3, 1000);
      expect(result).toEqual({ wasBroken: true, previous: 0, current: 3 });
      expect(await getHwm(db, id)).toBe(3);
    });

    it('current > stored: updates the row, returns wasBroken=true', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 3, 1000);
      const result = await bumpHwmIfHigher(db, id, 5, 2000);
      expect(result).toEqual({ wasBroken: true, previous: 3, current: 5 });
      expect(await getHwm(db, id)).toBe(5);
    });

    it('current === stored: no-op, returns wasBroken=false', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 3, 1000);
      const result = await bumpHwmIfHigher(db, id, 3, 2000);
      expect(result).toEqual({ wasBroken: false, previous: 3, current: 3 });
      expect(await getHwm(db, id)).toBe(3);
    });

    it('current < stored: no-op, returns wasBroken=false with previous=stored', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      const result = await bumpHwmIfHigher(db, id, 2, 2000);
      expect(result).toEqual({ wasBroken: false, previous: 5, current: 2 });
      expect(await getHwm(db, id)).toBe(5);
    });

    it('current=0 with no row: no-op (no row written)', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      const result = await bumpHwmIfHigher(db, id, 0, 1000);
      expect(result).toEqual({ wasBroken: false, previous: 0, current: 0 });
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });
  });

  describe('cascade on hard-delete', () => {
    it('deletes hwm row when its ritual is hard-deleted', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).delete(rituals).where(eq(rituals.id, id)).run();
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });
  });

  describe('clearHwm', () => {
    it('removes the row', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      await clearHwm(db, id);
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });

    it('is a no-op when no row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await expect(clearHwm(db, id)).resolves.toBeUndefined();
    });
  });
});
