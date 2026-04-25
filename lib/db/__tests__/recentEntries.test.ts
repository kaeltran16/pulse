/** @jest-environment node */
import { makeTestDb, tsLocal } from './test-helpers';
import { getRecentEntries } from '../queries/recentEntries';
import { spendingEntries, movementEntries, ritualEntries, rituals } from '../schema';

describe('getRecentEntries', () => {
  it('merges all three tables, sorts desc, caps at limit', async () => {
    const { db } = makeTestDb();
    db.insert(rituals).values({ id: 1, title: 'Read', icon: '📖', position: 1 }).run();

    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();
    db.insert(ritualEntries).values({ ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 21) }).run();

    const got = await getRecentEntries(db, 20);
    expect(got).toHaveLength(3);
    expect(got.map((e) => e.kind)).toEqual(['ritual', 'spend', 'move']);
  });

  it('caps at the limit', async () => {
    const { db } = makeTestDb();
    for (let i = 0; i < 25; i++) {
      db.insert(spendingEntries).values({ cents: 100 + i, note: null, category: null, occurredAt: tsLocal(2026, 4, 25, 1) + i }).run();
    }
    const got = await getRecentEntries(db, 20);
    expect(got).toHaveLength(20);
  });

  it('projects spend summary as merchant·-$x.xx', async () => {
    const { db } = makeTestDb();
    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('Verve · -$5.75');
  });

  it('projects move summary as kind·Nm', async () => {
    const { db } = makeTestDb();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('run · 30m');
  });

  it('projects ritual summary as the ritual title', async () => {
    const { db } = makeTestDb();
    db.insert(rituals).values({ id: 7, title: 'Morning pages', icon: '✦', position: 1 }).run();
    db.insert(ritualEntries).values({ ritualId: 7, occurredAt: tsLocal(2026, 4, 25, 6) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('Morning pages');
  });
});
