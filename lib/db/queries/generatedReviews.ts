import { and, eq } from 'drizzle-orm';
import { generatedReviews } from '../schema';
import { type AnyDb } from './onboarding';
import type { ReviewPeriod, ReviewResponse } from '../../api-types';

export async function getCachedReview(
  db: AnyDb,
  period: ReviewPeriod,
  periodKey: string,
): Promise<ReviewResponse | null> {
  const rows = (db as any)
    .select()
    .from(generatedReviews)
    .where(and(eq(generatedReviews.period, period), eq(generatedReviews.periodKey, periodKey)))
    .limit(1)
    .all() as Array<{ payload: string }>;
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].payload) as ReviewResponse;
}

export async function putCachedReview(
  db: AnyDb,
  period: ReviewPeriod,
  periodKey: string,
  payload: ReviewResponse,
): Promise<void> {
  const json = JSON.stringify(payload);
  const now = Date.now();
  (db as any)
    .delete(generatedReviews)
    .where(and(eq(generatedReviews.period, period), eq(generatedReviews.periodKey, periodKey)))
    .run();
  (db as any)
    .insert(generatedReviews)
    .values({ period, periodKey, payload: json, generatedAt: now })
    .run();
}

export async function clearCachedReview(
  db: AnyDb,
  period: ReviewPeriod,
  periodKey: string,
): Promise<void> {
  (db as any)
    .delete(generatedReviews)
    .where(and(eq(generatedReviews.period, period), eq(generatedReviews.periodKey, periodKey)))
    .run();
}
