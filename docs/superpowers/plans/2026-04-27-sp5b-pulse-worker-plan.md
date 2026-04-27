# SP5b — `pulse-worker` Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the IMAP-polling worker that turns `imap_accounts` rows into `synced_entries` rows, plus the encryption primitive 5c will reuse and a one-off admin seeder for getting Gmail app passwords into the database.

**Architecture:** A new `worker` Docker compose service (peer to `backend`, sharing the same SQLite bind-mount) running a `setInterval`-driven Node process. The worker decrypts per-account credentials, polls Gmail via `imapflow`, parses bank-alert emails through an extracted `parseEntry()` lib (used in-process, not over HTTP), and writes `synced_entries` + `imap_uids` rows. No new schema; no new HTTP routes (those are 5c).

**Tech Stack:** Node 22, TypeScript (strict, ESM), Drizzle ORM + `better-sqlite3` (existing), Express (HTTP only — worker has no HTTP), Zod, vitest, pino. New deps: `imapflow`, `mailparser`.

**Spec:** [`docs/superpowers/specs/2026-04-27-sp5b-pulse-worker-design.md`](../specs/2026-04-27-sp5b-pulse-worker-design.md)

**All commands run from the `backend/` directory unless otherwise noted.** When modifying files outside `backend/` (compose.yml is in `backend/deploy/`, GH workflow is in `.github/workflows/`), the path is given absolutely.

**Working dir baseline check before starting:** `git status` should show a clean tree (the spec is already committed). If `docs/superpowers/plans/2026-04-26-sp4g-live-activities-plan.md` and the `sp4g-live-activities-design.md` are untracked, leave them alone — they are prior work outside this plan.

---

## Task 1: Install new dependencies

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json` (auto)

- [ ] **Step 1: Add deps**

Edit `backend/package.json`. In `"dependencies"`, add (preserving alphabetical order):

```json
    "imapflow": "^1.0.176",
    "mailparser": "^3.7.2",
```

In `"devDependencies"`, add:

```json
    "@types/mailparser": "^3.4.5",
```

(Use these floor versions; `npm install` will pick the latest matching minor.)

- [ ] **Step 2: Install**

```bash
cd backend && npm install
```

Expected: `package-lock.json` updates; new `node_modules/imapflow`, `node_modules/mailparser` directories appear.

- [ ] **Step 3: Run existing tests to confirm no regression**

```bash
cd backend && npm test
```

Expected: all existing tests pass (102 SP2 + 25 SP5a tests, ~127 total).

- [ ] **Step 4: Commit**

```bash
git add backend/package.json backend/package-lock.json
git commit -m "deps(backend): add imapflow + mailparser for SP5b worker"
```

---

## Task 2: Encryption module (`lib/crypto/credentials.ts`)

**Files:**
- Create: `backend/src/lib/crypto/credentials.ts`
- Create: `backend/test/unit/crypto-credentials.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/crypto-credentials.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { encryptCredential, decryptCredential } from "../../src/lib/crypto/credentials.js";

const KEY_HEX = "a".repeat(64); // 32 bytes hex
const OTHER_KEY_HEX = "b".repeat(64);

describe("encryptCredential / decryptCredential", () => {
  it("round-trips a string", () => {
    const ct = encryptCredential("hunter2", KEY_HEX);
    expect(decryptCredential(ct, KEY_HEX)).toBe("hunter2");
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const ct1 = encryptCredential("same", KEY_HEX);
    const ct2 = encryptCredential("same", KEY_HEX);
    expect(ct1).not.toBe(ct2);
  });

  it("decryption with the wrong key throws", () => {
    const ct = encryptCredential("secret", KEY_HEX);
    expect(() => decryptCredential(ct, OTHER_KEY_HEX)).toThrow();
  });

  it("decryption fails closed on tampered ciphertext", () => {
    const ct = encryptCredential("secret", KEY_HEX);
    const buf = Buffer.from(ct, "base64");
    // Flip a byte in the middle (ciphertext region, between IV and tag)
    buf[15] ^= 0x01;
    const tampered = buf.toString("base64");
    expect(() => decryptCredential(tampered, KEY_HEX)).toThrow();
  });

  it("rejects malformed key (not 64 hex chars)", () => {
    expect(() => encryptCredential("x", "abc")).toThrow();
  });

  it("generates 10k unique IVs across 10k encrypts", () => {
    const ivs = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const ct = encryptCredential("x", KEY_HEX);
      const iv = Buffer.from(ct, "base64").subarray(0, 12).toString("hex");
      ivs.add(iv);
    }
    expect(ivs.size).toBe(10_000);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/crypto-credentials.test.ts
```

Expected: all tests fail with "Cannot find module" or similar — the implementation file doesn't exist yet.

- [ ] **Step 3: Implement the module**

Create `backend/src/lib/crypto/credentials.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX_REGEX = /^[0-9a-fA-F]{64}$/;

function decodeKey(keyHex: string): Buffer {
  if (!KEY_HEX_REGEX.test(keyHex)) {
    throw new Error("encryption key must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(keyHex, "hex");
}

/**
 * AES-256-GCM. Output format: base64(12-byte IV ‖ ciphertext ‖ 16-byte authTag).
 * Per-encrypt random IV via crypto.randomBytes(12).
 */
export function encryptCredential(plaintext: string, keyHex: string): string {
  const key = decodeKey(keyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString("base64");
}

/**
 * Inverse of encryptCredential. Throws if the auth tag fails verification
 * (wrong key, tampered ciphertext, or tampered tag).
 */
export function decryptCredential(ciphertextB64: string, keyHex: string): string {
  const key = decodeKey(keyHex);
  const buf = Buffer.from(ciphertextB64, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("ciphertext too short");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const ct = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/crypto-credentials.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/crypto/credentials.ts backend/test/unit/crypto-credentials.test.ts
git commit -m "feat(sp5b): AES-256-GCM credential encryption module"
```

---

## Task 3: Email plaintext extraction (`lib/email/extract.ts`)

**Files:**
- Create: `backend/src/lib/email/extract.ts`
- Create: `backend/test/unit/email-extract.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/email-extract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractPlaintext } from "../../src/lib/email/extract.js";

function rawEmail(parts: { headers: string; body: string }): Buffer {
  return Buffer.from(parts.headers + "\r\n\r\n" + parts.body, "utf8");
}

describe("extractPlaintext", () => {
  it("returns text/plain body when message is text/plain", async () => {
    const raw = rawEmail({
      headers:
        "From: bank@example.com\r\n" +
        "To: me@example.com\r\n" +
        "Subject: Charge alert\r\n" +
        "Content-Type: text/plain; charset=utf-8\r\n",
      body: "You spent $5.75 at Verve Coffee.",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("You spent $5.75 at Verve Coffee.");
  });

  it("returns html-converted-to-text when message is text/html only", async () => {
    const raw = rawEmail({
      headers:
        "From: bank@example.com\r\n" +
        "Subject: Charge alert\r\n" +
        "Content-Type: text/html; charset=utf-8\r\n",
      body: "<p>You spent <b>$5.75</b> at Verve Coffee.</p>",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("$5.75");
    expect(text).toContain("Verve Coffee");
    // tags should be stripped
    expect(text).not.toMatch(/<\w+>/);
  });

  it("returns empty string when message has no body content", async () => {
    const raw = rawEmail({
      headers: "From: x@y.z\r\nSubject: empty\r\nContent-Type: text/plain\r\n",
      body: "",
    });
    const text = await extractPlaintext(raw);
    expect(text).toBe("");
  });

  it("decodes HTML entities in html-only messages", async () => {
    const raw = rawEmail({
      headers: "Subject: t\r\nContent-Type: text/html\r\n",
      body: "<p>AT&amp;T billed you $9.99</p>",
    });
    const text = await extractPlaintext(raw);
    expect(text).toContain("AT&T");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/email-extract.test.ts
```

Expected: all 4 tests fail (module missing).

- [ ] **Step 3: Implement the module**

Create `backend/src/lib/email/extract.ts`:

```typescript
import { simpleParser } from "mailparser";

/**
 * Extracts plaintext from an RFC822 message buffer.
 * Returns parsed.text if present (mailparser fills this for text/plain parts
 * AND auto-converts text/html-only messages via its built-in html-to-text).
 * Returns '' when no extractable text exists.
 */
export async function extractPlaintext(rfc822: Buffer): Promise<string> {
  const parsed = await simpleParser(rfc822);
  return (parsed.text ?? "").trim();
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/email-extract.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/email/extract.ts backend/test/unit/email-extract.test.ts
git commit -m "feat(sp5b): email plaintext extraction via mailparser"
```

---

## Task 4: Recurring-detection heuristic (`worker/recurring.ts`)

**Files:**
- Create: `backend/src/worker/recurring.ts`
- Create: `backend/test/unit/recurring.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/recurring.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/recurring.test.ts
```

Expected: 7 tests fail.

- [ ] **Step 3: Implement the heuristic**

Create `backend/src/worker/recurring.ts`:

```typescript
import type { SyncedEntry } from "../db/schema.js";

/**
 * Decision §2 row 5: a candidate is recurring iff there exists ≥1 prior in
 * `priors` with the same currency and cents within ±10%. Caller is expected
 * to pre-filter `priors` to same-merchant + 60-day window (use the existing
 * `findRecurringCandidates` query).
 */
export function isRecurring(
  priors: readonly SyncedEntry[],
  candidate: { cents: number; currency: string },
): boolean {
  if (priors.length === 0) return false;
  const lower = candidate.cents * 0.9;
  const upper = candidate.cents * 1.1;
  return priors.some(
    (p) => p.currency === candidate.currency && p.cents >= lower && p.cents <= upper,
  );
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/recurring.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/worker/recurring.ts backend/test/unit/recurring.test.ts
git commit -m "feat(sp5b): recurring-detection heuristic (±10%, same currency)"
```

---

## Task 5: Backoff state machine (`worker/backoff.ts`)

**Files:**
- Create: `backend/src/worker/backoff.ts`
- Create: `backend/test/unit/backoff.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/backoff.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/backoff.test.ts
```

Expected: 6 tests fail (module missing).

- [ ] **Step 3: Implement the state machine**

Create `backend/src/worker/backoff.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/backoff.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/worker/backoff.ts backend/test/unit/backoff.test.ts
git commit -m "feat(sp5b): per-account backoff state machine"
```

---

## Task 6: Extract `parseEntry()` lib + thin route wrapper

**Files:**
- Create: `backend/src/lib/parse.ts`
- Create: `backend/test/unit/parse-lib.test.ts`
- Modify: `backend/src/routes/parse.ts`
- Modify: `backend/test/integration/parse.test.ts` (no changes expected; tests should still pass against the thin wrapper — confirm)

- [ ] **Step 1: Write the failing tests for the lib**

Create `backend/test/unit/parse-lib.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ZodError } from "zod";
import { parseEntry } from "../../src/lib/parse.js";
import { UpstreamError } from "../../src/middleware/errorHandler.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import { createLogger } from "../../src/lib/logger.js";

const logger = createLogger("fatal");
const modelId = "anthropic/claude-haiku-4.5";

function llmReturning(text: string): LlmClient {
  return {
    async *chatStream() {
      yield { delta: text };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

describe("parseEntry", () => {
  it("returns ParseResponse on a valid kind:spend reply", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "verve coffee 5.75",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "verve coffee 5.75" });
    expect(out.kind).toBe("spend");
    if (out.kind === "spend") {
      expect(out.data.amount).toBe(5.75);
      expect(out.confidence).toBe("high");
    }
  });

  it("forces `raw` to equal the input text (overriding model output)", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1, currency: "USD" },
        confidence: "high",
        raw: "WRONG",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "actual input" });
    expect(out.raw).toBe("actual input");
  });

  it("returns kind:chat for conversational input", async () => {
    const llm = llmReturning(
      JSON.stringify({ kind: "chat", confidence: "high", raw: "hi" }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "hi" });
    expect(out.kind).toBe("chat");
  });

  it("throws ZodError when the model returns non-JSON", async () => {
    const llm = llmReturning("not json at all");
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
  });

  it("throws ZodError when the model returns a kind we don't accept", async () => {
    const llm = llmReturning(
      JSON.stringify({ kind: "food", data: { items: [] }, confidence: "high", raw: "x" }),
    );
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
  });

  it("propagates UpstreamError when the LLM client rejects", async () => {
    const llm: LlmClient = {
      async *chatStream() {
        yield { delta: "" };
        yield { done: { inputTokens: 0, outputTokens: 0 } };
      },
      async chatJson() {
        throw new UpstreamError("network down");
      },
    };
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("logs raw model output on schema failure", async () => {
    const llm = llmReturning("not json");
    const warn = vi.fn();
    const fakeLogger = { ...logger, warn } as unknown as typeof logger;
    await expect(parseEntry({ llm, modelId, logger: fakeLogger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
    expect(warn).toHaveBeenCalled();
  });

  it("passes hint through to the prompt builder (smoke check via passing input)", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1, currency: "USD" },
        confidence: "high",
        raw: "x",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "x", hint: "spend" });
    expect(out.kind).toBe("spend");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/parse-lib.test.ts
```

Expected: 8 tests fail (module missing).

- [ ] **Step 3: Implement the lib**

Create `backend/src/lib/parse.ts`:

```typescript
import { ZodError } from "zod";
import type { ParseRequest, ParseResponse } from "@api-types";
import { ParseRequestSchema, ParseResponseSchema } from "../schemas/parse.js";
import { buildParseMessages } from "./prompts/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "./openrouter.js";
import type { Logger } from "./logger.js";

export type ParseEntryDeps = {
  llm: LlmClient;
  modelId: string;
  logger: Logger;
};

/**
 * Pure function over the parse contract. Used by:
 *   - the HTTP route `POST /parse` (thin wrapper)
 *   - the SP5b worker (in-process call from processAccount)
 *
 * Throws:
 *   - ZodError if input fails validation OR if model output isn't JSON OR fails schema
 *   - UpstreamError on LLM client failure (network / upstream provider)
 */
export async function parseEntry(
  deps: ParseEntryDeps,
  input: ParseRequest,
): Promise<ParseResponse> {
  const validated = ParseRequestSchema.parse(input);
  const { system, user } = buildParseMessages(validated.text, validated.hint);

  let text: string;
  try {
    const result = await deps.llm.chatJson({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: deps.modelId,
    });
    text = result.text;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(`parseEntry chatJson failed: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    deps.logger.warn({ modelOutput: text }, "parse: model did not return JSON");
    throw new ZodError([{ code: "custom", path: [], message: "model output was not valid JSON" }]);
  }

  if (parsed && typeof parsed === "object") {
    (parsed as { raw?: string }).raw = validated.text;
  }

  const out = ParseResponseSchema.safeParse(parsed);
  if (!out.success) {
    deps.logger.warn({ modelOutput: text }, "parse: model output failed schema");
    throw out.error;
  }
  return out.data;
}
```

- [ ] **Step 4: Run lib tests — expect pass**

```bash
cd backend && npx vitest run test/unit/parse-lib.test.ts
```

Expected: 8 passed.

- [ ] **Step 5: Refactor the HTTP route to be a thin wrapper**

Replace the contents of `backend/src/routes/parse.ts` with:

```typescript
import { Router, type Request, type Response, type NextFunction } from "express";
import { parseEntry, type ParseEntryDeps } from "../lib/parse.js";

export function parseRouter(deps: ParseEntryDeps): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = await parseEntry(deps, req.body);
      res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
```

- [ ] **Step 6: Run the existing parse integration tests — expect pass**

```bash
cd backend && npx vitest run test/integration/parse.test.ts
```

Expected: 7 passed (the existing tests at `backend/test/integration/parse.test.ts` continue to assert the HTTP envelope; they exercise the new thin wrapper unchanged).

- [ ] **Step 7: Run the full backend suite — expect pass**

```bash
cd backend && npm test
```

Expected: all tests pass (~135 total: 127 prior + 8 new lib tests).

- [ ] **Step 8: Commit**

```bash
git add backend/src/lib/parse.ts backend/src/routes/parse.ts backend/test/unit/parse-lib.test.ts
git commit -m "refactor(backend): extract parseEntry() lib; route becomes thin wrapper"
```

---

## Task 7: Config split (`config.ts` → http + worker)

**Files:**
- Modify: `backend/src/config.ts`
- Modify: `backend/test/unit/config.test.ts` (add worker-config tests; existing tests stay green)

- [ ] **Step 1: Read the existing config tests to understand the surface**

```bash
cat backend/test/unit/config.test.ts
```

Note the existing assertions; the new tests will live alongside them. (No change needed to existing tests if they import `loadConfig`; we keep `loadConfig` as an alias for `loadHttpConfig`.)

- [ ] **Step 2: Write failing tests for `loadWorkerConfig`**

Append to `backend/test/unit/config.test.ts` (or create equivalent describe block at the bottom of the file):

```typescript
import { loadWorkerConfig } from "../../src/config.js";

describe("loadWorkerConfig", () => {
  const baseEnv = {
    OPENROUTER_API_KEY: "k",
    JWT_SECRET: "x".repeat(32),
    PULSE_IMAP_ENCRYPTION_KEY: "a".repeat(64),
  };

  it("loads when PULSE_IMAP_ENCRYPTION_KEY is 64 hex chars", () => {
    const cfg = loadWorkerConfig(baseEnv);
    expect(cfg.imapEncryptionKey).toBe("a".repeat(64));
    expect(cfg.modelId).toBe("anthropic/claude-haiku-4.5"); // default
  });

  it("rejects a missing PULSE_IMAP_ENCRYPTION_KEY", () => {
    const env = { ...baseEnv, PULSE_IMAP_ENCRYPTION_KEY: undefined as unknown as string };
    expect(() => loadWorkerConfig(env)).toThrow(/PULSE_IMAP_ENCRYPTION_KEY/);
  });

  it("rejects a malformed (non-hex) PULSE_IMAP_ENCRYPTION_KEY", () => {
    const env = { ...baseEnv, PULSE_IMAP_ENCRYPTION_KEY: "not-hex" };
    expect(() => loadWorkerConfig(env)).toThrow();
  });

  it("rejects a wrong-length PULSE_IMAP_ENCRYPTION_KEY (32 chars instead of 64)", () => {
    const env = { ...baseEnv, PULSE_IMAP_ENCRYPTION_KEY: "a".repeat(32) };
    expect(() => loadWorkerConfig(env)).toThrow();
  });
});
```

- [ ] **Step 3: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/config.test.ts
```

Expected: existing config tests still green; the 4 new `loadWorkerConfig` tests fail (function not exported).

- [ ] **Step 4: Implement the split**

Replace the contents of `backend/src/config.ts` with:

```typescript
import { z } from "zod";

const HTTP_FIELDS = {
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(3000),
  MODEL_ID: z.string().default("anthropic/claude-haiku-4.5"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.string().default("development"),
  PROMPT_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
} as const;

const HttpSchema = z.object(HTTP_FIELDS);

const WorkerSchema = z.object({
  OPENROUTER_API_KEY: HTTP_FIELDS.OPENROUTER_API_KEY,
  JWT_SECRET: HTTP_FIELDS.JWT_SECRET,
  MODEL_ID: HTTP_FIELDS.MODEL_ID,
  LOG_LEVEL: HTTP_FIELDS.LOG_LEVEL,
  NODE_ENV: HTTP_FIELDS.NODE_ENV,
  PROMPT_TIMEOUT_MS: HTTP_FIELDS.PROMPT_TIMEOUT_MS,
  PULSE_IMAP_ENCRYPTION_KEY: z
    .string({ required_error: "PULSE_IMAP_ENCRYPTION_KEY is required" })
    .regex(/^[0-9a-fA-F]{64}$/, "PULSE_IMAP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
});

export type Config = {
  openrouterApiKey: string;
  jwtSecret: string;
  port: number;
  modelId: string;
  rateLimitPerMin: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  nodeEnv: string;
  promptTimeoutMs: number;
};

export type WorkerConfig = {
  openrouterApiKey: string;
  jwtSecret: string;
  modelId: string;
  logLevel: Config["logLevel"];
  nodeEnv: string;
  promptTimeoutMs: number;
  imapEncryptionKey: string;
};

function fail(error: z.ZodError): never {
  const msg = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment: ${msg}`);
}

export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = HttpSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    port: e.PORT,
    modelId: e.MODEL_ID,
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
    promptTimeoutMs: e.PROMPT_TIMEOUT_MS,
  };
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = WorkerSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    modelId: e.MODEL_ID,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
    promptTimeoutMs: e.PROMPT_TIMEOUT_MS,
    imapEncryptionKey: e.PULSE_IMAP_ENCRYPTION_KEY,
  };
}

/** Backwards-compatible alias for the pre-split callers. */
export const loadConfig = loadHttpConfig;
```

- [ ] **Step 5: Run config tests — expect pass**

```bash
cd backend && npx vitest run test/unit/config.test.ts
```

Expected: all config tests pass (existing + 4 new).

- [ ] **Step 6: Run the full suite — expect pass**

```bash
cd backend && npm test
```

Expected: all tests pass (the alias `loadConfig` keeps `src/index.ts` working unchanged).

- [ ] **Step 7: Commit**

```bash
git add backend/src/config.ts backend/test/unit/config.test.ts
git commit -m "feat(sp5b): split config into HTTP + worker variants"
```

---

## Task 8: IMAP wrapper (`worker/imap.ts`)

**Files:**
- Create: `backend/src/worker/imap.ts`
- Create: `backend/test/unit/imap.test.ts`

This task uses an injected `ImapFlow`-shaped client interface so the unit tests don't need a real IMAP server. The full integration is exercised in Task 9 + the live smoke test.

- [ ] **Step 1: Define the wrapper's contract via tests**

Create `backend/test/unit/imap.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { pollAccountMessages, type ImapClient } from "../../src/worker/imap.js";

const FOURTEEN_DAYS_MS = 14 * 86_400_000;

function fakeClient(opts: {
  searchResult: number[];
  fetchOne: (uid: number) => {
    uid: number;
    envelope: { from: { address: string; name?: string }[]; subject: string; date: Date };
    source: Buffer;
  };
}): ImapClient {
  return {
    connect: vi.fn(async () => {}),
    mailboxOpen: vi.fn(async () => {}),
    search: vi.fn(async () => opts.searchResult),
    fetchOne: vi.fn(async (uid: number) => opts.fetchOne(uid)),
    logout: vi.fn(async () => {}),
  };
}

describe("pollAccountMessages", () => {
  it("uses UID range search when maxSeenUid is set", async () => {
    const client = fakeClient({
      searchResult: [101, 102],
      fetchOne: (uid) => ({
        uid,
        envelope: { from: [{ address: "alerts@chase.com" }], subject: `s${uid}`, date: new Date() },
        source: Buffer.from(""),
      }),
    });
    await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 100,
      now: Date.now(),
    });
    expect(client.search).toHaveBeenCalledWith({ uid: "101:*" });
  });

  it("uses date-range search when maxSeenUid is null (first poll)", async () => {
    const now = Date.now();
    const client = fakeClient({ searchResult: [], fetchOne: () => { throw new Error("unreachable"); } });
    await pollAccountMessages({ client, allowlist: ["chase.com"], maxSeenUid: null, now });
    expect(client.search).toHaveBeenCalledWith({
      since: new Date(now - FOURTEEN_DAYS_MS),
    });
  });

  it("filters out UIDs whose envelope.from is not in the allowlist", async () => {
    const client = fakeClient({
      searchResult: [1, 2, 3],
      fetchOne: (uid) => ({
        uid,
        envelope: {
          from: [{ address: uid === 2 ? "spam@unknown.com" : "alerts@chase.com" }],
          subject: `s${uid}`,
          date: new Date(),
        },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    const uids = result.map((m) => m.uid);
    expect(uids).toEqual([1, 3]);
  });

  it("matches allowlist on full email and on domain suffix", async () => {
    const client = fakeClient({
      searchResult: [1, 2],
      fetchOne: (uid) => ({
        uid,
        envelope: {
          from: [{ address: uid === 1 ? "notify@chase.com" : "alerts@subdomain.chase.com" }],
          subject: `s${uid}`,
          date: new Date(),
        },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    expect(result.map((m) => m.uid)).toEqual([1, 2]);
  });

  it("applies a 50-UID soft cap", async () => {
    const uids = Array.from({ length: 80 }, (_, i) => i + 1);
    const client = fakeClient({
      searchResult: uids,
      fetchOne: (uid) => ({
        uid,
        envelope: { from: [{ address: "alerts@chase.com" }], subject: `s${uid}`, date: new Date() },
        source: Buffer.from(""),
      }),
    });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 0,
      now: Date.now(),
    });
    expect(result).toHaveLength(50);
  });

  it("returns [] when search returns no UIDs", async () => {
    const client = fakeClient({ searchResult: [], fetchOne: () => { throw new Error("unreachable"); } });
    const result = await pollAccountMessages({
      client,
      allowlist: ["chase.com"],
      maxSeenUid: 100,
      now: Date.now(),
    });
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/imap.test.ts
```

Expected: 6 tests fail (module missing).

- [ ] **Step 3: Implement the wrapper**

Create `backend/src/worker/imap.ts`:

```typescript
const FOURTEEN_DAYS_MS = 14 * 86_400_000;
const PER_TICK_UID_CAP = 50;

export type ImapEnvelope = {
  from: { address: string; name?: string }[];
  subject: string;
  date: Date;
};

export type FetchedMessage = {
  uid: number;
  envelope: ImapEnvelope;
  source: Buffer;
};

/**
 * Minimal subset of the imapflow client surface we use, so unit tests
 * can inject a fake. Maps directly onto `ImapFlow` instance methods.
 */
export type ImapClient = {
  connect: () => Promise<void>;
  mailboxOpen: (name: string) => Promise<unknown>;
  search: (
    query: { uid: string } | { since: Date },
  ) => Promise<number[] | undefined>;
  fetchOne: (uid: number, query: { source: true; envelope: true }) => Promise<{
    uid: number;
    envelope: ImapEnvelope;
    source: Buffer;
  }>;
  logout: () => Promise<void>;
};

function envelopeMatches(envelope: ImapEnvelope, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return false;
  const addr = (envelope.from?.[0]?.address ?? "").toLowerCase();
  return allowlist.some((entry) => {
    const e = entry.toLowerCase();
    return addr === e || addr.endsWith(`@${e}`) || addr.endsWith(`.${e}`);
  });
}

/**
 * One poll cycle for one connected IMAP client. Caller owns connect/logout
 * and the per-account credentials. Returns up to PER_TICK_UID_CAP messages.
 *
 * `maxSeenUid` null → date-range search (first-ever poll).
 * `maxSeenUid` number → UID-range search `${maxSeenUid + 1}:*`.
 */
export async function pollAccountMessages(args: {
  client: ImapClient;
  allowlist: readonly string[];
  maxSeenUid: number | null;
  now: number;
}): Promise<FetchedMessage[]> {
  const { client, allowlist, maxSeenUid, now } = args;
  const query =
    maxSeenUid == null
      ? { since: new Date(now - FOURTEEN_DAYS_MS) }
      : { uid: `${maxSeenUid + 1}:*` };
  const uids = (await client.search(query)) ?? [];
  if (uids.length === 0) return [];

  const out: FetchedMessage[] = [];
  for (const uid of uids) {
    if (out.length >= PER_TICK_UID_CAP) break;
    const msg = await client.fetchOne(uid, { source: true, envelope: true });
    if (!envelopeMatches(msg.envelope, allowlist)) continue;
    out.push({ uid: msg.uid, envelope: msg.envelope, source: msg.source });
  }
  return out;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/imap.test.ts
```

Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/worker/imap.ts backend/test/unit/imap.test.ts
git commit -m "feat(sp5b): IMAP poll wrapper with allowlist filter and 50-UID cap"
```

---

## Task 9: Per-account orchestrator (`worker/processAccount.ts`)

**Files:**
- Create: `backend/src/worker/processAccount.ts`
- Create: `backend/test/integration/processAccount.test.ts`

This is the integration boundary: a real in-memory SQLite, real `parseEntry`, mocked imapflow client, mocked `LlmClient`. It exercises the full §3 data flow.

- [ ] **Step 1: Write the failing tests**

Create `backend/test/integration/processAccount.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import * as imapUidsQ from "../../src/db/queries/imapUids.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import { encryptCredential } from "../../src/lib/crypto/credentials.js";
import { AccountBackoffState } from "../../src/worker/backoff.js";
import { processAccount } from "../../src/worker/processAccount.js";
import { UpstreamError } from "../../src/middleware/errorHandler.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapClient } from "../../src/worker/imap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");

const KEY = "a".repeat(64);
const APP_PASSWORD = "abcd-efgh-ijkl-mnop";

let db: Db;
let logger = createLogger("fatal");

function fakeImapClient(args: {
  searchResult: number[];
  message: (uid: number) => { source: Buffer; from: string; subject: string; date: Date };
  connectFails?: Error;
}): ImapClient {
  const search = vi.fn(async () => args.searchResult);
  const fetchOne = vi.fn(async (uid: number) => {
    const m = args.message(uid);
    return {
      uid,
      envelope: { from: [{ address: m.from }], subject: m.subject, date: m.date },
      source: m.source,
    };
  });
  return {
    connect: vi.fn(async () => {
      if (args.connectFails) throw args.connectFails;
    }),
    mailboxOpen: vi.fn(async () => {}),
    search,
    fetchOne,
    logout: vi.fn(async () => {}),
  };
}

function llmReturning(text: string | (() => string) | (() => never)): LlmClient {
  return {
    async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      const t = typeof text === "function" ? text() : text;
      return { text: t, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

function rfc822(subject: string, body: string): Buffer {
  return Buffer.from(
    `From: x@y.z\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`,
    "utf8",
  );
}

beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

function seedAccount(): number {
  const now = Date.now();
  const ct = encryptCredential(APP_PASSWORD, KEY);
  const { id } = imapAccountsQ.createImapAccount(db, {
    emailAddress: "kael@gmail.com",
    credentialsCiphertext: ct,
    senderAllowlist: JSON.stringify(["chase.com"]),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

describe("processAccount", () => {
  it("kind:spend → row inserted, UID marked, recurring=false on first occurrence", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "You spent $5.75 at Verve."),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(1_700_000_000_000),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "x",
      }),
    );
    const backoff = new AccountBackoffState(() => Date.now());

    await processAccount({
      db,
      account,
      backoff,
      logger,
      llm,
      modelId: "anthropic/claude-haiku-4.5",
      encryptionKey: KEY,
      imapClientFactory: () => client,
      now: Date.now(),
    });

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 0, 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].cents).toBe(575);
    expect(rows[0].currency).toBe("USD");
    expect(rows[0].merchant).toBe("Verve");
    expect(rows[0].recurring).toBe(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
    expect(backoff.consecutiveFailures(accountId)).toBe(0);
  });

  it("kind:spend with prior match → recurring=1", async () => {
    const accountId = seedAccount();
    const now = Date.now();
    // Pre-seed a prior recurring candidate
    syncedEntriesQ.insertSyncedEntry(db, {
      accountId,
      imapUid: 50,
      contentHash: "h",
      cents: 575,
      currency: "USD",
      merchant: "Verve",
      occurredAt: now - 30 * 86_400_000,
      rawParseResponse: "{}",
      createdAt: now - 30 * 86_400_000,
    });
    imapUidsQ.markUidSeen(db, accountId, 50, now);

    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "x"),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(now),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "x",
      }),
    );

    await processAccount({
      db,
      account,
      backoff: new AccountBackoffState(() => now),
      logger,
      llm,
      modelId: "anthropic/claude-haiku-4.5",
      encryptionKey: KEY,
      imapClientFactory: () => client,
      now,
    });

    const rows = syncedEntriesQ.listSinceCursor(db, accountId, 50, 100);
    expect(rows).toHaveLength(1);
    expect(rows[0].recurring).toBe(1);
  });

  it("kind:workout → no synced row, UID still marked seen", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("Charge alert", "x"),
        from: "alerts@chase.com",
        subject: "Charge alert",
        date: new Date(),
      }),
    });
    const llm = llmReturning(
      JSON.stringify({ kind: "chat", confidence: "high", raw: "x" }),
    );

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
  });

  it("UpstreamError from parseEntry → no row, UID NOT marked, transient failure recorded", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101, 102],
      message: (uid) => ({
        source: rfc822(`s${uid}`, "x"),
        from: "alerts@chase.com",
        subject: `s${uid}`,
        date: new Date(),
      }),
    });
    const llm: LlmClient = {
      async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
      async chatJson() { throw new UpstreamError("network down"); },
    };
    const backoff = new AccountBackoffState(() => Date.now());

    await processAccount({
      db, account, backoff, logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(false);
    expect(imapUidsQ.hasSeen(db, accountId, 102)).toBe(false);
    expect(backoff.consecutiveFailures(accountId)).toBe(1);
    // status remains 'active' (not permanent)
    expect(imapAccountsQ.getImapAccount(db, accountId)!.status).toBe("active");
  });

  it("ZodError from parseEntry → no row but UID marked seen (don't retry forever)", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({
      searchResult: [101],
      message: () => ({
        source: rfc822("s", "x"),
        from: "alerts@chase.com",
        subject: "s",
        date: new Date(),
      }),
    });
    const llm = llmReturning("not json at all");

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(syncedEntriesQ.listSinceCursor(db, accountId, 0, 100)).toHaveLength(0);
    expect(imapUidsQ.hasSeen(db, accountId, 101)).toBe(true);
  });

  it("auth failure on connect → status='error', no IMAP work after", async () => {
    const accountId = seedAccount();
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const authErr = new Error("Invalid credentials");
    (authErr as Error & { authenticationFailed?: boolean }).authenticationFailed = true;
    const client = fakeImapClient({
      searchResult: [],
      message: () => { throw new Error("unreachable"); },
      connectFails: authErr,
    });
    const llm = llmReturning("{}");

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger, llm,
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    const updated = imapAccountsQ.getImapAccount(db, accountId)!;
    expect(updated.status).toBe("error");
    expect(updated.lastError).toMatch(/auth/i);
    expect(client.search).not.toHaveBeenCalled();
  });

  it("decrypt failure → status='error', no IMAP attempted", async () => {
    const accountId = seedAccount();
    // Corrupt the ciphertext (drizzle sql tag handles parameter binding)
    db.run(sql`UPDATE imap_accounts SET credentials_ciphertext = ${"AAAA"} WHERE id = ${accountId}`);
    const account = imapAccountsQ.getImapAccount(db, accountId)!;
    const client = fakeImapClient({ searchResult: [], message: () => ({ source: Buffer.from(""), from: "", subject: "", date: new Date() }) });

    await processAccount({
      db, account, backoff: new AccountBackoffState(() => Date.now()), logger,
      llm: llmReturning("{}"),
      modelId: "anthropic/claude-haiku-4.5", encryptionKey: KEY,
      imapClientFactory: () => client, now: Date.now(),
    });

    expect(imapAccountsQ.getImapAccount(db, accountId)!.status).toBe("error");
    expect(client.connect).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/integration/processAccount.test.ts
```

Expected: 7 tests fail (module missing).

- [ ] **Step 3: Implement the orchestrator**

Create `backend/src/worker/processAccount.ts`:

```typescript
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import type { Db } from "../db/client.js";
import type { ImapAccount } from "../db/schema.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import * as imapUidsQ from "../db/queries/imapUids.js";
import * as syncedEntriesQ from "../db/queries/syncedEntries.js";
import { decryptCredential } from "../lib/crypto/credentials.js";
import { extractPlaintext } from "../lib/email/extract.js";
import { parseEntry } from "../lib/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Logger } from "../lib/logger.js";
import { pollAccountMessages, type ImapClient } from "./imap.js";
import { isRecurring } from "./recurring.js";
import type { AccountBackoffState } from "./backoff.js";

const TRUNCATE_BYTES = 4096;

export type ImapClientFactory = (args: {
  host: string;
  port: number;
  secure: true;
  user: string;
  pass: string;
  logger?: Logger;
}) => ImapClient;

export type ProcessAccountDeps = {
  db: Db;
  account: ImapAccount;
  backoff: AccountBackoffState;
  logger: Logger;
  llm: LlmClient;
  modelId: string;
  encryptionKey: string;
  imapClientFactory: ImapClientFactory;
  now: number;
};

function isAuthFailure(err: unknown): boolean {
  if (err instanceof Error) {
    if ((err as Error & { authenticationFailed?: boolean }).authenticationFailed) return true;
    return /authenticationfailed|no\s+login|invalid credentials/i.test(err.message);
  }
  return false;
}

function parseAllowlist(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function processAccount(deps: ProcessAccountDeps): Promise<{
  inserted: number;
  skipped: number;
  hadTransientError: boolean;
}> {
  const { db, account, backoff, logger, llm, modelId, encryptionKey, imapClientFactory, now } = deps;

  // 1. Decrypt credentials. Permanent on failure.
  let appPassword: string;
  try {
    appPassword = decryptCredential(account.credentialsCiphertext, encryptionKey);
  } catch (err) {
    logger.error({ accountId: account.id, err: (err as Error).message }, "credential decrypt failed");
    imapAccountsQ.updateStatus(db, account.id, "error");
    imapAccountsQ.updateError(db, account.id, "credentials decrypt failed");
    return { inserted: 0, skipped: 0, hadTransientError: false };
  }

  const allowlist = parseAllowlist(account.senderAllowlist);
  if (allowlist.length === 0) {
    logger.warn({ accountId: account.id }, "empty senderAllowlist; nothing will be processed");
  }

  const client = imapClientFactory({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    user: account.emailAddress,
    pass: appPassword,
    logger,
  });

  // 2. Connect. Auth failures are permanent; everything else is transient.
  try {
    await client.connect();
  } catch (err) {
    if (isAuthFailure(err)) {
      logger.error({ accountId: account.id, err: (err as Error).message }, "imap auth failed");
      imapAccountsQ.updateStatus(db, account.id, "error");
      imapAccountsQ.updateError(db, account.id, `auth failure: ${(err as Error).message}`);
      return { inserted: 0, skipped: 0, hadTransientError: false };
    }
    logger.warn({ accountId: account.id, err: (err as Error).message }, "imap connect failed (transient)");
    backoff.recordTransientFailure(account);
    return { inserted: 0, skipped: 0, hadTransientError: true };
  }

  let inserted = 0;
  let skipped = 0;
  let tickError = false;

  try {
    await client.mailboxOpen("INBOX");

    // 3. high-water-mark UID lookup
    const seenUids = imapUidsQ.listSeenUidsForAccount(db, account.id);
    const maxSeenUid = seenUids.length === 0 ? null : Math.max(...seenUids);

    // 4 + 5. Search + fetch (handled by pollAccountMessages)
    const messages = await pollAccountMessages({ client, allowlist, maxSeenUid, now });

    for (const msg of messages) {
      const plaintext = await extractPlaintext(msg.source);
      const truncated = plaintext.slice(0, TRUNCATE_BYTES);
      const text = `Subject: ${msg.envelope.subject}\n\n${truncated}`;
      const contentHash = createHash("sha256")
        .update(`${msg.envelope.subject}\n${plaintext}`)
        .digest("hex");

      let parsed;
      try {
        parsed = await parseEntry({ llm, modelId, logger }, { text, hint: "spend" });
      } catch (err) {
        if (err instanceof UpstreamError) {
          logger.warn({ accountId: account.id, uid: msg.uid, err: err.message }, "parseEntry upstream error; aborting tick");
          tickError = true;
          break;
        }
        if (err instanceof ZodError) {
          logger.warn({ accountId: account.id, uid: msg.uid }, "parseEntry schema failure; marking UID seen");
          imapUidsQ.markUidSeen(db, account.id, msg.uid, now);
          skipped++;
          continue;
        }
        throw err;
      }

      if (parsed.kind === "workout" || parsed.kind === "chat") {
        logger.info({ accountId: account.id, uid: msg.uid, kind: parsed.kind }, "skipped non-spend email");
        imapUidsQ.markUidSeen(db, account.id, msg.uid, now);
        skipped++;
        continue;
      }

      // kind === 'spend'
      const cents = Math.round(parsed.data.amount * 100);
      const currency = parsed.data.currency;
      const merchant = parsed.data.merchant ?? null;
      const occurredAt = msg.envelope.date.getTime();
      const priors = merchant
        ? syncedEntriesQ.findRecurringCandidates(db, account.id, merchant, occurredAt)
        : [];
      const recurring = isRecurring(priors, { cents, currency }) ? 1 : 0;

      // Single transaction: insert the synced entry + mark the UID seen together.
      // Drizzle's `db.transaction` is synchronous for better-sqlite3; the callback
      // receives a transaction-scoped Db instance.
      db.transaction((tx) => {
        syncedEntriesQ.insertSyncedEntry(tx, {
          accountId: account.id,
          imapUid: msg.uid,
          contentHash,
          cents,
          currency,
          merchant,
          category: parsed.data.category ?? null,
          occurredAt,
          recurring,
          rawParseResponse: JSON.stringify(parsed),
          emailSubject: msg.envelope.subject,
          emailFrom: msg.envelope.from?.[0]?.address ?? null,
          createdAt: now,
        });
        imapUidsQ.markUidSeen(tx, account.id, msg.uid, now);
      });
      inserted++;
    }
  } catch (err) {
    logger.warn({ accountId: account.id, err: (err as Error).message }, "imap tick failed (transient)");
    tickError = true;
  } finally {
    try { await client.logout(); } catch { /* ignore */ }
  }

  // 6. Bookkeeping
  imapAccountsQ.updateLastPolled(db, account.id, now);
  if (tickError) {
    backoff.recordTransientFailure(account);
  } else {
    backoff.recordSuccess(account);
    imapAccountsQ.updateError(db, account.id, null);
  }

  return { inserted, skipped, hadTransientError: tickError };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/integration/processAccount.test.ts
```

Expected: 7 passed.

- [ ] **Step 5: Run the full suite — expect pass**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add backend/src/worker/processAccount.ts backend/test/integration/processAccount.test.ts
git commit -m "feat(sp5b): per-account IMAP poll orchestrator"
```

---

## Task 10: Seeder lib (`lib/seedImapAccount.ts`)

**Files:**
- Create: `backend/src/lib/seedImapAccount.ts`
- Create: `backend/test/unit/seedImapAccount.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/test/unit/seedImapAccount.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import { decryptCredential } from "../../src/lib/crypto/credentials.js";
import { seedImapAccount, type ImapValidator } from "../../src/lib/seedImapAccount.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");

const KEY = "a".repeat(64);

let db: Db;
beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

describe("seedImapAccount", () => {
  it("happy path: validates with IMAP, encrypts, inserts; ciphertext round-trips", async () => {
    const validator: ImapValidator = vi.fn(async () => {});
    const { id } = await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1234 },
      { email: "kael@gmail.com", password: "abcd-efgh", allowlist: ["chase.com"] },
    );

    const row = imapAccountsQ.getImapAccount(db, id)!;
    expect(row.emailAddress).toBe("kael@gmail.com");
    expect(JSON.parse(row.senderAllowlist)).toEqual(["chase.com"]);
    expect(decryptCredential(row.credentialsCiphertext, KEY)).toBe("abcd-efgh");
    expect(validator).toHaveBeenCalledWith({ email: "kael@gmail.com", password: "abcd-efgh" });
  });

  it("validator failure → no row written, error propagates", async () => {
    const validator: ImapValidator = vi.fn(async () => { throw new Error("AUTHENTICATIONFAILED"); });
    await expect(
      seedImapAccount(
        { db, encryptionKey: KEY, validator, now: () => 1 },
        { email: "kael@gmail.com", password: "wrong", allowlist: [] },
      ),
    ).rejects.toThrow(/AUTHENTICATIONFAILED/);

    expect(imapAccountsQ.listImapAccounts(db)).toHaveLength(0);
  });

  it("rejects duplicate email_address", async () => {
    const validator: ImapValidator = async () => {};
    await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1 },
      { email: "kael@gmail.com", password: "p1", allowlist: [] },
    );
    await expect(
      seedImapAccount(
        { db, encryptionKey: KEY, validator, now: () => 2 },
        { email: "kael@gmail.com", password: "p2", allowlist: [] },
      ),
    ).rejects.toThrow(/already.*exists|UNIQUE/i);
  });

  it("empty allowlist is permitted but stored as `[]`", async () => {
    const validator: ImapValidator = async () => {};
    const { id } = await seedImapAccount(
      { db, encryptionKey: KEY, validator, now: () => 1 },
      { email: "kael@gmail.com", password: "p", allowlist: [] },
    );
    expect(imapAccountsQ.getImapAccount(db, id)!.senderAllowlist).toBe("[]");
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/unit/seedImapAccount.test.ts
```

Expected: 4 tests fail (module missing).

- [ ] **Step 3: Implement the lib**

Create `backend/src/lib/seedImapAccount.ts`:

```typescript
import type { Db } from "../db/client.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import { encryptCredential } from "./crypto/credentials.js";

export type ImapValidator = (args: { email: string; password: string }) => Promise<void>;

export type SeedDeps = {
  db: Db;
  encryptionKey: string;
  validator: ImapValidator;
  now: () => number;
};

export type SeedInput = {
  email: string;
  password: string;
  allowlist: readonly string[];
};

/**
 * Validates the IMAP credentials against Gmail BEFORE persisting (so the user
 * finds out about a wrong app password now, not on the first poll). On success,
 * encrypts the password and inserts a row into `imap_accounts`.
 *
 * Throws if:
 *   - validator rejects (e.g., IMAP NO LOGIN)
 *   - email already exists in imap_accounts (UNIQUE constraint)
 */
export async function seedImapAccount(
  deps: SeedDeps,
  input: SeedInput,
): Promise<{ id: number }> {
  await deps.validator({ email: input.email, password: input.password });
  const ciphertext = encryptCredential(input.password, deps.encryptionKey);
  const now = deps.now();
  try {
    return imapAccountsQ.createImapAccount(deps.db, {
      emailAddress: input.email,
      credentialsCiphertext: ciphertext,
      senderAllowlist: JSON.stringify([...input.allowlist]),
      createdAt: now,
      updatedAt: now,
    });
  } catch (err) {
    const msg = (err as Error).message;
    if (/UNIQUE/i.test(msg)) {
      throw new Error(`account ${input.email} already exists`);
    }
    throw err;
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/unit/seedImapAccount.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/seedImapAccount.ts backend/test/unit/seedImapAccount.test.ts
git commit -m "feat(sp5b): seedImapAccount lib (validate→encrypt→insert)"
```

---

## Task 11: Worker entrypoint + tick loop

**Files:**
- Create: `backend/src/worker/index.ts`
- Create: `backend/test/integration/worker-tick.test.ts`

The `setInterval` itself is hard to test, so we extract the per-tick logic as `runTick(deps)` and unit-test that. `index.ts` is then a thin shell wiring up `setInterval(() => runTick(deps), 60_000)` plus SIGTERM handling.

- [ ] **Step 1: Write the failing tests for the tick loop**

Create `backend/test/integration/worker-tick.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb, type Db } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import * as imapAccountsQ from "../../src/db/queries/imapAccounts.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import { encryptCredential } from "../../src/lib/crypto/credentials.js";
import { AccountBackoffState } from "../../src/worker/backoff.js";
import { runTick } from "../../src/worker/index.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapClient } from "../../src/worker/imap.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");
const KEY = "a".repeat(64);

let db: Db;
beforeEach(() => {
  const created = createDb(":memory:");
  db = created.db;
  runMigrations(db, migrationsFolder);
});

function llmReturning(text: string): LlmClient {
  return {
    async *chatStream() { yield { delta: "" }; yield { done: { inputTokens: 0, outputTokens: 0 } }; },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

function fakeClientReturning(uids: number[], from: string, body: string): ImapClient {
  return {
    connect: vi.fn(async () => {}),
    mailboxOpen: vi.fn(async () => {}),
    search: vi.fn(async () => uids),
    fetchOne: vi.fn(async (uid: number) => ({
      uid,
      envelope: { from: [{ address: from }], subject: "s", date: new Date() },
      source: Buffer.from(
        `From: x\r\nSubject: s\r\nContent-Type: text/plain\r\n\r\n${body}`,
        "utf8",
      ),
    })),
    logout: vi.fn(async () => {}),
  };
}

describe("runTick", () => {
  it("no accounts → no-op, no errors", async () => {
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => Date.now()),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: () => fakeClientReturning([], "x", ""),
      now: Date.now(),
    });
    expect(result.processed).toBe(0);
  });

  it("one active eligible account is processed; rows land in synced_entries", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: JSON.stringify(["chase.com"]),
      createdAt: now,
      updatedAt: now,
    });

    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1.0, currency: "USD", merchant: "M" },
        confidence: "high",
        raw: "x",
      }),
    );

    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm,
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: () => fakeClientReturning([1], "alerts@chase.com", "x"),
      now,
    });

    expect(result.processed).toBe(1);
    expect(syncedEntriesQ.listSinceCursor(db, id, 0, 100)).toHaveLength(1);
  });

  it("account with status='error' is skipped", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    const { id } = imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: "[]",
      createdAt: now,
      updatedAt: now,
    });
    imapAccountsQ.updateStatus(db, id, "error");

    const factory = vi.fn(() => fakeClientReturning([], "x", ""));
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: factory,
      now,
    });
    expect(result.processed).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });

  it("account in backoff (not eligible) is skipped", async () => {
    const ct = encryptCredential("p", KEY);
    const now = Date.now();
    imapAccountsQ.createImapAccount(db, {
      emailAddress: "u@gmail.com",
      credentialsCiphertext: ct,
      senderAllowlist: "[]",
      lastPolledAt: now - 10_000, // 10s ago, interval is 300s
      createdAt: now,
      updatedAt: now,
    });

    const factory = vi.fn(() => fakeClientReturning([], "x", ""));
    const result = await runTick({
      db,
      backoff: new AccountBackoffState(() => now),
      logger: createLogger("fatal"),
      llm: llmReturning("{}"),
      modelId: "m",
      encryptionKey: KEY,
      imapClientFactory: factory,
      now,
    });
    expect(result.processed).toBe(0);
    expect(factory).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && npx vitest run test/integration/worker-tick.test.ts
```

Expected: 4 tests fail (module missing or `runTick` not exported).

- [ ] **Step 3: Implement the entrypoint**

Create `backend/src/worker/index.ts`:

```typescript
import { ImapFlow } from "imapflow";
import { loadWorkerConfig } from "../config.js";
import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import { createLogger, type Logger } from "../lib/logger.js";
import { createOpenRouterClient } from "../lib/openrouter.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Db } from "../db/client.js";
import { AccountBackoffState } from "./backoff.js";
import { processAccount, type ImapClientFactory } from "./processAccount.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TICK_MS = 60_000;

export type TickDeps = {
  db: Db;
  backoff: AccountBackoffState;
  logger: Logger;
  llm: LlmClient;
  modelId: string;
  encryptionKey: string;
  imapClientFactory: ImapClientFactory;
  now: number;
};

/**
 * One tick of the worker loop. Extracted from `main()` for testability.
 * Iterates all active accounts whose backoff window has elapsed; processes them sequentially.
 */
export async function runTick(deps: TickDeps): Promise<{ processed: number }> {
  const accounts = imapAccountsQ
    .listImapAccounts(deps.db)
    .filter((a) => a.status === "active")
    .filter((a) => deps.backoff.shouldPollNow(a));

  let processed = 0;
  for (const account of accounts) {
    try {
      await processAccount({
        db: deps.db,
        account,
        backoff: deps.backoff,
        logger: deps.logger,
        llm: deps.llm,
        modelId: deps.modelId,
        encryptionKey: deps.encryptionKey,
        imapClientFactory: deps.imapClientFactory,
        now: deps.now,
      });
      processed++;
    } catch (err) {
      deps.logger.error(
        { accountId: account.id, err: (err as Error).message },
        "processAccount threw uncaught",
      );
    }
  }
  return { processed };
}

const realImapClientFactory: ImapClientFactory = ({ host, port, secure, user, pass, logger }) =>
  new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: logger as never,
  }) as unknown as ReturnType<ImapClientFactory>;

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = createLogger(config.logLevel);
  const dbPath = process.env.DB_PATH ?? "/data/pulse.db";
  const { db } = createDb(dbPath);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(__dirname, "../db/migrations");
  runMigrations(db, migrationsFolder);

  const llm = createOpenRouterClient(config.openrouterApiKey);
  const backoff = new AccountBackoffState();
  logger.info({ tickMs: TICK_MS }, "pulse-worker starting");

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runTick({
        db,
        backoff,
        logger,
        llm,
        modelId: config.modelId,
        encryptionKey: config.imapEncryptionKey,
        imapClientFactory: realImapClientFactory,
        now: Date.now(),
      });
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, "tick complete");
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, "tick threw uncaught");
    } finally {
      running = false;
    }
  };

  // Run one tick immediately, then schedule.
  await tick();
  const handle = setInterval(tick, TICK_MS);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "pulse-worker shutting down");
    clearInterval(handle);
    // Wait for any in-flight tick to settle (best-effort).
    for (let i = 0; i < 30 && running; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd backend && npx vitest run test/integration/worker-tick.test.ts
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/worker/index.ts backend/test/integration/worker-tick.test.ts
git commit -m "feat(sp5b): worker entrypoint with runTick loop and graceful shutdown"
```

---

## Task 12: Seeder CLI script

**Files:**
- Create: `backend/scripts/seed-imap-account.ts`

The lib is tested in Task 10; the CLI is a thin wrapper. We don't unit-test the CLI itself (its surface is `process.stdin` / `process.argv` / `process.exit`); the live smoke test exercises it end-to-end.

- [ ] **Step 1: Implement the CLI**

Create `backend/scripts/seed-imap-account.ts`:

```typescript
// Run on the droplet via:
//   docker compose -f /opt/pulse/compose.yml run --rm -it worker \
//     node dist/backend/scripts/seed-imap-account.js \
//     --email <gmail> [--allowlist domain1,domain2]
//
// The Gmail app password is prompted on stdin (hidden). It is never passed
// as a CLI flag and never appears in shell history or `ps`.

import { ImapFlow } from "imapflow";
import { createDb } from "../src/db/client.js";
import { loadWorkerConfig } from "../src/config.js";
import { seedImapAccount, type ImapValidator } from "../src/lib/seedImapAccount.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function readPasswordHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    process.stderr.write(prompt);
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      // Non-interactive (e.g., piped input) — fall back to plain readline.
      let buf = "";
      stdin.on("data", (chunk) => { buf += chunk.toString("utf8"); });
      stdin.on("end", () => resolve(buf.replace(/\r?\n$/, "")));
      stdin.on("error", reject);
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let out = "";
    const onData = (ch: string): void => {
      switch (ch) {
        case "": // Ctrl-C
          stdin.setRawMode(false);
          stdin.pause();
          process.stderr.write("\n");
          reject(new Error("aborted"));
          return;
        case "\r":
        case "\n":
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener("data", onData);
          process.stderr.write("\n");
          resolve(out);
          return;
        case "": // Backspace
          if (out.length > 0) out = out.slice(0, -1);
          return;
        default:
          if (ch.charCodeAt(0) >= 32) out += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const realValidator: ImapValidator = async ({ email, password }) => {
  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  await client.connect();
  await client.logout();
};

async function main(): Promise<void> {
  const email = arg("email");
  if (!email) {
    process.stderr.write("usage: seed-imap-account --email <gmail> [--allowlist domain1,domain2]\n");
    process.exit(2);
  }
  const allowlistRaw = arg("allowlist") ?? "";
  const allowlist = allowlistRaw
    ? allowlistRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
  if (allowlist.length === 0) {
    process.stderr.write(
      "WARNING: --allowlist is empty. The worker will drop every email it sees.\n" +
        "         Edit later via `sqlite3 /opt/pulse/data/pulse.db` or re-run with --allowlist.\n",
    );
  }

  const password = await readPasswordHidden("Gmail app password: ");
  if (!password) {
    process.stderr.write("password is required\n");
    process.exit(2);
  }

  const config = loadWorkerConfig();
  const dbPath = process.env.DB_PATH ?? "/data/pulse.db";
  const { db } = createDb(dbPath);

  try {
    const { id } = await seedImapAccount(
      { db, encryptionKey: config.imapEncryptionKey, validator: realValidator, now: Date.now },
      { email, password, allowlist },
    );
    process.stderr.write(`seeded imap_accounts id=${id} email=${email}\n`);
    process.exit(0);
  } catch (err) {
    process.stderr.write(`seed failed: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Verify it compiles in the build**

```bash
cd backend && npm run build
```

Expected: TypeScript compiles cleanly to `dist/backend/scripts/seed-imap-account.js`.

- [ ] **Step 3: Run the full test suite — expect pass**

```bash
cd backend && npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed-imap-account.ts
git commit -m "feat(sp5b): admin seeder CLI (hidden-stdin password prompt)"
```

---

## Task 13: Compose service + GH Action wiring

**Files:**
- Modify: `backend/deploy/compose.yml`
- Modify: `.github/workflows/deploy-backend.yml`

- [ ] **Step 1: Add the `worker` service to compose**

Edit `backend/deploy/compose.yml`. After the existing `backend:` block (which ends at the `restart: unless-stopped` line), append:

```yaml

  worker:
    image: ghcr.io/kaeltran16/pulse-backend:${IMAGE_TAG:-latest}
    command: node dist/backend/src/worker/index.js
    user: "1500:1500"
    env_file: .env
    environment:
      DB_PATH: /data/pulse.db
    volumes:
      - ./data:/data
    depends_on:
      migrator:
        condition: service_completed_successfully
    restart: unless-stopped
```

The full file should now have three services: `migrator`, `backend`, `worker`. No port mapping for `worker` (no HTTP).

- [ ] **Step 2: Add the GH Action step**

Edit `.github/workflows/deploy-backend.yml`. Find the `Up backend` step:

```yaml
      - name: Up backend
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d backend && docker compose ps"
```

Replace it with:

```yaml
      - name: Up backend
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d backend"

      - name: Up worker
        run: |
          ssh "$DEPLOY_HOST" "cd $DEPLOY_PATH && docker compose up -d worker && docker compose ps"
```

- [ ] **Step 3: Verify the compose file parses**

If you have Docker locally, run:

```bash
docker compose -f backend/deploy/compose.yml config --quiet
```

Expected: silent success. (If you don't have Docker locally, skip — the GH Action will catch a malformed file.)

- [ ] **Step 4: Commit**

```bash
git add backend/deploy/compose.yml .github/workflows/deploy-backend.yml
git commit -m "ci(sp5b): add worker compose service and deploy step"
```

---

## Task 14: Pre-deploy droplet config (USER-RUN)

> **This task is run by the user on the droplet.** Claude cannot run these commands; the user SSHes and executes.

**Goal:** put `PULSE_IMAP_ENCRYPTION_KEY` into `/opt/pulse/.env` *before* the first 5b deploy lands. Without it the `worker` container will fail-fast at startup.

- [ ] **Step 1: Generate the key on the droplet**

SSH to the droplet (`root@178.128.81.14`) and run:

```bash
KEY_HEX=$(openssl rand -hex 32)
echo "PULSE_IMAP_ENCRYPTION_KEY=$KEY_HEX" >> /opt/pulse/.env

# Verify it's in there exactly once:
grep -c '^PULSE_IMAP_ENCRYPTION_KEY=' /opt/pulse/.env
# Expected output: 1

# Show the key (so you can save it elsewhere):
grep '^PULSE_IMAP_ENCRYPTION_KEY=' /opt/pulse/.env
```

**Save the value somewhere safe (password manager).** Losing this key means every stored IMAP credential becomes unrecoverable.

- [ ] **Step 2: Confirm `.env` is still 0600 owned by root**

```bash
ls -la /opt/pulse/.env
# Expected: -rw------- 1 root root ...
```

If permissions drifted: `chmod 0600 /opt/pulse/.env`.

---

## Task 15: Live smoke test (USER-RUN)

> **This task is run by the user.** Claude writes the seeder; the user runs it on the droplet so the Gmail app password never enters Claude's session.

- [ ] **Step 1: Push the branch and watch the deploy**

```bash
git push origin main
```

Open the GH Actions tab; wait for the `deploy-backend` workflow to go green. Steps to monitor:

1. `test-and-build` — image builds and pushes.
2. `deploy` → `Run migrator` — exits 0 (5b adds no migration; this is a no-op).
3. `deploy` → `Up backend` — backend container running.
4. `deploy` → `Up worker` — worker container running.
5. `deploy` → `Smoke test` — `/health` returns 200.

If `Up worker` fails with the worker container restarting, check logs on the droplet:

```bash
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml logs worker'
```

The most likely cause is `PULSE_IMAP_ENCRYPTION_KEY` validation; fix Task 14 and re-deploy.

- [ ] **Step 2: Confirm worker is running and idle**

```bash
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml ps'
```

Expected: 3 services, `worker` showing `running`. (`migrator` is `exited (0)`, which is correct — it's `Type=oneshot`.)

```bash
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml logs --tail=20 worker'
```

Expected: a `pulse-worker starting` line and at least one `tick complete` (or no log entry if `result.processed === 0`, which is correct when there are no accounts yet).

- [ ] **Step 3: Run the seeder**

Pick the bank domains you want in your initial allowlist. Examples:
- `notify@chase.com` → `chase.com`
- `alerts@discover.com` → `discover.com`
- `noreply@capitalone.com` → `capitalone.com`

```bash
ssh -t root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml run --rm -it worker \
  node dist/backend/scripts/seed-imap-account.js \
  --email YOUR_GMAIL_ADDRESS@gmail.com \
  --allowlist chase.com,discover.com'
```

(`-t` allocates a TTY for the password prompt. Replace `YOUR_GMAIL_ADDRESS` and the allowlist.)

You'll see `Gmail app password:`. Paste your app password. Press Enter. Expected output:

```
seeded imap_accounts id=1 email=YOUR_GMAIL_ADDRESS@gmail.com
```

If you see `seed failed: AUTHENTICATIONFAILED`, the app password is wrong — check that 2-factor auth is enabled on your Gmail account and that the app password was generated under https://myaccount.google.com/apppasswords (not your account password).

- [ ] **Step 4: Wait for the next tick (≤60s) and watch logs**

```bash
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml logs -f worker'
```

Expected within 60s: a tick that logs the per-UID processing — `skipped non-spend email` for any non-bank-alert messages caught by the allowlist, and a final `tick complete` with `processed: 1`.

Press Ctrl-C to stop following.

- [ ] **Step 5: Verify rows landed in the database**

```bash
ssh root@178.128.81.14 'sqlite3 /opt/pulse/data/pulse.db \
  "SELECT id, merchant, cents, currency, recurring, datetime(occurred_at/1000, '"'"'unixepoch'"'"') AS occurred FROM synced_entries ORDER BY id"'
```

Expected: rows for any bank alerts in the last 14 days. Each row has merchant, cents (e.g., `575` for $5.75), currency (`USD`), and an `occurred_at` from the email envelope date.

- [ ] **Step 6: Wait 5 minutes and verify dedupe + recurring**

Wait for the next polling cycle (your `pollIntervalSeconds` default is 300s). Re-check logs:

```bash
ssh root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml logs --tail=20 worker'
```

Expected: a tick with `processed: 1` (the account was eligible) but **no new rows** in `synced_entries` (all UIDs are now in `imap_uids`). `consecutiveFailures: 0` implicit (no error logs).

Re-query:

```bash
ssh root@178.128.81.14 'sqlite3 /opt/pulse/data/pulse.db "SELECT count(*) FROM synced_entries"'
```

Expected: same count as Step 5.

If you have any merchant that appeared multiple times in the 14-day window:

```bash
ssh root@178.128.81.14 'sqlite3 /opt/pulse/data/pulse.db \
  "SELECT merchant, count(*) AS n, sum(recurring) AS r FROM synced_entries GROUP BY merchant"'
```

Expected: at least one row with `n >= 2` and `r >= 1` (the recurring heuristic flagged the second occurrence).

- [ ] **Step 7 (optional, recommended): Negative smoke test**

Verify the auth-failure permanent path works.

```bash
# Delete the account so the seeder accepts a new attempt
ssh root@178.128.81.14 'sqlite3 /opt/pulse/data/pulse.db \
  "DELETE FROM imap_accounts WHERE email_address = '"'"'YOUR_GMAIL_ADDRESS@gmail.com'"'"'"'

# Re-seed with a deliberately wrong password — seeder should fail validation
ssh -t root@178.128.81.14 'docker compose -f /opt/pulse/compose.yml run --rm -it worker \
  node dist/backend/scripts/seed-imap-account.js \
  --email YOUR_GMAIL_ADDRESS@gmail.com --allowlist chase.com'
# At the prompt, type any garbage (e.g., "wrong"). Expected: "seed failed: AUTHENTICATIONFAILED..."
```

Then re-seed correctly with your real app password (Step 3) so subsequent polling resumes.

- [ ] **Step 8: Mark the slice complete**

Update `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md` §3 sub-slice status row for **5b**:

Change:
```
- **5b** Not started.
```

To:
```
- **5b** ✅ Code complete YYYY-MM-DD — pulse-worker compose service running, AES-256-GCM encryption module + parseEntry() lib refactor + IMAP poll wrapper + per-account orchestrator + admin seeder + worker entrypoint. <N> backend tests passing (35–40 new). Live smoke verified on droplet: seeder accepted real Gmail app password, worker tick polled, <X> rows in synced_entries, dedupe verified on tick #2.
```

(Replace `YYYY-MM-DD` with today, `<N>` with the actual test count, `<X>` with the row count from Step 5.)

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5b): mark slice complete after live droplet verification"
```

---

## Final Verification (USER-RUN)

After Tasks 1–13 are merged and Tasks 14–15 are complete, sanity-check:

- [ ] All backend tests green: `cd backend && npm test` — expect ~135–145 tests passing (102 SP2 + 25 SP5a + ~35–40 SP5b).
- [ ] TypeScript compiles cleanly: `cd backend && npm run build` — no errors.
- [ ] No new schema migrations were generated (5b is no-schema-delta): `ls backend/src/db/migrations/` — same files as 5a (`0000_hesitant_freak.sql` only).
- [ ] Three running compose services on droplet: `docker compose -f /opt/pulse/compose.yml ps` shows `migrator` exited 0, `backend` running, `worker` running.
- [ ] At least one row in `synced_entries`.
- [ ] Tick #2 produced no duplicates.

If all pass, SP5b is closed. Move to SP5c (HTTP sync routes + iOS sync client).
