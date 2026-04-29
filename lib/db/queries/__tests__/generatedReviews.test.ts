/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { getCachedReview, putCachedReview, clearCachedReview } from '../generatedReviews';
import type { ReviewResponse } from '../../../api-types';

const sample: ReviewResponse = {
  period: 'weekly',
  hero: 'A steady week.',
  patterns: [{ signal: 'topSpendDay', text: 'Friday cost 4× any other day.' }],
  oneThingToTry: null,
  generatedAt: '2026-04-30T00:00:00Z',
};

describe('generatedReviews cache', () => {
  it('get returns null when no row exists', async () => {
    const { db } = makeTestDb();
    expect(await getCachedReview(db as any, 'weekly', '2026-W17')).toBeNull();
  });

  it('put then get round-trips', async () => {
    const { db } = makeTestDb();
    await putCachedReview(db as any, 'weekly', '2026-W17', sample);
    const out = await getCachedReview(db as any, 'weekly', '2026-W17');
    expect(out).toEqual(sample);
  });

  it('put twice overwrites the prior payload', async () => {
    const { db } = makeTestDb();
    await putCachedReview(db as any, 'weekly', '2026-W17', sample);
    const updated: ReviewResponse = { ...sample, hero: 'A different week.' };
    await putCachedReview(db as any, 'weekly', '2026-W17', updated);
    const out = await getCachedReview(db as any, 'weekly', '2026-W17');
    expect(out?.hero).toBe('A different week.');
  });

  it('clear removes the row', async () => {
    const { db } = makeTestDb();
    await putCachedReview(db as any, 'weekly', '2026-W17', sample);
    await clearCachedReview(db as any, 'weekly', '2026-W17');
    expect(await getCachedReview(db as any, 'weekly', '2026-W17')).toBeNull();
  });
});
