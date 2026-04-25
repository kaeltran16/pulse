/** @jest-environment node */
import { makeTestDb } from './test-helpers';

describe('migrations apply cleanly', () => {
  it('creates the expected table set', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'goals',
      'movement_entries',
      'ritual_entries',
      'rituals',
      'spending_entries',
    ]);
  });

  it('creates the expected indexes', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'idx_movement_occurred_at',
      'idx_ritual_entries_occurred_at',
      'idx_ritual_entries_ritual_id',
      'idx_spending_occurred_at',
    ]);
  });

  it('enforces ritual_entries.ritual_id foreign key', () => {
    const { raw } = makeTestDb();
    expect(() =>
      raw
        .prepare('INSERT INTO ritual_entries (ritual_id, occurred_at) VALUES (?, ?)')
        .run(999, Date.now()),
    ).toThrow(/FOREIGN KEY/i);
  });
});
