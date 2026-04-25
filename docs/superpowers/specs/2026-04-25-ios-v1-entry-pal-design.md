# SP3b — iOS v1: Entry + Pal (PalComposer + Spending Detail)

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Sub-project:** SP3b per `2026-04-25-implementation-process-design.md`
**Predecessors:** SP2 (backend `/chat`, `/parse`) code-complete; SP3a (data layer + shell) in flight (verification surface assumed shipped before SP3b boots).

---

## 1. Goal

Ship the user-facing surface that turns Pulse's local data layer into a functioning daily tool:

1. **PalComposer** — a unified modal sheet behind the FAB. The user types one thing; the system either logs an entry to SQLite or streams a chat reply.
2. **Spending Detail** — a drill-in from the Today screen's money stat showing today's spend list + total + budget.

Plus a small backend amendment to `/parse` so it can signal "this isn't an entry" without an error.

This sub-project does **not** ship: a separate Ask Pal tab/screen (handoff supersedes this), workout logging UI (SP4), email-receipt path (SP5), or persistent chat history.

## 2. Decisions locked during brainstorm

| # | Question | Decision |
|---|---|---|
| 1 | Scope | Unified PalComposer per `design_handoff/src/pal-composer.jsx` — one FAB, one sheet for log + ask. Original meta-spec's "Log Entry sheet" + "Ask Pal screen" pair is collapsed. |
| 2 | Routing inside the composer | **Parse-first, fall back to chat.** Every send hits `/parse`. If response is a recognizable entry (`spend` or `workout`) → log path. If `kind: "chat"` → stream from `/chat`. Food kind dropped (not a v1 tracker). |
| 3 | Low-confidence entry UX | Editable confirm bubble. High-confidence entries auto-write; low-confidence pause for `[Confirm] [Discard]`. |
| 4 | Chat persistence | Ephemeral. Messages live in component state; cleared on sheet close. No new schema. |
| 5 | Pal context payload | Always full context: `getTodayAggregates()` + last 20 entries projected to `{ at, kind, summary }`. |
| 6 | Spending Detail reach | Tap-through from Today's money stat. Stack route under Today. Move/Rituals detail screens out of scope. |
| 7 | JWT storage | Build-time env var (`EXPO_PUBLIC_PAL_TOKEN`). No SecureStore in v1. Rotation = rebuild. |

## 3. Backend amendments (SP2 patch)

SP2's `/parse` shipped with kinds `food | workout | spend`. SP3a's data model has only three trackers — Money, Move, Rituals — and no food table. SP3b reconciles `/parse` with the actual iOS schema:

1. **Add `kind: "chat"`** to `ParseResponseSchema` so conversational input routes to chat without a parse error:
   ```ts
   z.object({ kind: z.literal("chat"), confidence: z.literal("high"), raw: z.string() })
   ```
2. **Drop `kind: "food"`** from `ParseResponseSchema` and update `backend/src/lib/prompts/parse.ts`. Food is not a v1 tracker. If the user types something food-shaped, the model returns `kind: "chat"` and Pal answers conversationally instead of trying to log it.
3. **Keep `kind: "workout"`** as the name on the wire (avoids a rename across SP2 tests). Internally on iOS it routes to the **Move** tracker (`movement_entries`) — see §7.1.
4. **`lib/api-types.ts`** (shared types) — drop food member, add chat member.
5. **Tests** in `backend/src/routes/__tests__/parse.test.ts`:
   - Conversational input ("how was my week?") → `{ kind: "chat" }`.
   - Food-shaped input ("ate two eggs") → `{ kind: "chat" }` (no longer logged).
   - Existing spend and workout cases still pass.

These are non-trivial schema changes but stay within SP2's contract surface (one endpoint, additive + one removal). The shared `api-types` package version is bumped so the iOS client compiles against the new shape.

## 4. Architecture

### 4.1 New files

```
app/(tabs)/today/spending.tsx         # Spending Detail route
components/PalComposer.tsx            # the unified sheet
components/pal/
  Bubble.tsx                          # user / assistant text bubble
  TypingDots.tsx                      # streaming indicator
  ConfirmEntryBubble.tsx              # editable low-confidence entry
  StarterChips.tsx                    # compact-state suggestions
lib/pal/
  client.ts                           # parse() + chatStream()
  context.ts                          # buildContext(db) → { today, recentEntries }
  route.ts                            # parse-first orchestrator
  sse.ts                              # thin wrapper over react-native-sse
  config.ts                           # baseUrl + token from Expo config
  errors.ts                           # NetworkError / AuthError / RateLimitError / UpstreamError
lib/db/queries/
  recentEntries.ts                    # last N entries projected for Pal context
  todaySpend.ts                       # entries + total + budget for detail
  insertEntry.ts                      # ParseResponse → entries row
```

### 4.2 Modified files

- `app/(tabs)/today.tsx` — money stat block becomes pressable (routes to `/(tabs)/today/spending`); host the FAB that opens `PalComposer`.
- `lib/api-types.ts` — add `kind: "chat"` to `ParseResponse`.
- `package.json` — add `react-native-sse`.

### 4.3 Backend

- `backend/src/schemas/parse.ts`
- `backend/src/lib/prompts/parse.ts`
- `backend/src/routes/__tests__/parse.test.ts` (one new case)

## 5. Components

### 5.1 PalComposer

`components/PalComposer.tsx`. Modal sheet from the bottom. Renders compact (greeting + starter chips + composer) until first message; then expands to ~86% screen height with a chat scroller above the composer. Closing dismisses and tears down state.

**Props:** `{ visible: boolean; onClose(): void; onStartWorkout?(): void; seed?: string }`

**State:**
```ts
type Bubble =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string; streaming?: boolean }
  | { id: string; kind: 'confirm'; entry: ParsedEntry; status: 'pending' | 'committed' | 'discarded' };

messages: Bubble[]
input: string
expanded: boolean
pending: boolean   // true while parse() in flight or stream active
```

**On submit:** push `user` bubble, set `pending`, call `route(text, ctx, callbacks)`. Callbacks dispatch new bubbles or stream into the last assistant bubble.

**On close:** call `currentAbort?.abort()` then unmount. State cleared.

### 5.2 ConfirmEntryBubble

Editable controlled component. Shows fields appropriate to the entry kind:

- **spend:** `amount` (numeric, in dollars; persisted as `cents`), `category`, `merchant` (free-text — persisted to `note` since the schema has no merchant column).
- **workout** *(routes to Move tracker)*: `durationMin` (numeric — persisted as `minutes`), `kind` (free-text label like "run", "strength" — persisted to `movement_entries.kind`), `routine` (optional free-text — appended to `note`). Sets data from `/parse` is summarized into the `note` field for v1; structured set logging lands in SP4.

Buttons: `[Confirm] [Discard]`. On confirm → calls `insertEntry(db, kind, edited)`, sets bubble status `committed`, appends a small assistant text line ("Logged $5 at Verve — counted toward Money ring."). On discard → status `discarded`, bubble fades.

### 5.3 Spending Detail

`app/(tabs)/today/spending.tsx`. Stack route under Today (back-swipe lands on Today). Header with title "Spending today". Body:

- A summary block: "$X.YY of $B" + a thin progress bar (over-budget tinted red).
- An entry list: time (HH:MM), merchant or category, `-$amount`. Grouped descending by `at`. Empty state: *"No spending logged today."*

Subscribes via Drizzle `useLiveQuery`, so an entry confirmed in PalComposer reflects instantly.

### 5.4 Bubble, TypingDots, StarterChips

Direct ports of the handoff visuals to NativeWind. Starter chips fire `route(chipText, …)` directly — same path as typed input.

## 6. Pal client + router

### 6.1 `lib/pal/client.ts`

```ts
parse(text: string, hint?: 'workout' | 'spend'): Promise<ParseResponse>
chatStream(
  req: ChatRequest,
  cb: { onChunk(d: string): void; onDone(u: Usage): void; onError(code: string, msg: string): void },
): AbortController
```

`parse` is `fetch` with `Authorization: Bearer <token>`. Maps response status to typed errors (`AuthError` 401, `RateLimitError` 429, `UpstreamError` 5xx, `NetworkError` for transport failure). Validation_failed at the parse level falls through; the router treats it as `kind: "chat"` (see §6.2).

`chatStream` wraps `react-native-sse`. Its returned `AbortController` closes the underlying EventSource on `.abort()`.

### 6.2 `lib/pal/route.ts`

```ts
async function route(
  text: string,
  ctx: { messagesForChat: ChatMessage[]; context: PalContext },
  cb: {
    onAssistantStart(id: string): void;          // empty assistant bubble
    onChunk(id: string, delta: string): void;    // append delta
    onDone(id: string): void;
    onError(id: string, message: string): void;
    onCommit(entry: ParsedEntry): void;          // high-confidence write
    onConfirmNeeded(entry: ParsedEntry): void;   // low-confidence
  },
): AbortController | undefined
```

Pseudocode:

```
let r;
try { r = await parse(text); }
catch (e) { cb.onError(newId, errorMessageFor(e)); return; }

if (r.kind === 'chat') {
  const id = newId; cb.onAssistantStart(id);
  return chatStream({messages: ctx.messagesForChat, context: ctx.context}, {
    onChunk: d => cb.onChunk(id, d),
    onDone:  () => cb.onDone(id),
    onError: (_, msg) => cb.onError(id, msg),
  });
}
if (r.confidence === 'high') {
  await insertEntry(db, r);
  cb.onCommit(r);
} else {
  cb.onConfirmNeeded(r);   // user will confirm/discard via bubble
}
```

### 6.3 `lib/pal/context.ts`

```ts
buildContext(db, tz): Promise<{ today: TodaySummary; recentEntries: RecentEntry[] }>
```

Calls `getTodayAggregates(db, tz)` (SP3a) and `getRecentEntries(db, 20)` (new). `RecentEntry` is `{ at: ISOString, kind: 'spend' | 'move' | 'ritual', summary: string }`. `getRecentEntries` queries all three SP3a entry tables, merges, sorts by `occurred_at` desc, and projects:

- spend: `"<note ?? category ?? "Spent"> · -$<cents/100>"`
- move: `"<kind ?? "Movement"> · <minutes>m"`
- ritual: `"<rituals.title>"` (joined via `ritual_id`)

Cap: 20 rows total. No pagination.

### 6.4 `lib/pal/config.ts`

```ts
export const PAL_BASE_URL = Constants.expoConfig?.extra?.palBaseUrl as string;
export const PAL_TOKEN    = Constants.expoConfig?.extra?.palToken    as string;
```

`app.config.ts` reads from `process.env.EXPO_PUBLIC_PAL_BASE_URL` and `EXPO_PUBLIC_PAL_TOKEN`. `.env.example` updated to document both.

## 7. Data flow

1. User submits text → composer pushes `user` bubble, sets `pending`.
2. `buildContext(db)` runs (today aggregates + recent 20).
3. `route(text, ctx, callbacks)` → `POST /parse`.
4. Branch on response:
   - `kind: "chat"` → `chatStream` with `{ messages: history, context }`. Empty assistant bubble appended; chunks stream in; done clears the streaming flag.
   - high-confidence entry → `insertEntry(db, r)` immediately; assistant text bubble confirms.
   - low-confidence entry → confirm bubble appended; nothing written until user taps Confirm.
5. On confirm → `insertEntry(db, edited)`; bubble transitions to `committed`; small text line appended.
6. Drizzle `useLiveQuery` on Today and Spending Detail re-renders without manual invalidation.
7. Conversation history sent to `/chat` is the bubble list filtered to `user`/`assistant`, projected to `{ role, content }`. Confirm bubbles are excluded.
8. On sheet close → `abortController.abort()` for any in-flight stream; state torn down.

### 7.1 Entry mapping (`insertEntry`)

SP3a shipped two relevant tables (rituals are checkbox-only and not parsed):

```
spending_entries: { id, cents, note, category, occurred_at }
movement_entries: { id, minutes, kind, note, occurred_at }
```

Mapping per parse `kind`:

**`kind: "spend"`** → `spending_entries`

| Parse field | Column | Notes |
|---|---|---|
| `data.amount` (decimal) | `cents` | `round(amount * 100)`. `currency` from `/parse` is dropped — v1 is USD-only. |
| `data.category` | `category` | Pass through. |
| `data.merchant` | `note` | Schema has no merchant column; merchant text goes into `note`. If both merchant and free-text would be present, prefix: `"Verve Coffee — morning"`. |
| `raw` | (dropped in v1) | No `raw_text` column. Available in `note` if needed for debug, but not by default. |
| (none) | `occurred_at` | `Date.now()` at insert. |

**`kind: "workout"`** → `movement_entries`

| Parse field | Column | Notes |
|---|---|---|
| `data.durationMin` | `minutes` | Required. If `/parse` returns no duration but does return sets, plan-level decision: estimate or reject — see §11. |
| `data.routine` | `kind` | The `kind` column is a free-text label ("run", "Push day", "yoga"). Routine name is the closest concept. Default `"workout"` when missing. |
| `data.sets` | `note` | Summarized as `"3×5 squat, 3×8 bench"`. Structured set logging lands in SP4. |
| `raw` | (dropped) | No `raw_text` column. |
| (none) | `occurred_at` | `Date.now()` at insert. |

No schema migrations are required from SP3b — the existing SP3a schema is sufficient with the mapping above. (Adding a `raw_text` column for audit is a possible future SP3a patch but not blocking.)

### 7.2 Today spend query (`getTodaySpend`)

Returns `{ totalCents: number; budgetCents: number; entries: SpendingEntry[] }`. Filters `spending_entries.occurred_at` within the user's TZ-aware day boundary using SP3a's day-key helper. Reads `goals.daily_budget_cents` for the budget. Entries ordered by `occurred_at` desc.

## 8. Error handling

| Failure | UX |
|---|---|
| Network unreachable | Bubble: *"Couldn't reach Pal. Check your connection."* Input restored. |
| 401 unauthorized | Bubble: *"Pal isn't authorized — your token may need to be rotated."* |
| 429 rate-limited | Bubble: *"Slow down a sec — try again in a minute."* Input restored. |
| 5xx / `upstream_error` | Bubble: *"Pal had trouble thinking. Try again?"* Input restored. |
| `/parse` `validation_failed` | Treated as `kind: "chat"` — stream a normal answer. No error bubble. |
| SSE mid-stream error | Half-streamed assistant bubble's text replaced in place. Usage not recorded. |
| `insertEntry` fails | Bubble: *"Couldn't save the entry — try again."* Confirm bubble stays in `pending`. |
| User offline at confirm time | Write proceeds (SQLite is local). Bubble → `committed`. |
| Sheet closed mid-stream | `abort()`. No bubble update. State torn down. |

No automatic retries. All retries are user-driven. Errors logged via `console.warn` with `{ requestId, code }`. No remote logging in v1. Input text is restored to the textarea on any error before the first chunk; once a chunk has arrived, the bubble keeps whatever it streamed.

## 9. Testing

### 9.1 TDD targets

Per meta-spec §3 SP3b row: Pal client (request shape + error handling), entry validation. UI verified visually.

### 9.2 Test files

```
lib/pal/__tests__/
  client.test.ts          # parse() + chatStream() — fetch + SSE mocked
  route.test.ts           # parse-first/chat-fallback orchestration
  context.test.ts         # buildContext shape + recent-entry projection
lib/db/queries/__tests__/
  insertEntry.test.ts     # ParseResponse → spending_entries / movement_entries
  todaySpend.test.ts      # aggregation + TZ boundary
  recentEntries.test.ts   # 3-table merge, desc sort, 20-cap, summary projection
backend/src/routes/__tests__/
  parse.test.ts           # +cases: conversational → "chat"; food-shaped → "chat"; food kind removed
```

### 9.3 Cases (high level)

- `parse()` POST shape, `Authorization: Bearer`, body `{ text }`. Maps 401/429/5xx/transport to typed errors.
- `chatStream()` decodes `chunk` / `done` / `error` events. `.abort()` closes connection without firing `onDone`.
- Router branches: `chat` → calls `chatStream`, never `insertEntry`. High-confidence entry → `insertEntry`, never `chatStream`. Low-confidence → neither, only `onConfirmNeeded`. `validation_failed` → falls through to `chatStream`.
- `buildContext(db)` against in-memory seeded DB: 20-row cap, descending `at`, summary projection per kind (spend/move/ritual).
- `insertEntry` for `spend`: `cents = round(amount * 100)`; merchant lands in `note`; `currency` ignored. For `workout`: `durationMin → minutes`; `routine → kind`; sets summarized into `note`. `occurred_at` defaults to `Date.now()`.
- `getTodaySpend` aggregates only today's `spending_entries`; ordering descending; budget read from `goals.daily_budget_cents`.
- `getRecentEntries` merges spend/move/ritual rows from three tables, applies 20-cap after the desc sort, and projects each with the right summary string (rituals join `rituals.title`).

### 9.4 Smoke test (visual verification)

1. Onboarding completes (SP3a).
2. Tap FAB → PalComposer opens compact, starter chips visible.
3. Tap chip *"Verve coffee, $5"* → confirmation bubble appears (high-confidence path); Money ring on Today updates.
4. Type *"ran 30 minutes"* → low-confidence confirm bubble (or high-confidence direct write, depending on parse); tap Confirm if shown. Today's Move ring updates.
5. Type *"how am I doing this week?"* → `/parse` returns `chat`; SSE stream renders incrementally into an assistant bubble.
6. Close composer → state cleared; reopen → empty.
7. Tap money stat on Today → Spending Detail shows entries, total, budget bar.
8. Force backend offline → submit text → error bubble; input restored.

Smoke test passes = SP3b complete.

## 10. Out of scope (deferred)

| Item | Reason / where it lands |
|---|---|
| Food tracking | Not a Pulse v1 tracker. `/parse` is updated to never return `kind: "food"`; food-shaped input routes to chat. |
| Logging rituals via `/parse` | Rituals are checkbox-only on the Today screen. Pal doesn't parse them. |
| Persistent chat history | v2; would need `pal_messages` table. |
| SecureStore-backed token | v2 if multi-device; build-time env is sufficient for single-user v1. |
| Move + Rituals detail screens | Polish (SP6) or follow-up; design handoff doesn't fully spec them. |
| Structured workout/set logging | SP4. SP3b's workout-via-Pal collapses sets into a `note` summary. |
| Receipt-from-email parsing | SP5. `/parse` in v1 is user-typed only. |
| Tool-calling chat (model emits log_entry inline) | Potential v2 if parse-first routing turns out lossy. |
| Retry/backoff | All retries are user-driven in v1. |
| `raw_text` audit column | Could add to SP3a tables later for parse-debug; not blocking. |

## 11. Open items

- **Workout without duration.** If `/parse` returns `kind: "workout"` with no `durationMin`, `movement_entries.minutes` (NOT NULL) cannot be filled. Plan-level resolution: surface a low-confidence confirm bubble that requires the user to enter minutes before Confirm becomes enabled. (Default-to-zero is wrong; auto-estimate is dishonest.)
- **Cost.** Every send now costs a `/parse` call. Single-user, single-device, OpenRouter Haiku — negligible (<$1/mo at expected volume). Re-evaluate if it grows.

## 12. What this spec is NOT

- Not the SP4 workout flow. SP3b ships only the minimum workout-entry fields the parse model returns; full workout UX is SP4.
- Not a chat-tool-calling design. We picked parse-first explicitly; revisit only if it proves lossy.
- Not a refactor of the FAB or Today screen beyond what's needed to host the FAB and the spending tap-through.
