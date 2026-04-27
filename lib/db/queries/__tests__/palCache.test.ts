/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import {
  readCache,
  writeCache,
  deleteCacheByPrefix,
  vacuumStaleNudges,
} from '../palCache';

describe('palCache', () => {
  describe('writeCache + readCache', () => {
    it('round-trips a value', () => {
      const { db } = makeTestDb();
      writeCache(db, 'k1', { a: 1, b: 'two' });
      expect(readCache(db, 'k1')).toEqual({ a: 1, b: 'two' });
    });

    it('overwrites on second write', () => {
      const { db } = makeTestDb();
      writeCache(db, 'k1', { v: 1 });
      writeCache(db, 'k1', { v: 2 });
      expect(readCache(db, 'k1')).toEqual({ v: 2 });
    });

    it('returns null on miss', () => {
      const { db } = makeTestDb();
      expect(readCache(db, 'nope')).toBeNull();
    });

    it('returns null when value is stale beyond maxAgeMs', () => {
      const { db, raw } = makeTestDb();
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      raw.prepare(`INSERT INTO pal_cache (key, value, fetched_at) VALUES (?, ?, ?)`).run(
        'k1', JSON.stringify({ v: 1 }), tenMinutesAgo,
      );
      expect(readCache(db, 'k1', 5 * 60 * 1000)).toBeNull();
      expect(readCache(db, 'k1', 60 * 60 * 1000)).toEqual({ v: 1 });
    });
  });

  describe('deleteCacheByPrefix', () => {
    it('removes only matching prefix', () => {
      const { db } = makeTestDb();
      writeCache(db, 'suggestions:abc', { a: 1 });
      writeCache(db, 'suggestions:def', { b: 2 });
      writeCache(db, 'nudge:2026-04-28:0:5', { sub: 'x' });
      deleteCacheByPrefix(db, 'suggestions:');
      expect(readCache(db, 'suggestions:abc')).toBeNull();
      expect(readCache(db, 'suggestions:def')).toBeNull();
      expect(readCache(db, 'nudge:2026-04-28:0:5')).toEqual({ sub: 'x' });
    });
  });

  describe('vacuumStaleNudges', () => {
    it('keeps today nudges, drops other-day nudges', () => {
      const { db } = makeTestDb();
      writeCache(db, 'nudge:2026-04-28:0:5', { sub: 'today1' });
      writeCache(db, 'nudge:2026-04-28:1:5', { sub: 'today2' });
      writeCache(db, 'nudge:2026-04-27:3:5', { sub: 'yesterday' });
      writeCache(db, 'suggestions:abc', { v: 1 });
      vacuumStaleNudges(db, '2026-04-28');
      expect(readCache(db, 'nudge:2026-04-28:0:5')).toEqual({ sub: 'today1' });
      expect(readCache(db, 'nudge:2026-04-28:1:5')).toEqual({ sub: 'today2' });
      expect(readCache(db, 'nudge:2026-04-27:3:5')).toBeNull();
      expect(readCache(db, 'suggestions:abc')).toEqual({ v: 1 });
    });
  });
});
