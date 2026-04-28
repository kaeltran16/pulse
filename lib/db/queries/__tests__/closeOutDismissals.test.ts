/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { isDismissedToday, markDismissedToday } from '../closeOutDismissals';

describe('closeOutDismissals', () => {
  describe('isDismissedToday', () => {
    it('returns false when no row for the date key', async () => {
      const { db } = makeTestDb();
      expect(await isDismissedToday(db, '2026-04-29')).toBe(false);
    });

    it('returns true after markDismissedToday for the same key', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      expect(await isDismissedToday(db, '2026-04-29')).toBe(true);
    });

    it('isolates across date keys', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      expect(await isDismissedToday(db, '2026-04-28')).toBe(false);
      expect(await isDismissedToday(db, '2026-04-30')).toBe(false);
    });
  });

  describe('markDismissedToday', () => {
    it('is idempotent — same key written twice does not throw', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      await expect(markDismissedToday(db, '2026-04-29', 2000)).resolves.toBeUndefined();
      expect(await isDismissedToday(db, '2026-04-29')).toBe(true);
    });

    it('updates dismissed_at on second write of the same key', async () => {
      const { db, raw } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      await markDismissedToday(db, '2026-04-29', 2000);
      const row = raw
        .prepare('SELECT dismissed_at FROM dismissed_close_outs WHERE date_key = ?')
        .get('2026-04-29') as { dismissed_at: number };
      expect(row.dismissed_at).toBe(2000);
    });
  });
});
