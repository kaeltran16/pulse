import type { SyncedEntry } from "../db/schema.js";

/**
 * Decision §2 row 5: a candidate is recurring iff there exists ≥1 prior in
 * `priors` with the same currency whose amount, when used as the reference,
 * places candidate.cents within ±10%. Caller is expected to pre-filter
 * `priors` to same-merchant + 60-day window (use the existing
 * `findRecurringCandidates` query).
 */
export function isRecurring(
  priors: readonly SyncedEntry[],
  candidate: { cents: number; currency: string },
): boolean {
  if (priors.length === 0) return false;
  return priors.some((p) => {
    if (p.currency !== candidate.currency) return false;
    const lower = p.cents * 0.9;
    const upper = p.cents * 1.1;
    return candidate.cents >= lower && candidate.cents <= upper;
  });
}
