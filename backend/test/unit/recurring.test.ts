import { describe, it, expect } from "vitest";
import { isRecurring } from "../../src/worker/recurring.js";
import type { SyncedEntry } from "../../src/db/schema.js";

function entry(overrides: Partial<SyncedEntry> = {}): SyncedEntry {
  return {
    id: 1,
    accountId: 1,
    imapUid: 1,
    contentHash: "h",
    cents: 1000,
    currency: "USD",
    merchant: "Netflix",
    category: null,
    occurredAt: 0,
    recurring: 0,
    rawParseResponse: "{}",
    emailSubject: null,
    emailFrom: null,
    createdAt: 0,
    ...overrides,
  };
}

describe("isRecurring", () => {
  it("returns false with 0 priors", () => {
    expect(isRecurring([], { cents: 1000, currency: "USD" })).toBe(false);
  });

  it("returns true on exact-amount match (≥1 prior)", () => {
    expect(isRecurring([entry()], { cents: 1000, currency: "USD" })).toBe(true);
  });

  it("returns true when amount is within +9%", () => {
    // prior 1000 cents, candidate 1090 cents → +9%
    expect(isRecurring([entry({ cents: 1000 })], { cents: 1090, currency: "USD" })).toBe(true);
  });

  it("returns false when amount is +11%", () => {
    expect(isRecurring([entry({ cents: 1000 })], { cents: 1110, currency: "USD" })).toBe(false);
  });

  it("returns true when amount is within -10% (boundary inclusive)", () => {
    expect(isRecurring([entry({ cents: 1000 })], { cents: 900, currency: "USD" })).toBe(true);
  });

  it("returns false when currency differs", () => {
    expect(isRecurring([entry({ currency: "USD" })], { cents: 1000, currency: "EUR" })).toBe(false);
  });

  it("returns true if at least one prior is in tolerance even if others aren't", () => {
    const priors = [
      entry({ id: 1, cents: 5000, currency: "USD" }),
      entry({ id: 2, cents: 1000, currency: "USD" }),
    ];
    expect(isRecurring(priors, { cents: 1050, currency: "USD" })).toBe(true);
  });
});
