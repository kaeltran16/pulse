/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import { reseedDefaults } from '../reseedDefaults';
import { DEFAULT_RITUALS } from '../../seed-defaults';

describe('reseedDefaults', () => {
  it('inserts all defaults on a fresh DB', () => {
    const { db } = makeTestDb();
    reseedDefaults(db);
    const rows = (db as any).select().from(rituals).all() as Array<{ title: string }>;
    expect(rows.map((r) => r.title).sort()).toEqual(
      DEFAULT_RITUALS.map((d) => d.title).sort(),
    );
  });

  it('does not duplicate existing titles', () => {
    const { db } = makeTestDb();
    // Seed 3 of the 7 defaults manually
    (db as any).insert(rituals).values([
      { title: 'Morning pages',   icon: 'book.closed.fill',  cadence: 'morning', color: 'accent', position: 0 },
      { title: 'Inbox zero',      icon: 'tray.fill',         cadence: 'weekdays', color: 'move', position: 1 },
      { title: '8 glasses water', icon: 'cup.and.saucer.fill', cadence: 'all_day', color: 'cyan', position: 2 },
    ]).run();

    reseedDefaults(db);

    const rows = (db as any).select().from(rituals).all() as Array<{ title: string }>;
    expect(rows.length).toBe(DEFAULT_RITUALS.length); // no duplicates of the 3 pre-existing
    expect(rows.map((r) => r.title).sort()).toEqual(
      DEFAULT_RITUALS.map((d) => d.title).sort(),
    );
  });

  it('is idempotent — running twice has no effect after first run', () => {
    const { db } = makeTestDb();
    reseedDefaults(db);
    const before = (db as any).select().from(rituals).all().length;
    reseedDefaults(db);
    const after  = (db as any).select().from(rituals).all().length;
    expect(after).toBe(before);
  });

  it('assigns position MAX+1 to newly inserted rows', () => {
    const { db } = makeTestDb();
    (db as any).insert(rituals).values({
      title: 'Morning pages', icon: 'book.closed.fill', cadence: 'morning', color: 'accent', position: 5,
    }).run();
    reseedDefaults(db);
    const water = (db as any).select().from(rituals).where(eq(rituals.title, '8 glasses water')).all()[0];
    expect(water.position).toBeGreaterThan(5);
  });
});
