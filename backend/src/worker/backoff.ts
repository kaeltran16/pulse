import type { ImapAccount } from "../db/schema.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

type PerAccount = {
  consecutiveFailures: number;
  nextEligibleAt: number; // 0 = no override (use lastPolledAt + pollInterval)
};

/**
 * Per-account in-memory backoff state. Process-local; restart resets to defaults.
 *
 * Decision §2 row 6:
 *   - recordSuccess  → consecutiveFailures = 0, nextEligibleAt = 0
 *   - recordTransientFailure → consecutiveFailures++, nextEligibleAt = now + min(pollInterval * 2^consecutiveFailures, 1h)
 *   - shouldPollNow  → if nextEligibleAt set, requires now >= nextEligibleAt;
 *                      else requires now >= (lastPolledAt + pollInterval)
 *                      lastPolledAt = null is always eligible (first ever poll)
 */
export class AccountBackoffState {
  private readonly state = new Map<number, PerAccount>();
  constructor(private readonly clock: () => number = Date.now) {}

  shouldPollNow(account: ImapAccount): boolean {
    const now = this.clock();
    const s = this.state.get(account.id);
    if (s && s.nextEligibleAt > 0) {
      return now >= s.nextEligibleAt;
    }
    if (account.lastPolledAt == null) return true;
    return now - account.lastPolledAt >= account.pollIntervalSeconds * 1000;
  }

  recordSuccess(account: ImapAccount): void {
    this.state.set(account.id, { consecutiveFailures: 0, nextEligibleAt: 0 });
  }

  recordTransientFailure(account: ImapAccount): void {
    const prev = this.state.get(account.id) ?? { consecutiveFailures: 0, nextEligibleAt: 0 };
    const failures = prev.consecutiveFailures + 1;
    const baseMs = account.pollIntervalSeconds * 1000;
    const delayMs = Math.min(baseMs * 2 ** failures, ONE_HOUR_MS);
    this.state.set(account.id, {
      consecutiveFailures: failures,
      nextEligibleAt: this.clock() + delayMs,
    });
  }

  /** Test/debug only. */
  consecutiveFailures(accountId: number): number {
    return this.state.get(accountId)?.consecutiveFailures ?? 0;
  }
}
