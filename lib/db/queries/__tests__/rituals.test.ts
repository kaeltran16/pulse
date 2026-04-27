/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals, type RitualCadence, type RitualColor } from '../../schema';
import { type InsertRitualInput, insertRitual, updateRitual } from '../rituals';

const sample = (overrides: Partial<InsertRitualInput> = {}): InsertRitualInput => ({
  title: 'Test ritual',
  icon: 'sparkles',
  cadence: 'daily' as RitualCadence,
  color: 'rituals' as RitualColor,
  active: true,
  ...overrides,
});

describe('insertRitual', () => {
  it('first insert gets position 0', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({ title: 'A' }));
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.position).toBe(0);
  });

  it('subsequent inserts get MAX(position) + 1', async () => {
    const { db } = makeTestDb();
    await insertRitual(db, sample({ title: 'A' }));
    await insertRitual(db, sample({ title: 'B' }));
    const idC = await insertRitual(db, sample({ title: 'C' }));
    const rowC = (db as any).select().from(rituals).where(eq(rituals.id, idC)).all()[0];
    expect(rowC.position).toBe(2);
  });

  it('persists all input fields', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({
      title: 'X', icon: 'leaf.fill', cadence: 'morning', color: 'accent',
    }));
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.title).toBe('X');
    expect(row.icon).toBe('leaf.fill');
    expect(row.cadence).toBe('morning');
    expect(row.color).toBe('accent');
    expect(row.active).toBe(true);
  });
});

describe('updateRitual', () => {
  it('updates title/icon/cadence/color but not position/active', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({ title: 'Old' }));
    const before = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    await updateRitual(db, id, {
      title: 'New', icon: 'leaf.fill', cadence: 'morning', color: 'accent',
    });
    const after = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(after.title).toBe('New');
    expect(after.icon).toBe('leaf.fill');
    expect(after.cadence).toBe('morning');
    expect(after.color).toBe('accent');
    expect(after.position).toBe(before.position);
    expect(after.active).toBe(before.active);
  });
});

import { ritualEntries } from '../../schema';
import { softDeleteRitual, restoreRitual, hardDeleteRitual } from '../rituals';

describe('softDeleteRitual', () => {
  it('sets active=false, leaves ritualEntries intact', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    (db as any).insert(ritualEntries).values({ ritualId: id, occurredAt: 1000 }).run();
    await softDeleteRitual(db, id);
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.active).toBe(false);
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
  });

  it('reorders remaining active rituals to keep contiguous positions', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' })); // position 0
    const b = await insertRitual(db, sample({ title: 'B' })); // position 1
    const c = await insertRitual(db, sample({ title: 'C' })); // position 2
    await softDeleteRitual(db, b);
    const aRow = (db as any).select().from(rituals).where(eq(rituals.id, a)).all()[0];
    const cRow = (db as any).select().from(rituals).where(eq(rituals.id, c)).all()[0];
    expect(aRow.position).toBe(0);
    expect(cRow.position).toBe(1);
  });
});

describe('restoreRitual', () => {
  it('sets active=true, assigns position MAX(active.position) + 1', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' })); // position 0
    const b = await insertRitual(db, sample({ title: 'B' })); // position 1
    await softDeleteRitual(db, a); // a is inactive; b shifts to position 0
    await restoreRitual(db, a);
    const aRow = (db as any).select().from(rituals).where(eq(rituals.id, a)).all()[0];
    expect(aRow.active).toBe(true);
    expect(aRow.position).toBe(1); // after b (position 0)
  });
});

describe('hardDeleteRitual', () => {
  it('cascades delete to ritualEntries via FK', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    (db as any).insert(ritualEntries).values({ ritualId: id, occurredAt: 1000 }).run();
    await hardDeleteRitual(db, id);
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all();
    expect(row.length).toBe(0);
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });
});

import { reorderRitualPositions } from '../rituals';

describe('reorderRitualPositions', () => {
  it('rewrites positions to match the supplied array order', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [c, a, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[c]).toBe(0);
    expect(byId[a]).toBe(1);
    expect(byId[b]).toBe(2);
  });

  it('preserves contiguous positions [0, 1, 2, ...] with no gaps', async () => {
    const { db } = makeTestDb();
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push(await insertRitual(db, sample({ title: `R${i}` })));
    const shuffled = [ids[3], ids[0], ids[4], ids[2], ids[1]];
    await reorderRitualPositions(db, shuffled);
    const positions = ((db as any).select().from(rituals).all() as Array<{ position: number }>)
      .map((r) => r.position).sort((x, y) => x - y);
    expect(positions).toEqual([0, 1, 2, 3, 4]);
  });

  it('adjacent swap → just those two move', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [a, c, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[a]).toBe(0);
    expect(byId[c]).toBe(1);
    expect(byId[b]).toBe(2);
  });

  it('drag-to-end works', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [b, c, a]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[a]).toBe(2);
  });

  it('drag-to-start works', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [c, a, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[c]).toBe(0);
  });
});

import { toggleRitualToday } from '../rituals';
import { dayKey } from '../dayKey';

describe('toggleRitualToday', () => {
  it('inserts a ritualEntries row when no entry exists today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    await toggleRitualToday(db, id, dayKey(new Date()));
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
  });

  it('deletes ALL today rows when at least one exists today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const now = Date.now();
    (db as any).insert(ritualEntries).values([
      { ritualId: id, occurredAt: now - 1000 },
      { ritualId: id, occurredAt: now - 500 },
      { ritualId: id, occurredAt: now },
    ]).run();
    await toggleRitualToday(db, id, dayKey(new Date()));
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });

  it("does not touch prior days' entries", async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const now = new Date();
    const today = dayKey(now);
    const yesterdayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).getTime();
    (db as any).insert(ritualEntries).values([
      { ritualId: id, occurredAt: yesterdayMs },
      { ritualId: id, occurredAt: Date.now() },
    ]).run();
    await toggleRitualToday(db, id, today); // currently has an entry today, toggles off
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
    expect(entries[0].occurredAt).toBe(yesterdayMs);
  });

  it('toggles off then on then off again — final state has 0 entries today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const today = dayKey(new Date());
    await toggleRitualToday(db, id, today); // off→on (insert)
    await toggleRitualToday(db, id, today); // on→off (delete all)
    await toggleRitualToday(db, id, today); // off→on (insert)
    await toggleRitualToday(db, id, today); // on→off (delete all)
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });
});
