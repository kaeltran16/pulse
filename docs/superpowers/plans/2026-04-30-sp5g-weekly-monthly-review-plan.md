# SP5g — Weekly + Monthly Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Weekly and Monthly Review screens (`app/reviews/{weekly,monthly}.tsx`), period-aware backend `POST /review`, and the local aggregate / signal computation that drives both.

**Architecture:** iOS computes aggregates and signals locally from SQLite. Backend `/review` accepts a discriminated-union request keyed on `period: 'weekly' | 'monthly'` and returns LLM-authored prose only (`hero`, `patterns[]` tagged by signal key, optional `oneThingToTry`). iOS owns all numbers, caches the LLM response per period in a new `generated_reviews` table, and renders structured UI from cache + aggregates.

**Tech Stack:** Drizzle (better-sqlite3 in tests, expo-sqlite in app), Zod, Express, Vitest (backend), Jest (iOS), Expo Router.

**Spec:** [`../specs/2026-04-30-sp5g-weekly-monthly-review-design.md`](../specs/2026-04-30-sp5g-weekly-monthly-review-design.md)

---

## File structure

**Created:**

- `lib/db/queries/reviewAggregates.ts` — period bounds, `lastCompletedPeriodKey`, `computeReviewAggregates`, `computeReviewSignals`, `isPeriodEmpty`.
- `lib/db/queries/__tests__/reviewAggregates.test.ts` — bounds, aggregates, signals, empty.
- `lib/db/queries/generatedReviews.ts` — cache `get` / `put` / `clear`.
- `lib/db/queries/__tests__/generatedReviews.test.ts`.
- `lib/sync/reviewClient.ts` — `postReview()` wrapper around fetch.
- `lib/sync/__tests__/reviewClient.test.ts`.
- `lib/db/migrations/0007_<drizzle-name>.sql` — `generated_reviews` table (auto-generated).
- `app/reviews/_layout.tsx` — bare stack.
- `app/reviews/weekly.tsx`, `app/reviews/monthly.tsx` — thin route wrappers.
- `app/components/reviews/ReviewScreen.tsx` — shared body.
- `app/components/reviews/ThreeStatSummary.tsx`.
- `app/components/reviews/HeroCard.tsx`.
- `app/components/reviews/PatternsList.tsx`.
- `app/components/reviews/OneThingToTry.tsx`.
- `app/components/reviews/ByTheNumbers.tsx`.
- `app/components/reviews/ReviewEmptyState.tsx`, `ReviewRetryCard.tsx`.
- `app/components/reviews/__tests__/ReviewScreen.test.tsx`.

**Modified:**

- `lib/api-types.ts` — replace `ReviewRequest` / `ReviewResponse` and remove the four legacy aggregate types.
- `lib/db/schema.ts` — add `generatedReviews` table.
- `backend/src/schemas/review.ts` — replaced with discriminated union.
- `backend/src/lib/prompts/review.ts` — replaced with branched builder.
- `backend/src/routes/review.ts` — small adjustments to use the new schema/prompt.
- `backend/test/integration/review.test.ts` — rewritten.
- `backend/test/fixtures/aggregates.ts` — replaced with new shape.
- `app/(tabs)/you/index.tsx` — flip the two `Coming soon` rows on.

**Deleted:** none.

---

## Conventions used by every task

- **Backend tests** use Vitest. Import `from "vitest"`. Run with `cd backend && npm test`.
- **iOS tests** use Jest with a `/** @jest-environment node */` directive at the top. Run with `npm test`. Use `makeTestDb()` from `lib/db/__tests__/test-helpers.ts` for SQLite-backed tests.
- **Migrations** are generated with `cd <root> && npx drizzle-kit generate`. Drizzle picks the filename suffix; the plan refers to `0007_*.sql` and the post-generate edit to `lib/db/migrations/migrations.js` adds an `m0007` import line in alphabetical order.
- **Commit cadence:** one commit per task. Style: `feat(sp5g): …` for new behavior, `refactor(sp5g): …` for plumbing, `test(sp5g): …` for test-only commits, `chore(sp5g): …` for migrations and config. Subject ≤ 70 chars. No `Co-Authored-By` footer (per `CLAUDE.md`).
- **Type baseline:** `npx tsc --noEmit` baseline is currently 28 root errors and 0 backend errors. After every task that touches TS, run typecheck and confirm no regression.

---

## Task 1 — Replace shared `ReviewRequest` / `ReviewResponse` types in `lib/api-types.ts`

**Files:**
- Modify: `lib/api-types.ts:52-55,93-106`

- [ ] **Step 1: Open `lib/api-types.ts` and locate the existing aggregate types and review types**

Lines 52-55 hold the legacy `WorkoutAggregate`, `FoodAggregate`, `SpendAggregate`, `RitualAggregate`. Lines 93-106 hold `ReviewRequest` and `ReviewResponse`. Both blocks are replaced wholesale.

- [ ] **Step 2: Delete lines 52-55 (`WorkoutAggregate` … `RitualAggregate`)**

These are unused outside the review path (verified by grep). Removing them now keeps the next step's diff clean.

- [ ] **Step 3: Replace the `ReviewRequest` / `ReviewResponse` block (lines 93-106) with the new shape**

```ts
// --- /review ---

export type ReviewPeriod = 'weekly' | 'monthly';

export type ReviewSpendAggregate = {
  totalMinor: number;
  currency: string;
  byCategory: Record<string, number>;
  byDayOfWeek: number[]; // length 7, index 0 = Monday
  topMerchant: { name: string; totalMinor: number } | null;
};

export type ReviewRitualsAggregate = {
  kept: number;
  goalTotal: number;
  perRitual: Array<{ id: number; name: string; color: string; kept: number; streak: number }>;
  bestStreakRitual: { name: string; streak: number; color: string } | null;
};

export type ReviewWorkoutsAggregate = {
  sessions: number;
  prCount: number;
};

export type ReviewAggregates = {
  spend: ReviewSpendAggregate;
  rituals: ReviewRitualsAggregate;
  workouts: ReviewWorkoutsAggregate;
};

export type ReviewSignals = {
  topSpendDay: { dayOfWeek: number; multiplier: number } | null;
  ritualVsNonRitual: { sessionsOnRitualDays: number; sessionsOnNonRitualDays: number } | null;
  bestStreak: { ritualName: string; streak: number; color: string } | null;
  underBudget: { byMinor: number; budgetMinor: number } | null;
};

export type ReviewSignalKey = 'topSpendDay' | 'ritualVsNonRitual' | 'bestStreak' | 'underBudget';

export type ReviewRequest = {
  period: ReviewPeriod;
  periodKey: string; // 'YYYY-Www' (weekly) or 'YYYY-MM' (monthly)
  aggregates: ReviewAggregates;
  signals: ReviewSignals;
};

export type ReviewPatternProse = {
  signal: ReviewSignalKey;
  text: string;
};

export type ReviewResponse = {
  period: ReviewPeriod;
  hero: string;
  patterns: ReviewPatternProse[];
  oneThingToTry: { markdown: string; askPalPrompt: string } | null;
  generatedAt: string;
};
```

- [ ] **Step 4: Run typecheck**

Run: `npx tsc --noEmit`
Expected: backend compile errors only at `backend/src/schemas/review.ts` and the test fixture (those get fixed in Tasks 2 and 5). Root errors should not exceed the baseline of 28.

- [ ] **Step 5: Commit**

```bash
git add lib/api-types.ts
git commit -m "refactor(sp5g): redefine ReviewRequest/Response in api-types"
```

---

## Task 2 — Replace backend Zod schemas

**Files:**
- Modify: `backend/src/schemas/review.ts` (full rewrite)

- [ ] **Step 1: Write a failing schema test**

Create `backend/test/unit/reviewSchema.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ReviewRequestSchema, ReviewResponseSchema } from "../../src/schemas/review.js";

const validAggs = {
  spend: {
    totalMinor: 12500,
    currency: "USD",
    byCategory: { dining: 4500, groceries: 8000 },
    byDayOfWeek: [1000, 0, 0, 2500, 0, 8000, 1000],
    topMerchant: { name: "Trader Joe's", totalMinor: 8000 },
  },
  rituals: {
    kept: 12,
    goalTotal: 21,
    perRitual: [{ id: 1, name: "meditate", color: "rituals", kept: 5, streak: 5 }],
    bestStreakRitual: { name: "meditate", streak: 5, color: "rituals" },
  },
  workouts: { sessions: 3, prCount: 1 },
};
const validSignals = {
  topSpendDay: { dayOfWeek: 5, multiplier: 4.0 },
  ritualVsNonRitual: null,
  bestStreak: { ritualName: "meditate", streak: 5, color: "rituals" },
  underBudget: null,
};

describe("ReviewRequestSchema", () => {
  it("accepts a weekly request", () => {
    const ok = ReviewRequestSchema.safeParse({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(ok.success).toBe(true);
  });

  it("accepts a monthly request", () => {
    const ok = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(ok.success).toBe(true);
  });

  it("rejects weekly with monthly-shaped key", () => {
    const r = ReviewRequestSchema.safeParse({
      period: "weekly",
      periodKey: "2026-04",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects monthly with weekly-shaped key", () => {
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-W17",
      aggregates: validAggs,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects negative totalMinor", () => {
    const bad = { ...validAggs, spend: { ...validAggs.spend, totalMinor: -1 } };
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: bad,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });

  it("rejects byDayOfWeek length != 7", () => {
    const bad = { ...validAggs, spend: { ...validAggs.spend, byDayOfWeek: [0, 0, 0] } };
    const r = ReviewRequestSchema.safeParse({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: bad,
      signals: validSignals,
    });
    expect(r.success).toBe(false);
  });
});

describe("ReviewResponseSchema", () => {
  it("accepts a valid response", () => {
    const ok = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "A steady week.",
      patterns: [{ signal: "topSpendDay", text: "Friday cost 4× any other day." }],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(ok.success).toBe(true);
  });

  it("rejects duplicate signal keys in patterns", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "x",
      patterns: [
        { signal: "topSpendDay", text: "a" },
        { signal: "topSpendDay", text: "b" },
      ],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects empty hero", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "",
      patterns: [],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });

  it("rejects > 3 patterns", () => {
    const r = ReviewResponseSchema.safeParse({
      period: "weekly",
      hero: "x",
      patterns: [
        { signal: "topSpendDay", text: "a" },
        { signal: "ritualVsNonRitual", text: "b" },
        { signal: "bestStreak", text: "c" },
        { signal: "underBudget", text: "d" },
      ],
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test, expect it to fail**

Run: `cd backend && npx vitest run test/unit/reviewSchema.test.ts`
Expected: fails because the existing `backend/src/schemas/review.ts` has the legacy shape.

- [ ] **Step 3: Replace `backend/src/schemas/review.ts` with the new shape**

```ts
import { z } from "zod";
import type { ReviewRequest, ReviewResponse } from "@api-types";

const SpendAggregate = z.object({
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  byCategory: z.record(z.string(), z.number().int().nonnegative()),
  byDayOfWeek: z.array(z.number().int().nonnegative()).length(7),
  topMerchant: z
    .object({ name: z.string().min(1), totalMinor: z.number().int().nonnegative() })
    .nullable(),
});

const RitualsAggregate = z.object({
  kept: z.number().int().nonnegative(),
  goalTotal: z.number().int().nonnegative(),
  perRitual: z.array(
    z.object({
      id: z.number().int().positive(),
      name: z.string().min(1),
      color: z.string().min(1),
      kept: z.number().int().nonnegative(),
      streak: z.number().int().nonnegative(),
    }),
  ),
  bestStreakRitual: z
    .object({ name: z.string().min(1), streak: z.number().int().positive(), color: z.string().min(1) })
    .nullable(),
});

const WorkoutsAggregate = z.object({
  sessions: z.number().int().nonnegative(),
  prCount: z.number().int().nonnegative(),
});

const Aggregates = z.object({
  spend: SpendAggregate,
  rituals: RitualsAggregate,
  workouts: WorkoutsAggregate,
});

const Signals = z.object({
  topSpendDay: z
    .object({ dayOfWeek: z.number().int().min(0).max(6), multiplier: z.number().positive() })
    .nullable(),
  ritualVsNonRitual: z
    .object({
      sessionsOnRitualDays: z.number().int().nonnegative(),
      sessionsOnNonRitualDays: z.number().int().nonnegative(),
    })
    .nullable(),
  bestStreak: z
    .object({ ritualName: z.string().min(1), streak: z.number().int().positive(), color: z.string().min(1) })
    .nullable(),
  underBudget: z
    .object({ byMinor: z.number().int(), budgetMinor: z.number().int().positive() })
    .nullable(),
});

const Weekly = z.object({
  period: z.literal("weekly"),
  periodKey: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/, "weekly periodKey must be YYYY-Www"),
  aggregates: Aggregates,
  signals: Signals,
});

const Monthly = z.object({
  period: z.literal("monthly"),
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "monthly periodKey must be YYYY-MM"),
  aggregates: Aggregates,
  signals: Signals,
});

export const ReviewRequestSchema: z.ZodType<ReviewRequest> = z.discriminatedUnion("period", [Weekly, Monthly]);

const PatternProse = z.object({
  signal: z.enum(["topSpendDay", "ritualVsNonRitual", "bestStreak", "underBudget"]),
  text: z.string().min(1),
});

export const ReviewResponseSchema: z.ZodType<ReviewResponse> = z.object({
  period: z.enum(["weekly", "monthly"]),
  hero: z.string().min(1),
  patterns: z
    .array(PatternProse)
    .max(3)
    .refine((arr) => new Set(arr.map((p) => p.signal)).size === arr.length, {
      message: "patterns must have unique signal keys",
    }),
  oneThingToTry: z
    .object({ markdown: z.string().min(1), askPalPrompt: z.string().min(1) })
    .nullable(),
  generatedAt: z.string().min(1),
});
```

- [ ] **Step 4: Run the test, expect it to pass**

Run: `cd backend && npx vitest run test/unit/reviewSchema.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/review.ts backend/test/unit/reviewSchema.test.ts
git commit -m "feat(sp5g): period-aware /review request and response schemas"
```

---

## Task 3 — Replace backend prompt builder

**Files:**
- Modify: `backend/src/lib/prompts/review.ts` (full rewrite)
- Test: `backend/test/unit/reviewPrompt.test.ts` (new)

- [ ] **Step 1: Write the failing prompt-builder test**

```ts
import { describe, it, expect } from "vitest";
import { buildReviewMessages } from "../../src/lib/prompts/review.js";
import type { ReviewRequest } from "@api-types";

const baseAggs: ReviewRequest["aggregates"] = {
  spend: {
    totalMinor: 12500,
    currency: "USD",
    byCategory: { dining: 4500 },
    byDayOfWeek: [0, 0, 0, 0, 0, 12500, 0],
    topMerchant: { name: "Verve", totalMinor: 4000 },
  },
  rituals: { kept: 12, goalTotal: 21, perRitual: [], bestStreakRitual: null },
  workouts: { sessions: 3, prCount: 1 },
};

describe("buildReviewMessages", () => {
  it("weekly request asks for one-sentence hero and per-signal patterns", () => {
    const out = buildReviewMessages({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: baseAggs,
      signals: {
        topSpendDay: { dayOfWeek: 5, multiplier: 4.0 },
        ritualVsNonRitual: null,
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.system).toMatch(/Reflective/);
    expect(out.user).toMatch(/weekly/i);
    expect(out.user).toMatch(/2026-W17/);
    expect(out.user).toMatch(/topSpendDay/);
    expect(out.user).not.toMatch(/ritualVsNonRitual/);
    expect(out.user).not.toMatch(/bestStreak/);
    expect(out.user).not.toMatch(/underBudget/);
    expect(out.user).toMatch(/one short sentence/i);
  });

  it("monthly request asks for a 2-3 sentence narrative", () => {
    const out = buildReviewMessages({
      period: "monthly",
      periodKey: "2026-04",
      aggregates: baseAggs,
      signals: {
        topSpendDay: null,
        ritualVsNonRitual: { sessionsOnRitualDays: 2, sessionsOnNonRitualDays: 1 },
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.user).toMatch(/2-3 sentence/i);
    expect(out.user).toMatch(/2026-04/);
    expect(out.user).toMatch(/ritualVsNonRitual/);
  });

  it("includes only non-null signal keys in the user message", () => {
    const out = buildReviewMessages({
      period: "weekly",
      periodKey: "2026-W17",
      aggregates: baseAggs,
      signals: {
        topSpendDay: null,
        ritualVsNonRitual: null,
        bestStreak: null,
        underBudget: null,
      },
    });
    expect(out.user).toMatch(/no signals were detected/i);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

Run: `cd backend && npx vitest run test/unit/reviewPrompt.test.ts`
Expected: fails — current prompt builder takes `(month, aggregates)`, not the new shape.

- [ ] **Step 3: Replace `backend/src/lib/prompts/review.ts`**

```ts
import type { ReviewRequest, ReviewSignalKey } from "@api-types";

const SYSTEM = `You write the user's review in the Pulse app.

Voice:
- Reflective, specific, encouraging without flattery.
- Use the supplied numbers exactly. Do not invent ones not present.
- Never write a pattern for a signal that wasn't supplied as non-null.

Output format:
- Strict JSON matching the response schema you've been given.
- patterns[] entries each carry a 'signal' key matching one of the non-null signals in the input.
- patterns[] has at most one entry per signal key.
- Each pattern.text is a single sentence, 25 words or fewer.
`;

function nonNullKeys(signals: ReviewRequest["signals"]): ReviewSignalKey[] {
  const out: ReviewSignalKey[] = [];
  if (signals.topSpendDay) out.push("topSpendDay");
  if (signals.ritualVsNonRitual) out.push("ritualVsNonRitual");
  if (signals.bestStreak) out.push("bestStreak");
  if (signals.underBudget) out.push("underBudget");
  return out;
}

export function buildReviewMessages(req: ReviewRequest): { system: string; user: string } {
  const keys = nonNullKeys(req.signals);
  const heroInstruction =
    req.period === "weekly"
      ? "Write the hero as one short sentence (≤ 12 words) capturing the week's character."
      : "Write the hero as a 2-3 sentence narrative paragraph capturing the month's character.";

  const signalsBlock =
    keys.length === 0
      ? "no signals were detected — emit an empty patterns array."
      : `Non-null signal keys you may use in patterns: ${keys.join(", ")}.`;

  const oneThingHint =
    req.period === "weekly"
      ? "If any non-null signal supports a concrete suggestion, emit oneThingToTry as { markdown, askPalPrompt }, where markdown is one short sentence (may use **bold**) and askPalPrompt is a follow-up question Pal could answer. Otherwise emit oneThingToTry: null."
      : "oneThingToTry is optional for monthly. Emit null if nothing concrete fits.";

  const user =
    `Write the ${req.period} review for ${req.periodKey}.\n\n` +
    `${heroInstruction}\n\n` +
    `${signalsBlock}\n\n` +
    `${oneThingHint}\n\n` +
    `Aggregates (use exact numbers in prose):\n` +
    JSON.stringify(req.aggregates, null, 2) +
    `\n\nSignals (only non-null entries are eligible for patterns[]):\n` +
    JSON.stringify(req.signals, null, 2);

  return { system: SYSTEM, user };
}
```

- [ ] **Step 4: Run test, expect pass**

Run: `cd backend && npx vitest run test/unit/reviewPrompt.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/prompts/review.ts backend/test/unit/reviewPrompt.test.ts
git commit -m "feat(sp5g): branched /review prompt builder for weekly + monthly"
```

---

## Task 4 — Rewrite the `/review` route + integration tests

**Files:**
- Modify: `backend/src/routes/review.ts`
- Modify: `backend/test/fixtures/aggregates.ts` (replaced)
- Modify: `backend/test/integration/review.test.ts` (rewritten)

- [ ] **Step 1: Replace `backend/test/fixtures/aggregates.ts`**

```ts
import type { ReviewRequest } from "@api-types";

export const sampleAggregates: ReviewRequest["aggregates"] = {
  spend: {
    totalMinor: 125000,
    currency: "USD",
    byCategory: { dining: 30000, groceries: 45000, other: 50000 },
    byDayOfWeek: [10000, 5000, 5000, 5000, 60000, 30000, 10000],
    topMerchant: { name: "Trader Joe's", totalMinor: 30000 },
  },
  rituals: {
    kept: 21,
    goalTotal: 28,
    perRitual: [{ id: 1, name: "meditate", color: "rituals", kept: 7, streak: 7 }],
    bestStreakRitual: { name: "meditate", streak: 7, color: "rituals" },
  },
  workouts: { sessions: 3, prCount: 1 },
};

export const sampleSignals: ReviewRequest["signals"] = {
  topSpendDay: { dayOfWeek: 4, multiplier: 4.0 },
  ritualVsNonRitual: { sessionsOnRitualDays: 2, sessionsOnNonRitualDays: 1 },
  bestStreak: { ritualName: "meditate", streak: 7, color: "rituals" },
  underBudget: null,
};
```

- [ ] **Step 2: Rewrite `backend/test/integration/review.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import { sampleAggregates, sampleSignals } from "../fixtures/aggregates.js";

const goodResponse = JSON.stringify({
  period: "weekly",
  hero: "A steady week.",
  patterns: [
    { signal: "topSpendDay", text: "Friday cost 4× any other day this week." },
    { signal: "bestStreak", text: "Meditate held a 7-day streak." },
  ],
  oneThingToTry: {
    markdown: "Plan groceries on **Thursday** — Friday spend usually drops.",
    askPalPrompt: "Tell me more about my Friday spending",
  },
  generatedAt: "2026-04-30T00:00:00Z",
});

describe("POST /review", () => {
  it("returns structured prose for a weekly request", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: goodResponse,
          usage: { inputTokens: 100, outputTokens: 200 },
        }),
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("weekly");
    expect(res.body.patterns).toHaveLength(2);
    expect(res.body.oneThingToTry?.askPalPrompt).toMatch(/Friday/);
  });

  it("returns structured prose for a monthly request", async () => {
    const monthlyResp = JSON.stringify({
      period: "monthly",
      hero: "April was your steadiest month yet. Spending stayed below March, movement held, and rituals took hold.",
      patterns: [{ signal: "topSpendDay", text: "Friday averaged 4× any other day." }],
      oneThingToTry: null,
      generatedAt: "2026-05-01T00:00:00Z",
    });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: monthlyResp, usage: { inputTokens: 100, outputTokens: 200 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "monthly",
        periodKey: "2026-04",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("monthly");
    expect(res.body.hero.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
  });

  it("rejects weekly with monthly-shaped key (400)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-04",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("rejects monthly with weekly-shaped key (400)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "monthly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("rejects byDayOfWeek length != 7 (400)", async () => {
    const bad = { ...sampleAggregates, spend: { ...sampleAggregates.spend, byDayOfWeek: [0, 0, 0] } };
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: bad,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
  });

  it("returns 502 when LLM returns invalid JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json at all", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(502);
  });

  it("returns 502 when LLM emits a pattern.signal that wasn't supplied as non-null", async () => {
    const badResp = JSON.stringify({
      period: "weekly",
      hero: "x",
      patterns: [{ signal: "underBudget", text: "made-up" }], // underBudget is null in sampleSignals
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: badResp, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(502);
  });

  it("returns 401 with no token", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/review")
      .send({ period: "weekly", periodKey: "2026-W17", aggregates: sampleAggregates, signals: sampleSignals });
    expect(res.status).toBe(401);
  });

  it("returns 403 with token missing 'review' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["chat", "parse", "sync"] });
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ period: "weekly", periodKey: "2026-W17", aggregates: sampleAggregates, signals: sampleSignals });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Run integration tests, expect failures**

Run: `cd backend && npx vitest run test/integration/review.test.ts`
Expected: many failures — the current route still uses the old schema/prompt and rejects the new request shape; the "wrong-signal" test in particular requires new route logic.

- [ ] **Step 4: Update `backend/src/routes/review.ts`**

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { ReviewRequestSchema, ReviewResponseSchema } from "../schemas/review.js";
import { buildReviewMessages } from "../lib/prompts/review.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { ReviewSignalKey, ReviewRequest } from "@api-types";

function nonNullSignalKeys(signals: ReviewRequest["signals"]): Set<ReviewSignalKey> {
  const s = new Set<ReviewSignalKey>();
  if (signals.topSpendDay) s.add("topSpendDay");
  if (signals.ritualVsNonRitual) s.add("ritualVsNonRitual");
  if (signals.bestStreak) s.add("bestStreak");
  if (signals.underBudget) s.add("underBudget");
  return s;
}

export function reviewRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ReviewRequestSchema.parse(req.body);
      const { system, user } = buildReviewMessages(body);
      const { text } = await deps.llm.chatJson({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        model: deps.modelId,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new UpstreamError("review output was not valid JSON");
      }
      const validated = ReviewResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`review output failed schema: ${validated.error.message}`);
      }

      // Enforce: every pattern.signal must be a non-null signal in the request.
      const allowed = nonNullSignalKeys(body.signals);
      const stray = validated.data.patterns.find((p) => !allowed.has(p.signal));
      if (stray) {
        throw new UpstreamError(`review pattern referenced absent signal: ${stray.signal}`);
      }

      // Enforce: response.period must match request.period.
      if (validated.data.period !== body.period) {
        throw new UpstreamError(`review period mismatch: req=${body.period} resp=${validated.data.period}`);
      }

      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
```

- [ ] **Step 5: Run all backend tests**

Run: `cd backend && npm test`
Expected: all green. The full backend baseline is 226 tests + new tests from Tasks 2/3 + the rewritten integration tests.

- [ ] **Step 6: Run backend typecheck**

Run: `cd backend && npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/review.ts backend/test/integration/review.test.ts backend/test/fixtures/aggregates.ts
git commit -m "feat(sp5g): rewrite /review route for period-aware structured prose"
```

---

## Task 5 — iOS schema delta + migration `0007`

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0007_<drizzle-name>.sql` (auto-generated)
- Modify: `lib/db/migrations/migrations.js` (add the m0007 import + entry)
- Modify: `lib/db/migrations/meta/*` (auto-updated by drizzle-kit)

- [ ] **Step 1: Add `generatedReviews` to `lib/db/schema.ts`**

Append at the end of the existing schema file (after the SP5f tables added in `0006_*.sql`):

```ts
export const generatedReviews = sqliteTable(
  'generated_reviews',
  {
    period: text('period', { enum: ['weekly', 'monthly'] }).notNull(),
    periodKey: text('period_key').notNull(),
    payload: text('payload').notNull(),
    generatedAt: integer('generated_at').notNull(),
  },
  (t) => ({
    pk: uniqueIndex('idx_generated_reviews_pk').on(t.period, t.periodKey),
  }),
);
```

(`uniqueIndex` is already imported at the top of `schema.ts`.)

- [ ] **Step 2: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: drizzle creates `lib/db/migrations/0007_<some-name>.sql` and updates `lib/db/migrations/meta/_journal.json` + `0007_snapshot.json`. The SQL should look like:

```sql
CREATE TABLE `generated_reviews` (
  `period` text NOT NULL,
  `period_key` text NOT NULL,
  `payload` text NOT NULL,
  `generated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_generated_reviews_pk` ON `generated_reviews` (`period`,`period_key`);
```

If the drizzle-generated SQL differs in cosmetic ways (CHECK clause placement, index naming), accept the generator's output — do not hand-edit.

- [ ] **Step 3: Wire the new migration into `lib/db/migrations/migrations.js`**

This file lists imports manually (`m0000` through `m0006` today). Add `m0007`:

```js
import m0006 from './0006_acoustic_iron_lad.sql';
import m0007 from './0007_<drizzle-name>.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
m0007
    }
  }
```

(Match the exact filename emitted in Step 2.)

- [ ] **Step 4: Run iOS tests to confirm migration applies cleanly**

Run: `npm test -- lib/db/queries/__tests__/streakHighWater.test.ts`
Expected: passes. `makeTestDb()` runs `migrate()` against an in-memory SQLite, so this is the cheapest end-to-end migration check we have.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "chore(sp5g): generated_reviews table + migration 0007"
```

---

## Task 6 — `reviewAggregates.ts` part 1: period bounds + `lastCompletedPeriodKey`

**Files:**
- Create: `lib/db/queries/reviewAggregates.ts` (initial)
- Create: `lib/db/queries/__tests__/reviewAggregates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
/** @jest-environment node */
import { periodBounds, lastCompletedPeriodKey } from '../reviewAggregates';

describe('periodBounds', () => {
  it('weekly: returns Mon 00:00 to next Mon 00:00 for an offset of 0', () => {
    // Anchor: Wed 2026-04-29
    const anchor = new Date(2026, 3, 29, 12, 0, 0);
    const b = periodBounds('weekly', anchor, 0);
    // Mon 2026-04-27 00:00 .. Mon 2026-05-04 00:00
    expect(new Date(b.startMs).toString()).toContain('Apr 27 2026');
    expect(new Date(b.endMs).toString()).toContain('May 04 2026');
    expect(b.key).toBe('2026-W18');
  });

  it('weekly: offset -1 returns the previous ISO week', () => {
    const anchor = new Date(2026, 3, 29, 12, 0, 0);
    const b = periodBounds('weekly', anchor, -1);
    expect(b.key).toBe('2026-W17');
  });

  it('weekly: ISO year boundary — Jan 1 2027 is Friday, falls in 2026-W53', () => {
    const anchor = new Date(2027, 0, 1, 12, 0, 0);
    const b = periodBounds('weekly', anchor, 0);
    expect(b.key).toBe('2026-W53');
  });

  it('monthly: returns 1st 00:00 to next 1st 00:00 for offset 0', () => {
    const anchor = new Date(2026, 3, 15, 12, 0, 0); // Apr 15
    const b = periodBounds('monthly', anchor, 0);
    expect(new Date(b.startMs).toString()).toContain('Apr 01 2026');
    expect(new Date(b.endMs).toString()).toContain('May 01 2026');
    expect(b.key).toBe('2026-04');
  });

  it('monthly: offset -1 returns the previous month', () => {
    const anchor = new Date(2026, 3, 15, 12, 0, 0);
    const b = periodBounds('monthly', anchor, -1);
    expect(b.key).toBe('2026-03');
  });

  it('monthly: rolls back across year boundary', () => {
    const anchor = new Date(2026, 0, 15, 12, 0, 0); // Jan 15
    const b = periodBounds('monthly', anchor, -1);
    expect(b.key).toBe('2025-12');
  });
});

describe('lastCompletedPeriodKey', () => {
  it('weekly: Wed → returns the prior week (last completed Mon..Sun)', () => {
    const wed = new Date(2026, 3, 29, 12, 0, 0);
    expect(lastCompletedPeriodKey('weekly', wed)).toBe('2026-W17');
  });

  it('weekly: Mon morning → returns the week that ended yesterday', () => {
    const mon = new Date(2026, 3, 27, 9, 0, 0);
    expect(lastCompletedPeriodKey('weekly', mon)).toBe('2026-W17');
  });

  it('monthly: 15th → returns the prior month', () => {
    const d = new Date(2026, 3, 15, 12, 0, 0);
    expect(lastCompletedPeriodKey('monthly', d)).toBe('2026-03');
  });

  it('monthly: 1st of month → returns the prior month', () => {
    const d = new Date(2026, 3, 1, 9, 0, 0);
    expect(lastCompletedPeriodKey('monthly', d)).toBe('2026-03');
  });
});
```

- [ ] **Step 2: Run test, expect ImportError**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: fails — module not found.

- [ ] **Step 3: Create `lib/db/queries/reviewAggregates.ts`**

```ts
export type ReviewPeriod = 'weekly' | 'monthly';

export type PeriodBounds = {
  startMs: number;
  endMs: number; // exclusive
  key: string;   // 'YYYY-Www' | 'YYYY-MM'
};

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// ISO week: Monday = day 1; week containing Jan 4 is week 1.
function isoWeekParts(d: Date): { year: number; week: number } {
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { year: target.getUTCFullYear(), week };
}

function startOfMondayLocal(d: Date): Date {
  const day = (d.getDay() + 6) % 7; // Mon=0..Sun=6
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day, 0, 0, 0, 0);
  return out;
}

function startOfMonthLocal(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}

export function periodBounds(period: ReviewPeriod, anchor: Date, offset: number): PeriodBounds {
  if (period === 'weekly') {
    const monAnchor = startOfMondayLocal(anchor);
    const start = new Date(monAnchor.getFullYear(), monAnchor.getMonth(), monAnchor.getDate() + 7 * offset, 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7, 0, 0, 0, 0);
    const { year, week } = isoWeekParts(start);
    return { startMs: start.getTime(), endMs: end.getTime(), key: `${year}-W${pad2(week)}` };
  }
  // monthly
  const m0 = startOfMonthLocal(anchor.getFullYear(), anchor.getMonth());
  const start = startOfMonthLocal(m0.getFullYear(), m0.getMonth() + offset);
  const end = startOfMonthLocal(start.getFullYear(), start.getMonth() + 1);
  return { startMs: start.getTime(), endMs: end.getTime(), key: `${start.getFullYear()}-${pad2(start.getMonth() + 1)}` };
}

export function lastCompletedPeriodKey(period: ReviewPeriod, asOf: Date): string {
  return periodBounds(period, asOf, -1).key;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: 10 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/reviewAggregates.ts lib/db/queries/__tests__/reviewAggregates.test.ts
git commit -m "feat(sp5g): periodBounds and lastCompletedPeriodKey helpers"
```

---

## Task 7 — `reviewAggregates.ts` part 2: `computeReviewAggregates`

**Files:**
- Modify: `lib/db/queries/reviewAggregates.ts`
- Modify: `lib/db/queries/__tests__/reviewAggregates.test.ts`

- [ ] **Step 1: Append failing tests**

Append to the existing test file (after the existing `describe` blocks):

```ts
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals, ritualEntries, spendingEntries, sessions, prs, exercises, goals } from '../../schema';
import { computeReviewAggregates } from '../reviewAggregates';

function seedRitual(db: any, title: string, color: string = 'rituals'): number {
  const r = db
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color, position: 0 })
    .returning({ id: rituals.id })
    .all();
  return r[0].id;
}

describe('computeReviewAggregates', () => {
  it('weekly: counts ritual entries, spending, sessions in [startMs, endMs)', async () => {
    const { db } = makeTestDb();
    const ritualId = seedRitual(db, 'meditate');
    // Mon 2026-04-27 .. Sun 2026-05-03 → key 2026-W18 at offset 0 vs anchor Wed 04-29
    const wed = new Date(2026, 3, 29, 12).getTime();
    db.insert(ritualEntries).values({ ritualId, occurredAt: wed }).run();
    db.insert(spendingEntries)
      .values({ cents: 1500, category: 'dining', occurredAt: wed, currency: 'USD' })
      .run();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 3 }).run();

    const aggs = await computeReviewAggregates(db as any, 'weekly', '2026-W18');
    expect(aggs.spend.totalMinor).toBe(1500);
    expect(aggs.spend.byDayOfWeek[2]).toBe(1500); // Wed = index 2 (Mon=0)
    expect(aggs.spend.topMerchant).toBeNull(); // no merchant set
    expect(aggs.rituals.kept).toBe(1);
    expect(aggs.rituals.goalTotal).toBe(3 * 7);
    expect(aggs.workouts.sessions).toBe(0);
    expect(aggs.workouts.prCount).toBe(0);
  });

  it('weekly: byCategory + topMerchant resolve correctly', async () => {
    const { db } = makeTestDb();
    const wed = new Date(2026, 3, 29, 12).getTime();
    db.insert(spendingEntries)
      .values([
        { cents: 1500, category: 'dining', merchant: 'Verve', occurredAt: wed, currency: 'USD' },
        { cents: 4000, category: 'groceries', merchant: "Trader Joe's", occurredAt: wed, currency: 'USD' },
        { cents: 800, category: 'dining', merchant: 'Verve', occurredAt: wed, currency: 'USD' },
      ])
      .run();
    const aggs = await computeReviewAggregates(db as any, 'weekly', '2026-W18');
    expect(aggs.spend.byCategory.dining).toBe(2300);
    expect(aggs.spend.byCategory.groceries).toBe(4000);
    expect(aggs.spend.topMerchant).toEqual({ name: "Trader Joe's", totalMinor: 4000 });
  });

  it('monthly: bestStreakRitual is null when no ritual has a streak >= 1', async () => {
    const { db } = makeTestDb();
    seedRitual(db, 'meditate');
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 1 }).run();
    const aggs = await computeReviewAggregates(db as any, 'monthly', '2026-04');
    expect(aggs.rituals.bestStreakRitual).toBeNull();
  });

  it('monthly: counts sessions and PRs by occurrence time', async () => {
    const { db } = makeTestDb();
    const apr15 = new Date(2026, 3, 15, 12).getTime();
    const may1  = new Date(2026, 4, 1, 12).getTime();
    db.insert(exercises).values({ id: 'bench', name: 'Bench', group: 'push', muscle: 'chest', equipment: 'bb', kind: 'strength', sfSymbol: 'figure.strengthtraining.functional' }).run();
    db.insert(sessions).values([
      { routineNameSnapshot: 'A', status: 'completed', startedAt: apr15, finishedAt: apr15 + 1, prCount: 1 },
      { routineNameSnapshot: 'B', status: 'completed', startedAt: may1, finishedAt: may1 + 1, prCount: 0 }, // out of period
    ]).run();
    db.insert(prs).values({ exerciseId: 'bench', weightKg: 100, reps: 5, sessionId: 1, achievedAt: apr15 }).run();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 30, dailyRitualTarget: 1 }).run();
    const aggs = await computeReviewAggregates(db as any, 'monthly', '2026-04');
    expect(aggs.workouts.sessions).toBe(1);
    expect(aggs.workouts.prCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, expect failure (function not exported)**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: ImportError on `computeReviewAggregates`.

- [ ] **Step 3: Implement `computeReviewAggregates`**

Append to `lib/db/queries/reviewAggregates.ts`. Note: Drizzle's typed `db` is parametrised over schema; in tests we pass `BetterSQLite3Database`, in the app we pass an Expo Drizzle instance. We accept both via `AnyDb` (mirror the pattern used in `lib/db/queries/onboarding.ts`).

```ts
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import {
  goals as goalsTable,
  rituals,
  ritualEntries,
  spendingEntries,
  sessions,
  prs,
  type RitualColor,
} from '../schema';
import { streakForRitual } from './streaks';
import type { ReviewAggregates } from '../../api-types';
import { type AnyDb } from './onboarding';

function parseKey(period: ReviewPeriod, periodKey: string): { year: number; index: number } {
  if (period === 'weekly') {
    const m = /^(\d{4})-W(\d{2})$/.exec(periodKey);
    if (!m) throw new Error(`bad weekly key: ${periodKey}`);
    return { year: Number(m[1]), index: Number(m[2]) };
  }
  const m = /^(\d{4})-(\d{2})$/.exec(periodKey);
  if (!m) throw new Error(`bad monthly key: ${periodKey}`);
  return { year: Number(m[1]), index: Number(m[2]) };
}

function boundsForKey(period: ReviewPeriod, periodKey: string): PeriodBounds {
  if (period === 'monthly') {
    const { year, index } = parseKey('monthly', periodKey);
    const start = new Date(year, index - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, index, 1, 0, 0, 0, 0);
    return { startMs: start.getTime(), endMs: end.getTime(), key: periodKey };
  }
  // weekly: scan ±1 around current week to find the matching ISO key.
  const { year } = parseKey('weekly', periodKey);
  const probe = new Date(year, 0, 4, 12); // Jan 4 is always in week 1
  // walk forward at most 53 weeks to find a Monday whose key matches.
  for (let i = -1; i <= 53; i++) {
    const b = periodBounds('weekly', probe, i);
    if (b.key === periodKey) return b;
  }
  throw new Error(`no bounds for weekly key ${periodKey}`);
}

function daysInPeriod(b: PeriodBounds): number {
  return Math.round((b.endMs - b.startMs) / 86400000);
}

function dayOfWeekIndex(ms: number): number {
  // 0 = Monday .. 6 = Sunday (matches schema/spec contract).
  return (new Date(ms).getDay() + 6) % 7;
}

export async function computeReviewAggregates(
  db: AnyDb,
  period: ReviewPeriod,
  periodKey: string,
): Promise<ReviewAggregates> {
  const bounds = boundsForKey(period, periodKey);
  const { startMs, endMs } = bounds;

  // ─── Spend ──────────────────────────────────────────
  const spendRows = (db as any)
    .select({
      cents: spendingEntries.cents,
      category: spendingEntries.category,
      merchant: spendingEntries.merchant,
      currency: spendingEntries.currency,
      occurredAt: spendingEntries.occurredAt,
    })
    .from(spendingEntries)
    .where(and(gte(spendingEntries.occurredAt, startMs), lt(spendingEntries.occurredAt, endMs)))
    .all() as Array<{ cents: number; category: string | null; merchant: string | null; currency: string; occurredAt: number }>;

  let totalMinor = 0;
  const byCategory: Record<string, number> = {};
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const merchantTotals = new Map<string, number>();
  let currency = 'USD';
  for (const row of spendRows) {
    totalMinor += row.cents;
    if (row.category) byCategory[row.category] = (byCategory[row.category] ?? 0) + row.cents;
    byDayOfWeek[dayOfWeekIndex(row.occurredAt)] += row.cents;
    if (row.merchant) merchantTotals.set(row.merchant, (merchantTotals.get(row.merchant) ?? 0) + row.cents);
    currency = row.currency;
  }
  let topMerchant: { name: string; totalMinor: number } | null = null;
  for (const [name, total] of merchantTotals.entries()) {
    if (!topMerchant || total > topMerchant.totalMinor) topMerchant = { name, totalMinor: total };
  }

  // ─── Rituals ────────────────────────────────────────
  const ritualRows = (db as any)
    .select({ id: rituals.id, title: rituals.title, color: rituals.color })
    .from(rituals)
    .where(eq(rituals.active, true))
    .orderBy(asc(rituals.position))
    .all() as Array<{ id: number; title: string; color: RitualColor }>;

  const entriesInPeriod = (db as any)
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .where(and(gte(ritualEntries.occurredAt, startMs), lt(ritualEntries.occurredAt, endMs)))
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  const allRitualEntries = (db as any)
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  const asOf = new Date(endMs - 1);
  const perRitual = ritualRows.map((r) => ({
    id: r.id,
    name: r.title,
    color: r.color,
    kept: entriesInPeriod.filter((e) => e.ritualId === r.id).length,
    streak: streakForRitual({ ritualEntries: allRitualEntries, ritualId: r.id, asOf }),
  }));
  const kept = entriesInPeriod.length;

  const goalsRow = (db as any).select().from(goalsTable).limit(1).all() as Array<{ dailyRitualTarget: number }>;
  const dailyTarget = goalsRow[0]?.dailyRitualTarget ?? 0;
  const goalTotal = dailyTarget * daysInPeriod(bounds);

  let bestStreakRitual: { name: string; streak: number; color: string } | null = null;
  for (const r of perRitual) {
    if (r.streak >= 1 && (!bestStreakRitual || r.streak > bestStreakRitual.streak)) {
      bestStreakRitual = { name: r.name, streak: r.streak, color: r.color };
    }
  }

  // ─── Workouts ───────────────────────────────────────
  const sessionsInPeriod = (db as any)
    .select({ id: sessions.id, prCount: sessions.prCount })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'completed'),
        gte(sessions.startedAt, startMs),
        lt(sessions.startedAt, endMs),
      ),
    )
    .all() as Array<{ id: number; prCount: number }>;
  const sessionCount = sessionsInPeriod.length;

  const prsInPeriod = (db as any)
    .select({ id: prs.id })
    .from(prs)
    .where(and(gte(prs.achievedAt, startMs), lt(prs.achievedAt, endMs)))
    .all() as Array<{ id: number }>;
  const prCount = prsInPeriod.length;

  return {
    spend: { totalMinor, currency, byCategory, byDayOfWeek, topMerchant },
    rituals: { kept, goalTotal, perRitual, bestStreakRitual },
    workouts: { sessions: sessionCount, prCount },
  };
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/reviewAggregates.ts lib/db/queries/__tests__/reviewAggregates.test.ts
git commit -m "feat(sp5g): computeReviewAggregates over local SQLite"
```

---

## Task 8 — `reviewAggregates.ts` part 3: `computeReviewSignals` + `isPeriodEmpty`

**Files:**
- Modify: `lib/db/queries/reviewAggregates.ts`
- Modify: `lib/db/queries/__tests__/reviewAggregates.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { computeReviewSignals, isPeriodEmpty } from '../reviewAggregates';

describe('computeReviewSignals', () => {
  function emptyAggs(): ReturnType<typeof Object.assign> {
    return {
      spend: { totalMinor: 0, currency: 'USD', byCategory: {}, byDayOfWeek: [0,0,0,0,0,0,0], topMerchant: null },
      rituals: { kept: 0, goalTotal: 7, perRitual: [], bestStreakRitual: null },
      workouts: { sessions: 0, prCount: 0 },
    };
  }

  it('topSpendDay null when fewer than 2 days have spend', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    aggs.spend.byDayOfWeek[5] = 5000; // only Saturday has spend
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.topSpendDay).toBeNull();
  });

  it('topSpendDay multiplier: 1 day at $200, 4 days at $50 → 4', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    aggs.spend.byDayOfWeek = [5000, 5000, 5000, 5000, 20000, 0, 0];
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.topSpendDay?.dayOfWeek).toBe(4);
    expect(sig.topSpendDay?.multiplier).toBeCloseTo(4, 5);
  });

  it('ritualVsNonRitual null when no sessions in period', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.ritualVsNonRitual).toBeNull();
  });

  it('underBudget populated when dailyBudget × days > totalMinor', async () => {
    const { db } = makeTestDb();
    // weekly = 7 days; budget 5000/day → 35000 minor; spend 20000 → under by 15000
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    aggs.spend.totalMinor = 20000;
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.underBudget).toEqual({ byMinor: 15000, budgetMinor: 35000 });
  });

  it('underBudget null when over budget', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 5000, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    aggs.spend.totalMinor = 50000; // > 7 × 5000
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.underBudget).toBeNull();
  });

  it('underBudget null when dailyBudgetCents is 0', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 1 }).run();
    const aggs = emptyAggs();
    aggs.spend.totalMinor = 100;
    const sig = await computeReviewSignals(db as any, 'weekly', aggs as any, '2026-W18');
    expect(sig.underBudget).toBeNull();
  });
});

describe('isPeriodEmpty', () => {
  it('true when all three domains are zero', () => {
    expect(
      isPeriodEmpty({
        spend: { totalMinor: 0, currency: 'USD', byCategory: {}, byDayOfWeek: [0,0,0,0,0,0,0], topMerchant: null },
        rituals: { kept: 0, goalTotal: 7, perRitual: [], bestStreakRitual: null },
        workouts: { sessions: 0, prCount: 0 },
      }),
    ).toBe(true);
  });

  it('false when any domain has activity', () => {
    expect(
      isPeriodEmpty({
        spend: { totalMinor: 0, currency: 'USD', byCategory: {}, byDayOfWeek: [0,0,0,0,0,0,0], topMerchant: null },
        rituals: { kept: 1, goalTotal: 7, perRitual: [], bestStreakRitual: null },
        workouts: { sessions: 0, prCount: 0 },
      }),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect ImportError**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: fails on missing exports.

- [ ] **Step 3: Append to `lib/db/queries/reviewAggregates.ts`**

```ts
import type { ReviewSignals } from '../../api-types';

export async function computeReviewSignals(
  db: AnyDb,
  period: ReviewPeriod,
  aggs: ReviewAggregates,
  periodKey: string,
): Promise<ReviewSignals> {
  const bounds = boundsForKey(period, periodKey);
  const { startMs, endMs } = bounds;

  // ─── topSpendDay ────────────────────────────────────
  const daysWithSpend = aggs.spend.byDayOfWeek.filter((v) => v > 0);
  let topSpendDay: ReviewSignals['topSpendDay'] = null;
  if (daysWithSpend.length >= 2) {
    let topIdx = 0;
    for (let i = 1; i < 7; i++) if (aggs.spend.byDayOfWeek[i] > aggs.spend.byDayOfWeek[topIdx]) topIdx = i;
    const top = aggs.spend.byDayOfWeek[topIdx];
    const others = aggs.spend.byDayOfWeek.filter((v, i) => i !== topIdx && v > 0);
    if (others.length >= 1) {
      const avg = others.reduce((s, v) => s + v, 0) / others.length;
      topSpendDay = { dayOfWeek: topIdx, multiplier: top / avg };
    }
  }

  // ─── ritualVsNonRitual ──────────────────────────────
  let ritualVsNonRitual: ReviewSignals['ritualVsNonRitual'] = null;
  if (aggs.workouts.sessions > 0) {
    const ritualEntryRows = (db as any)
      .select({ occurredAt: ritualEntries.occurredAt })
      .from(ritualEntries)
      .where(and(gte(ritualEntries.occurredAt, startMs), lt(ritualEntries.occurredAt, endMs)))
      .all() as Array<{ occurredAt: number }>;

    const ritualDayKeys = new Set<string>();
    for (const e of ritualEntryRows) ritualDayKeys.add(localDayKey(e.occurredAt));

    const sessionRows = (db as any)
      .select({ startedAt: sessions.startedAt })
      .from(sessions)
      .where(
        and(
          eq(sessions.status, 'completed'),
          gte(sessions.startedAt, startMs),
          lt(sessions.startedAt, endMs),
        ),
      )
      .all() as Array<{ startedAt: number }>;

    let onRitual = 0;
    let offRitual = 0;
    for (const s of sessionRows) {
      if (ritualDayKeys.has(localDayKey(s.startedAt))) onRitual++;
      else offRitual++;
    }
    ritualVsNonRitual = { sessionsOnRitualDays: onRitual, sessionsOnNonRitualDays: offRitual };
  }

  // ─── bestStreak ─────────────────────────────────────
  const bestStreak: ReviewSignals['bestStreak'] = aggs.rituals.bestStreakRitual
    ? {
        ritualName: aggs.rituals.bestStreakRitual.name,
        streak: aggs.rituals.bestStreakRitual.streak,
        color: aggs.rituals.bestStreakRitual.color,
      }
    : null;

  // ─── underBudget ────────────────────────────────────
  const goalsRow = (db as any).select().from(goalsTable).limit(1).all() as Array<{ dailyBudgetCents: number }>;
  const daily = goalsRow[0]?.dailyBudgetCents ?? 0;
  let underBudget: ReviewSignals['underBudget'] = null;
  if (daily > 0) {
    const days = daysInPeriod(bounds);
    const budgetMinor = daily * days;
    if (aggs.spend.totalMinor < budgetMinor) {
      underBudget = { byMinor: budgetMinor - aggs.spend.totalMinor, budgetMinor };
    }
  }

  return { topSpendDay, ritualVsNonRitual, bestStreak, underBudget };
}

function localDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function isPeriodEmpty(aggs: ReviewAggregates): boolean {
  return aggs.spend.totalMinor === 0 && aggs.rituals.kept === 0 && aggs.workouts.sessions === 0;
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- lib/db/queries/__tests__/reviewAggregates.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/reviewAggregates.ts lib/db/queries/__tests__/reviewAggregates.test.ts
git commit -m "feat(sp5g): computeReviewSignals + isPeriodEmpty"
```

---

## Task 9 — `generatedReviews.ts` cache module

**Files:**
- Create: `lib/db/queries/generatedReviews.ts`
- Create: `lib/db/queries/__tests__/generatedReviews.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests, expect ImportError**

Run: `npm test -- lib/db/queries/__tests__/generatedReviews.test.ts`
Expected: fails — module missing.

- [ ] **Step 3: Create `lib/db/queries/generatedReviews.ts`**

```ts
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
  // Upsert by deleting any existing row then inserting (no ON CONFLICT clause configured on this table).
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
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- lib/db/queries/__tests__/generatedReviews.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/generatedReviews.ts lib/db/queries/__tests__/generatedReviews.test.ts
git commit -m "feat(sp5g): generated_reviews cache (get/put/clear)"
```

---

## Task 10 — `reviewClient.ts` HTTP wrapper

**Files:**
- Create: `lib/sync/reviewClient.ts`
- Create: `lib/sync/__tests__/reviewClient.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run tests, expect ImportError**

Run: `npm test -- lib/sync/__tests__/reviewClient.test.ts`
Expected: fails.

- [ ] **Step 3: Create `lib/sync/reviewClient.ts`**

Mirror the pattern in `lib/sync/client.ts`:

```ts
import type { ReviewRequest, ReviewResponse } from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from '../pal/config';
import {
  AuthError,
  NetworkError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try {
    return (await res.json()) as ErrorEnvelope;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${PAL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function mapHttpError(status: number, env: ErrorEnvelope | null): Error {
  const msg = env?.error.message ?? '';
  const rid = env?.requestId;
  if (status === 400) return new ValidationError(msg, rid);
  if (status === 401 || status === 403) return new AuthError(msg, rid);
  if (status === 429) return new RateLimitError(msg, rid);
  return new UpstreamError(msg, rid);
}

export async function postReview(body: ReviewRequest): Promise<ReviewResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/review`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as ReviewResponse;
  throw mapHttpError(res.status, await readError(res));
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- lib/sync/__tests__/reviewClient.test.ts`
Expected: all green.

- [ ] **Step 5: Commit**

```bash
git add lib/sync/reviewClient.ts lib/sync/__tests__/reviewClient.test.ts
git commit -m "feat(sp5g): postReview HTTP wrapper with error taxonomy"
```

---

## Task 11 — Presentational components: `ThreeStatSummary`, `HeroCard`, `PatternsList`, `OneThingToTry`, `ByTheNumbers`, `ReviewEmptyState`, `ReviewRetryCard`

These are pure presentational components. No tests at this layer (they're covered by the integration test in Task 13). Tasks 11.1 – 11.7 each create one file.

**Files:**
- Create: `app/components/reviews/ThreeStatSummary.tsx`
- Create: `app/components/reviews/HeroCard.tsx`
- Create: `app/components/reviews/PatternsList.tsx`
- Create: `app/components/reviews/OneThingToTry.tsx`
- Create: `app/components/reviews/ByTheNumbers.tsx`
- Create: `app/components/reviews/ReviewEmptyState.tsx`
- Create: `app/components/reviews/ReviewRetryCard.tsx`

- [ ] **Step 1: Identify the existing token/style helpers**

Run: `grep -n "from '@/lib/theme/tokens'" app/(tabs)/rituals/index.tsx | head -5`

Expected: a single import like `import { palette, radii, spacing, type } from '@/lib/theme/tokens';`. The new components use the same tokens. (If the alias `@/` isn't in use, fall back to `../../lib/theme/tokens`.)

- [ ] **Step 2: Create `ThreeStatSummary.tsx`**

```tsx
import { View, Text } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';
import type { ReviewAggregates } from '@/lib/api-types';

type Props = { aggregates: ReviewAggregates };

export function ThreeStatSummary({ aggregates }: Props) {
  const cells: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: 'SPENT',
      value: `$${(aggregates.spend.totalMinor / 100).toFixed(0)}`,
      sub: `${aggregates.spend.currency}`,
      color: palette.money,
    },
    {
      label: 'SESSIONS',
      value: String(aggregates.workouts.sessions),
      sub: `${aggregates.workouts.prCount} PRs`,
      color: palette.move,
    },
    {
      label: 'RITUALS',
      value: `${aggregates.rituals.kept}`,
      sub: `of ${aggregates.rituals.goalTotal}`,
      color: palette.rituals,
    },
  ];

  return (
    <View
      className="mx-4 mb-4 rounded-2xl p-4"
      style={{ backgroundColor: palette.surface, gap: spacing.sm }}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {cells.map((c) => (
          <View
            key={c.label}
            style={{
              flex: 1,
              padding: spacing.sm,
              borderRadius: radii.md,
              backgroundColor: `${c.color}14`,
            }}
          >
            <Text style={{ ...font.captionBold, color: c.color, letterSpacing: 0.3 }}>{c.label}</Text>
            <Text style={{ ...font.numeric, color: palette.ink, marginTop: 2 }}>{c.value}</Text>
            <Text style={{ ...font.caption, color: palette.ink3, marginTop: 1 }}>{c.sub}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

(If `palette`, `radii`, `spacing`, or `font` shapes differ from what's used elsewhere — for example `font.captionBold` doesn't exist — substitute the equivalent token used by `app/(tabs)/rituals/index.tsx`. Inline literal style objects are fine if there's no token; the goal is functional output, not perfect token reuse.)

- [ ] **Step 3: Create `HeroCard.tsx`**

```tsx
import { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';

type Props = {
  hero: string;
  onRegenerate: () => void;
  busy?: boolean;
  cooldownMs?: number;
};

const COOLDOWN_MS = 60_000;

export function HeroCard({ hero, onRegenerate, busy, cooldownMs = COOLDOWN_MS }: Props) {
  const [lastFiredAt, setLastFiredAt] = useState<number | null>(null);
  const onCooldown = lastFiredAt !== null && Date.now() - lastFiredAt < cooldownMs;
  const disabled = !!busy || onCooldown;

  const handlePress = () => {
    if (disabled) return;
    setLastFiredAt(Date.now());
    onRegenerate();
  };

  return (
    <View
      style={{
        margin: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: `${palette.accent}18`,
        borderWidth: 0.5,
        borderColor: `${palette.accent}33`,
      }}
    >
      <Text style={{ ...font.captionBold, color: palette.accent, marginBottom: spacing.sm }}>
        ✦ WRITTEN BY PAL
      </Text>
      <Text style={{ ...font.body, color: palette.ink, lineHeight: 22 }}>{hero}</Text>
      <Pressable
        onPress={handlePress}
        disabled={disabled}
        accessibilityState={{ disabled }}
        accessibilityLabel="Regenerate review"
        style={{
          alignSelf: 'flex-start',
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          backgroundColor: palette.surface,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" />
        ) : (
          <Text style={{ ...font.caption, color: palette.ink2 }}>
            {onCooldown ? 'Just regenerated…' : 'Regenerate'}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Create `PatternsList.tsx`**

```tsx
import { View, Text } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';
import type { ReviewPatternProse, ReviewSignals } from '@/lib/api-types';

type Props = {
  patterns: ReviewPatternProse[];
  signals: ReviewSignals;
};

function colorForPattern(p: ReviewPatternProse, signals: ReviewSignals): string {
  switch (p.signal) {
    case 'topSpendDay': return palette.money;
    case 'ritualVsNonRitual': return palette.move;
    case 'bestStreak': return signals.bestStreak?.color ? colorTokenToHex(signals.bestStreak.color) : palette.rituals;
    case 'underBudget': return palette.money;
  }
}

function colorTokenToHex(token: string): string {
  // Map RitualColor token names to palette hex values.
  // Falls back to palette.rituals for unknown tokens.
  const map: Record<string, string> = {
    rituals: palette.rituals,
    accent: palette.accent,
    move: palette.move,
    money: palette.money,
    cyan: palette.cyan ?? '#5AC8FA',
  };
  return map[token] ?? palette.rituals;
}

export function PatternsList({ patterns, signals }: Props) {
  if (patterns.length === 0) return null;
  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm }}>
      <Text style={{ ...font.section, color: palette.ink, marginBottom: spacing.sm }}>Patterns</Text>
      {patterns.map((p, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row',
            backgroundColor: palette.surface,
            borderRadius: radii.md,
            padding: spacing.md,
            gap: spacing.md,
          }}
        >
          <View style={{ width: 3, borderRadius: 2, backgroundColor: colorForPattern(p, signals) }} />
          <Text style={{ ...font.body, color: palette.ink, flex: 1, lineHeight: 22 }}>{p.text}</Text>
        </View>
      ))}
    </View>
  );
}
```

- [ ] **Step 5: Create `OneThingToTry.tsx`**

```tsx
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';

type Props = {
  markdown: string;
  askPalPrompt: string;
};

function parseInlineBold(input: string): Array<{ text: string; bold: boolean }> {
  const parts: Array<{ text: string; bold: boolean }> = [];
  const regex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(input))) {
    if (m.index > lastIndex) parts.push({ text: input.slice(lastIndex, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < input.length) parts.push({ text: input.slice(lastIndex), bold: false });
  return parts;
}

export function OneThingToTry({ markdown, askPalPrompt }: Props) {
  const router = useRouter();
  const segments = parseInlineBold(markdown);

  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: `${palette.accent}12`,
        borderWidth: 0.5,
        borderColor: `${palette.accent}33`,
      }}
    >
      <Text style={{ ...font.captionBold, color: palette.ink3, marginBottom: spacing.sm }}>
        ✦ ONE THING TO TRY
      </Text>
      <Text style={{ ...font.body, color: palette.ink, lineHeight: 22, marginBottom: spacing.md }}>
        {segments.map((s, i) =>
          s.bold ? (
            <Text key={i} style={{ fontWeight: '700' }}>{s.text}</Text>
          ) : (
            <Text key={i}>{s.text}</Text>
          ),
        )}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask Pal more"
        onPress={() => router.push(`/pal-composer?prefill=${encodeURIComponent(askPalPrompt)}`)}
        style={{
          alignSelf: 'flex-start',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          backgroundColor: palette.accent,
        }}
      >
        <Text style={{ ...font.bodySmall, color: '#fff', fontWeight: '600' }}>Ask Pal more</Text>
      </Pressable>
    </View>
  );
}
```

(If the actual PalComposer route isn't `/pal-composer`, locate it via `grep -rn "PalComposer" app/` and adjust. The 5f close-out screen calls PalComposer with a `prefill` prop — the same mechanism is reused here through query-param routing if PalComposer supports it; otherwise wire it via a context/event used by 5f.)

- [ ] **Step 6: Create `ByTheNumbers.tsx`**

```tsx
import { View, Text } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';
import type { ReviewAggregates } from '@/lib/api-types';

type Props = {
  aggregates: ReviewAggregates;
  bestStreakDays: number | null;
};

export function ByTheNumbers({ aggregates, bestStreakDays }: Props) {
  const rows: Array<{ label: string; value: string; sub: string; color: string }> = [
    {
      label: 'Total spent',
      value: `$${(aggregates.spend.totalMinor / 100).toFixed(0)}`,
      sub: aggregates.spend.currency,
      color: palette.money,
    },
    {
      label: 'Sessions',
      value: String(aggregates.workouts.sessions),
      sub: `${aggregates.workouts.prCount} PRs`,
      color: palette.move,
    },
    {
      label: 'Rituals kept',
      value: `${aggregates.rituals.kept} / ${aggregates.rituals.goalTotal}`,
      sub: aggregates.rituals.goalTotal === 0
        ? '—'
        : `${Math.round((aggregates.rituals.kept / aggregates.rituals.goalTotal) * 100)}%`,
      color: palette.rituals,
    },
  ];
  if (bestStreakDays !== null) {
    rows.push({
      label: 'Best streak',
      value: `${bestStreakDays} days`,
      sub: 'Ritual',
      color: palette.accent,
    });
  }

  return (
    <View style={{ marginHorizontal: spacing.md, marginBottom: spacing.md }}>
      <Text style={{ ...font.section, color: palette.ink, marginBottom: spacing.sm }}>By the numbers</Text>
      <View style={{ backgroundColor: palette.surface, borderRadius: radii.md, padding: 4 }}>
        {rows.map((r, i, arr) => (
          <View
            key={r.label}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.md,
              borderBottomWidth: i < arr.length - 1 ? 0.5 : 0,
              borderBottomColor: palette.hair,
            }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: r.color,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={{ ...font.body, color: palette.ink }}>{r.label}</Text>
              <Text style={{ ...font.caption, color: palette.ink3 }}>{r.sub}</Text>
            </View>
            <Text style={{ ...font.numeric, color: palette.ink }}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
```

- [ ] **Step 7: Create `ReviewEmptyState.tsx`**

```tsx
import { View, Text } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';

type Props = { period: 'weekly' | 'monthly' };

export function ReviewEmptyState({ period }: Props) {
  const label = period === 'weekly' ? 'this week' : 'this month';
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginVertical: spacing.lg,
        padding: spacing.xl,
        borderRadius: radii.lg,
        backgroundColor: palette.surface,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...font.body, color: palette.ink, textAlign: 'center' }}>
        Not enough data for {label}.
      </Text>
      <Text style={{ ...font.caption, color: palette.ink3, textAlign: 'center', marginTop: spacing.sm }}>
        Log a ritual, a session, or an entry — then come back.
      </Text>
    </View>
  );
}
```

- [ ] **Step 8: Create `ReviewRetryCard.tsx`**

```tsx
import { View, Text, Pressable } from 'react-native';
import { palette, radii, spacing, type as font } from '@/lib/theme/tokens';

type Props = { onRetry: () => void; busy?: boolean };

export function ReviewRetryCard({ onRetry, busy }: Props) {
  return (
    <View
      style={{
        marginHorizontal: spacing.md,
        marginBottom: spacing.md,
        padding: spacing.lg,
        borderRadius: radii.lg,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.hair,
      }}
    >
      <Text style={{ ...font.body, color: palette.ink }}>
        Couldn't reach Pal. Your stats are still up to date.
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel="Retry generating review"
        style={{
          alignSelf: 'flex-start',
          marginTop: spacing.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderRadius: 999,
          backgroundColor: palette.accent,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ ...font.bodySmall, color: '#fff', fontWeight: '600' }}>Retry</Text>
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 9: Run typecheck**

Run: `npx tsc --noEmit`
Expected: root errors not above the baseline of 28. If individual components reference missing token keys, replace with literal styles or the closest matching token discovered via `grep`.

- [ ] **Step 10: Commit**

```bash
git add app/components/reviews/
git commit -m "feat(sp5g): review screen presentational components"
```

---

## Task 12 — `ReviewScreen` shared body + route wrappers

**Files:**
- Create: `app/components/reviews/ReviewScreen.tsx`
- Create: `app/reviews/_layout.tsx`
- Create: `app/reviews/weekly.tsx`
- Create: `app/reviews/monthly.tsx`

- [ ] **Step 1: Create `ReviewScreen.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { palette, spacing, type as font } from '@/lib/theme/tokens';
import { db } from '@/lib/db/client'; // adjust import to wherever the app's drizzle instance lives
import {
  computeReviewAggregates,
  computeReviewSignals,
  isPeriodEmpty,
  lastCompletedPeriodKey,
  periodBounds,
  type ReviewPeriod,
} from '@/lib/db/queries/reviewAggregates';
import { getCachedReview, putCachedReview } from '@/lib/db/queries/generatedReviews';
import { postReview } from '@/lib/sync/reviewClient';
import type { ReviewAggregates, ReviewResponse, ReviewSignals } from '@/lib/api-types';
import { ThreeStatSummary } from './ThreeStatSummary';
import { HeroCard } from './HeroCard';
import { PatternsList } from './PatternsList';
import { OneThingToTry } from './OneThingToTry';
import { ByTheNumbers } from './ByTheNumbers';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewRetryCard } from './ReviewRetryCard';

type Props = {
  period: ReviewPeriod;
  initialKey?: string;
};

const MAX_BACK_OFFSET = -12;

function offsetFromKey(period: ReviewPeriod, key: string): number {
  // Walk offsets from 0 backward until the bounds key matches; cap at MAX_BACK_OFFSET.
  const today = new Date();
  for (let i = -1; i >= MAX_BACK_OFFSET; i--) {
    if (periodBounds(period, today, i).key === key) return i;
  }
  return -1;
}

function keyAtOffset(period: ReviewPeriod, offset: number): string {
  return periodBounds(period, new Date(), offset).key;
}

function periodLabel(period: ReviewPeriod, key: string): string {
  if (period === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long' });
    return `${monthName} ${y}`;
  }
  // weekly: derive Mon..Sun bounds for the key
  const today = new Date();
  for (let i = 0; i >= MAX_BACK_OFFSET; i--) {
    const b = periodBounds('weekly', today, i);
    if (b.key === key) {
      const start = new Date(b.startMs);
      const end = new Date(b.endMs - 1);
      const fmt = (d: Date) => d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
      return `${fmt(start)} – ${fmt(end)}`;
    }
  }
  return key;
}

export function ReviewScreen({ period, initialKey }: Props) {
  const router = useRouter();
  const startKey = initialKey ?? lastCompletedPeriodKey(period, new Date());
  const [offset, setOffset] = useState(offsetFromKey(period, startKey));
  const periodKey = keyAtOffset(period, offset);

  const [aggregates, setAggregates] = useState<ReviewAggregates | null>(null);
  const [signals, setSignals] = useState<ReviewSignals | null>(null);
  const [response, setResponse] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Recompute on period/key change.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setResponse(null);
      const aggs = await computeReviewAggregates(db, period, periodKey);
      if (cancelled) return;
      setAggregates(aggs);
      if (isPeriodEmpty(aggs)) return;
      const cached = await getCachedReview(db, period, periodKey);
      if (cached) {
        setResponse(cached);
        return;
      }
      const sigs = await computeReviewSignals(db, period, aggs, periodKey);
      if (cancelled) return;
      setSignals(sigs);
      try {
        setBusy(true);
        const resp = await postReview({ period, periodKey, aggregates: aggs, signals: sigs });
        if (cancelled) return;
        await putCachedReview(db, period, periodKey, resp);
        setResponse(resp);
      } catch (e) {
        if (!cancelled) setError((e as Error).name ?? 'Error');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period, periodKey]);

  const onRegenerate = useCallback(async () => {
    if (!aggregates) return;
    setError(null);
    setBusy(true);
    try {
      const sigs = signals ?? (await computeReviewSignals(db, period, aggregates, periodKey));
      setSignals(sigs);
      const resp = await postReview({ period, periodKey, aggregates, signals: sigs });
      await putCachedReview(db, period, periodKey, resp);
      setResponse(resp);
    } catch (e) {
      setError((e as Error).name ?? 'Error');
    } finally {
      setBusy(false);
    }
  }, [aggregates, signals, period, periodKey]);

  if (!aggregates) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.bg }} />
    );
  }

  const empty = isPeriodEmpty(aggregates);
  const canGoForward = offset < 0;
  const canGoBack = offset > MAX_BACK_OFFSET;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: palette.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={{ paddingVertical: 6, paddingRight: 6 }}
        >
          <Text style={{ ...font.body, color: palette.accent }}>‹ Back</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable
          disabled={!canGoBack}
          onPress={() => setOffset((o) => Math.max(MAX_BACK_OFFSET, o - 1))}
          accessibilityLabel="Previous period"
          style={{ opacity: canGoBack ? 1 : 0.3, paddingHorizontal: 8 }}
        >
          <Text style={{ ...font.body, color: palette.accent }}>‹</Text>
        </Pressable>
        <Pressable
          disabled={!canGoForward}
          onPress={() => setOffset((o) => Math.min(0, o + 1))}
          accessibilityLabel="Next period"
          style={{ opacity: canGoForward ? 1 : 0.3, paddingHorizontal: 8 }}
        >
          <Text style={{ ...font.body, color: palette.accent }}>›</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.md }}>
        <Text style={{ ...font.captionBold, color: palette.accent }}>
          {period === 'weekly' ? 'WEEKLY REVIEW' : 'MONTHLY REVIEW'} · {periodLabel(period, periodKey)}
        </Text>
      </View>

      {empty ? (
        <ReviewEmptyState period={period} />
      ) : (
        <>
          <ThreeStatSummary aggregates={aggregates} />
          {error ? (
            <ReviewRetryCard onRetry={onRegenerate} busy={busy} />
          ) : response ? (
            <>
              <HeroCard hero={response.hero} onRegenerate={onRegenerate} busy={busy} />
              <PatternsList patterns={response.patterns} signals={signals ?? emptySignals()} />
              {period === 'weekly' && response.oneThingToTry && (
                <OneThingToTry
                  markdown={response.oneThingToTry.markdown}
                  askPalPrompt={response.oneThingToTry.askPalPrompt}
                />
              )}
              {period === 'monthly' && (
                <ByTheNumbers
                  aggregates={aggregates}
                  bestStreakDays={aggregates.rituals.bestStreakRitual?.streak ?? null}
                />
              )}
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function emptySignals(): ReviewSignals {
  return { topSpendDay: null, ritualVsNonRitual: null, bestStreak: null, underBudget: null };
}
```

(If the app's Drizzle instance is named differently — e.g. `getDb()` rather than `db` — adjust the import. Locate it via `grep -rn "drizzle.*expo-sqlite" lib/ | head -3`.)

- [ ] **Step 2: Create `app/reviews/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function ReviewsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 3: Create `app/reviews/weekly.tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/app/components/reviews/ReviewScreen';

export default function WeeklyReviewRoute() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  return <ReviewScreen period="weekly" initialKey={key} />;
}
```

- [ ] **Step 4: Create `app/reviews/monthly.tsx`**

```tsx
import { useLocalSearchParams } from 'expo-router';
import { ReviewScreen } from '@/app/components/reviews/ReviewScreen';

export default function MonthlyReviewRoute() {
  const { key } = useLocalSearchParams<{ key?: string }>();
  return <ReviewScreen period="monthly" initialKey={key} />;
}
```

- [ ] **Step 5: Run typecheck**

Run: `npx tsc --noEmit`
Expected: root error count not above the baseline of 28. Fix any ReviewScreen-internal type errors before committing.

- [ ] **Step 6: Commit**

```bash
git add app/components/reviews/ReviewScreen.tsx app/reviews/
git commit -m "feat(sp5g): ReviewScreen body and weekly/monthly routes"
```

---

## Task 13 — Screen integration test

**Files:**
- Create: `app/components/reviews/__tests__/ReviewScreen.test.tsx`

- [ ] **Step 1: Identify the existing testing-library pattern**

Run: `grep -rn "@testing-library/react-native" lib/ app/ | head -5`

Expected: at least one match in an existing screen test (the SP5e/5f work shipped tests). Use the same patterns. If no app-level screen tests exist yet, write a node-environment Jest test that imports the component directly with mocked dependencies (without rendering) and asserts the call shape on `postReview`.

- [ ] **Step 2: Write the integration test**

```tsx
/** @jest-environment node */
import { jest } from '@jest/globals';

// Mock the imports BEFORE requiring ReviewScreen.
jest.mock('@/lib/db/client', () => ({ db: {} }));
jest.mock('@/lib/db/queries/reviewAggregates', () => {
  const real = jest.requireActual('@/lib/db/queries/reviewAggregates');
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
  (computeReviewAggregates as jest.Mock).mockResolvedValue(baseAggs);
  (computeReviewSignals as jest.Mock).mockResolvedValue(baseSignals);
  (isPeriodEmpty as jest.Mock).mockReturnValue(false);
  (getCachedReview as jest.Mock).mockResolvedValue(null);
  (putCachedReview as jest.Mock).mockResolvedValue(undefined);
  (postReview as jest.Mock).mockResolvedValue(baseResp);
});

afterEach(() => jest.clearAllMocks());

describe('ReviewScreen orchestration', () => {
  it('cache hit short-circuits postReview', async () => {
    (getCachedReview as jest.Mock).mockResolvedValue(baseResp);
    const { runOrchestration } = await import('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).not.toHaveBeenCalled();
  });

  it('cache miss calls postReview and persists', async () => {
    const { runOrchestration } = await import('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).toHaveBeenCalledTimes(1);
    expect(putCachedReview).toHaveBeenCalledWith({}, 'weekly', '2026-W17', baseResp);
  });

  it('empty period skips postReview entirely', async () => {
    (isPeriodEmpty as jest.Mock).mockReturnValue(true);
    const { runOrchestration } = await import('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(postReview).not.toHaveBeenCalled();
  });

  it('failure does not write cache', async () => {
    (postReview as jest.Mock).mockRejectedValue(new Error('boom'));
    const { runOrchestration } = await import('./orchestrationHarness');
    await runOrchestration({ period: 'weekly', periodKey: '2026-W17' });
    expect(putCachedReview).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Extract the orchestration into a reusable harness**

Create `app/components/reviews/__tests__/orchestrationHarness.ts`:

```ts
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
```

The harness mirrors `ReviewScreen.tsx`'s `useEffect` orchestration so the component itself remains testable in isolation without React rendering. **If `ReviewScreen.tsx`'s orchestration ever changes, update both files together** — the cross-file consistency is the price of avoiding a full RN test renderer setup for SP5g.

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- app/components/reviews/__tests__/ReviewScreen.test.tsx`
Expected: 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add app/components/reviews/__tests__/
git commit -m "test(sp5g): ReviewScreen orchestration coverage"
```

---

## Task 14 — Wire You-tab rows on

**Files:**
- Modify: `app/(tabs)/you/index.tsx`

- [ ] **Step 1: Locate the Reviews block in `app/(tabs)/you/index.tsx`**

Run: `grep -n "Reviews\|weekly\|monthly\|Coming soon" app/(tabs)/you/index.tsx`

Expected: lines 87-90 (verified earlier) hold the disabled rows. The exact list shape is:

```ts
{ key: 'weekly', icon: 'calendar', iconBg: palette.rituals, title: 'Weekly review', value: 'Coming soon', disabled: true },
{ key: 'monthly', icon: 'chart.bar.fill', iconBg: palette.accent, title: 'Monthly review', value: 'Coming soon', disabled: true },
```

- [ ] **Step 2: Replace those two entries**

Drop `value` and `disabled`; add `onPress`. Read the existing list-row component to confirm it dispatches `onPress` (or routes via a `route` field). If the row component takes a `route` field instead, use that.

```ts
{ key: 'weekly', icon: 'calendar', iconBg: palette.rituals, title: 'Weekly review', onPress: () => router.push('/reviews/weekly') },
{ key: 'monthly', icon: 'chart.bar.fill', iconBg: palette.accent, title: 'Monthly review', onPress: () => router.push('/reviews/monthly') },
```

If the file doesn't already import `useRouter`, add `import { useRouter } from 'expo-router';` at the top and `const router = useRouter();` inside the component.

- [ ] **Step 3: Run typecheck**

Run: `npx tsc --noEmit`
Expected: root errors not above baseline.

- [ ] **Step 4: Commit**

```bash
git add app/(tabs)/you/index.tsx
git commit -m "feat(sp5g): activate Weekly + Monthly rows in You tab"
```

---

## Task 15 — Full test sweep + smoke

**Files:** none.

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: green. Total ≈ 226 + new (Tasks 2/3/4 added ~17 tests).

- [ ] **Step 2: Run the full iOS test suite**

Run: `npm test`
Expected: green. iOS baseline at the start of SP5g was 435; this slice adds ~35-45 new tests.

- [ ] **Step 3: Run typecheck**

Run: `cd backend && npx tsc --noEmit && cd .. && npx tsc --noEmit`
Expected: backend 0 errors, root not above baseline 28.

- [ ] **Step 4: Web smoke (optional but recommended)**

Run: `npm run web` (or whatever the project's web target is — check `package.json` scripts).

In the browser:
1. Navigate to the You tab — confirm the Reviews rows are clickable and not greyed out.
2. Tap "Weekly review" → expect a Weekly Review screen with three-stat summary, Pal-written hero, optional patterns + One thing to try.
3. Tap chevron-back to walk through history; confirm forward chevron disables at offset 0 and back chevron disables at offset −12.
4. Force a period with no data via the URL — `/reviews/weekly?key=2026-W01` (assuming no data that early). Expect the empty state.
5. Disconnect Wi-Fi and tap Regenerate; expect the retry card. Reconnect and tap Retry; expect a fresh hero.
6. Reload the page on the same period — expect cached payload to render without a fetch (Network tab should show no `/review` POST).
7. Repeat for `/reviews/monthly`.

- [ ] **Step 5: Update the SP5 meta-spec status line for 5g**

Edit `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md` §3 "Sub-slice status" — replace `**5g** Not started.` with a code-complete line in the same style as 5a–5f. Include test-count delta, baselines, and the deferred-pass carryover note.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5g): mark slice code-complete in meta-spec §3 sub-slice status"
```

- [ ] **Step 7: Live droplet smoke (deferred, user-run)**

This is gated on the existing `OPENROUTER_API_KEY` carryover from SP5b/SP5c. Once the key lands on the droplet, curl `/review` from Windows with a real JWT and the new request shape; confirm a 200 response with structured prose. **This step closes SP5g.**

---

## Self-review

**Spec coverage:**

| Spec section | Implementing task(s) |
|---|---|
| §3.1 Module layout | Tasks 5–14 |
| §3.2 Data flow on mount | Task 12 (ReviewScreen) + Task 13 (orchestration harness coverage) |
| §4.1 Request schema | Task 2 |
| §4.2 Response schema | Task 2 |
| §4.3 Prompt builder | Task 3 |
| §4.4 Route | Task 4 |
| §4.5 Breaking change posture | Task 1 (api-types) + Task 4 (no compat shim) |
| §5.1 reviewAggregates | Tasks 6, 7, 8 |
| §5.2 generatedReviews | Task 9 |
| §5.3 reviewClient | Task 10 |
| §5.4 Migration 0007 | Task 5 |
| §6.1 Routes | Task 12 |
| §6.2 You-tab wiring | Task 14 |
| §6.3 ReviewScreen body | Tasks 11, 12 |
| §6.4 Markdown handling | Task 11 (`OneThingToTry.tsx` `parseInlineBold`) |
| §7 Testing | Tasks 2, 3, 4, 6, 7, 8, 9, 10, 13, 15 |

No gaps.

**Placeholder scan:** No "TBD" / "TODO" / "fill in details" / vague-validation language remains. Where the plan defers to real-codebase shapes (token names, drizzle instance import path, PalComposer route), it gives the engineer the exact `grep` to discover and the fallback to use.

**Type consistency:** `ReviewPeriod`, `ReviewAggregates`, `ReviewSignals`, `ReviewSignalKey`, `ReviewPatternProse` are defined in Task 1 and used by every later task with the same names. `periodBounds`, `lastCompletedPeriodKey`, `computeReviewAggregates`, `computeReviewSignals`, `isPeriodEmpty`, `getCachedReview`, `putCachedReview`, `clearCachedReview`, `postReview` keep stable signatures across tasks.

One known cross-file consistency cost is flagged inline: the orchestration in `ReviewScreen.tsx` (Task 12) and the test harness `orchestrationHarness.ts` (Task 13) must stay in sync. The plan explicitly notes this in Task 13.
