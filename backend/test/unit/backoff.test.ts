import { describe, it, expect, beforeEach } from "vitest";
import { AccountBackoffState } from "../../src/worker/backoff.js";
import type { ImapAccount } from "../../src/db/schema.js";

function account(overrides: Partial<ImapAccount> = {}): ImapAccount {
  return {
    id: 1,
    emailAddress: "u@x.com",
    credentialsCiphertext: "c",
    senderAllowlist: "[]",
    pollIntervalSeconds: 300, // 5 min
    status: "active",
    lastPolledAt: null,
    lastError: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

let now = 0;
const clock = () => now;
let state: AccountBackoffState;

beforeEach(() => {
  now = 1_000_000;
  state = new AccountBackoffState(clock);
});

describe("AccountBackoffState", () => {
  it("first poll is eligible immediately when lastPolledAt is null", () => {
    expect(state.shouldPollNow(account({ lastPolledAt: null }))).toBe(true);
  });

  it("not eligible when within pollIntervalSeconds of lastPolledAt", () => {
    const acct = account({ lastPolledAt: now - 100_000 }); // 100s ago, interval is 300s
    expect(state.shouldPollNow(acct)).toBe(false);
  });

  it("eligible when past pollIntervalSeconds since lastPolledAt", () => {
    const acct = account({ lastPolledAt: now - 400_000 }); // 400s ago, interval is 300s
    expect(state.shouldPollNow(acct)).toBe(true);
  });

  it("transient failure pushes nextEligibleAt out exponentially", () => {
    const acct = account({ lastPolledAt: now });
    state.recordTransientFailure(acct);
    // First failure: backoff = 300s * 2^1 = 600s = 600_000ms
    now += 599_000;
    expect(state.shouldPollNow(acct)).toBe(false);
    now += 2_000; // total 601s past the failure
    expect(state.shouldPollNow(acct)).toBe(true);
  });

  it("backoff caps at 1 hour after enough failures", () => {
    const acct = account({ lastPolledAt: now });
    // 5min × 2^k: k=1→10min, k=2→20min, k=3→40min, k=4→80min (capped to 60min)
    for (let i = 0; i < 6; i++) {
      state.recordTransientFailure(acct);
    }
    const before = now;
    now = before + 60 * 60 * 1000 - 1000; // 1h - 1s after last failure
    expect(state.shouldPollNow(acct)).toBe(false);
    now = before + 60 * 60 * 1000 + 1000; // 1h + 1s after last failure
    expect(state.shouldPollNow(acct)).toBe(true);
  });

  it("recordSuccess resets the failure counter", () => {
    const acct = account({ lastPolledAt: now });
    state.recordTransientFailure(acct);
    state.recordTransientFailure(acct);
    state.recordSuccess(acct);
    // After success, normal eligibility based on lastPolledAt + interval
    now += 301_000;
    expect(state.shouldPollNow({ ...acct, lastPolledAt: acct.lastPolledAt })).toBe(true);
  });
});
