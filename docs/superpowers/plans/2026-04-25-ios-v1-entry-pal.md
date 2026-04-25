# SP3b — iOS v1: Entry + Pal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship PalComposer (unified log-or-ask sheet) and Spending Detail. Wire the FAB on Today; route user input through `/parse` (with chat fallback) into either SQLite entries or streamed `/chat` answers.

**Architecture:** Backend `/parse` is amended to drop `kind: "food"` and add `kind: "chat"`. iOS `lib/pal/*` provides the network client (parse + SSE chat) and a parse-first router. PalComposer (modal sheet) consumes the router; bubbles render text, streaming, and editable confirm states. Spending Detail is a stack route under Today that reads `spending_entries` for today.

**Tech Stack:** TypeScript, Expo SDK 55, React Native 0.83, Expo Router, Drizzle ORM + expo-sqlite, NativeWind v4, react-native-sse. Backend: Express, vitest, Zod.

---

## File map

**Shared / backend:**
- Modify `lib/api-types.ts` — `ParseResponse`: drop food, add chat. Drop `Entry.kind = "food"`.
- Modify `backend/src/schemas/parse.ts` — `ParseResponseSchema`: drop food, add chat.
- Modify `backend/src/lib/prompts/parse.ts` — system prompt: drop food, instruct chat fallback.
- Modify `backend/test/integration/parse.test.ts` — replace food test with spend test; add two chat-fallback tests; tighten validation_failed cases.
- Modify `backend/test/unit/schemas.test.ts` — drop food schema test (if present); add chat case.

**Pal client (iOS):**
- Create `lib/pal/config.ts`
- Create `lib/pal/errors.ts`
- Create `lib/pal/client.ts` (parse + chatStream)
- Create `lib/pal/sse.ts` (thin wrapper)
- Create `lib/pal/route.ts` (orchestrator)
- Create `lib/pal/context.ts` (buildContext)
- Create `lib/pal/__tests__/client.test.ts`
- Create `lib/pal/__tests__/route.test.ts`
- Create `lib/pal/__tests__/context.test.ts`

**DB queries (iOS):**
- Create `lib/db/queries/insertEntry.ts`
- Create `lib/db/queries/recentEntries.ts`
- Create `lib/db/queries/todaySpend.ts`
- Create `lib/db/__tests__/insertEntry.test.ts`
- Create `lib/db/__tests__/recentEntries.test.ts`
- Create `lib/db/__tests__/todaySpend.test.ts`

**UI:**
- Create `components/pal/Bubble.tsx`
- Create `components/pal/TypingDots.tsx`
- Create `components/pal/StarterChips.tsx`
- Create `components/pal/ConfirmEntryBubble.tsx`
- Create `components/PalComposer.tsx`
- Create `app/(tabs)/today/_layout.tsx` (stack layout to host the spending route)
- Create `app/(tabs)/today/index.tsx` *(move existing `today.tsx` content here)*
- Create `app/(tabs)/today/spending.tsx`
- Delete `app/(tabs)/today.tsx` (replaced by the folder layout)

**Config:**
- Modify `package.json` (add `react-native-sse`)
- Modify `.env.example` (add `EXPO_PUBLIC_PAL_BASE_URL`, `EXPO_PUBLIC_PAL_TOKEN`)

---

## Task 1: Shared api-types — drop food, add chat

**Files:**
- Modify: `lib/api-types.ts`

- [x] **Step 1: Update `ParseResponse` and remove food types**

Replace the food/workout/spend block and the `Entry` declaration with:

```ts
// --- Stub entity types (SP3a tightens iOS-side; backend keeps these for /parse) ---

export type Entry = {
  id: string;
  kind: "workout" | "spend";
  at: string; // ISO 8601
  note?: string;
};

export type WorkoutEntry = {
  routine?: string;
  sets?: Array<{ exercise: string; reps: number; weight?: number }>;
  durationMin?: number;
};

export type SpendEntry = {
  amount: number;
  currency: string; // ISO 4217
  category?: string;
  merchant?: string;
};
```

Then update `ParseResponse` (search for the union type or `ParseHint`):

```ts
export type ParseHint = "workout" | "spend";

export type ParseResponse =
  | { kind: "workout"; data: WorkoutEntry; confidence: "high" | "low"; raw: string }
  | { kind: "spend";   data: SpendEntry;   confidence: "high" | "low"; raw: string }
  | { kind: "chat";    confidence: "high"; raw: string };
```

Delete any remaining `FoodEntry` type or `food` literal.

- [x] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: failures will appear in backend & tests that still reference food. They will be fixed in Tasks 2–4. Continue regardless.

- [x] **Step 3: Commit**

```bash
git add lib/api-types.ts
git commit -m "feat(api-types): drop food kind, add chat kind to ParseResponse"
```

---

## Task 2: Backend parse schema (TDD)

**Files:**
- Modify: `backend/src/schemas/parse.ts`
- Modify: `backend/test/unit/schemas.test.ts` (or create a new schema test file if absent)

- [x] **Step 1: Write failing schema tests**

Open `backend/test/unit/schemas.test.ts`. Find any food test (e.g. `it(... "food schema" ...)`) and replace with:

```ts
import { describe, it, expect } from "vitest";
import { ParseResponseSchema } from "../../src/schemas/parse.js";

describe("ParseResponseSchema", () => {
  it("accepts a spend entry", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "spend",
      data: { amount: 5.75, currency: "USD", merchant: "Verve" },
      confidence: "high",
      raw: "verve $5.75",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a workout entry", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "workout",
      data: { durationMin: 30, routine: "run" },
      confidence: "low",
      raw: "ran 30 min",
    });
    expect(r.success).toBe(true);
  });

  it("accepts a chat response", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "chat",
      confidence: "high",
      raw: "how was my week?",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a food entry (food was dropped)", () => {
    const r = ParseResponseSchema.safeParse({
      kind: "food",
      data: { items: [{ name: "eggs" }] },
      confidence: "high",
      raw: "ate eggs",
    });
    expect(r.success).toBe(false);
  });
});
```

- [x] **Step 2: Run tests — should fail**

Run: `cd backend && npm test -- schemas`
Expected: chat & rejection tests fail (food still present, chat not yet defined).

- [x] **Step 3: Update the schema**

Replace `backend/src/schemas/parse.ts` entirely with:

```ts
import { z } from "zod";
import type { ParseRequest, ParseResponse } from "@api-types";

export const ParseRequestSchema: z.ZodType<ParseRequest> = z.object({
  text: z.string().min(1, "text is required"),
  hint: z.enum(["workout", "spend"]).optional(),
});

const WorkoutEntry = z.object({
  routine: z.string().optional(),
  sets: z.array(z.object({ exercise: z.string(), reps: z.number().int(), weight: z.number().optional() })).optional(),
  durationMin: z.number().optional(),
});

const SpendEntry = z.object({
  amount: z.number(),
  currency: z.string().length(3),
  category: z.string().optional(),
  merchant: z.string().optional(),
});

const Confidence = z.enum(["high", "low"]);

export const ParseResponseSchema: z.ZodType<ParseResponse> = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("workout"), data: WorkoutEntry, confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("spend"),   data: SpendEntry,   confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("chat"),    confidence: z.literal("high"), raw: z.string() }),
]);
```

- [x] **Step 4: Run tests — should pass**

Run: `cd backend && npm test -- schemas`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add backend/src/schemas/parse.ts backend/test/unit/schemas.test.ts
git commit -m "feat(backend): drop food, add chat to ParseResponseSchema"
```

---

## Task 3: Backend parse prompt — drop food, add chat fallback

**Files:**
- Modify: `backend/src/lib/prompts/parse.ts`
- Modify: `backend/test/unit/prompts.test.ts` (if it asserts the prompt content)

- [x] **Step 1: Replace the prompt**

```ts
import type { ParseHint } from "@api-types";

const SYSTEM = `You parse short, free-form entries the user typed into the Pulse app into structured JSON, OR signal that the input is conversational.

Output rules:
- Return JSON only. No prose. No code fences.
- Pick exactly one kind: "workout", "spend", or "chat".
- Use "spend" when the user is logging money out: include amount (number) and currency (ISO 4217). Optional category, merchant.
- Use "workout" when the user is logging movement/exercise: optional routine, optional sets[], optional durationMin (number, in minutes).
- Use "chat" for everything else: questions ("how am I doing this week?"), conversational greetings, food mentions, anything that is NOT a quantified spend or workout entry. Pulse v1 does not track food, so food-shaped input is "chat", not an entry.
- If you can identify a workout or spend but key fields are ambiguous, set confidence: "low". Otherwise confidence: "high".
- For "chat", confidence is always "high".

Shapes:
{ "kind": "workout" | "spend",
  "data": <kind-specific object>,
  "confidence": "high" | "low",
  "raw": <the input text exactly> }
{ "kind": "chat",
  "confidence": "high",
  "raw": <the input text exactly> }`;

export function buildParseMessages(text: string, hint?: ParseHint): { system: string; user: string } {
  const hintLine = hint ? `\nhint: ${hint}` : "";
  const user = `Parse this entry:\n"""\n${text}\n"""${hintLine}`;
  return { system: SYSTEM, user };
}
```

- [x] **Step 2: Update prompt unit test if it exists**

Open `backend/test/unit/prompts.test.ts`. If it asserts substrings like `"food"`, replace those expectations with assertions like:

```ts
expect(system).toContain('"workout"');
expect(system).toContain('"spend"');
expect(system).toContain('"chat"');
expect(system).not.toContain('"food"');
```

- [x] **Step 3: Run unit tests**

Run: `cd backend && npm test -- prompts`
Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add backend/src/lib/prompts/parse.ts backend/test/unit/prompts.test.ts
git commit -m "feat(backend): parse prompt routes food-shaped input to chat"
```

---

## Task 4: Backend parse integration tests — replace food, add chat fallback

**Files:**
- Modify: `backend/test/integration/parse.test.ts`

- [x] **Step 1: Replace the file**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const SPEND_JSON = JSON.stringify({
  kind: "spend",
  data: { amount: 5.75, currency: "USD", merchant: "Verve" },
  confidence: "high",
  raw: "verve coffee 5.75",
});

const WORKOUT_LOW_JSON = JSON.stringify({
  kind: "workout",
  data: { routine: "run" },
  confidence: "low",
  raw: "went for a run",
});

const CHAT_JSON = JSON.stringify({
  kind: "chat",
  confidence: "high",
  raw: "how was my week?",
});

describe("POST /parse", () => {
  it("returns parsed spend entry on happy path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: SPEND_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "verve coffee 5.75" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("spend");
    expect(res.body.data.amount).toBe(5.75);
    expect(res.body.confidence).toBe("high");
  });

  it("returns parsed low-confidence workout", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: WORKOUT_LOW_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "went for a run" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("workout");
    expect(res.body.confidence).toBe("low");
  });

  it("routes conversational input to kind:chat", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: CHAT_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "how was my week?" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("chat");
    expect(res.body.confidence).toBe("high");
  });

  it("returns 400 validation_failed when model emits food (kind dropped)", async () => {
    const FOOD = JSON.stringify({ kind: "food", data: { items: [{ name: "eggs" }] }, confidence: "high", raw: "ate eggs" });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: FOOD, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate eggs" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed on empty text", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed when model emits non-JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json at all", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 502 upstream_error when chatJson rejects", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => {
          const { UpstreamError } = await import("../../src/middleware/errorHandler.js");
          throw new UpstreamError("network down");
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate eggs" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });
});
```

- [x] **Step 2: Run integration tests**

Run: `cd backend && npm test -- parse`
Expected: PASS.

- [x] **Step 3: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS. If anything else still references `food` (e.g. example data in chat tests), update those references to `spend` or `workout`.

- [x] **Step 4: Commit**

```bash
git add backend/test/integration/parse.test.ts
git commit -m "test(backend): parse integration covers spend, low-confidence workout, chat fallback"
```

---

## Task 5: Add `react-native-sse` dependency

**Files:**
- Modify: `package.json`
- Modify: `.env.example`

- [x] **Step 1: Install**

Run: `npm install react-native-sse`
Expected: package added; lockfile updated.

- [x] **Step 2: Update `.env.example`**

Append (create the file if missing):

```
EXPO_PUBLIC_PAL_BASE_URL=http://localhost:3000
EXPO_PUBLIC_PAL_TOKEN=paste-dev-token-here
```

- [x] **Step 3: Update `app.config.ts` or `app.json` to expose env to the runtime**

If `app.config.ts` does not exist yet, create it (and delete the `expo` field from `app.json` per Expo's app-config rules, OR leave `app.json` and read directly via `process.env.EXPO_PUBLIC_*`). The simplest path uses Expo's `EXPO_PUBLIC_*` mechanism, which exposes vars to the bundle automatically. **No app config changes needed** — `process.env.EXPO_PUBLIC_PAL_BASE_URL` works directly in `lib/pal/config.ts`. Skip this step if so.

- [x] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add react-native-sse + EXPO_PUBLIC_PAL_* env vars"
```

---

## Task 6: Pal config + errors

**Files:**
- Create: `lib/pal/config.ts`
- Create: `lib/pal/errors.ts`

- [x] **Step 1: Write `lib/pal/config.ts`**

```ts
const baseUrl = process.env.EXPO_PUBLIC_PAL_BASE_URL ?? "";
const token = process.env.EXPO_PUBLIC_PAL_TOKEN ?? "";

if (!baseUrl) console.warn("[pal] EXPO_PUBLIC_PAL_BASE_URL not set");
if (!token) console.warn("[pal] EXPO_PUBLIC_PAL_TOKEN not set");

export const PAL_BASE_URL = baseUrl;
export const PAL_TOKEN = token;
```

- [x] **Step 2: Write `lib/pal/errors.ts`**

```ts
export class PalError extends Error {
  constructor(public readonly code: string, message: string, public readonly requestId?: string) {
    super(message);
    this.name = 'PalError';
  }
}
export class NetworkError  extends PalError { constructor(m = 'Network unreachable') { super('network', m); } }
export class AuthError     extends PalError { constructor(m = 'Unauthorized', rid?: string) { super('unauthorized', m, rid); } }
export class RateLimitError extends PalError { constructor(m = 'Rate limited', rid?: string) { super('rate_limited', m, rid); } }
export class UpstreamError extends PalError { constructor(m = 'Upstream failed', rid?: string) { super('upstream_error', m, rid); } }
export class ValidationError extends PalError { constructor(m = 'Validation failed', rid?: string) { super('validation_failed', m, rid); } }

/** User-facing message for an error. */
export function messageFor(e: unknown): string {
  if (e instanceof NetworkError) return "Couldn't reach Pal. Check your connection.";
  if (e instanceof AuthError) return "Pal isn't authorized — your token may need to be rotated.";
  if (e instanceof RateLimitError) return "Slow down a sec — try again in a minute.";
  if (e instanceof UpstreamError) return "Pal had trouble thinking. Try again?";
  return "Something went wrong. Try again.";
}
```

- [x] **Step 3: Commit**

```bash
git add lib/pal/config.ts lib/pal/errors.ts
git commit -m "feat(pal): config + typed errors"
```

---

## Task 7: Pal client `parse()` (TDD)

**Files:**
- Create: `lib/pal/client.ts` (parse function only this task)
- Create: `lib/pal/__tests__/client.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { parse } from '../client';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from '../errors';

const BASE = 'http://test.local';
const TOKEN = 'tok-abc';

jest.mock('../config', () => ({ PAL_BASE_URL: 'http://test.local', PAL_TOKEN: 'tok-abc' }));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  // @ts-expect-error override global fetch
  global.fetch = fetchMock;
});

const json = (status: number, body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

describe('parse()', () => {
  it('POSTs /parse with bearer auth and { text } body', async () => {
    fetchMock.mockReturnValue(json(200, { kind: 'chat', confidence: 'high', raw: 'hi' }));
    await parse('hi');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/parse`);
    expect(init.method).toBe('POST');
    expect(init.headers['Authorization']).toBe(`Bearer ${TOKEN}`);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ text: 'hi' });
  });

  it('passes hint when given', async () => {
    fetchMock.mockReturnValue(json(200, { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: 'x' }));
    await parse('x', 'spend');
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ text: 'x', hint: 'spend' });
  });

  it('returns the parsed response body on 200', async () => {
    const body = { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: 'x' };
    fetchMock.mockReturnValue(json(200, body));
    expect(await parse('x')).toEqual(body);
  });

  it('throws AuthError on 401', async () => {
    fetchMock.mockReturnValue(json(401, { error: { code: 'unauthorized', message: 'no' }, requestId: 'r1' }));
    await expect(parse('x')).rejects.toBeInstanceOf(AuthError);
  });

  it('throws RateLimitError on 429', async () => {
    fetchMock.mockReturnValue(json(429, { error: { code: 'rate_limited', message: 'slow' }, requestId: 'r2' }));
    await expect(parse('x')).rejects.toBeInstanceOf(RateLimitError);
  });

  it('throws UpstreamError on 5xx', async () => {
    fetchMock.mockReturnValue(json(502, { error: { code: 'upstream_error', message: 'boom' }, requestId: 'r3' }));
    await expect(parse('x')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('throws ValidationError on 400', async () => {
    fetchMock.mockReturnValue(json(400, { error: { code: 'validation_failed', message: 'no' }, requestId: 'r4' }));
    await expect(parse('x')).rejects.toBeInstanceOf(ValidationError);
  });

  it('throws NetworkError when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await expect(parse('x')).rejects.toBeInstanceOf(NetworkError);
  });
});
```

- [x] **Step 2: Run — fails (parse not exported)**

Run: `npm test -- client.test`
Expected: FAIL "Cannot find module '../client'".

- [x] **Step 3: Implement `lib/pal/client.ts`**

```ts
import type { ParseResponse, ParseHint } from '@/lib/api-types';
import { PAL_BASE_URL, PAL_TOKEN } from './config';
import { AuthError, NetworkError, RateLimitError, UpstreamError, ValidationError } from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try { return (await res.json()) as ErrorEnvelope; } catch { return null; }
}

export async function parse(text: string, hint?: ParseHint): Promise<ParseResponse> {
  const body: { text: string; hint?: ParseHint } = { text };
  if (hint) body.hint = hint;

  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/parse`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  if (res.ok) return (await res.json()) as ParseResponse;

  const env = await readError(res);
  const rid = env?.requestId;
  const msg = env?.error.message ?? '';
  if (res.status === 401) throw new AuthError(msg, rid);
  if (res.status === 429) throw new RateLimitError(msg, rid);
  if (res.status === 400) throw new ValidationError(msg, rid);
  throw new UpstreamError(msg, rid);
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- client.test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/pal/client.ts lib/pal/__tests__/client.test.ts
git commit -m "feat(pal): client.parse() with typed error mapping"
```

---

## Task 8: Pal client `chatStream()` (TDD)

**Files:**
- Modify: `lib/pal/client.ts`
- Create: `lib/pal/sse.ts` (test-friendly indirection over react-native-sse)
- Modify: `lib/pal/__tests__/client.test.ts`

- [x] **Step 1: Write `lib/pal/sse.ts` (thin DI seam)**

```ts
// Indirection over react-native-sse so tests can swap in a fake EventSource.
import EventSource, { type EventSourceListener } from 'react-native-sse';

export type CustomEvents = 'chunk' | 'done' | 'error';

export type SSEFactory = (url: string, init: {
  headers: Record<string, string>;
  method: 'POST';
  body: string;
}) => SSEHandle;

export interface SSEHandle {
  addEventListener(name: CustomEvents | 'open' | 'close', cb: (ev: { data?: string; type?: string }) => void): void;
  close(): void;
}

export const realSSE: SSEFactory = (url, init) => {
  const es = new EventSource<CustomEvents>(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  return {
    addEventListener: (name, cb) => es.addEventListener(name as CustomEvents, cb as EventSourceListener<CustomEvents>),
    close: () => es.close(),
  };
};
```

- [x] **Step 2: Append failing test to `client.test.ts`**

```ts
import { chatStream } from '../client';
import type { SSEHandle } from '../sse';

class FakeSSE implements SSEHandle {
  listeners = new Map<string, (ev: { data?: string }) => void>();
  closed = false;
  addEventListener(name: string, cb: (ev: { data?: string }) => void) {
    this.listeners.set(name, cb);
  }
  close() { this.closed = true; }
  fire(name: string, data?: string) { this.listeners.get(name)?.({ data }); }
}

describe('chatStream()', () => {
  it('opens SSE to /chat with bearer + body, dispatches chunk/done', () => {
    const fake = new FakeSSE();
    const onChunk = jest.fn();
    const onDone = jest.fn();
    const onError = jest.fn();

    const ctrl = chatStream(
      { messages: [{ role: 'user', content: 'hi' }] },
      { onChunk, onDone, onError },
      () => fake,
    );

    fake.fire('chunk', JSON.stringify({ delta: 'Hel' }));
    fake.fire('chunk', JSON.stringify({ delta: 'lo.' }));
    fake.fire('done', JSON.stringify({ usage: { input_tokens: 1, output_tokens: 2 } }));

    expect(onChunk).toHaveBeenNthCalledWith(1, 'Hel');
    expect(onChunk).toHaveBeenNthCalledWith(2, 'lo.');
    expect(onDone).toHaveBeenCalledWith({ input_tokens: 1, output_tokens: 2 });
    expect(onError).not.toHaveBeenCalled();
    ctrl.abort();
    expect(fake.closed).toBe(true);
  });

  it('dispatches error event with code+message', () => {
    const fake = new FakeSSE();
    const cb = { onChunk: jest.fn(), onDone: jest.fn(), onError: jest.fn() };
    chatStream({ messages: [{ role: 'user', content: 'hi' }] }, cb, () => fake);
    fake.fire('error', JSON.stringify({ code: 'upstream_error', message: 'down', requestId: 'r' }));
    expect(cb.onError).toHaveBeenCalledWith('upstream_error', 'down');
  });

  it('abort closes the underlying source without firing onDone', () => {
    const fake = new FakeSSE();
    const cb = { onChunk: jest.fn(), onDone: jest.fn(), onError: jest.fn() };
    const ctrl = chatStream({ messages: [{ role: 'user', content: 'hi' }] }, cb, () => fake);
    ctrl.abort();
    expect(fake.closed).toBe(true);
    expect(cb.onDone).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 3: Run — fails**

Run: `npm test -- client.test`
Expected: FAIL ("chatStream is not a function").

- [x] **Step 4: Implement `chatStream` in `lib/pal/client.ts`**

Append to `lib/pal/client.ts`:

```ts
import { realSSE, type SSEFactory } from './sse';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type ChatRequest = {
  messages: ChatMessage[];
  context?: { recentEntries?: unknown; today?: unknown };
};
export type ChatStreamCallbacks = {
  onChunk(delta: string): void;
  onDone(usage: { input_tokens?: number; output_tokens?: number }): void;
  onError(code: string, message: string): void;
};

export function chatStream(
  req: ChatRequest,
  cb: ChatStreamCallbacks,
  factory: SSEFactory = realSSE,
): { abort: () => void } {
  const es = factory(`${PAL_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${PAL_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(req),
  });

  es.addEventListener('chunk', (ev) => {
    if (!ev.data) return;
    try { cb.onChunk((JSON.parse(ev.data) as { delta: string }).delta); }
    catch { /* ignore malformed chunk */ }
  });
  es.addEventListener('done', (ev) => {
    if (!ev.data) { cb.onDone({}); return; }
    try { cb.onDone((JSON.parse(ev.data) as { usage: object }).usage); }
    catch { cb.onDone({}); }
  });
  es.addEventListener('error', (ev) => {
    if (!ev.data) { cb.onError('network', 'Stream error'); return; }
    try {
      const { code, message } = JSON.parse(ev.data) as { code: string; message: string };
      cb.onError(code, message);
    } catch {
      cb.onError('network', 'Stream error');
    }
  });

  return { abort: () => es.close() };
}
```

- [x] **Step 5: Run — passes**

Run: `npm test -- client.test`
Expected: PASS (all 11 tests across parse + chatStream).

- [x] **Step 6: Commit**

```bash
git add lib/pal/client.ts lib/pal/sse.ts lib/pal/__tests__/client.test.ts
git commit -m "feat(pal): chatStream() with SSE factory + abort"
```

---

## Task 9: `insertEntry` (TDD, pure mapping + actual write)

**Files:**
- Create: `lib/db/queries/insertEntry.ts`
- Create: `lib/db/__tests__/insertEntry.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { makeTestDb } from './test-helpers';
import { insertEntry, mapToRow } from '../queries/insertEntry';
import { spendingEntries, movementEntries } from '../schema';

describe('mapToRow (pure)', () => {
  it('maps spend with merchant + category', () => {
    const r = mapToRow({
      kind: 'spend',
      data: { amount: 5.75, currency: 'USD', merchant: 'Verve', category: 'coffee' },
      confidence: 'high',
      raw: 'verve $5.75',
    }, 1700000000000);
    expect(r).toEqual({
      table: 'spending_entries',
      row: { cents: 575, note: 'Verve', category: 'coffee', occurredAt: 1700000000000 },
    });
  });

  it('rounds amount * 100 for spend', () => {
    const r = mapToRow({
      kind: 'spend',
      data: { amount: 1.005, currency: 'USD' },
      confidence: 'high',
      raw: 'x',
    }, 1);
    expect(r.row.cents).toBe(101);
  });

  it('maps workout with duration + routine', () => {
    const r = mapToRow({
      kind: 'workout',
      data: { durationMin: 30, routine: 'run' },
      confidence: 'high',
      raw: 'ran 30 min',
    }, 1700000000000);
    expect(r).toEqual({
      table: 'movement_entries',
      row: { minutes: 30, kind: 'run', note: null, occurredAt: 1700000000000 },
    });
  });

  it('summarizes workout sets into note', () => {
    const r = mapToRow({
      kind: 'workout',
      data: {
        durationMin: 42,
        sets: [
          { exercise: 'squat', reps: 5, weight: 225 },
          { exercise: 'bench', reps: 8 },
        ],
      },
      confidence: 'high',
      raw: 'push day',
    }, 1);
    expect(r.row.minutes).toBe(42);
    expect(r.row.note).toBe('5×squat @225, 8×bench');
  });

  it('defaults workout kind to "workout" when routine missing', () => {
    const r = mapToRow({
      kind: 'workout',
      data: { durationMin: 20 },
      confidence: 'high',
      raw: 'x',
    }, 1);
    expect(r.row.kind).toBe('workout');
  });

  it('throws when workout has no durationMin', () => {
    expect(() =>
      mapToRow({ kind: 'workout', data: { routine: 'run' }, confidence: 'low', raw: 'x' }, 1),
    ).toThrow(/duration/i);
  });
});

describe('insertEntry (writes)', () => {
  it('writes a spend row to spending_entries', async () => {
    const { db } = makeTestDb();
    await insertEntry(db, {
      kind: 'spend',
      data: { amount: 5.75, currency: 'USD', merchant: 'Verve' },
      confidence: 'high',
      raw: 'x',
    }, 1700000000000);
    const rows = db.select().from(spendingEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ cents: 575, note: 'Verve', occurredAt: 1700000000000 });
  });

  it('writes a workout row to movement_entries', async () => {
    const { db } = makeTestDb();
    await insertEntry(db, {
      kind: 'workout',
      data: { durationMin: 30, routine: 'run' },
      confidence: 'high',
      raw: 'x',
    }, 1700000000000);
    const rows = db.select().from(movementEntries).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ minutes: 30, kind: 'run', occurredAt: 1700000000000 });
  });
});
```

- [x] **Step 2: Run — fails**

Run: `npm test -- insertEntry`
Expected: FAIL.

- [x] **Step 3: Implement `lib/db/queries/insertEntry.ts`**

```ts
import type { ParseResponse } from '@/lib/api-types';
import { spendingEntries, movementEntries } from '../schema';
import type { AnyDb } from './onboarding';

type SpendRow = { cents: number; note: string | null; category: string | null; occurredAt: number };
type MoveRow  = { minutes: number; kind: string | null; note: string | null; occurredAt: number };

export type MappedRow =
  | { table: 'spending_entries'; row: SpendRow }
  | { table: 'movement_entries'; row: MoveRow };

function summarizeSets(sets: Array<{ exercise: string; reps: number; weight?: number }>): string {
  return sets
    .map((s) => `${s.reps}×${s.exercise}${s.weight != null ? ` @${s.weight}` : ''}`)
    .join(', ');
}

export function mapToRow(parsed: ParseResponse, occurredAt: number): MappedRow {
  if (parsed.kind === 'spend') {
    const cents = Math.round(parsed.data.amount * 100);
    return {
      table: 'spending_entries',
      row: {
        cents,
        note: parsed.data.merchant ?? null,
        category: parsed.data.category ?? null,
        occurredAt,
      },
    };
  }
  if (parsed.kind === 'workout') {
    if (parsed.data.durationMin == null) throw new Error('workout requires durationMin');
    const note = parsed.data.sets && parsed.data.sets.length > 0 ? summarizeSets(parsed.data.sets) : null;
    return {
      table: 'movement_entries',
      row: {
        minutes: parsed.data.durationMin,
        kind: parsed.data.routine ?? 'workout',
        note,
        occurredAt,
      },
    };
  }
  throw new Error(`mapToRow: cannot map kind=${parsed.kind}`);
}

export async function insertEntry(db: AnyDb, parsed: ParseResponse, occurredAt = Date.now()): Promise<void> {
  const m = mapToRow(parsed, occurredAt);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  if (m.table === 'spending_entries') {
    await dx.insert(spendingEntries).values(m.row).run();
  } else {
    await dx.insert(movementEntries).values(m.row).run();
  }
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- insertEntry`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/insertEntry.ts lib/db/__tests__/insertEntry.test.ts
git commit -m "feat(db): insertEntry maps ParseResponse to spending/movement rows"
```

---

## Task 10: `recentEntries` (TDD, 3-table merge + projection)

**Files:**
- Create: `lib/db/queries/recentEntries.ts`
- Create: `lib/db/__tests__/recentEntries.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { makeTestDb, tsLocal } from './test-helpers';
import { getRecentEntries } from '../queries/recentEntries';
import { spendingEntries, movementEntries, ritualEntries, rituals } from '../schema';

describe('getRecentEntries', () => {
  it('merges all three tables, sorts desc, caps at limit', async () => {
    const { db } = makeTestDb();
    db.insert(rituals).values({ id: 1, title: 'Read', icon: '📖', position: 1 }).run();

    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();
    db.insert(ritualEntries).values({ ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 21) }).run();

    const got = await getRecentEntries(db, 20);
    expect(got).toHaveLength(3);
    // Descending: 21 > 8 > 7
    expect(got.map((e) => e.kind)).toEqual(['ritual', 'spend', 'move']);
  });

  it('caps at the limit', async () => {
    const { db } = makeTestDb();
    for (let i = 0; i < 25; i++) {
      db.insert(spendingEntries).values({ cents: 100 + i, note: null, category: null, occurredAt: tsLocal(2026, 4, 25, 1) + i }).run();
    }
    const got = await getRecentEntries(db, 20);
    expect(got).toHaveLength(20);
  });

  it('projects spend summary as merchant·-$x.xx', async () => {
    const { db } = makeTestDb();
    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('Verve · -$5.75');
  });

  it('projects move summary as kind·Nm', async () => {
    const { db } = makeTestDb();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('run · 30m');
  });

  it('projects ritual summary as the ritual title', async () => {
    const { db } = makeTestDb();
    db.insert(rituals).values({ id: 7, title: 'Morning pages', icon: '✦', position: 1 }).run();
    db.insert(ritualEntries).values({ ritualId: 7, occurredAt: tsLocal(2026, 4, 25, 6) }).run();
    const [e] = await getRecentEntries(db, 20);
    expect(e.summary).toBe('Morning pages');
  });
});
```

- [x] **Step 2: Run — fails**

Run: `npm test -- recentEntries`
Expected: FAIL (module missing).

- [x] **Step 3: Implement `lib/db/queries/recentEntries.ts`**

```ts
import { desc, eq } from 'drizzle-orm';
import { spendingEntries, movementEntries, ritualEntries, rituals } from '../schema';
import type { AnyDb } from './onboarding';

export type RecentEntry = {
  at: number;
  kind: 'spend' | 'move' | 'ritual';
  summary: string;
};

function fmtSpend(cents: number, note: string | null, category: string | null): string {
  const dollars = (cents / 100).toFixed(2);
  const label = note ?? category ?? 'Spent';
  return `${label} · -$${dollars}`;
}

function fmtMove(minutes: number, kind: string | null): string {
  return `${kind ?? 'Movement'} · ${minutes}m`;
}

export async function getRecentEntries(db: AnyDb, limit: number): Promise<RecentEntry[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  const spends: Array<{ cents: number; note: string | null; category: string | null; occurredAt: number }> =
    await dx.select().from(spendingEntries).orderBy(desc(spendingEntries.occurredAt)).limit(limit);

  const moves: Array<{ minutes: number; kind: string | null; occurredAt: number }> =
    await dx.select().from(movementEntries).orderBy(desc(movementEntries.occurredAt)).limit(limit);

  const ritEntries: Array<{ ritualId: number; occurredAt: number; title: string | null }> =
    await dx.select({
      ritualId: ritualEntries.ritualId,
      occurredAt: ritualEntries.occurredAt,
      title: rituals.title,
    })
      .from(ritualEntries)
      .leftJoin(rituals, eq(ritualEntries.ritualId, rituals.id))
      .orderBy(desc(ritualEntries.occurredAt))
      .limit(limit);

  const merged: RecentEntry[] = [
    ...spends.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'spend', summary: fmtSpend(r.cents, r.note, r.category) })),
    ...moves.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'move', summary: fmtMove(r.minutes, r.kind) })),
    ...ritEntries.map((r): RecentEntry => ({ at: r.occurredAt, kind: 'ritual', summary: r.title ?? 'Ritual' })),
  ];

  merged.sort((a, b) => b.at - a.at);
  return merged.slice(0, limit);
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- recentEntries`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/recentEntries.ts lib/db/__tests__/recentEntries.test.ts
git commit -m "feat(db): getRecentEntries merges three entry tables"
```

---

## Task 11: `getTodaySpend` (TDD)

**Files:**
- Create: `lib/db/queries/todaySpend.ts`
- Create: `lib/db/__tests__/todaySpend.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { makeTestDb, atLocal, tsLocal } from './test-helpers';
import { getTodaySpend } from '../queries/todaySpend';
import { goals, spendingEntries } from '../schema';

describe('getTodaySpend', () => {
  it('aggregates only today\'s spend rows; orders desc; reads budget from goals', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 }).run();

    db.insert(spendingEntries).values([
      { cents: 1620, note: 'Tartine',  category: 'food', occurredAt: tsLocal(2026, 4, 25, 12) },
      { cents:  575, note: 'Verve',    category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) },
      { cents: 9999, note: 'Yesterday',category: null,    occurredAt: tsLocal(2026, 4, 24, 18) },
    ]).run();

    const r = await getTodaySpend(db, atLocal(2026, 4, 25, 14));
    expect(r.totalCents).toBe(1620 + 575);
    expect(r.budgetCents).toBe(8500);
    expect(r.entries.map((e) => e.note)).toEqual(['Tartine', 'Verve']); // desc
  });

  it('returns zero total + zero budget when no goals row', async () => {
    const { db } = makeTestDb();
    const r = await getTodaySpend(db, atLocal(2026, 4, 25, 12));
    expect(r.totalCents).toBe(0);
    expect(r.budgetCents).toBe(0);
    expect(r.entries).toEqual([]);
  });
});
```

- [x] **Step 2: Run — fails**

Run: `npm test -- todaySpend`
Expected: FAIL.

- [x] **Step 3: Implement `lib/db/queries/todaySpend.ts`**

```ts
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { goals, spendingEntries } from '../schema';
import { localDayBounds } from './today';
import type { AnyDb } from './onboarding';

export type TodaySpend = {
  totalCents: number;
  budgetCents: number;
  entries: Array<{
    id: number;
    cents: number;
    note: string | null;
    category: string | null;
    occurredAt: number;
  }>;
};

export async function getTodaySpend(db: AnyDb, asOf: Date): Promise<TodaySpend> {
  const { startMs, endMs } = localDayBounds(asOf);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  const goalRows = await dx.select({ b: goals.dailyBudgetCents }).from(goals).where(eq(goals.id, 1));
  const budgetCents = goalRows[0]?.b ?? 0;

  const entries = await dx.select()
    .from(spendingEntries)
    .where(and(gte(spendingEntries.occurredAt, startMs), lt(spendingEntries.occurredAt, endMs)))
    .orderBy(desc(spendingEntries.occurredAt));

  const totalCents = entries.reduce((acc: number, r: { cents: number }) => acc + r.cents, 0);
  return { totalCents, budgetCents, entries };
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- todaySpend`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/todaySpend.ts lib/db/__tests__/todaySpend.test.ts
git commit -m "feat(db): getTodaySpend aggregates today's spending + reads budget"
```

---

## Task 12: `buildContext` for Pal (TDD)

**Files:**
- Create: `lib/pal/context.ts`
- Create: `lib/pal/__tests__/context.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { describe, expect, it } from '@jest/globals';
import { makeTestDb, atLocal, tsLocal } from '@/lib/db/__tests__/test-helpers';
import { goals, spendingEntries, movementEntries, ritualEntries, rituals } from '@/lib/db/schema';
import { buildContext } from '../context';

describe('buildContext', () => {
  it('returns today aggregates + recent entries (capped)', async () => {
    const { db } = makeTestDb();
    db.insert(goals).values({ id: 1, dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 }).run();
    db.insert(rituals).values({ id: 1, title: 'Read', icon: '📖', position: 1 }).run();

    db.insert(spendingEntries).values({ cents: 575, note: 'Verve', category: 'coffee', occurredAt: tsLocal(2026, 4, 25, 8) }).run();
    db.insert(movementEntries).values({ minutes: 30, kind: 'run', note: null, occurredAt: tsLocal(2026, 4, 25, 7) }).run();

    const ctx = await buildContext(db, atLocal(2026, 4, 25, 14));
    expect(ctx.today.spentCents).toBe(575);
    expect(ctx.today.moveMinutes).toBe(30);
    expect(ctx.recentEntries.length).toBe(2);
    expect(ctx.recentEntries[0].kind).toBe('spend'); // most recent (8am > 7am)
  });
});
```

- [x] **Step 2: Run — fails**

Run: `npm test -- pal/__tests__/context`
Expected: FAIL.

- [x] **Step 3: Implement `lib/pal/context.ts`**

```ts
import { eq } from 'drizzle-orm';
import { goals, rituals, spendingEntries, movementEntries, ritualEntries } from '@/lib/db/schema';
import { getTodayAggregates, type TodayAggregates } from '@/lib/db/queries/today';
import { getRecentEntries, type RecentEntry } from '@/lib/db/queries/recentEntries';
import type { AnyDb } from '@/lib/db/queries/onboarding';

export type PalContext = {
  today: TodayAggregates;
  recentEntries: RecentEntry[];
};

export async function buildContext(db: AnyDb, asOf: Date = new Date()): Promise<PalContext> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const [g] = await dx.select().from(goals).where(eq(goals.id, 1));
  const activeRituals = await dx.select({ id: rituals.id }).from(rituals).where(eq(rituals.active, true));
  const spending = await dx.select({ cents: spendingEntries.cents, occurredAt: spendingEntries.occurredAt }).from(spendingEntries);
  const movement = await dx.select({ minutes: movementEntries.minutes, occurredAt: movementEntries.occurredAt }).from(movementEntries);
  const rEntries = await dx.select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt }).from(ritualEntries);

  const today = getTodayAggregates({
    asOf,
    goals: g ? {
      dailyBudgetCents: g.dailyBudgetCents,
      dailyMoveMinutes: g.dailyMoveMinutes,
      dailyRitualTarget: g.dailyRitualTarget,
    } : { dailyBudgetCents: 0, dailyMoveMinutes: 0, dailyRitualTarget: 0 },
    activeRituals,
    spending,
    movement,
    ritualEntries: rEntries,
  });

  const recentEntries = await getRecentEntries(db, 20);
  return { today, recentEntries };
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- pal/__tests__/context`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/pal/context.ts lib/pal/__tests__/context.test.ts
git commit -m "feat(pal): buildContext composes today + recent entries"
```

---

## Task 13: Pal `route()` orchestrator (TDD)

**Files:**
- Create: `lib/pal/route.ts`
- Create: `lib/pal/__tests__/route.test.ts`

- [x] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { describe, expect, it, jest } from '@jest/globals';
import type { ParseResponse } from '@/lib/api-types';

const parseMock = jest.fn<Promise<ParseResponse>, [string]>();
const chatStreamMock = jest.fn();
const insertEntryMock = jest.fn(async () => {});

jest.mock('../client', () => ({
  parse: (text: string) => parseMock(text),
  chatStream: (req: unknown, cb: unknown) => chatStreamMock(req, cb),
}));
jest.mock('@/lib/db/queries/insertEntry', () => ({
  insertEntry: (...args: unknown[]) => insertEntryMock(...args as [unknown, ParseResponse]),
}));

import { route } from '../route';
import { ValidationError } from '../errors';

const callbacks = () => ({
  onAssistantStart: jest.fn(),
  onChunk: jest.fn(),
  onDone: jest.fn(),
  onError: jest.fn(),
  onCommit: jest.fn(),
  onConfirmNeeded: jest.fn(),
});

const ctx = { messagesForChat: [{ role: 'user' as const, content: 'hi' }], context: { today: {}, recentEntries: [] } };

describe('route()', () => {
  beforeEach(() => { parseMock.mockReset(); chatStreamMock.mockReset(); insertEntryMock.mockClear(); });

  it('chat → calls chatStream, no insertEntry', async () => {
    parseMock.mockResolvedValue({ kind: 'chat', confidence: 'high', raw: 'hi' });
    const cb = callbacks();
    await route('hi', ctx, {} as never, cb);
    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    expect(insertEntryMock).not.toHaveBeenCalled();
    expect(cb.onAssistantStart).toHaveBeenCalled();
  });

  it('high-confidence spend → insertEntry + onCommit, no chatStream', async () => {
    const r: ParseResponse = { kind: 'spend', data: { amount: 5, currency: 'USD' }, confidence: 'high', raw: '$5' };
    parseMock.mockResolvedValue(r);
    const cb = callbacks();
    await route('$5', ctx, { db: 'fake' } as never, cb);
    expect(insertEntryMock).toHaveBeenCalledWith('fake', r);
    expect(cb.onCommit).toHaveBeenCalledWith(r);
    expect(chatStreamMock).not.toHaveBeenCalled();
  });

  it('low-confidence workout → onConfirmNeeded only', async () => {
    const r: ParseResponse = { kind: 'workout', data: { durationMin: 30 }, confidence: 'low', raw: 'ran 30' };
    parseMock.mockResolvedValue(r);
    const cb = callbacks();
    await route('ran 30', ctx, {} as never, cb);
    expect(insertEntryMock).not.toHaveBeenCalled();
    expect(chatStreamMock).not.toHaveBeenCalled();
    expect(cb.onConfirmNeeded).toHaveBeenCalledWith(r);
  });

  it('parse ValidationError → falls through to chatStream', async () => {
    parseMock.mockRejectedValue(new ValidationError('bad'));
    const cb = callbacks();
    await route('weird', ctx, {} as never, cb);
    expect(chatStreamMock).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it('parse network error → onError, no chat', async () => {
    parseMock.mockRejectedValue(new Error('boom'));
    const cb = callbacks();
    await route('x', ctx, {} as never, cb);
    expect(cb.onError).toHaveBeenCalled();
    expect(chatStreamMock).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run — fails**

Run: `npm test -- pal/__tests__/route`
Expected: FAIL.

- [x] **Step 3: Implement `lib/pal/route.ts`**

```ts
import type { ParseResponse } from '@/lib/api-types';
import { parse, chatStream, type ChatMessage } from './client';
import { insertEntry } from '@/lib/db/queries/insertEntry';
import { ValidationError, messageFor } from './errors';
import type { AnyDb } from '@/lib/db/queries/onboarding';
import type { PalContext } from './context';

export type RouteCallbacks = {
  onAssistantStart(id: string): void;
  onChunk(id: string, delta: string): void;
  onDone(id: string): void;
  onError(id: string, message: string): void;
  onCommit(entry: ParseResponse): void;
  onConfirmNeeded(entry: ParseResponse): void;
};

export type RouteContext = {
  messagesForChat: ChatMessage[];
  context: PalContext | object;
};

let _idSeq = 0;
const newId = () => `b${Date.now()}_${++_idSeq}`;

function startChat(ctx: RouteContext, cb: RouteCallbacks): { abort: () => void } {
  const id = newId();
  cb.onAssistantStart(id);
  return chatStream(
    { messages: ctx.messagesForChat, context: ctx.context as never },
    {
      onChunk: (d) => cb.onChunk(id, d),
      onDone: () => cb.onDone(id),
      onError: (_code, msg) => cb.onError(id, msg),
    },
  );
}

export async function route(
  text: string,
  ctx: RouteContext,
  deps: { db: AnyDb },
  cb: RouteCallbacks,
): Promise<{ abort: () => void } | undefined> {
  let r: ParseResponse;
  try {
    r = await parse(text);
  } catch (err) {
    // ValidationError = model emitted JSON that didn't fit any kind. Treat as chat.
    if (err instanceof ValidationError) {
      return startChat(ctx, cb);
    }
    cb.onError(newId(), messageFor(err));
    return undefined;
  }

  if (r.kind === 'chat') return startChat(ctx, cb);

  if (r.confidence === 'high') {
    try { await insertEntry(deps.db, r); }
    catch { cb.onError(newId(), "Couldn't save the entry — try again."); return undefined; }
    cb.onCommit(r);
    return undefined;
  }

  cb.onConfirmNeeded(r);
  return undefined;
}
```

- [x] **Step 4: Run — passes**

Run: `npm test -- pal/__tests__/route`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add lib/pal/route.ts lib/pal/__tests__/route.test.ts
git commit -m "feat(pal): route() parse-first orchestrator with chat fallback"
```

---

## Task 14: `Bubble` and `TypingDots` components

**Files:**
- Create: `components/pal/Bubble.tsx`
- Create: `components/pal/TypingDots.tsx`

- [x] **Step 1: Write `components/pal/TypingDots.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

export function TypingDots() {
  const [n, setN] = useState(1);
  useEffect(() => {
    const t = setInterval(() => setN((v) => (v % 3) + 1), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <View className="flex-row gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <View key={i} className={i < n ? 'h-1.5 w-1.5 rounded-full bg-ink3' : 'h-1.5 w-1.5 rounded-full bg-fill'} />
      ))}
      <Text className="sr-only">Pal is typing</Text>
    </View>
  );
}
```

- [x] **Step 2: Write `components/pal/Bubble.tsx`**

```tsx
import { Text, View } from 'react-native';

export function Bubble({ role, text }: { role: 'user' | 'assistant'; text: string }) {
  const isUser = role === 'user';
  return (
    <View className={isUser ? 'self-end mb-2 max-w-[76%]' : 'self-start mb-2 max-w-[76%]'}>
      <View
        className={
          isUser
            ? 'px-3 py-2 rounded-2xl rounded-br-md bg-accent'
            : 'px-3 py-2 rounded-2xl rounded-bl-md bg-fill'
        }
      >
        <Text className={isUser ? 'text-body text-white' : 'text-body text-ink'}>{text}</Text>
      </View>
    </View>
  );
}
```

- [x] **Step 3: Commit**

```bash
git add components/pal/Bubble.tsx components/pal/TypingDots.tsx
git commit -m "feat(pal-ui): Bubble + TypingDots"
```

---

## Task 15: `StarterChips` component

**Files:**
- Create: `components/pal/StarterChips.tsx`

- [x] **Step 1: Write the file**

```tsx
import { Pressable, Text, View } from 'react-native';

export type Starter = { label: string; tone: 'money' | 'move' | 'rituals' | 'accent' };

const STARTERS: Starter[] = [
  { label: 'Verve coffee, $5',      tone: 'money' },
  { label: 'Ran 30 minutes',         tone: 'move' },
  { label: "How's my week so far?",  tone: 'accent' },
];

export function StarterChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <View className="px-4 pb-3">
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Try saying</Text>
      <View className="gap-2">
        {STARTERS.map((s) => (
          <Pressable
            key={s.label}
            onPress={() => onPick(s.label)}
            className="flex-row items-center px-3 py-2.5 bg-surface border border-hair rounded-xl"
          >
            <View className={
              s.tone === 'money'  ? 'h-2 w-2 rounded-full bg-money mr-3'
              : s.tone === 'move' ? 'h-2 w-2 rounded-full bg-move mr-3'
              : s.tone === 'rituals' ? 'h-2 w-2 rounded-full bg-rituals mr-3'
              : 'h-2 w-2 rounded-full bg-accent mr-3'
            } />
            <Text className="flex-1 text-callout text-ink">{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add components/pal/StarterChips.tsx
git commit -m "feat(pal-ui): StarterChips"
```

---

## Task 16: `ConfirmEntryBubble` component

**Files:**
- Create: `components/pal/ConfirmEntryBubble.tsx`

- [x] **Step 1: Write the file**

```tsx
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ParseResponse } from '@/lib/api-types';

type Props = {
  entry: Extract<ParseResponse, { kind: 'spend' | 'workout' }>;
  status: 'pending' | 'committed' | 'discarded';
  onConfirm(updated: typeof entry): void;
  onDiscard(): void;
};

export function ConfirmEntryBubble({ entry, status, onConfirm, onDiscard }: Props) {
  const disabled = status !== 'pending';
  if (entry.kind === 'spend') return <SpendForm entry={entry} disabled={disabled} status={status} onConfirm={onConfirm} onDiscard={onDiscard} />;
  return <WorkoutForm entry={entry} disabled={disabled} status={status} onConfirm={onConfirm} onDiscard={onDiscard} />;
}

function SpendForm({ entry, disabled, status, onConfirm, onDiscard }: {
  entry: Extract<ParseResponse, { kind: 'spend' }>;
  disabled: boolean;
  status: Props['status'];
  onConfirm: Props['onConfirm'];
  onDiscard: Props['onDiscard'];
}) {
  const [amount, setAmount] = useState(String(entry.data.amount));
  const [merchant, setMerchant] = useState(entry.data.merchant ?? '');
  const [category, setCategory] = useState(entry.data.category ?? '');
  const valid = !disabled && Number.isFinite(Number(amount)) && Number(amount) > 0;

  return (
    <View className={'self-start mb-2 max-w-[88%] bg-surface border border-hair rounded-2xl p-3 ' + (status === 'discarded' ? 'opacity-50' : '')}>
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Spend · low confidence</Text>
      <Field label="Amount ($)"  value={amount}   onChangeText={setAmount}   disabled={disabled} keyboardType="decimal-pad" />
      <Field label="Merchant"    value={merchant} onChangeText={setMerchant} disabled={disabled} />
      <Field label="Category"    value={category} onChangeText={setCategory} disabled={disabled} />
      {!disabled && (
        <View className="flex-row gap-2 mt-2">
          <Pressable
            disabled={!valid}
            onPress={() => onConfirm({ ...entry, data: { ...entry.data, amount: Number(amount), merchant: merchant || undefined, category: category || undefined } })}
            className={valid ? 'flex-1 bg-money rounded-xl py-2.5 items-center' : 'flex-1 bg-fill rounded-xl py-2.5 items-center'}
          >
            <Text className={valid ? 'text-subhead text-white' : 'text-subhead text-ink3'}>Confirm</Text>
          </Pressable>
          <Pressable onPress={onDiscard} className="flex-1 bg-fill rounded-xl py-2.5 items-center">
            <Text className="text-subhead text-ink">Discard</Text>
          </Pressable>
        </View>
      )}
      {status === 'committed' && <Text className="text-caption1 text-move mt-2">Logged.</Text>}
    </View>
  );
}

function WorkoutForm({ entry, disabled, status, onConfirm, onDiscard }: {
  entry: Extract<ParseResponse, { kind: 'workout' }>;
  disabled: boolean;
  status: Props['status'];
  onConfirm: Props['onConfirm'];
  onDiscard: Props['onDiscard'];
}) {
  const [minutes, setMinutes] = useState(entry.data.durationMin != null ? String(entry.data.durationMin) : '');
  const [routine, setRoutine] = useState(entry.data.routine ?? '');
  const valid = !disabled && Number.isFinite(Number(minutes)) && Number(minutes) > 0;

  return (
    <View className={'self-start mb-2 max-w-[88%] bg-surface border border-hair rounded-2xl p-3 ' + (status === 'discarded' ? 'opacity-50' : '')}>
      <Text className="text-caption1 text-ink3 uppercase tracking-wider mb-2">Workout · low confidence</Text>
      <Field label="Minutes" value={minutes} onChangeText={setMinutes} disabled={disabled} keyboardType="number-pad" />
      <Field label="Kind"    value={routine} onChangeText={setRoutine} disabled={disabled} />
      {!disabled && (
        <View className="flex-row gap-2 mt-2">
          <Pressable
            disabled={!valid}
            onPress={() => onConfirm({ ...entry, data: { ...entry.data, durationMin: Number(minutes), routine: routine || undefined } })}
            className={valid ? 'flex-1 bg-move rounded-xl py-2.5 items-center' : 'flex-1 bg-fill rounded-xl py-2.5 items-center'}
          >
            <Text className={valid ? 'text-subhead text-white' : 'text-subhead text-ink3'}>Confirm</Text>
          </Pressable>
          <Pressable onPress={onDiscard} className="flex-1 bg-fill rounded-xl py-2.5 items-center">
            <Text className="text-subhead text-ink">Discard</Text>
          </Pressable>
        </View>
      )}
      {status === 'committed' && <Text className="text-caption1 text-move mt-2">Logged.</Text>}
    </View>
  );
}

function Field({ label, value, onChangeText, disabled, keyboardType }: {
  label: string;
  value: string;
  onChangeText: (s: string) => void;
  disabled: boolean;
  keyboardType?: 'decimal-pad' | 'number-pad';
}) {
  return (
    <View className="mb-2">
      <Text className="text-caption2 text-ink3 mb-1">{label}</Text>
      <TextInput
        editable={!disabled}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        className="bg-fill rounded-lg px-3 py-2 text-body text-ink"
      />
    </View>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add components/pal/ConfirmEntryBubble.tsx
git commit -m "feat(pal-ui): ConfirmEntryBubble (spend + workout) with edit + confirm"
```

---

## Task 17: `PalComposer` component

**Files:**
- Create: `components/PalComposer.tsx`

- [x] **Step 1: Write the file**

```tsx
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bubble } from './pal/Bubble';
import { TypingDots } from './pal/TypingDots';
import { StarterChips } from './pal/StarterChips';
import { ConfirmEntryBubble } from './pal/ConfirmEntryBubble';

import { db } from '@/lib/db/client';
import { buildContext } from '@/lib/pal/context';
import { route } from '@/lib/pal/route';
import { insertEntry } from '@/lib/db/queries/insertEntry';
import type { ChatMessage } from '@/lib/pal/client';
import type { ParseResponse } from '@/lib/api-types';

type Bubble =
  | { id: string; kind: 'user'; text: string }
  | { id: string; kind: 'assistant'; text: string; streaming?: boolean }
  | { id: string; kind: 'confirm'; entry: Extract<ParseResponse, { kind: 'spend' | 'workout' }>; status: 'pending' | 'committed' | 'discarded' };

let _seq = 0;
const newId = () => `b${Date.now()}_${++_seq}`;

export function PalComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const expanded = messages.length > 0 || pending;
  const abortRef = useRef<{ abort: () => void } | undefined>(undefined);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!visible) {
      abortRef.current?.abort();
      abortRef.current = undefined;
      setMessages([]);
      setInput('');
      setPending(false);
    }
  }, [visible]);

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    const userBubble: Bubble = { id: newId(), kind: 'user', text: trimmed };
    setMessages((prev) => [...prev, userBubble]);
    setInput('');
    setPending(true);

    const ctx = await buildContext(db);
    const messagesForChat: ChatMessage[] = [...messages, userBubble]
      .filter((m): m is Extract<Bubble, { kind: 'user' | 'assistant' }> => m.kind === 'user' || m.kind === 'assistant')
      .map((m) => ({ role: m.kind, content: m.text }));

    const handle = await route(
      trimmed,
      { messagesForChat, context: ctx },
      { db },
      {
        onAssistantStart: (id) =>
          setMessages((prev) => [...prev, { id, kind: 'assistant', text: '', streaming: true }]),
        onChunk: (id, delta) =>
          setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'assistant' ? { ...m, text: m.text + delta } : m))),
        onDone: (id) => {
          setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'assistant' ? { ...m, streaming: false } : m)));
          setPending(false);
        },
        onError: (id, msg) => {
          setMessages((prev) => {
            const existing = prev.find((m) => m.id === id);
            if (existing && existing.kind === 'assistant') {
              return prev.map((m) => (m.id === id ? { id, kind: 'assistant', text: msg } : m));
            }
            return [...prev, { id, kind: 'assistant', text: msg }];
          });
          setInput(trimmed);
          setPending(false);
        },
        onCommit: (entry) => {
          const summary = entry.kind === 'spend'
            ? `Logged ${entry.data.merchant ?? 'spend'} — $${entry.data.amount.toFixed(2)} on Money ring.`
            : `Logged ${entry.data.routine ?? 'workout'} — ${entry.data.durationMin}m on Move ring.`;
          setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: summary }]);
          setPending(false);
        },
        onConfirmNeeded: (entry) => {
          if (entry.kind !== 'spend' && entry.kind !== 'workout') return;
          setMessages((prev) => [...prev, { id: newId(), kind: 'confirm', entry, status: 'pending' }]);
          setPending(false);
        },
      },
    );
    abortRef.current = handle;
  };

  const onConfirmEntry = async (id: string, updated: Extract<ParseResponse, { kind: 'spend' | 'workout' }>) => {
    try { await insertEntry(db, updated); }
    catch {
      setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: "Couldn't save the entry — try again." }]);
      return;
    }
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'confirm' ? { ...m, entry: updated, status: 'committed' } : m)));
    const summary = updated.kind === 'spend'
      ? `Logged ${updated.data.merchant ?? 'spend'} — $${updated.data.amount.toFixed(2)} on Money ring.`
      : `Logged ${updated.data.routine ?? 'workout'} — ${updated.data.durationMin}m on Move ring.`;
    setMessages((prev) => [...prev, { id: newId(), kind: 'assistant', text: summary }]);
  };

  const onDiscardEntry = (id: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id && m.kind === 'confirm' ? { ...m, status: 'discarded' } : m)));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/40" onPress={onClose}>
        <Pressable
          onPress={() => {}}
          className={expanded ? 'mt-auto bg-bg rounded-t-3xl' : 'mt-auto bg-bg rounded-t-3xl'}
          style={{ height: expanded ? '86%' : 'auto' }}
        >
          <SafeAreaView edges={['bottom']}>
            <View className="items-center pt-2">
              <View className="h-1.5 w-9 rounded-full bg-hair" />
            </View>
            <View className="flex-row items-center px-4 py-2">
              <View className="h-8 w-8 rounded-full bg-accent items-center justify-center">
                <Text className="text-white text-callout">✦</Text>
              </View>
              <View className="ml-2 flex-1">
                <Text className="text-callout text-ink">Pal</Text>
                <Text className="text-caption2 text-ink3">Log, ask, or start anything</Text>
              </View>
              <Pressable onPress={onClose} className="h-8 w-8 rounded-full bg-fill items-center justify-center">
                <Text className="text-ink3">✕</Text>
              </Pressable>
            </View>

            {expanded && (
              <ScrollView ref={scrollRef} className="flex-1 px-4">
                {messages.map((m) => {
                  if (m.kind === 'user' || m.kind === 'assistant') {
                    return <Bubble key={m.id} role={m.kind} text={m.text || (m.streaming ? '…' : '')} />;
                  }
                  return (
                    <ConfirmEntryBubble
                      key={m.id}
                      entry={m.entry}
                      status={m.status}
                      onConfirm={(updated) => onConfirmEntry(m.id, updated)}
                      onDiscard={() => onDiscardEntry(m.id)}
                    />
                  );
                })}
                {pending && messages[messages.length - 1]?.kind !== 'assistant' && <TypingDots />}
              </ScrollView>
            )}

            {!expanded && <StarterChips onPick={send} />}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View className="flex-row items-end px-3 pb-3 pt-2 gap-2 border-t border-hair">
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  placeholder={expanded ? 'Reply or log something…' : 'Log a coffee, ask about your week…'}
                  multiline
                  className="flex-1 bg-fill rounded-2xl px-3 py-2 text-body text-ink max-h-24"
                />
                <Pressable
                  onPress={() => send(input)}
                  disabled={!input.trim() || pending}
                  className={input.trim() && !pending ? 'h-9 w-9 rounded-full bg-accent items-center justify-center' : 'h-9 w-9 rounded-full bg-fill items-center justify-center'}
                >
                  <Text className={input.trim() && !pending ? 'text-white' : 'text-ink3'}>↑</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [x] **Step 2: Commit**

```bash
git add components/PalComposer.tsx
git commit -m "feat(pal): PalComposer modal sheet wires route + confirm flow"
```

---

## Task 18: Convert `today.tsx` into a stack and host the FAB

**Files:**
- Delete: `app/(tabs)/today.tsx`
- Create: `app/(tabs)/today/_layout.tsx`
- Create: `app/(tabs)/today/index.tsx` *(content moved from old `today.tsx`)*

- [x] **Step 1: Move existing screen body**

Read `app/(tabs)/today.tsx` (whatever SP3a put there — likely a stub or rings preview). Copy its content verbatim into a new file `app/(tabs)/today/index.tsx`.

- [x] **Step 2: Add a FAB and money tap-through to `app/(tabs)/today/index.tsx`**

At the top of the file:

```tsx
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PalComposer } from '@/components/PalComposer';
```

Inside the screen component, declare state:

```tsx
const router = useRouter();
const [palOpen, setPalOpen] = useState(false);
```

Wrap the existing money stat block (or whatever currently shows `$X.XX`) in a `Pressable` that calls `router.push('/(tabs)/today/spending')`. Then add the FAB and composer at the end of the JSX, just before the closing root tag:

```tsx
<Pressable
  onPress={() => setPalOpen(true)}
  className="absolute bottom-6 right-6 h-14 w-14 rounded-full bg-accent items-center justify-center shadow-lg"
>
  <Text className="text-white text-title2">＋</Text>
</Pressable>
<PalComposer visible={palOpen} onClose={() => setPalOpen(false)} />
```

If the existing screen is a bare stub (no money block yet), add a placeholder pressable:

```tsx
<Pressable onPress={() => router.push('/(tabs)/today/spending')} className="m-4 p-4 bg-surface rounded-2xl">
  <Text className="text-caption1 text-ink3 uppercase">Money</Text>
  <Text className="text-title1 text-ink mt-1">$0.00</Text>
  <Text className="text-caption1 text-ink3 mt-1">Tap for today's spending</Text>
</Pressable>
```

- [x] **Step 3: Write `app/(tabs)/today/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function TodayLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 4: Delete the old `app/(tabs)/today.tsx`**

```bash
git rm app/(tabs)/today.tsx
```

- [x] **Step 5: Verify dev server starts and Today still routes**

Run: `npm run web` (in another terminal)
Open the app: Today tab still renders. FAB visible. Tap FAB → composer opens compact with starter chips.

- [x] **Step 6: Commit**

```bash
git add app/\(tabs\)/today
git commit -m "feat(today): stack layout + FAB hosting PalComposer + spending tap-through"
```

---

## Task 19: Spending Detail screen

**Files:**
- Create: `app/(tabs)/today/spending.tsx`

- [x] **Step 1: Write the file**

```tsx
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getTodaySpend, type TodaySpend } from '@/lib/db/queries/todaySpend';

const HHMM = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fmt$ = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function SpendingDetail() {
  const router = useRouter();
  const [data, setData] = useState<TodaySpend>({ totalCents: 0, budgetCents: 0, entries: [] });

  // SP3a's useLiveQuery is the canonical reactive read; if not yet wired here,
  // a manual refresh on focus is sufficient for v1.
  useEffect(() => {
    let live = true;
    (async () => {
      const r = await getTodaySpend(db, new Date());
      if (live) setData(r);
    })();
    return () => { live = false; };
  }, []);

  const overBudget = data.budgetCents > 0 && data.totalCents > data.budgetCents;
  const pct = data.budgetCents > 0 ? Math.min(1, data.totalCents / data.budgetCents) : 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 rounded-full bg-fill items-center justify-center">
          <Text className="text-ink">‹</Text>
        </Pressable>
        <Text className="ml-3 text-headline text-ink">Spending today</Text>
      </View>

      <View className="px-4 py-3">
        <Text className="text-largeTitle text-ink">{fmt$(data.totalCents)}</Text>
        <Text className="text-subhead text-ink3 mt-1">
          of {fmt$(data.budgetCents)} daily budget
        </Text>
        <View className="h-2 mt-3 rounded-full bg-fill overflow-hidden">
          <View
            className={overBudget ? 'h-full bg-money' : 'h-full bg-money'}
            style={{ width: `${Math.round(pct * 100)}%`, opacity: overBudget ? 1 : 0.7 }}
          />
        </View>
        {overBudget && (
          <Text className="text-caption1 text-money mt-2">Over budget by {fmt$(data.totalCents - data.budgetCents)}</Text>
        )}
      </View>

      <ScrollView className="flex-1 px-4">
        {data.entries.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-body text-ink3">No spending logged today.</Text>
          </View>
        ) : (
          data.entries.map((e) => (
            <View key={e.id} className="flex-row items-center py-3 border-b border-hair">
              <Text className="text-callout text-ink3 w-12">{HHMM(e.occurredAt)}</Text>
              <View className="flex-1">
                <Text className="text-callout text-ink">{e.note ?? e.category ?? 'Spending'}</Text>
                {e.category && e.note && <Text className="text-caption1 text-ink3">{e.category}</Text>}
              </View>
              <Text className="text-callout text-ink">−{fmt$(e.cents)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Verify route works**

In the running dev server, tap the money block on Today → Spending Detail renders. Empty state if no entries; back-swipe (or the `‹` button) returns to Today.

- [x] **Step 3: Commit**

```bash
git add app/\(tabs\)/today/spending.tsx
git commit -m "feat(today): Spending Detail screen"
```

---

## Task 20: End-to-end smoke test + meta-spec status update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-25-implementation-process-design.md`

- [x] **Step 1: Run automated verification**

Run (from project root):

```bash
npm test
```

Expected: PASS for all jest suites including the new Pal tests.

```bash
cd backend && npm test && cd ..
```

Expected: PASS for all vitest suites including the updated parse tests.

- [x] **Step 2: Run the smoke test on web**

```bash
npm run web
```

Walk through, in order:

1. Onboarding completes (or already complete from SP3a). Land on Today with a FAB visible bottom-right.
2. Tap FAB → PalComposer opens compact, starter chips visible.
3. Tap chip *"Verve coffee, $5"* → confirmation message bubble appears: *"Logged Verve — $5.00 on Money ring."* (high-confidence path).
4. Type `ran 30 minutes` → low-confidence confirm bubble appears with editable Minutes / Kind. Tap **Confirm** → bubble shows "Logged."; assistant message confirms; Move ring updates on Today.
5. Type `how am I doing this week?` → assistant bubble streams in incrementally. (If the dev backend isn't deployed, expect an error bubble — the UI path is what's being verified here.)
6. Close the sheet (drag down or `✕`) → reopen → empty state restored.
7. Back on Today, tap the money block → Spending Detail shows the Verve entry, today's total, and budget bar.
8. Force backend offline (stop the dev backend) → submit text → an error bubble appears, input is restored to the textarea.

- [x] **Step 3: (Best-effort) iPhone Expo Go**

If iPhone available: scan the Metro QR with Expo Go and re-run the smoke test on device. Note any platform-specific regressions. Not blocking SP3b sign-off.

- [x] **Step 4: Update meta-spec status row for SP3b**

In `docs/superpowers/specs/2026-04-25-implementation-process-design.md`, replace the SP3b row:

```
| 3b | iOS v1 — entry + Pal | ✅ Code complete 2026-04-25 — PalComposer wired with parse-first router; Spending Detail shipped. Backend `/parse` amended (food dropped, chat added). Smoke test verified on web. iPhone Expo Go verification deferred (not blocking). |
```

- [x] **Step 5: Final commit**

```bash
git add docs/superpowers/specs/2026-04-25-implementation-process-design.md
git commit -m "docs: mark SP3b code complete"
```

---

## Self-review checklist (already run inline; documenting for future me)

- **Spec coverage.**
  - §3 backend amendment → Tasks 1–4. ✓
  - §4 architecture (file map) → Task list mirrors it. ✓
  - §5 components → Tasks 14–17. ✓
  - §6 client + router → Tasks 6–8, 12, 13. ✓
  - §7 data flow → exercised by Task 17 (composer wiring) + 19 (spending detail). ✓
  - §7.1 entry mapping → Task 9 (covers spend cents + workout sets summary + duration enforcement). ✓
  - §7.2 todaySpend → Task 11. ✓
  - §8 error handling → covered in route.ts (Task 13), client errors (Task 6), composer error bubble (Task 17). ✓
  - §9 testing → Tasks 7, 8, 9, 10, 11, 12, 13. ✓
  - §11 open item (workout without duration) → Task 9 throws in `mapToRow`; Task 16's WorkoutForm requires `minutes > 0` to enable Confirm. ✓
- **Placeholders.** None. All steps have concrete code.
- **Type consistency.** `ParseResponse` shape narrowed identically across api-types (Task 1), schema (Task 2), client tests (Task 7), insertEntry (Task 9), route (Task 13), composer (Task 17). `AnyDb` reused from SP3a's `onboarding.ts` throughout. `ChatMessage`/`ChatRequest` declared in `client.ts` (Task 8) and consumed by `route.ts` (Task 13) and composer (Task 17).
