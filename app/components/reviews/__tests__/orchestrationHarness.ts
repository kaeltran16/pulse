import { computeReviewAggregates, computeReviewSignals, isPeriodEmpty } from '@/lib/db/queries/reviewAggregates';
import { getCachedReview, putCachedReview } from '@/lib/db/queries/generatedReviews';
import { postReview } from '@/lib/sync/reviewClient';
import { db } from '@/lib/db/client';
import type { ReviewPeriod } from '@/lib/api-types';

export async function runOrchestration(params: { period: ReviewPeriod; periodKey: string }): Promise<void> {
  const aggs = await computeReviewAggregates(db, params.period, params.periodKey);
  if (isPeriodEmpty(aggs)) return;
  const cached = await getCachedReview(db, params.period, params.periodKey);
  if (cached) return;
  const signals = await computeReviewSignals(db, params.period, aggs, params.periodKey);
  try {
    const resp = await postReview({ period: params.period, periodKey: params.periodKey, aggregates: aggs, signals });
    await putCachedReview(db, params.period, params.periodKey, resp);
  } catch {
    // failure path: do not write cache
  }
}
