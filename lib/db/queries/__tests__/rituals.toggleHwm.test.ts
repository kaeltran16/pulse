/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals, ritualEntries } from '../../schema';
import { toggleRitualToday } from '../rituals';
import { getHwm } from '../streakHighWater';
import { dayKey } from '../dayKey';

function seedRitual(db: ReturnType<typeof makeTestDb>['db']): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title: 'r1', icon: 'star.fill', cadence: 'daily', color: 'rituals', position: 0 })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

function seedEntryAt(db: ReturnType<typeof makeTestDb>['db'], ritualId: number, ms: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).insert(ritualEntries).values({ ritualId, occurredAt: ms }).run();
}

describe('toggleRitualToday — HWM bump', () => {
  it('bumps the HWM when the toggle inserts a new entry that ticks the streak past stored', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);

    const today = new Date();
    const todayKey = dayKey(today);
    const oneDay = 24 * 60 * 60 * 1000;
    seedEntryAt(db, id, today.getTime() - 2 * oneDay);
    seedEntryAt(db, id, today.getTime() -     oneDay);

    await toggleRitualToday(db, id, todayKey);

    expect(await getHwm(db, id)).toBe(3);
  });

  it('does not bump the HWM when the toggle deletes (untoggle)', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);
    const today = new Date();
    const todayKey = dayKey(today);

    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(1);

    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(1);
  });

  it('does not lower the HWM if the new streak is shorter than stored', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);
    const today = new Date();
    const todayKey = dayKey(today);
    const oneDay = 24 * 60 * 60 * 1000;

    seedEntryAt(db, id, today.getTime() - 3 * oneDay);
    seedEntryAt(db, id, today.getTime() - 2 * oneDay);
    seedEntryAt(db, id,     today.getTime() - oneDay);
    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(4);

    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(4);
  });
});
