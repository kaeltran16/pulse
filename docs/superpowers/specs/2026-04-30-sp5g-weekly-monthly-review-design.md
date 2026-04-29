# SP5g — Weekly + Monthly Review (Design Spec)

**Date:** 2026-04-30
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) §3 row 5g
**Slice:** Last child of SP5. Decomposed under the SP5 meta-spec.

---

## 1. What this slice ships

Two iOS screens — **Weekly review** and **Monthly review** — opened from the existing You-tab "Reviews" rows, plus a period-aware backend `POST /review`.

Each screen:

- Resolves a **period key** for the most recently *completed* week (`YYYY-Www`, ISO Mon→Sun) or month (`YYYY-MM`); chevrons walk back/forward up to 12 periods.
- Computes structured **aggregates + signals** locally from SQLite (spending, rituals, workouts).
- Short-circuits to an empty state if the period has zero activity across all three domains.
- Reads a per-period cache; on miss, posts aggregates+signals to `/review` and persists the response.
- LLM returns *prose only* — `hero`, one prose line per non-null `signal`, optional `oneThingToTry` with an `askPalPrompt`. iOS owns all numbers.
- Regenerate button overwrites cache; soft-disabled for 60s after each call. Failures show inline retry.

The two `Coming soon` rows in `app/(tabs)/you/index.tsx` (`weekly`, `monthly` under "Reviews") flip on.

---

## 2. Locked decisions (resolved during brainstorming)

These are inputs to the implementation plan and are not open for relitigation there.

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Response shape | **Structured prose + locally-computed numbers.** LLM returns hero, patterns prose tagged by `signal` key, and an optional `oneThingToTry`. iOS computes all stats. | LLM is good at editorial framing, bad at being a calculator. We have all raw data locally; the LLM should only frame, never count. Also enables the handoff's per-row icons, color bars, and "Ask Pal more" deeplink — markdown-only would lose that. |
| 2 | Week window | **Mon → Sun (ISO week).** | Matches meta-spec §7 default proposal. "Sunday review of the week that just closed" reads as a natural ritual. |
| 3 | Trigger model | **You-tab rows only.** No Today banner, no foreground-auto-modal. | SP5g is the lowest-novelty slice per meta-spec §3. We just shipped two foreground triggers in 5f (Celebration + Close-Out); stacking another risks fatigue. A Sunday banner can earn its way in via SP6 if it does. |
| 4a | `food` aggregate | **Cut entirely.** Removed from request schema, not made optional. | Vestigial in the existing SP2 schema. Pulse has never tracked food. Making it optional adds code paths for nothing. |
| 4b | Domain coverage | **Spending + rituals + workouts**, where workouts surface as `{sessions, prCount}` (not minutes). | Matches the handoff's three-ring layout. Pulse tracks PRs and sessions, not minutes-moved; redefining "Moved" to what we actually have keeps numbers honest. |
| 5 | Patterns generation | **Hybrid:** iOS computes deterministic candidate signals (top spend day, ritual-vs-non-ritual delta, best streak, under-budget). LLM writes the prose around them, tagging each line with the `signal` key it framed. | Numbers stay deterministic; LLM only does framing. iOS renders each pattern with a deterministic color token via signal→color mapping. |
| 6 | Caching | **Per-period local SQLite cache** (`generated_reviews(period, period_key)`). Render cached payload on open; Regenerate overwrites. | Reopen is free; the Regenerate button is already in the handoff, so persistence falls out for free. |
| 7 | Default period | **Most recent completed period.** Never shows in-progress data. Chevron pair walks history; capped at 12 periods back. | "Review" implies a closed period; matches handoff framing; cache works cleanly because period_key is fixed once generated. |
| 8 | Empty period | **Local short-circuit.** If `sessions + ritual_entries + spending_entries === 0` in the period, render an empty state and never call `/review`. | Saves cost; LLM filler prose for empty data is worse than honest absence. |
| 9a | `/review` failure UX | **Inline error card with Retry.** No cache write on failure. | Same shape as Pal nudge errors in 5e; consistent. |
| 9b | Regenerate cap | **Soft 60s cooldown** after each successful or failed call. No daily cap. | Cheap; prevents accidental double-tap; lets the user iterate. Daily caps are over-engineering at one user. |
| 10 | Markdown rendering on iOS | **None.** `oneThingToTry.markdown` will be one short sentence; render via plain Text + an inline `<Bold>` for `**…**`. No new dep. | YAGNI — adding `react-native-markdown-display` for one sentence is overkill. |

---

## 3. Architecture

### 3.1 Module layout

```
backend/
  src/
    schemas/review.ts                   # period-aware discriminated union
    lib/prompts/review.ts               # branched on period
    routes/review.ts                    # unchanged shape; new schema/prompt under it
  test/integration/review.test.ts       # rewritten for new schema

lib/
  db/
    migrations/0007_*.sql               # generated_reviews table
    queries/
      reviewAggregates.ts               # period bounds, aggregates, signals, isPeriodEmpty
      generatedReviews.ts               # cache read/write
  sync/
    reviewClient.ts                     # POST /review wrapper, mapped error taxonomy

app/
  (tabs)/you/index.tsx                  # flip 'weekly' + 'monthly' rows on
  reviews/
    _layout.tsx                         # stack
    weekly.tsx                          # thin wrapper, period='weekly'
    monthly.tsx                         # thin wrapper, period='monthly'
  components/reviews/
    ReviewScreen.tsx                    # shared body, parametrised by period
    ThreeStatSummary.tsx
    HeroCard.tsx
    PatternsList.tsx
    OneThingToTry.tsx
    ByTheNumbers.tsx                    # monthly only
    ReviewEmptyState.tsx
    ReviewRetryCard.tsx
```

### 3.2 Data flow on mount

```
periodKey ← route param || lastCompleted(period, today)
aggregates ← useLiveQuery(computeReviewAggregates(period, periodKey))
if isPeriodEmpty(aggregates): render <ReviewEmptyState/>; return
cached ← generatedReviews.get(period, periodKey)
if cached: render cached + aggregates; return
signals ← computeReviewSignals(period, aggregates, periodKey)
POST /review { period, periodKey, aggregates, signals }
  on success: generatedReviews.put(period, periodKey, payload); render
  on failure: render <ReviewRetryCard/>; do not write cache
```

Regenerate: same pipeline from the fetch step; always overwrites cache on success; disables itself for 60s after the call (settled or failed) via component-local state.

---

## 4. Backend — `/review` schema, prompt, route

### 4.1 Request (discriminated union on `period`)

```ts
const SpendAggregate = z.object({
  totalMinor:    z.number().int().nonnegative(),
  currency:      z.string().length(3),
  byCategory:    z.record(z.string(), z.number().int().nonnegative()),
  byDayOfWeek:   z.array(z.number().int().nonnegative()).length(7), // index 0 = Monday
  topMerchant:   z.object({ name: z.string(), totalMinor: z.number().int().nonnegative() }).nullable(),
});
const RitualsAggregate = z.object({
  kept:               z.number().int().nonnegative(),
  goalTotal:          z.number().int().nonnegative(),
  perRitual:          z.array(z.object({
                        id: z.number().int().positive(),
                        name: z.string(),
                        color: z.string(),
                        kept: z.number().int().nonnegative(),
                        streak: z.number().int().nonnegative(),
                      })),
  bestStreakRitual:   z.object({ name: z.string(), streak: z.number().int().positive(), color: z.string() }).nullable(),
});
const WorkoutsAggregate = z.object({
  sessions: z.number().int().nonnegative(),
  prCount:  z.number().int().nonnegative(),
});
const AggregatesSchema = z.object({
  spend:    SpendAggregate,
  rituals:  RitualsAggregate,
  workouts: WorkoutsAggregate,
});

const SignalsSchema = z.object({
  topSpendDay:       z.object({ dayOfWeek: z.number().int().min(0).max(6), multiplier: z.number().positive() }).nullable(),
  ritualVsNonRitual: z.object({ sessionsOnRitualDays: z.number().int().nonnegative(), sessionsOnNonRitualDays: z.number().int().nonnegative() }).nullable(),
  bestStreak:        z.object({ ritualName: z.string(), streak: z.number().int().positive(), color: z.string() }).nullable(),
  underBudget:       z.object({ byMinor: z.number().int(), budgetMinor: z.number().int().positive() }).nullable(),
});

const WeeklyReviewRequest = z.object({
  period:    z.literal('weekly'),
  periodKey: z.string().regex(/^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/),
  aggregates: AggregatesSchema,
  signals:    SignalsSchema,
});
const MonthlyReviewRequest = z.object({
  period:    z.literal('monthly'),
  periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  aggregates: AggregatesSchema,
  signals:    SignalsSchema,
});

export const ReviewRequestSchema = z.discriminatedUnion('period', [WeeklyReviewRequest, MonthlyReviewRequest]);
```

### 4.2 Response

```ts
const PatternProseSchema = z.object({
  signal: z.enum(['topSpendDay', 'ritualVsNonRitual', 'bestStreak', 'underBudget']),
  text:   z.string().min(1),
});
const ReviewResponseSchema = z.object({
  period:        z.enum(['weekly', 'monthly']),
  hero:          z.string().min(1),
  patterns:      z.array(PatternProseSchema)
                  .max(3)
                  .refine(arr => new Set(arr.map(p => p.signal)).size === arr.length,
                          { message: 'patterns must have unique signal keys' }),
  oneThingToTry: z.object({ markdown: z.string().min(1), askPalPrompt: z.string().min(1) }).nullable(),
  generatedAt:   z.string(),
});
```

`hero` is one short sentence for weekly, a 2–3 sentence paragraph for monthly. `patterns` contains at most one entry per signal key, and only for non-null signals supplied in the request — schema rejects extras. `oneThingToTry` is optional and weekly-leaning (the LLM may return it for monthly too; iOS only renders it on weekly per the handoff).

### 4.3 Prompt builder (`backend/src/lib/prompts/review.ts`)

System voice unchanged ("Reflective, specific, encouraging without flattery. Use the supplied numbers. Do not invent ones not present."). Branched user block:

- Weekly: asks for a one-sentence hero, one prose line per non-null signal (each line 1 sentence, ≤ 25 words, must use the signal's numbers), and optionally one `oneThingToTry` (sentence + `askPalPrompt` framed as a question Pal could answer).
- Monthly: asks for a 2–3 sentence narrative hero matching the handoff's "April was your steadiest month yet…" cadence; same patterns rules; `oneThingToTry` allowed but not required.

The user block enumerates which signals are non-null and instructs the LLM never to write a pattern for a null signal. Aggregate JSON is included verbatim for color (top merchant, top category etc.).

Output format: strict JSON matching `ReviewResponseSchema`. Existing `chatJson` + safe-parse + `UpstreamError` flow stays.

### 4.4 Route (`backend/src/routes/review.ts`)

Logic unchanged except for the new schemas + prompt builder signature. JWT scope: `review` (already covers this route).

### 4.5 Breaking change posture

The current `/review` shape (`{month, aggregates: {workouts, food, spend, rituals}}` → `{markdown, generatedAt}`) is replaced wholesale. **No production consumer exists** — iOS has never called `/review`. The integration test is rewritten; no compat shim, no deprecation period.

---

## 5. iOS — local computation

### 5.1 `lib/db/queries/reviewAggregates.ts`

```ts
type Period = 'weekly' | 'monthly';
type PeriodBounds = { startMs: number; endMs: number; key: string }; // exclusive end
function periodBounds(period: Period, anchor: Date, offset: number): PeriodBounds;
function lastCompletedPeriodKey(period: Period, asOf: Date): string;
function computeReviewAggregates(period: Period, periodKey: string): Promise<ReviewAggregates>;
function computeReviewSignals(period: Period, aggs: ReviewAggregates, periodKey: string): Promise<ReviewSignals>;
function isPeriodEmpty(aggs: ReviewAggregates): boolean;
```

Bounds use `dayKey`-style local-date math (not raw ms arithmetic) for DST safety. ISO week math: Mon = day 1; week containing Jan 4 is week 1 (standard).

Signal definitions:

- `topSpendDay`: for each `byDayOfWeek` index, `multiplier = thisDay / avg(other days with spend > 0)`. Null if fewer than 2 days have spend.
- `ritualVsNonRitual`: count sessions on days where any ritual was logged vs days where none was. Null if `sessions === 0` in the period.
- `bestStreak`: `aggs.rituals.bestStreakRitual` directly. Null when no ritual has a streak ≥ 2.
- `underBudget`: requires `goals.monthlyBudget` (existing column) > 0 *and* period is monthly. Null on weekly periods (we don't have weekly budgets) or when no budget set or when over budget.

`isPeriodEmpty` is true iff `spend.totalMinor === 0 && rituals.kept === 0 && workouts.sessions === 0`.

### 5.2 `lib/db/queries/generatedReviews.ts`

```ts
function getCachedReview(period: Period, periodKey: string): Promise<ReviewResponse | null>;
function putCachedReview(period: Period, periodKey: string, payload: ReviewResponse): Promise<void>;
function clearCachedReview(period: Period, periodKey: string): Promise<void>; // used by Regenerate before fetch (optional; overwrite-on-success works too)
```

Backed by the new `generated_reviews` table (§5.4). Idempotent put.

### 5.3 `lib/sync/reviewClient.ts`

```ts
type ReviewError =
  | { code: 'network' }
  | { code: 'auth' }
  | { code: 'validation'; message: string }
  | { code: 'upstream' }
  | { code: 'unknown' };

function postReview(req: WeeklyReviewRequest | MonthlyReviewRequest): Promise<ReviewResponse>; // throws ReviewError
```

Wraps `fetch` with the existing JWT helper; maps HTTP statuses to `ReviewError` codes (mirrors `lib/sync/client.ts` taxonomy from 5c). Re-entrance guard at module level (one in-flight request per period+periodKey at a time).

### 5.4 Schema delta (migration `0007_*.sql`)

```sql
CREATE TABLE generated_reviews (
  period       TEXT NOT NULL CHECK (period IN ('weekly','monthly')),
  period_key   TEXT NOT NULL,
  payload      TEXT NOT NULL,
  generated_at INTEGER NOT NULL,
  PRIMARY KEY (period, period_key)
);
```

No backend schema delta.

---

## 6. iOS — screens + navigation

### 6.1 Routes

```
app/reviews/_layout.tsx       Stack (header rendered inside ReviewScreen, not by the stack)
app/reviews/weekly.tsx        const route param: ?key=YYYY-Www
app/reviews/monthly.tsx       const route param: ?key=YYYY-MM
```

Both wrappers resolve `key` (route param or `lastCompletedPeriodKey`) and render `<ReviewScreen period=... periodKey=... />`.

### 6.2 You-tab wiring

In `app/(tabs)/you/index.tsx`, the existing rows under "Reviews":

```diff
- { key: 'weekly',  ..., value: 'Coming soon', disabled: true }
- { key: 'monthly', ..., value: 'Coming soon', disabled: true }
+ { key: 'weekly',  ..., onPress: () => router.push('/reviews/weekly')  }
+ { key: 'monthly', ..., onPress: () => router.push('/reviews/monthly') }
```

### 6.3 `ReviewScreen` body

Sections in order:

1. **Header** — period label ("Weekly review · Apr 13–19" / "April"). Back/forward chevrons; forward disabled at offset 0; back disabled at offset −12. Back button (top-left) returns to You-tab.
2. **`<ThreeStatSummary>`** — Spent / Sessions / Rituals from `aggregates`. Color tokens: `money`, `move`, `rituals`. Renders for both periods.
3. **`<HeroCard>`** — sparkles icon, "Written by Pal" caption, `hero` text, Regenerate button. Cooldown state owned here.
4. **`<PatternsList>`** — maps `patterns[]` via `signal → color` table:
   - `topSpendDay` → `theme.money`
   - `ritualVsNonRitual` → `theme.move`
   - `bestStreak` → `signals.bestStreak.color` (always present when the signal is non-null; falls back to `theme.rituals` only if the LLM somehow returned a `bestStreak` pattern with the signal absent — which the route rejects per §4.2)
   - `underBudget` → `theme.money`
   Hidden when `patterns` is empty.
5. **`<OneThingToTry>`** *(weekly only, when `oneThingToTry` non-null)* — gradient card per handoff; "Ask Pal more" button calls `router.push('/pal-composer?prefill=' + encodeURIComponent(askPalPrompt))` (the existing `prefill` mechanism added in 5f).
6. **`<ByTheNumbers>`** *(monthly only)* — handoff's deeper stats list driven entirely by `aggregates`: total spent + delta vs prior month, sessions + PR count, rituals kept / total, best streak.

Empty state: `<ReviewEmptyState/>` ("Not enough data for this week / month — come back when you've logged some entries"). Header still renders so the user can scroll back to a populated period.

Failure state: `<ReviewRetryCard/>` replaces hero + patterns. Three-stat summary still renders (it's local data — no reason to hide it on a network failure).

### 6.4 Markdown handling

`oneThingToTry.markdown` may contain `**bold**` per the prompt. Render via a tiny inline parser: split on `**…**` runs, render plain segments as `<Text>`, bold segments as `<Text style={{fontWeight:'600'}}>`. No new dep.

---

## 7. Testing plan

### 7.1 Backend — `backend/test/integration/review.test.ts` (rewritten) + new unit tests for the prompt builder

- **Schema validation**
  - `weekly` with monthly-shaped key (`2026-04`) → 400 `validation_failed`.
  - `monthly` with weekly-shaped key (`2026-W17`) → 400 `validation_failed`.
  - Missing `period` → 400.
  - Negative `totalMinor` → 400.
  - `byDayOfWeek` length ≠ 7 → 400.
- **Happy path weekly** — returns `period='weekly'`, hero non-empty, patterns only for the non-null signals supplied.
- **Happy path monthly** — same; hero longer (asserted by length).
- **LLM returns invalid JSON** → 502 `upstream_error`.
- **LLM returns a `pattern.signal` not supplied as non-null** → 502 (route enforces this on top of schema).
- **LLM returns two patterns with the same `signal` key** → 502 (schema `.refine` per §4.2 rejects).
- **Auth** — no JWT → 401; JWT without `review` scope → 403.

### 7.2 iOS — unit tests (`lib/db/queries/__tests__/reviewAggregates.test.ts`)

- `periodBounds`
  - Weekly Mon→Sun bounds for a known date.
  - ISO year-end edge case (Jan 1 falls in week 53 of prior year).
  - Monthly bounds across DST transitions (use March / November test fixtures).
- `lastCompletedPeriodKey`
  - On Sunday morning: returns the week that ended the day before (`now-1`'s ISO week).
  - On the 1st of the month: returns the prior month.
- `computeReviewAggregates`
  - Spend totals + byCategory + byDayOfWeek + topMerchant against seeded entries.
  - `rituals.kept` counts entries within `[startMs, endMs)`; `goalTotal = dailyTarget × daysInPeriod`.
  - `bestStreakRitual` resolves to the per-ritual streak max as-of `endMs`.
  - Sessions counted by `started_at` within bounds; `prCount` = distinct PRs set within bounds.
- `computeReviewSignals`
  - `topSpendDay` returns null when only one day has spend.
  - `topSpendDay` multiplier math: 1 day × $200, 4 days × $50 → multiplier = 4.
  - `ritualVsNonRitual` null when zero sessions.
  - `underBudget` null on weekly; null on monthly when no budget; null when over budget; populated with positive `byMinor` when under.
- `isPeriodEmpty` — true iff all three domains are zero; false when any is non-zero.

### 7.3 iOS — cache + client tests

- `generatedReviews.put`/`get` round-trip; second `put` overwrites.
- `reviewClient.postReview`
  - 200 → returns parsed payload.
  - 401 → throws `{code: 'auth'}`.
  - 502 → `{code: 'upstream'}`.
  - JSON parse failure → `{code: 'validation', message}`.
  - Network throw → `{code: 'network'}`.

### 7.4 iOS — screen integration tests

- **Cache hit** — given a cached payload, `<ReviewScreen>` mounts without calling the client.
- **Cache miss** — calls client once; on success persists payload and renders.
- **Failure** — does not write cache; renders `<ReviewRetryCard/>`; three-stat summary still rendered.
- **Empty period** — `isPeriodEmpty(aggregates) === true` → no client call; `<ReviewEmptyState/>` renders.
- **Regenerate cooldown** — fake timers; tap Regenerate → button disabled for 60s; second tap within window is a no-op.
- **Chevron bounds** — forward disabled at offset 0; back disabled at offset −12.
- **Ask Pal more** — taps push `/pal-composer` with `prefill` query param matching `oneThingToTry.askPalPrompt`.

### 7.5 Verification posture

Per meta-spec §5:

- **Backend slice**: tests green on Windows; live curl smoke from Windows against the droplet (gated on the existing `OPENROUTER_API_KEY` carryover from 5b/5c).
- **iOS slice**: typecheck clean (`npx tsc --noEmit` baseline preserved); `npm test` green; web-target sanity-check.
- **iPhone Expo Go visual**: deferred to the SP5-wide end-of-slice pass.

### 7.6 Smoke test

1. From web target: You → Weekly review → screen renders three-stat summary from local data → tap Generate → backend round-trip → hero + patterns + (optional) "One thing to try" render → "Ask Pal more" opens PalComposer with prefilled prompt.
2. Same for Monthly review.
3. Force-set route to `?key=` of an empty period → empty state, no network call.
4. Disconnect network → retry card; reconnect → retry succeeds; cache populated.
5. Reload screen on the same period → cached payload renders without a fetch.
6. Walk back 12 weeks via chevron → back button disabled at offset −12.

---

## 8. Cross-cutting dependencies

| Dependency | Where consumed | Status |
|---|---|---|
| Backend `/review` route | This slice (rewritten in place) | Already deployed; no schema delta downstream because no client calls it today. Same `OPENROUTER_API_KEY` deploy gate as `/parse` — same carryover situation as 5b/5c. |
| `goals.monthlyBudget` column | `computeReviewSignals` → `underBudget` | Built in SP3a; no schema delta. |
| `streakForRitual` | `computeReviewAggregates` → `rituals.perRitual.streak`, `bestStreakRitual` | Built in SP3a; live-verified in 5f. |
| PalComposer `prefill` prop | `<OneThingToTry>` "Ask Pal more" CTA | Added in 5f; this is the second consumer. |
| `useLiveQuery` | `<ReviewScreen>` aggregates subscription | In use since SP3a. |
| `dayKey` helpers | period bounds math (DST safety) | Extracted in 5e. |
| JWT `review` scope | Backend route guard | Already configured; no JWT regen needed. |

---

## 9. Scope cuts

Explicitly out of scope for SP5g:

| Item | Reason |
|---|---|
| Today-screen "Sunday review" banner / auto-trigger | Per §2 row 3. Earned via SP6 Polish if it earns its keep. |
| Weekly budget tracking | Only monthly budgets exist on `goals`. Adding weekly budgets is a product change, not a review surface. |
| Comparison to prior period (weekly only) | Monthly review's `<ByTheNumbers>` shows month-over-month deltas. Weekly comparison ("vs last week") inflates the aggregate query and adds scope; cut for SP5g. |
| Share / export of reviews | Handoff shows a share icon; out of scope. Add in SP6 if there's pull. |
| "Edit / accept / reject" on Pal's patterns | The patterns are read-only narrative. No tagging UI. |
| Multi-period selector (e.g. quarter, year-to-date) | Two periods only. Quarter/year reviews are not on the meta-spec. |
| Email / push delivery of reviews | Per meta-spec §2 row 10 — no notifications in SP5. |
| Backwards-compat for the old `/review` shape | No existing client; clean break is fine per §4.5. |
| Markdown rendering library | Per §2 row 10. Inline `<Bold>` parser only. |

---

## 10. Open items (resolved before plan-writing)

All resolved during brainstorming:

- ~~Week window~~ → ISO Mon→Sun (§2 row 2).
- ~~`food` aggregate~~ → cut (§2 row 4a).
- ~~Workout metric~~ → `{sessions, prCount}` (§2 row 4b).
- ~~Default period~~ → most recent completed (§2 row 7).
- ~~Failure UX~~ → inline retry card (§2 row 9a).
- ~~Regenerate cap~~ → 60s soft cooldown (§2 row 9b).
- ~~Cache storage~~ → SQLite `generated_reviews` table (§2 row 6).

No outstanding inputs are required before invoking `superpowers:writing-plans`.

---

## 11. What this spec is NOT

- Not an implementation plan. Next step: `superpowers:writing-plans`.
- Not a redesign of `/review`'s deployment posture or auth. Existing JWT + scope wiring stands.
- Not a notification surface. Both screens are user-initiated; no foreground triggers.
- Not a multi-account feature. Single-user assumption from parent meta-spec stands.
