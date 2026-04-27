/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { getCursor, setCursor } from '../syncCursor';

describe('syncCursor', () => {
  it('initial state has accountId null and lastSyncedId 0', () => {
    const { db } = makeTestDb();
    const c = getCursor(db);
    expect(c).toEqual({ accountId: null, lastSyncedId: 0 });
  });

  it('setCursor + getCursor round-trips', () => {
    const { db } = makeTestDb();
    setCursor(db, 42, 1000);
    const c = getCursor(db);
    expect(c.accountId).toBe(42);
    expect(c.lastSyncedId).toBe(1000);
  });

  it('CHECK constraint blocks inserting a second row', () => {
    const { raw } = makeTestDb();
    expect(() => {
      raw.prepare('INSERT INTO sync_cursor (id) VALUES (2)').run();
    }).toThrow(/CHECK constraint/i);
  });
});
