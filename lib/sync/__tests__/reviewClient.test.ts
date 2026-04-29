/** @jest-environment node */
import { postReview } from '../reviewClient';
import { AuthError, NetworkError, UpstreamError, ValidationError } from '../errors';
import type { ReviewRequest, ReviewResponse } from '../../api-types';

const baseReq: ReviewRequest = {
  period: 'weekly',
  periodKey: '2026-W17',
  aggregates: {
    spend: { totalMinor: 0, currency: 'USD', byCategory: {}, byDayOfWeek: [0,0,0,0,0,0,0], topMerchant: null },
    rituals: { kept: 0, goalTotal: 0, perRitual: [], bestStreakRitual: null },
    workouts: { sessions: 0, prCount: 0 },
  },
  signals: { topSpendDay: null, ritualVsNonRitual: null, bestStreak: null, underBudget: null },
};

const sampleResp: ReviewResponse = {
  period: 'weekly',
  hero: 'x',
  patterns: [],
  oneThingToTry: null,
  generatedAt: '2026-04-30T00:00:00Z',
};

describe('reviewClient.postReview', () => {
  const realFetch = global.fetch;
  afterEach(() => { global.fetch = realFetch; });

  it('returns the parsed response on 200', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify(sampleResp), { status: 200 })) as any;
    const out = await postReview(baseReq);
    expect(out).toEqual(sampleResp);
  });

  it('throws AuthError on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'no' } }), { status: 401 })) as any;
    await expect(postReview(baseReq)).rejects.toBeInstanceOf(AuthError);
  });

  it('throws AuthError on 403', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'forbidden', message: 'no' } }), { status: 403 })) as any;
    await expect(postReview(baseReq)).rejects.toBeInstanceOf(AuthError);
  });

  it('throws ValidationError on 400', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'validation_failed', message: 'bad' } }), { status: 400 })) as any;
    await expect(postReview(baseReq)).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws UpstreamError on 502', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response('upstream', { status: 502 })) as any;
    await expect(postReview(baseReq)).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws NetworkError on fetch reject', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('boom')) as any;
    await expect(postReview(baseReq)).rejects.toBeInstanceOf(NetworkError);
  });
});
