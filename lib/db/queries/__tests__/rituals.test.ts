/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import { insertRitual, updateRitual } from '../rituals';

const sample = (overrides: Partial<{
  title: string; icon: string; cadence: string; color: string;
}> = {}) => ({
  title: 'Test ritual',
  icon: 'sparkles',
  cadence: 'daily' as const,
  color: 'rituals' as const,
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
