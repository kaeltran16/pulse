/** @jest-environment node */
import { jest } from '@jest/globals';

jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/db/queries/reviewAggregates', () => {
  const real = jest.requireActual('@/lib/db/queries/reviewAggregates') as object;
  return {
    ...real,
    computeReviewAggregates: jest.fn(),
    computeReviewSignals: jest.fn(),
    isPeriodEmpty: jest.fn(),
    lastCompletedPeriodKey: jest.fn(() => '2026-W17'),
  };
});
jest.mock('@/lib/db/queries/generatedReviews', () => ({
  getCachedReview: jest.fn(),
  putCachedReview: jest.fn(),
}));
jest.mock('@/lib/sync/reviewClient', () => ({
  postReview: jest.fn(),
}));

import { computeReviewAggregates, computeReviewSignals, isPeriodEmpty } from '@/lib/db/queries/reviewAggregates';
import { getCachedReview, putCachedReview } from '@/lib/db/queries/generatedReviews';
import { postReview } from '@/lib/sync/reviewClient';

const baseAggs = {
  spend: { totalMinor: 1000, currency: 'USD', byCategory: {}, byDayOfWeek: [0,0,0,0,1000,0,0], topMerchant: null },
  rituals: { kept: 1, goalTotal: 7, perRitual: [], bestStreakRitual: null },
  workouts: { sessions: 1, prCount: 0 },
};
const baseSignals = { topSpendDay: null, ritualVsNonRitual: null, bestStreak: null, underBudget: null };
const baseResp = {
  period: 'weekly' as const,
  hero: 'A steady week.',
  patterns: [],
  oneThingToTry: null,
  generatedAt: '2026-04-30T00:00:00Z',
};

beforeEach(() => {
  (computeReviewAggregates as jest.Mock).mockResolvedValue(baseAggs as never);
  (computeReviewSignals as jest.Mock).mockResolvedValue(baseSignals as never);
  (isPeriodEmpty as jest.Mock).mockReturnValue(false);
  (getCachedReview as jest.Mock).mockResolvedValue(null as never);
  (putCachedReview as jest.Mock).mockResolvedValue(undefined as never);
  (postReview as jest.Mock).mockResolvedValue(baseResp as never);
});

afterEach(() => jest.clearAllMocks());

describe('ReviewScreen orchestration', () => {
  it('cache hit short-circuits postReview', async () => {
    (getCachedReview as jest.Mock).mockResolvedValue(baseResp as never);
    const { runOrchestration } = require('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).not.toHaveBeenCalled();
  });

  it('cache miss calls postReview and persists', async () => {
    const { runOrchestration } = require('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).toHaveBeenCalledTimes(1);
    expect(putCachedReview).toHaveBeenCalledWith({}, 'weekly', '2026-W17', baseResp);
  });

  it('empty period skips postReview entirely', async () => {
    (isPeriodEmpty as jest.Mock).mockReturnValue(true);
    const { runOrchestration } = require('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).not.toHaveBeenCalled();
  });

  it('failure does not write cache', async () => {
    (postReview as jest.Mock).mockRejectedValue(new Error('boom') as never);
    const { runOrchestration } = require('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(putCachedReview).not.toHaveBeenCalled();
  });
});
