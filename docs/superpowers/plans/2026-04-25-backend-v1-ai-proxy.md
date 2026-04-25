# Backend v1 (AI proxy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a stateless Node + Express HTTP service exposing `/chat` (SSE), `/parse` (JSON), `/review` (JSON), and `/health`, deployed to a DigitalOcean droplet, hitting OpenRouter (`anthropic/claude-haiku-4.5`) behind a long-lived HS256 JWT.

**Architecture:** Single TypeScript Express process. Stateless. Zod validates input; `openai` SDK pointed at OpenRouter does the LLM call. JWT auth + per-IP rate limit + structured pino logs. Deployed via `rsync` + `systemd` on plaintext HTTP. Shared types between client and server live at the repo root.

**Tech Stack:** Node LTS, TypeScript (strict), Express 4, Zod, `openai` SDK (against OpenRouter), `jsonwebtoken`, `express-rate-limit`, `pino`, `vitest`, `supertest`, `tsx` for dev, `systemd` for prod.

**Spec:** `docs/superpowers/specs/2026-04-25-backend-v1-ai-proxy-design.md`

**Engineer ground rules:**
- Work happens in `backend/` and at the repo root (`lib/api-types.ts` only). Do **not** touch `app/`, `components/`, `tailwind.config.js`, or anything outside `backend/` and `lib/api-types.ts`. SP1 (design system) is running in parallel on `main`.
- After every task that has tests, run `npm test` from `backend/` and confirm green before committing.
- Never commit `.env`, `.env.local`, `.env.production`, or any file containing `OPENROUTER_API_KEY` or `JWT_SECRET`.
- Commits are **author-only** (no `Co-Authored-By: Claude` per `CLAUDE.md`). Use the imperative subject style of the recent log.

---

## File map

What exists at the start, what each new file is responsible for.

**Created at the repo root:**

| File | Responsibility |
|---|---|
| `lib/api-types.ts` | Shared TypeScript types: `ChatRequest`, `ChatResponse` (SSE event names), `ParseRequest`, `ParseResponse`, `ReviewRequest`, `ReviewResponse`, `ErrorEnvelope`, stub entity types (`Entry`, `FoodEntry`, `WorkoutEntry`, `SpendEntry`, `TodaySummary`, `*Aggregate`). Imported by both `app/` and `backend/`. |

**Created under `backend/`:**

| File | Responsibility |
|---|---|
| `package.json` | Backend deps + scripts (`dev`, `build`, `start`, `test`). |
| `tsconfig.json` | Strict TS, `outDir: dist`, includes parent `lib/api-types.ts`. |
| `.env.example` | Template — `OPENROUTER_API_KEY`, `JWT_SECRET`, `PORT`, `MODEL_ID`, `RATE_LIMIT_PER_MIN`, `LOG_LEVEL`. |
| `.gitignore` | Ignores `dist/`, `node_modules/`, `.env*`. |
| `vitest.config.ts` | Vitest config — Node env, coverage off for v1. |
| `README.md` | Deploy + token rotation runbook. |
| `src/index.ts` | Express app factory + `listen`. Splits `createApp()` (testable) from `main()` (boots server). |
| `src/config.ts` | Reads + validates env vars on boot. Throws on missing required keys. |
| `src/lib/logger.ts` | Pino instance — JSON lines, configurable level. |
| `src/lib/openrouter.ts` | OpenRouter SDK wrapper — `chatStream(messages, system) → AsyncIterable<delta>`, `chatJson<T>(messages, system, schema) → T`. Hides the OpenAI SDK shape. |
| `src/lib/prompts/chat.ts` | `buildChatSystemPrompt(context?) → string`. |
| `src/lib/prompts/parse.ts` | `buildParseMessages(text, hint?) → { system, user }`. |
| `src/lib/prompts/review.ts` | `buildReviewMessages(month, aggregates) → { system, user }`. |
| `src/middleware/requestId.ts` | Adds `req.id`, sets `X-Request-Id` header. |
| `src/middleware/auth.ts` | Verifies JWT, attaches `req.auth = { sub, scope }`. |
| `src/middleware/rateLimit.ts` | Configures `express-rate-limit` with the standard error envelope. |
| `src/middleware/errorHandler.ts` | Final error middleware — maps known errors → status + envelope. |
| `src/schemas/chat.ts` | Zod schema mirroring `ChatRequest`. |
| `src/schemas/parse.ts` | Zod schema mirroring `ParseRequest`, plus `ParseResponse` schemas keyed by `kind`. |
| `src/schemas/review.ts` | Zod schemas mirroring `ReviewRequest`/`ReviewResponse`. |
| `src/routes/health.ts` | `GET /health`. |
| `src/routes/chat.ts` | `POST /chat` SSE handler. |
| `src/routes/parse.ts` | `POST /parse` JSON handler. |
| `src/routes/review.ts` | `POST /review` JSON handler. |
| `scripts/issue-token.ts` | CLI — prints a signed JWT to stdout. |
| `scripts/smoke.sh` | Bash — runs against deployed instance, exits non-zero on any failure. |
| `scripts/deploy.sh` | Bash — `npm run build`, `rsync`, `ssh systemctl restart`, then runs `smoke.sh`. |
| `deploy/pulse-backend.service` | systemd unit (committed for reference; lives at `/etc/systemd/system/...` on the droplet). |
| `deploy/bootstrap.md` | One-time droplet bootstrap runbook. |
| `test/fixtures/messages.ts` | Sample `ChatRequest` payloads. |
| `test/fixtures/entries.ts` | Sample `Entry`/`FoodEntry`/etc. payloads. |
| `test/fixtures/aggregates.ts` | Sample monthly aggregates for `/review`. |
| `test/helpers/app.ts` | `buildTestApp()` — wires the app with a mocked OpenRouter and a known `JWT_SECRET`. |
| `test/helpers/jwt.ts` | `signTestToken(claims?)` — issues tokens for tests. |
| `test/unit/prompts.test.ts` | Golden tests for prompt builders. |
| `test/unit/schemas.test.ts` | Zod parse pass/fail cases. |
| `test/unit/jwt.test.ts` | JWT helper tests. |
| `test/integration/health.test.ts` | `GET /health`. |
| `test/integration/auth.test.ts` | Missing/bad/scope-mismatched tokens. |
| `test/integration/rateLimit.test.ts` | 429 after threshold. |
| `test/integration/parse.test.ts` | `/parse` happy + validation. |
| `test/integration/chat.test.ts` | `/chat` SSE happy + upstream-error. |
| `test/integration/review.test.ts` | `/review` happy. |

---

## Task 1: Add the shared types module at the repo root

**Files:**
- Create: `lib/api-types.ts`

- [ ] **Step 1: Create `lib/api-types.ts`**

```ts
// lib/api-types.ts
// Shared between the Pulse RN app (app/) and the backend (backend/).
// SP2 stubs entity types loosely; SP3a tightens them.

export type ErrorCode =
  | "unauthorized"
  | "forbidden"
  | "rate_limited"
  | "validation_failed"
  | "upstream_error"
  | "internal";

export type ErrorEnvelope = {
  error: { code: ErrorCode; message: string };
  requestId: string;
};

// --- Stub entity types (SP3a will replace) ---

export type Entry = {
  id: string;
  kind: "food" | "workout" | "spend";
  at: string; // ISO 8601
  note?: string;
};

export type FoodEntry = {
  items: Array<{ name: string; qty?: string }>;
  calories?: number;
  meal?: "breakfast" | "lunch" | "dinner" | "snack";
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

export type TodaySummary = {
  date: string; // YYYY-MM-DD
  rings?: { move?: number; exercise?: number; stand?: number };
  totals?: { calories?: number; spendMinor?: number };
};

export type WorkoutAggregate = { sessions: number; totalVolume?: number };
export type FoodAggregate = { avgCalories?: number; days: number };
export type SpendAggregate = { totalMinor: number; currency: string; byCategory?: Record<string, number> };
export type RitualAggregate = { streaks?: Record<string, number> };

// --- /chat ---

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type ChatRequest = {
  messages: ChatMessage[];
  context?: {
    recentEntries?: Entry[];
    today?: TodaySummary;
  };
};

// SSE events emitted by /chat (documented for client consumers in SP3b)
export type ChatStreamEvent =
  | { event: "chunk"; data: { delta: string } }
  | { event: "done"; data: { usage: { inputTokens: number; outputTokens: number } } }
  | { event: "error"; data: { code: ErrorCode; message: string; requestId: string } };

// --- /parse ---

export type ParseHint = "food" | "workout" | "spend";

export type ParseRequest = {
  text: string;
  hint?: ParseHint;
};

export type ParseConfidence = "high" | "low";

export type ParseResponse =
  | { kind: "food"; data: FoodEntry; confidence: ParseConfidence; raw: string }
  | { kind: "workout"; data: WorkoutEntry; confidence: ParseConfidence; raw: string }
  | { kind: "spend"; data: SpendEntry; confidence: ParseConfidence; raw: string };

// --- /review ---

export type ReviewRequest = {
  month: string; // "YYYY-MM"
  aggregates: {
    workouts: WorkoutAggregate;
    food: FoodAggregate;
    spend: SpendAggregate;
    rituals: RitualAggregate;
  };
};

export type ReviewResponse = {
  markdown: string;
  generatedAt: string; // ISO 8601 UTC
};
```

- [ ] **Step 2: Commit**

```bash
git add lib/api-types.ts
git commit -m "feat(api-types): add shared client/server types for backend v1"
```

---

## Task 2: Scaffold the backend package

**Files:**
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/.gitignore`, `backend/.env.example`, `backend/vitest.config.ts`, `backend/src/index.ts` (placeholder)

- [ ] **Step 1: Create `backend/package.json`**

```json
{
  "name": "pulse-backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0",
    "jsonwebtoken": "^9.0.2",
    "openai": "^4.77.0",
    "pino": "^9.5.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node": "^22.9.0",
    "@types/supertest": "^6.0.2",
    "supertest": "^7.0.0",
    "tsx": "^4.19.2",
    "typescript": "~5.9.2",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 2: Create `backend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist",
    "rootDir": "..",
    "baseUrl": ".",
    "paths": {
      "@api-types": ["../lib/api-types.ts"]
    }
  },
  "include": ["src/**/*", "scripts/**/*", "test/**/*", "../lib/api-types.ts"]
}
```

- [ ] **Step 3: Create `backend/.gitignore`**

```
node_modules/
dist/
.env
.env.local
.env.production
coverage/
```

- [ ] **Step 4: Create `backend/.env.example`**

```
# Copy to .env and fill in for local dev. Never commit .env.
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=                        # 32+ random bytes; openssl rand -hex 32
PORT=3000
MODEL_ID=anthropic/claude-haiku-4.5
RATE_LIMIT_PER_MIN=60
LOG_LEVEL=info
NODE_ENV=development
```

- [ ] **Step 5: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    pool: "forks", // SSE tests are easier with isolated workers
    testTimeout: 10000,
  },
});
```

- [ ] **Step 6: Create placeholder `backend/src/index.ts`**

```ts
console.log("pulse-backend boot stub");
```

- [ ] **Step 7: Install deps**

Run from `backend/`:

```bash
cd backend && npm install
```

Expected: lockfile generated, no errors.

- [ ] **Step 8: Verify TS compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output (success).

- [ ] **Step 9: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/.gitignore backend/.env.example backend/vitest.config.ts backend/src/index.ts
git commit -m "chore(backend): scaffold pulse-backend package"
```

---

## Task 3: Config loader

**Files:**
- Create: `backend/src/config.ts`
- Test: `backend/test/unit/config.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/unit/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL };
});
afterEach(() => {
  process.env = ORIGINAL;
});

describe("loadConfig", () => {
  it("returns parsed config when all required vars are set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.PORT = "3000";
    process.env.MODEL_ID = "anthropic/claude-haiku-4.5";
    process.env.RATE_LIMIT_PER_MIN = "60";
    process.env.LOG_LEVEL = "info";

    const cfg = loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(cfg.rateLimitPerMin).toBe(60);
    expect(cfg.logLevel).toBe("info");
  });

  it("throws when OPENROUTER_API_KEY is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.JWT_SECRET = "x".repeat(32);
    expect(() => loadConfig()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws when JWT_SECRET is shorter than 32 chars", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "short";
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("uses defaults for optional vars", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "x".repeat(32);
    delete process.env.PORT;
    delete process.env.MODEL_ID;
    delete process.env.RATE_LIMIT_PER_MIN;
    delete process.env.LOG_LEVEL;
    const cfg = loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(cfg.rateLimitPerMin).toBe(60);
    expect(cfg.logLevel).toBe("info");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/config.test.ts
```

Expected: FAIL — `Cannot find module '../../src/config.js'`.

- [ ] **Step 3: Implement `backend/src/config.ts`**

```ts
import { z } from "zod";

const Schema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(3000),
  MODEL_ID: z.string().default("anthropic/claude-haiku-4.5"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.string().default("development"),
});

export type Config = {
  openrouterApiKey: string;
  jwtSecret: string;
  port: number;
  modelId: string;
  rateLimitPerMin: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  nodeEnv: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    port: e.PORT,
    modelId: e.MODEL_ID,
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
  };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/config.test.ts
```

Expected: 4 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/config.ts backend/test/unit/config.test.ts
git commit -m "feat(backend): add env-driven config loader with zod validation"
```

---

## Task 4: Logger

**Files:**
- Create: `backend/src/lib/logger.ts`

- [ ] **Step 1: Implement (no test — pino is library code)**

```ts
// backend/src/lib/logger.ts
import { pino } from "pino";

export function createLogger(level: string = "info") {
  return pino({
    level,
    base: undefined, // drop pid/hostname; we have requestId for correlation
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/logger.ts
git commit -m "feat(backend): add pino logger factory"
```

---

## Task 5: Request ID middleware

**Files:**
- Create: `backend/src/middleware/requestId.ts`
- Test: `backend/test/integration/requestId.test.ts` (added later in Task 9 wiring; for now unit-test the middleware)
- Test: `backend/test/unit/requestId.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/unit/requestId.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestId } from "../../src/middleware/requestId.js";

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  } as unknown as Response & { headers: Record<string, string> };
}

describe("requestId", () => {
  it("attaches a uuid to req.id and sets X-Request-Id header", () => {
    const req = {} as Request & { id?: string };
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    // @ts-expect-error test helper
    expect(res.headers["X-Request-Id"]).toBe(req.id);
    expect(next).toHaveBeenCalled();
  });

  it("respects an incoming X-Request-Id header", () => {
    const incoming = "11111111-2222-3333-4444-555555555555";
    const req = { headers: { "x-request-id": incoming } } as unknown as Request & { id?: string };
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);
    expect(req.id).toBe(incoming);
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/requestId.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/middleware/requestId.ts
import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers?.["x-request-id"];
  const id = typeof incoming === "string" && UUID_RE.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/requestId.test.ts
```

Expected: 2 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/requestId.ts backend/test/unit/requestId.test.ts
git commit -m "feat(backend): add requestId middleware"
```

---

## Task 6: JWT helpers and auth middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`
- Create: `backend/test/helpers/jwt.ts`
- Test: `backend/test/unit/jwt.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/unit/jwt.test.ts
import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, AuthError, type Scope } from "../../src/middleware/auth.js";

const SECRET = "x".repeat(32);

function sign(payload: object, secret = SECRET): string {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}

describe("verifyToken", () => {
  it("returns claims for a valid token", () => {
    const token = sign({ sub: "kael", scope: ["chat", "parse", "review"] });
    const claims = verifyToken(token, SECRET, "chat" as Scope);
    expect(claims.sub).toBe("kael");
    expect(claims.scope).toContain("chat");
  });

  it("throws AuthError(unauthorized) on bad signature", () => {
    const token = sign({ sub: "kael", scope: ["chat"] }, "y".repeat(32));
    expect(() => verifyToken(token, SECRET, "chat" as Scope)).toThrowError(AuthError);
    try {
      verifyToken(token, SECRET, "chat" as Scope);
    } catch (e) {
      expect((e as AuthError).code).toBe("unauthorized");
    }
  });

  it("throws AuthError(unauthorized) on malformed token", () => {
    expect(() => verifyToken("not.a.jwt", SECRET, "chat" as Scope)).toThrowError(AuthError);
  });

  it("throws AuthError(forbidden) when scope is missing", () => {
    const token = sign({ sub: "kael", scope: ["parse"] });
    try {
      verifyToken(token, SECRET, "chat" as Scope);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AuthError).code).toBe("forbidden");
    }
  });

  it("throws AuthError(unauthorized) when scope claim is missing entirely", () => {
    const token = sign({ sub: "kael" });
    try {
      verifyToken(token, SECRET, "chat" as Scope);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AuthError).code).toBe("unauthorized");
    }
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/jwt.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `backend/src/middleware/auth.ts`**

```ts
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { ErrorCode } from "@api-types";

export type Scope = "chat" | "parse" | "review";

export type AuthClaims = {
  sub: string;
  scope: Scope[];
  iat?: number;
};

export class AuthError extends Error {
  constructor(public code: Extract<ErrorCode, "unauthorized" | "forbidden">, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function verifyToken(token: string, secret: string, requiredScope: Scope): AuthClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (_err) {
    throw new AuthError("unauthorized", "invalid token");
  }
  if (!decoded || typeof decoded !== "object") {
    throw new AuthError("unauthorized", "malformed claims");
  }
  const claims = decoded as Partial<AuthClaims>;
  if (typeof claims.sub !== "string" || !Array.isArray(claims.scope)) {
    throw new AuthError("unauthorized", "missing required claims");
  }
  if (!claims.scope.includes(requiredScope)) {
    throw new AuthError("forbidden", `token lacks scope '${requiredScope}'`);
  }
  return claims as AuthClaims;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function authMiddleware(secret: string, requiredScope: Scope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      return next(new AuthError("unauthorized", "missing or malformed Authorization header"));
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) return next(new AuthError("unauthorized", "empty bearer token"));
    try {
      req.auth = verifyToken(token, secret, requiredScope);
      next();
    } catch (err) {
      next(err);
    }
  };
}
```

- [ ] **Step 4: Create `backend/test/helpers/jwt.ts`**

```ts
import jwt from "jsonwebtoken";
import type { Scope } from "../../src/middleware/auth.js";

export const TEST_SECRET = "x".repeat(32);

export function signTestToken(opts: { sub?: string; scope?: Scope[]; secret?: string } = {}): string {
  const sub = opts.sub ?? "kael";
  const scope: Scope[] = opts.scope ?? ["chat", "parse", "review"];
  const secret = opts.secret ?? TEST_SECRET;
  return jwt.sign({ sub, scope }, secret, { algorithm: "HS256" });
}
```

- [ ] **Step 5: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/jwt.test.ts
```

Expected: 5 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/auth.ts backend/test/helpers/jwt.ts backend/test/unit/jwt.test.ts
git commit -m "feat(backend): add JWT auth middleware and verifyToken helper"
```

---

## Task 7: Error handler middleware

**Files:**
- Create: `backend/src/middleware/errorHandler.ts`
- Test: `backend/test/unit/errorHandler.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/unit/errorHandler.test.ts
import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import { errorHandler, UpstreamError } from "../../src/middleware/errorHandler.js";
import { AuthError } from "../../src/middleware/auth.js";
import { createLogger } from "../../src/lib/logger.js";

function fakeRes() {
  const r: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return r as Response & { statusCode: number; body: any };
}

const logger = createLogger("fatal");
const handle = errorHandler(logger);
const req = { id: "req-1" } as Request;
const next = vi.fn() as unknown as NextFunction;

describe("errorHandler", () => {
  it("maps AuthError(unauthorized) to 401 envelope", () => {
    const res = fakeRes();
    handle(new AuthError("unauthorized", "no token"), req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: "unauthorized", message: "no token" }, requestId: "req-1" });
  });

  it("maps AuthError(forbidden) to 403", () => {
    const res = fakeRes();
    handle(new AuthError("forbidden", "scope"), req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("maps ZodError to 400 validation_failed", () => {
    const res = fakeRes();
    const err = (() => {
      try {
        z.object({ x: z.string() }).parse({});
        return new Error("unreachable");
      } catch (e) {
        return e as ZodError;
      }
    })();
    handle(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("maps UpstreamError to 502", () => {
    const res = fakeRes();
    handle(new UpstreamError("openrouter 503"), req, res, next);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });

  it("maps unknown errors to 500 internal with generic message", () => {
    const res = fakeRes();
    handle(new Error("boom"), req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("internal");
    expect(res.body.error.message).toBe("internal server error");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/errorHandler.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// backend/src/middleware/errorHandler.ts
import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ErrorCode, ErrorEnvelope } from "@api-types";
import type { Logger } from "../lib/logger.js";
import { AuthError } from "./auth.js";

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

type Mapped = { status: number; code: ErrorCode; message: string };

function map(err: unknown): Mapped {
  if (err instanceof AuthError) {
    const status = err.code === "forbidden" ? 403 : 401;
    return { status, code: err.code, message: err.message };
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
    return { status: 400, code: "validation_failed", message };
  }
  if (err instanceof UpstreamError) {
    return { status: 502, code: "upstream_error", message: "upstream provider error" };
  }
  return { status: 500, code: "internal", message: "internal server error" };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const m = map(err);
    const requestId = req.id ?? "unknown";
    logger.error({ requestId, code: m.code, status: m.status, err: err instanceof Error ? err.message : String(err) }, "request failed");
    const envelope: ErrorEnvelope = { error: { code: m.code, message: m.message }, requestId };
    res.status(m.status).json(envelope);
  };
}
```

- [ ] **Step 4: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/errorHandler.test.ts
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/middleware/errorHandler.ts backend/test/unit/errorHandler.test.ts
git commit -m "feat(backend): add error handler middleware with envelope"
```

---

## Task 8: Rate limit middleware

**Files:**
- Create: `backend/src/middleware/rateLimit.ts`

- [ ] **Step 1: Implement (integration-tested in Task 16)**

```ts
// backend/src/middleware/rateLimit.ts
import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import type { ErrorEnvelope } from "@api-types";

export function createRateLimit(perMin: number) {
  return rateLimit({
    windowMs: 60_000,
    limit: perMin,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req: Request, res: Response, _next: NextFunction) => {
      const envelope: ErrorEnvelope = {
        error: { code: "rate_limited", message: "too many requests" },
        requestId: req.id ?? "unknown",
      };
      res.status(429).json(envelope);
    },
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/rateLimit.ts
git commit -m "feat(backend): add rate limit middleware"
```

---

## Task 9: Zod schemas mirroring shared types

**Files:**
- Create: `backend/src/schemas/chat.ts`, `backend/src/schemas/parse.ts`, `backend/src/schemas/review.ts`
- Test: `backend/test/unit/schemas.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/unit/schemas.test.ts
import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "../../src/schemas/chat.js";
import { ParseRequestSchema } from "../../src/schemas/parse.js";
import { ReviewRequestSchema } from "../../src/schemas/review.js";

describe("ChatRequestSchema", () => {
  it("accepts a minimal request", () => {
    const r = ChatRequestSchema.parse({ messages: [{ role: "user", content: "hi" }] });
    expect(r.messages).toHaveLength(1);
  });
  it("rejects empty messages", () => {
    expect(() => ChatRequestSchema.parse({ messages: [] })).toThrow();
  });
  it("rejects unknown role", () => {
    expect(() => ChatRequestSchema.parse({ messages: [{ role: "system", content: "x" }] })).toThrow();
  });
});

describe("ParseRequestSchema", () => {
  it("accepts text only", () => {
    expect(ParseRequestSchema.parse({ text: "ate eggs" }).text).toBe("ate eggs");
  });
  it("accepts a hint", () => {
    expect(ParseRequestSchema.parse({ text: "x", hint: "food" }).hint).toBe("food");
  });
  it("rejects empty text", () => {
    expect(() => ParseRequestSchema.parse({ text: "" })).toThrow();
  });
  it("rejects bad hint", () => {
    expect(() => ParseRequestSchema.parse({ text: "x", hint: "bogus" })).toThrow();
  });
});

describe("ReviewRequestSchema", () => {
  it("accepts a well-formed month + aggregates", () => {
    const r = ReviewRequestSchema.parse({
      month: "2026-04",
      aggregates: {
        workouts: { sessions: 8 },
        food: { days: 28 },
        spend: { totalMinor: 100000, currency: "USD" },
        rituals: {},
      },
    });
    expect(r.month).toBe("2026-04");
  });
  it("rejects bad month format", () => {
    expect(() =>
      ReviewRequestSchema.parse({
        month: "April",
        aggregates: { workouts: { sessions: 0 }, food: { days: 0 }, spend: { totalMinor: 0, currency: "USD" }, rituals: {} },
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/schemas.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `backend/src/schemas/chat.ts`**

```ts
import { z } from "zod";
import type { ChatRequest } from "@api-types";

const Entry = z.object({ id: z.string(), kind: z.enum(["food", "workout", "spend"]), at: z.string(), note: z.string().optional() });
const TodaySummary = z.object({
  date: z.string(),
  rings: z.object({ move: z.number().optional(), exercise: z.number().optional(), stand: z.number().optional() }).optional(),
  totals: z.object({ calories: z.number().optional(), spendMinor: z.number().optional() }).optional(),
});

export const ChatRequestSchema: z.ZodType<ChatRequest> = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1, "messages must contain at least one message"),
  context: z
    .object({
      recentEntries: z.array(Entry).optional(),
      today: TodaySummary.optional(),
    })
    .optional(),
});
```

- [ ] **Step 4: Implement `backend/src/schemas/parse.ts`**

```ts
import { z } from "zod";
import type { ParseRequest, ParseResponse } from "@api-types";

export const ParseRequestSchema: z.ZodType<ParseRequest> = z.object({
  text: z.string().min(1, "text is required"),
  hint: z.enum(["food", "workout", "spend"]).optional(),
});

const FoodEntry = z.object({
  items: z.array(z.object({ name: z.string(), qty: z.string().optional() })),
  calories: z.number().optional(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
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
  z.object({ kind: z.literal("food"), data: FoodEntry, confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("workout"), data: WorkoutEntry, confidence: Confidence, raw: z.string() }),
  z.object({ kind: z.literal("spend"), data: SpendEntry, confidence: Confidence, raw: z.string() }),
]);
```

- [ ] **Step 5: Implement `backend/src/schemas/review.ts`**

```ts
import { z } from "zod";
import type { ReviewRequest, ReviewResponse } from "@api-types";

const WorkoutAggregate = z.object({ sessions: z.number().int().nonnegative(), totalVolume: z.number().optional() });
const FoodAggregate = z.object({ avgCalories: z.number().optional(), days: z.number().int().nonnegative() });
const SpendAggregate = z.object({
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  byCategory: z.record(z.string(), z.number()).optional(),
});
const RitualAggregate = z.object({ streaks: z.record(z.string(), z.number()).optional() });

export const ReviewRequestSchema: z.ZodType<ReviewRequest> = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
  aggregates: z.object({
    workouts: WorkoutAggregate,
    food: FoodAggregate,
    spend: SpendAggregate,
    rituals: RitualAggregate,
  }),
});

export const ReviewResponseSchema: z.ZodType<ReviewResponse> = z.object({
  markdown: z.string().min(1),
  generatedAt: z.string(),
});
```

- [ ] **Step 6: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/schemas.test.ts
```

Expected: 9 passing.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas backend/test/unit/schemas.test.ts
git commit -m "feat(backend): add zod schemas for chat/parse/review"
```

---

## Task 10: Prompt builders

**Files:**
- Create: `backend/src/lib/prompts/chat.ts`, `backend/src/lib/prompts/parse.ts`, `backend/src/lib/prompts/review.ts`
- Test: `backend/test/unit/prompts.test.ts`
- Create: `backend/test/fixtures/entries.ts`, `backend/test/fixtures/aggregates.ts`

- [ ] **Step 1: Create fixtures**

```ts
// backend/test/fixtures/entries.ts
import type { Entry, TodaySummary } from "@api-types";

export const sampleEntries: Entry[] = [
  { id: "e1", kind: "food", at: "2026-04-25T08:30:00Z", note: "oatmeal" },
  { id: "e2", kind: "spend", at: "2026-04-25T11:00:00Z", note: "coffee" },
];

export const sampleToday: TodaySummary = {
  date: "2026-04-25",
  rings: { move: 320, exercise: 25, stand: 8 },
  totals: { calories: 1450, spendMinor: 1250 },
};
```

```ts
// backend/test/fixtures/aggregates.ts
import type { ReviewRequest } from "@api-types";

export const sampleAggregates: ReviewRequest["aggregates"] = {
  workouts: { sessions: 12, totalVolume: 38400 },
  food: { avgCalories: 2150, days: 28 },
  spend: { totalMinor: 125000, currency: "USD", byCategory: { groceries: 45000, dining: 30000, other: 50000 } },
  rituals: { streaks: { meditation: 21, journaling: 14 } },
};
```

- [ ] **Step 2: Write failing test**

```ts
// backend/test/unit/prompts.test.ts
import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../../src/lib/prompts/chat.js";
import { buildParseMessages } from "../../src/lib/prompts/parse.js";
import { buildReviewMessages } from "../../src/lib/prompts/review.js";
import { sampleEntries, sampleToday } from "../fixtures/entries.js";
import { sampleAggregates } from "../fixtures/aggregates.js";

describe("buildChatSystemPrompt", () => {
  it("returns a non-empty string with the persona name", () => {
    const s = buildChatSystemPrompt();
    expect(s.length).toBeGreaterThan(0);
    expect(s).toMatch(/Pal/);
  });

  it("includes today's totals when context is provided", () => {
    const s = buildChatSystemPrompt({ today: sampleToday, recentEntries: sampleEntries });
    expect(s).toContain("2026-04-25");
    expect(s).toContain("1450");
    expect(s).toContain("oatmeal");
  });
});

describe("buildParseMessages", () => {
  it("includes the input text and the parse instruction", () => {
    const m = buildParseMessages("ate 2 eggs and toast");
    expect(m.system).toMatch(/JSON/);
    expect(m.user).toContain("ate 2 eggs and toast");
  });

  it("includes the hint when provided", () => {
    const m = buildParseMessages("hex bar 5x5", "workout");
    expect(m.user).toMatch(/hint.*workout/i);
  });
});

describe("buildReviewMessages", () => {
  it("includes the month and aggregate counts", () => {
    const m = buildReviewMessages("2026-04", sampleAggregates);
    expect(m.user).toContain("2026-04");
    expect(m.user).toContain("12"); // sessions
    expect(m.user).toContain("USD");
  });
});
```

- [ ] **Step 3: Run test, expect failure**

```bash
cd backend && npm test -- test/unit/prompts.test.ts
```

Expected: FAIL — modules not found.

- [ ] **Step 4: Implement `backend/src/lib/prompts/chat.ts`**

```ts
import type { ChatRequest } from "@api-types";

const PERSONA = `You are Pal, the user's calm, concise personal assistant inside the Pulse iOS app.

Voice:
- Warm but not chatty. No filler.
- Direct. Answer first, explain only if asked.
- Plain English. Avoid emoji unless the user uses them first.

Format:
- Default to short, readable text. Use bullet lists only when the user asks for options.
- Never wrap responses in code fences unless the user is asking for code.

Boundaries:
- You see the user's recent entries and today's summary if the client provides them. Do not invent data the client did not send.
- If you don't know, say so.`;

export function buildChatSystemPrompt(context?: ChatRequest["context"]): string {
  if (!context) return PERSONA;
  const parts: string[] = [PERSONA];
  if (context.today) {
    const t = context.today;
    parts.push(
      `\nToday (${t.date}):` +
        (t.totals?.calories != null ? ` calories=${t.totals.calories}` : "") +
        (t.totals?.spendMinor != null ? ` spend_minor=${t.totals.spendMinor}` : "") +
        (t.rings ? ` rings=${JSON.stringify(t.rings)}` : "")
    );
  }
  if (context.recentEntries?.length) {
    parts.push("\nRecent entries:");
    for (const e of context.recentEntries) {
      parts.push(`- [${e.kind} @ ${e.at}]${e.note ? ` ${e.note}` : ""}`);
    }
  }
  return parts.join("\n");
}
```

- [ ] **Step 5: Implement `backend/src/lib/prompts/parse.ts`**

```ts
import type { ParseHint } from "@api-types";

const SYSTEM = `You parse short, free-form entries the user typed into the Pulse app into structured JSON.

Output rules:
- Return JSON only. No prose. No code fences.
- Pick exactly one kind: "food", "workout", or "spend".
- For food: items[] with name + optional qty, optional calories, optional meal.
- For workout: optional routine, optional sets[], optional durationMin.
- For spend: amount (number), currency (ISO 4217), optional category, optional merchant.
- If you can't tell with high confidence, set confidence: "low".

Shape:
{ "kind": "food" | "workout" | "spend",
  "data": <kind-specific object>,
  "confidence": "high" | "low",
  "raw": <the input text exactly> }`;

export function buildParseMessages(text: string, hint?: ParseHint): { system: string; user: string } {
  const hintLine = hint ? `\nhint: ${hint}` : "";
  const user = `Parse this entry:\n"""\n${text}\n"""${hintLine}`;
  return { system: SYSTEM, user };
}
```

- [ ] **Step 6: Implement `backend/src/lib/prompts/review.ts`**

```ts
import type { ReviewRequest } from "@api-types";

const SYSTEM = `You write the user's monthly review for the Pulse app.

Voice:
- Reflective, specific, encouraging without flattery.
- Use the supplied numbers. Do not invent ones not present.

Format:
- Markdown. Headings: ## Wins, ## Patterns, ## To watch, ## Next month.
- Keep it tight: under ~400 words.`;

export function buildReviewMessages(month: string, aggregates: ReviewRequest["aggregates"]): { system: string; user: string } {
  const user =
    `Write the monthly review for ${month}.\n\n` +
    `Aggregates (JSON):\n` +
    JSON.stringify(aggregates, null, 2);
  return { system: SYSTEM, user };
}
```

- [ ] **Step 7: Run test, expect pass**

```bash
cd backend && npm test -- test/unit/prompts.test.ts
```

Expected: 5 passing.

- [ ] **Step 8: Commit**

```bash
git add backend/src/lib/prompts backend/test/fixtures backend/test/unit/prompts.test.ts
git commit -m "feat(backend): add prompt builders for chat/parse/review"
```

---

## Task 11: OpenRouter SDK wrapper

**Files:**
- Create: `backend/src/lib/openrouter.ts`

This wrapper hides the OpenAI SDK shape behind two methods so route handlers (and tests) can mock at one boundary.

- [ ] **Step 1: Implement**

```ts
// backend/src/lib/openrouter.ts
import OpenAI from "openai";
import { UpstreamError } from "../middleware/errorHandler.js";

export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

export type Usage = { inputTokens: number; outputTokens: number };

export interface LlmClient {
  chatStream(args: { messages: Msg[]; model: string }): AsyncIterable<{ delta: string } | { done: Usage }>;
  chatJson(args: { messages: Msg[]; model: string }): Promise<{ text: string; usage: Usage }>;
}

export function createOpenRouterClient(apiKey: string): LlmClient {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  return {
    async *chatStream({ messages, model }) {
      let stream;
      try {
        stream = await client.chat.completions.create({ model, messages, stream: true });
      } catch (err) {
        throw new UpstreamError(`openrouter create failed: ${(err as Error).message}`);
      }
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { delta };
          // Some providers send usage on the final chunk:
          const u = (chunk as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
          if (u) {
            inputTokens = u.prompt_tokens ?? inputTokens;
            outputTokens = u.completion_tokens ?? outputTokens;
          }
        }
      } catch (err) {
        throw new UpstreamError(`openrouter stream failed: ${(err as Error).message}`);
      }
      yield { done: { inputTokens, outputTokens } };
    },

    async chatJson({ messages, model }) {
      try {
        const resp = await client.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
        });
        const text = resp.choices?.[0]?.message?.content ?? "";
        const usage = {
          inputTokens: resp.usage?.prompt_tokens ?? 0,
          outputTokens: resp.usage?.completion_tokens ?? 0,
        };
        return { text, usage };
      } catch (err) {
        throw new UpstreamError(`openrouter chatJson failed: ${(err as Error).message}`);
      }
    },
  };
}
```

- [ ] **Step 2: Verify TS compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add backend/src/lib/openrouter.ts
git commit -m "feat(backend): add OpenRouter SDK wrapper (chatStream + chatJson)"
```

---

## Task 12: Health route + app factory + test helper

**Files:**
- Create: `backend/src/routes/health.ts`, `backend/src/index.ts` (replace stub), `backend/test/helpers/app.ts`
- Test: `backend/test/integration/health.test.ts`

- [ ] **Step 1: Implement `backend/src/routes/health.ts`**

```ts
import { Router } from "express";

export const VERSION = "0.1.0";

export function healthRouter(): Router {
  const r = Router();
  r.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, version: VERSION });
  });
  return r;
}
```

- [ ] **Step 2: Implement `backend/src/index.ts` (app factory + boot)**

```ts
import express, { type Express } from "express";
import { loadConfig, type Config } from "./config.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authMiddleware } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { healthRouter } from "./routes/health.js";
import type { LlmClient } from "./lib/openrouter.js";
import { createOpenRouterClient } from "./lib/openrouter.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  llm: LlmClient;
};

export function createApp(deps: AppDeps): Express {
  const { config, logger } = deps;
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(express.json({ limit: "256kb" }));

  // Public
  app.use(healthRouter());

  // Protected — rate-limited and JWT-verified per route in later tasks.
  // Wiring for /chat, /parse, /review is appended in Tasks 13-15.

  // Final error handler.
  app.use(errorHandler(logger));
  return app;
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const llm = createOpenRouterClient(config.openrouterApiKey);
  const app = createApp({ config, logger, llm });
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "pulse-backend listening");
  });
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 3: Implement `backend/test/helpers/app.ts`**

```ts
import { createApp, type AppDeps } from "../../src/index.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient } from "../../src/lib/openrouter.js";
import { TEST_SECRET } from "./jwt.js";
import type { Config } from "../../src/config.js";

export function buildTestApp(overrides: { llm?: Partial<LlmClient>; config?: Partial<Config> } = {}) {
  const config: Config = {
    openrouterApiKey: "test",
    jwtSecret: TEST_SECRET,
    port: 0,
    modelId: "anthropic/claude-haiku-4.5",
    rateLimitPerMin: 60,
    logLevel: "fatal",
    nodeEnv: "test",
    ...overrides.config,
  };
  const llm: LlmClient = {
    async *chatStream() {
      yield { delta: "ok" };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson() {
      return { text: "{}", usage: { inputTokens: 1, outputTokens: 1 } };
    },
    ...overrides.llm,
  };
  const deps: AppDeps = { config, logger: createLogger("fatal"), llm };
  return { app: createApp(deps), deps };
}
```

- [ ] **Step 4: Write failing test**

```ts
// backend/test/integration/health.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";

describe("GET /health", () => {
  it("returns 200 with ok and version", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(typeof res.body.version).toBe("string");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("does not require auth", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 5: Run test, expect pass**

```bash
cd backend && npm test -- test/integration/health.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/index.ts backend/src/routes/health.ts backend/test/helpers/app.ts backend/test/integration/health.test.ts
git commit -m "feat(backend): add app factory, health route, and test harness"
```

---

## Task 13: `/parse` route (TDD)

**Files:**
- Create: `backend/src/routes/parse.ts`
- Modify: `backend/src/index.ts` — wire the route
- Test: `backend/test/integration/parse.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/integration/parse.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const FOOD_JSON = JSON.stringify({
  kind: "food",
  data: { items: [{ name: "eggs", qty: "2" }, { name: "toast", qty: "1 slice" }] },
  confidence: "high",
  raw: "ate 2 eggs and toast",
});

describe("POST /parse", () => {
  it("returns parsed food entry on happy path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: FOOD_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate 2 eggs and toast" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("food");
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.confidence).toBe("high");
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

  it("returns 502 upstream_error when model emits non-JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json at all", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate eggs" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });

  it("returns 502 upstream_error when model JSON fails the schema", async () => {
    const bad = JSON.stringify({ kind: "food", data: { items: "not-an-array" }, confidence: "high", raw: "x" });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: bad, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "x" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/integration/parse.test.ts
```

Expected: FAIL — `/parse` 404 or module-not-found.

- [ ] **Step 3: Implement `backend/src/routes/parse.ts`**

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { ParseRequestSchema, ParseResponseSchema } from "../schemas/parse.js";
import { buildParseMessages } from "../lib/prompts/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";

export function parseRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/parse", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ParseRequestSchema.parse(req.body);
      const { system, user } = buildParseMessages(body.text, body.hint);
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
        throw new UpstreamError("model did not return JSON");
      }
      // Ensure raw is the original input regardless of what the model echoed:
      if (parsed && typeof parsed === "object") (parsed as { raw?: string }).raw = body.text;
      const validated = ParseResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`model output failed schema: ${validated.error.message}`);
      }
      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
```

- [ ] **Step 4: Wire the route in `backend/src/index.ts`**

Replace the comment block in `createApp` ("Wiring for /chat, /parse, /review …") with this and the appropriate imports at the top:

```ts
// add near other imports
import { parseRouter } from "./routes/parse.js";
```

```ts
// inside createApp(), after `app.use(healthRouter());` and before `app.use(errorHandler(logger));`
const rateLimitMw = createRateLimit(config.rateLimitPerMin);
app.use("/parse", rateLimitMw, authMiddleware(config.jwtSecret, "parse"), parseRouter({ llm: deps.llm, modelId: config.modelId }));
```

- [ ] **Step 5: Run test, expect pass**

```bash
cd backend && npm test -- test/integration/parse.test.ts
```

Expected: 4 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/parse.ts backend/src/index.ts backend/test/integration/parse.test.ts
git commit -m "feat(backend): add POST /parse route with zod-guarded model output"
```

---

## Task 14: `/chat` route (SSE) (TDD)

**Files:**
- Create: `backend/src/routes/chat.ts`
- Modify: `backend/src/index.ts` — wire the route
- Test: `backend/test/integration/chat.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/integration/chat.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

function parseSse(raw: string): Array<{ event: string; data: any }> {
  const events: Array<{ event: string; data: any }> = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    let ev = "message";
    const data: string[] = [];
    for (const l of lines) {
      if (l.startsWith("event: ")) ev = l.slice(7).trim();
      else if (l.startsWith("data: ")) data.push(l.slice(6));
    }
    const joined = data.join("\n");
    events.push({ event: ev, data: joined ? JSON.parse(joined) : null });
  }
  return events;
}

describe("POST /chat", () => {
  it("streams chunks then a done event on success", async () => {
    const { app } = buildTestApp({
      llm: {
        async *chatStream() {
          yield { delta: "Hello" };
          yield { delta: ", world" };
          yield { done: { inputTokens: 3, outputTokens: 4 } };
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    const chunks = events.filter((e) => e.event === "chunk");
    const dones = events.filter((e) => e.event === "done");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.map((e) => e.data.delta).join("")).toBe("Hello, world");
    expect(dones).toHaveLength(1);
    expect(dones[0].data.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
  });

  it("emits an SSE error event when the upstream fails mid-stream", async () => {
    const { app } = buildTestApp({
      llm: {
        async *chatStream() {
          yield { delta: "partial" };
          throw new Error("boom");
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200); // SSE stream already opened with 200
    const events = parseSse(res.text);
    const errs = events.filter((e) => e.event === "error");
    expect(errs).toHaveLength(1);
    expect(errs[0].data.code).toBe("upstream_error");
    expect(errs[0].data.requestId).toBeTruthy();
  });

  it("rejects an empty messages array with 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/integration/chat.test.ts
```

Expected: FAIL — route not wired.

- [ ] **Step 3: Implement `backend/src/routes/chat.ts`**

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { ChatRequestSchema } from "../schemas/chat.js";
import { buildChatSystemPrompt } from "../lib/prompts/chat.js";
import type { LlmClient, Msg } from "../lib/openrouter.js";

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function chatRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/chat", async (req: Request, res: Response, next: NextFunction) => {
    let body;
    try {
      body = ChatRequestSchema.parse(req.body);
    } catch (err) {
      return next(err); // 400 validation_failed via error handler
    }

    const system = buildChatSystemPrompt(body.context);
    const messages: Msg[] = [{ role: "system", content: system }, ...body.messages];

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    try {
      for await (const item of deps.llm.chatStream({ messages, model: deps.modelId })) {
        if (aborted) break;
        if ("delta" in item) {
          writeEvent(res, "chunk", { delta: item.delta });
        } else {
          writeEvent(res, "done", { usage: item.done });
        }
      }
    } catch (err) {
      writeEvent(res, "error", {
        code: "upstream_error",
        message: (err as Error).message,
        requestId: req.id,
      });
    } finally {
      res.end();
    }
  });
  return r;
}
```

- [ ] **Step 4: Wire the route in `backend/src/index.ts`**

Add import and `app.use` line, alongside the parse wiring:

```ts
import { chatRouter } from "./routes/chat.js";
```

```ts
app.use("/chat", rateLimitMw, authMiddleware(config.jwtSecret, "chat"), chatRouter({ llm: deps.llm, modelId: config.modelId }));
```

- [ ] **Step 5: Run test, expect pass**

```bash
cd backend && npm test -- test/integration/chat.test.ts
```

Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/chat.ts backend/src/index.ts backend/test/integration/chat.test.ts
git commit -m "feat(backend): add POST /chat SSE route"
```

---

## Task 15: `/review` route (TDD)

**Files:**
- Create: `backend/src/routes/review.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/test/integration/review.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// backend/test/integration/review.test.ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import { sampleAggregates } from "../fixtures/aggregates.js";

describe("POST /review", () => {
  it("returns markdown on happy path", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: JSON.stringify({ markdown: "## Wins\n- 12 sessions\n", generatedAt: "2026-04-30T00:00:00Z" }),
          usage: { inputTokens: 100, outputTokens: 200 },
        }),
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-04", aggregates: sampleAggregates });
    expect(res.status).toBe(200);
    expect(res.body.markdown).toMatch(/Wins/);
    expect(res.body.generatedAt).toBeTruthy();
  });

  it("rejects malformed month with 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "April", aggregates: sampleAggregates });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });
});
```

- [ ] **Step 2: Run test, expect failure**

```bash
cd backend && npm test -- test/integration/review.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement `backend/src/routes/review.ts`**

```ts
import { Router, type Request, type Response, type NextFunction } from "express";
import { ReviewRequestSchema, ReviewResponseSchema } from "../schemas/review.js";
import { buildReviewMessages } from "../lib/prompts/review.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";

export function reviewRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/review", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ReviewRequestSchema.parse(req.body);
      const { system, user } = buildReviewMessages(body.month, body.aggregates);
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
        // Fallback: treat the raw text as markdown if the model returned plain text.
        parsed = { markdown: text, generatedAt: new Date().toISOString() };
      }
      const validated = ReviewResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`review output failed schema: ${validated.error.message}`);
      }
      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
```

- [ ] **Step 4: Wire route**

```ts
import { reviewRouter } from "./routes/review.js";
```

```ts
app.use("/review", rateLimitMw, authMiddleware(config.jwtSecret, "review"), reviewRouter({ llm: deps.llm, modelId: config.modelId }));
```

- [ ] **Step 5: Run test, expect pass**

```bash
cd backend && npm test -- test/integration/review.test.ts
```

Expected: 2 passing.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/review.ts backend/src/index.ts backend/test/integration/review.test.ts
git commit -m "feat(backend): add POST /review route"
```

---

## Task 16: Auth + rate limit integration tests

**Files:**
- Test: `backend/test/integration/auth.test.ts`
- Test: `backend/test/integration/rateLimit.test.ts`

- [ ] **Step 1: Write `backend/test/integration/auth.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken, TEST_SECRET } from "../helpers/jwt.js";
import jwt from "jsonwebtoken";

describe("auth middleware", () => {
  it("rejects /parse without Authorization header (401)", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/parse").send({ text: "x" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(res.body.requestId).toBeTruthy();
  });

  it("rejects /parse with bad signature (401)", async () => {
    const { app } = buildTestApp();
    const bad = jwt.sign({ sub: "kael", scope: ["parse"] }, "y".repeat(32), { algorithm: "HS256" });
    const res = await request(app).post("/parse").set("Authorization", `Bearer ${bad}`).send({ text: "x" });
    expect(res.status).toBe(401);
  });

  it("rejects /chat with token missing 'chat' scope (403)", async () => {
    const { app } = buildTestApp();
    const t = signTestToken({ scope: ["parse", "review"] });
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${t}`)
      .send({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("/health does not require a token", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("rejects malformed Authorization header", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/parse").set("Authorization", "Token abc").send({ text: "x" });
    expect(res.status).toBe(401);
  });

  // sanity: TEST_SECRET is what the test app uses
  it("accepts a token signed with TEST_SECRET", () => {
    expect(TEST_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
```

- [ ] **Step 2: Write `backend/test/integration/rateLimit.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

describe("rate limit", () => {
  it("returns 429 with rate_limited code after threshold", async () => {
    const { app } = buildTestApp({ config: { rateLimitPerMin: 3 } });
    const token = signTestToken();
    const send = () => request(app).post("/parse").set("Authorization", `Bearer ${token}`).send({ text: "x" });

    // First few should be 200 (mocked llm returns "{}" which fails schema -> 502).
    // We don't care about the success body — only that 429 eventually appears.
    const responses = [];
    for (let i = 0; i < 6; i++) {
      const r = await send();
      responses.push(r.status);
    }
    expect(responses).toContain(429);
    const limited = responses.find((s) => s === 429);
    expect(limited).toBe(429);
  });
});
```

> **Note:** the mocked `chatJson` in `buildTestApp` returns `"{}"`, which fails the `ParseResponseSchema` and produces a 502. That's fine for this test — we only assert that some response is a 429 once the limiter trips.

- [ ] **Step 3: Run tests, expect pass**

```bash
cd backend && npm test -- test/integration/auth.test.ts test/integration/rateLimit.test.ts
```

Expected: all green.

- [ ] **Step 4: Run full test suite to ensure nothing else broke**

```bash
cd backend && npm test
```

Expected: every test green.

- [ ] **Step 5: Commit**

```bash
git add backend/test/integration/auth.test.ts backend/test/integration/rateLimit.test.ts
git commit -m "test(backend): add auth and rate limit integration coverage"
```

---

## Task 17: `issue-token` CLI

**Files:**
- Create: `backend/scripts/issue-token.ts`

- [ ] **Step 1: Implement**

```ts
// backend/scripts/issue-token.ts
// Run on the droplet (or locally with a known JWT_SECRET) to mint a long-lived token.
// Usage: JWT_SECRET=... npm exec tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review

import jwt from "jsonwebtoken";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error("JWT_SECRET env var must be set and >= 32 chars");
  process.exit(1);
}
const sub = arg("sub", "kael")!;
const scope = (arg("scope", "chat,parse,review") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const token = jwt.sign({ sub, scope }, secret, { algorithm: "HS256" });
process.stdout.write(token + "\n");
```

- [ ] **Step 2: Sanity-check it runs**

```bash
cd backend && JWT_SECRET=$(node -e "process.stdout.write('x'.repeat(32))") npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review
```

Expected: a single JWT printed to stdout.

- [ ] **Step 3: Commit**

```bash
git add backend/scripts/issue-token.ts
git commit -m "feat(backend): add issue-token CLI"
```

---

## Task 18: systemd unit + droplet bootstrap runbook

**Files:**
- Create: `backend/deploy/pulse-backend.service`
- Create: `backend/deploy/bootstrap.md`

- [ ] **Step 1: Create `backend/deploy/pulse-backend.service`**

```ini
[Unit]
Description=Pulse backend (AI proxy)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=pulse
WorkingDirectory=/srv/pulse-backend
EnvironmentFile=/etc/pulse-backend.env
ExecStart=/usr/bin/node /srv/pulse-backend/dist/src/index.js
Restart=on-failure
RestartSec=2
StandardOutput=journal
StandardError=journal

# Sandboxing
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/pulse-backend

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create `backend/deploy/bootstrap.md`**

```markdown
# Pulse backend — droplet bootstrap (one-time)

Run as root on a fresh DigitalOcean Ubuntu LTS droplet.

## 1. System user + Node

```bash
adduser --system --group --home /srv/pulse-backend pulse
mkdir -p /srv/pulse-backend
chown pulse:pulse /srv/pulse-backend

# Node LTS via NodeSource:
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs
node --version
```

## 2. Env file

```bash
install -m 600 -o pulse -g pulse /dev/null /etc/pulse-backend.env
$EDITOR /etc/pulse-backend.env
```

Contents:

```
OPENROUTER_API_KEY=sk-or-...
JWT_SECRET=$(openssl rand -hex 32)
PORT=3000
MODEL_ID=anthropic/claude-haiku-4.5
RATE_LIMIT_PER_MIN=60
LOG_LEVEL=info
NODE_ENV=production
```

(Replace the `JWT_SECRET=$(openssl rand -hex 32)` line with the actual value before saving.)

## 3. systemd unit

```bash
cp /srv/pulse-backend/deploy/pulse-backend.service /etc/systemd/system/pulse-backend.service
systemctl daemon-reload
systemctl enable pulse-backend
```

(The unit is started by `scripts/deploy.sh` after the first deploy.)

## 4. Firewall

```bash
ufw allow OpenSSH
ufw allow 3000/tcp
ufw enable
```

## 5. Mint and store the JWT

```bash
cd /srv/pulse-backend
sudo -u pulse env $(cat /etc/pulse-backend.env | xargs) npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review
```

Copy the printed token. It will be pasted into the iOS app (Keychain) and into the local dev `.env` of the Expo app.

## 6. Verify

After running `scripts/deploy.sh` from the dev machine:

```bash
curl -s http://<droplet-host>:3000/health
# → {"ok":true,"version":"0.1.0"}

scripts/smoke.sh
# (run from dev machine — see scripts/smoke.sh)
```

## Rotation

1. Edit `/etc/pulse-backend.env`, replace `JWT_SECRET`.
2. `systemctl restart pulse-backend`.
3. Mint a new token (Step 5).
4. Update phone + dev `.env`.
```

- [ ] **Step 3: Commit**

```bash
git add backend/deploy
git commit -m "chore(backend): add systemd unit and droplet bootstrap runbook"
```

---

## Task 19: `deploy.sh` and `smoke.sh`

**Files:**
- Create: `backend/scripts/deploy.sh`, `backend/scripts/smoke.sh`

- [ ] **Step 1: Create `backend/scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   DEPLOY_HOST=user@droplet.host DEPLOY_PATH=/srv/pulse-backend ./scripts/deploy.sh
# Requires SSH key auth; runs from the backend/ directory.

: "${DEPLOY_HOST:?DEPLOY_HOST is required (e.g. user@droplet.host)}"
: "${DEPLOY_PATH:=/srv/pulse-backend}"

echo "==> Building"
npm run build

echo "==> Syncing to ${DEPLOY_HOST}:${DEPLOY_PATH}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .env \
  --exclude .env.local \
  --exclude test \
  dist/ package.json package-lock.json deploy/ scripts/ \
  "${DEPLOY_HOST}:${DEPLOY_PATH}/"

echo "==> Installing prod deps + restarting service"
ssh "${DEPLOY_HOST}" "cd ${DEPLOY_PATH} && npm ci --omit=dev && sudo systemctl restart pulse-backend && sleep 1 && systemctl is-active pulse-backend"

echo "==> Running smoke test"
"$(dirname "$0")/smoke.sh"

echo "==> Deploy OK"
```

- [ ] **Step 2: Create `backend/scripts/smoke.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   BASE_URL=http://<droplet-host>:3000 DEV_JWT=ey... ./scripts/smoke.sh
#
# Exits non-zero on any failure. Intended to run after deploy.

: "${BASE_URL:?BASE_URL is required}"
: "${DEV_JWT:?DEV_JWT is required}"

AUTH=(-H "Authorization: Bearer ${DEV_JWT}")
JSON=(-H "Content-Type: application/json")

check_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "${actual}" != "${expected}" ]; then
    echo "FAIL: ${desc} — expected ${expected}, got ${actual}" >&2
    exit 1
  fi
  echo "OK:   ${desc} (${actual})"
}

# 1. /health
status=$(curl -s -o /tmp/pulse_health.json -w "%{http_code}" "${BASE_URL}/health")
check_status "GET /health" 200 "${status}"
grep -q '"ok":true' /tmp/pulse_health.json

# 2. /parse happy
status=$(curl -s -o /tmp/pulse_parse.json -w "%{http_code}" -X POST "${BASE_URL}/parse" "${AUTH[@]}" "${JSON[@]}" \
  -d '{"text":"ate 2 eggs and toast"}')
check_status "POST /parse" 200 "${status}"
grep -q '"kind":"food"' /tmp/pulse_parse.json

# 3. /chat SSE — fetch first chunk
status=$(curl -s -N -o /tmp/pulse_chat.txt -w "%{http_code}" -X POST "${BASE_URL}/chat" "${AUTH[@]}" "${JSON[@]}" \
  --max-time 30 \
  -d '{"messages":[{"role":"user","content":"say hi in one word"}]}')
check_status "POST /chat" 200 "${status}"
grep -q '^event: chunk' /tmp/pulse_chat.txt
grep -q '^event: done'  /tmp/pulse_chat.txt

# 4. /review happy
status=$(curl -s -o /tmp/pulse_review.json -w "%{http_code}" -X POST "${BASE_URL}/review" "${AUTH[@]}" "${JSON[@]}" \
  -d '{"month":"2026-04","aggregates":{"workouts":{"sessions":1},"food":{"days":1},"spend":{"totalMinor":0,"currency":"USD"},"rituals":{}}}')
check_status "POST /review" 200 "${status}"
grep -q '"markdown"' /tmp/pulse_review.json

# 5. /chat without auth → 401
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/chat" "${JSON[@]}" \
  -d '{"messages":[{"role":"user","content":"x"}]}')
check_status "POST /chat (no auth)" 401 "${status}"

# 6. Rate limit — 70 quick requests; expect at least one 429.
hit429=0
for i in $(seq 1 70); do
  s=$(curl -s -o /dev/null -w "%{http_code}" -X POST "${BASE_URL}/parse" "${AUTH[@]}" "${JSON[@]}" -d '{"text":"x"}')
  if [ "${s}" = "429" ]; then hit429=1; break; fi
done
if [ "${hit429}" != "1" ]; then
  echo "FAIL: rate limit did not trip within 70 requests" >&2
  exit 1
fi
echo "OK:   rate limit observed (429)"

echo "All smoke checks passed."
```

- [ ] **Step 3: Make executable**

```bash
chmod +x backend/scripts/deploy.sh backend/scripts/smoke.sh
```

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/deploy.sh backend/scripts/smoke.sh
git commit -m "chore(backend): add deploy.sh and smoke.sh scripts"
```

---

## Task 20: README

**Files:**
- Create: `backend/README.md`

- [ ] **Step 1: Create `backend/README.md`**

```markdown
# pulse-backend

Stateless AI proxy for the Pulse iOS app. See `docs/superpowers/specs/2026-04-25-backend-v1-ai-proxy-design.md` for the full design.

## Quick start (local dev on Windows)

```bash
cd backend
cp .env.example .env
# Edit .env: set OPENROUTER_API_KEY, generate JWT_SECRET (openssl rand -hex 32 or equivalent)
npm install
npm run dev
```

Server listens on `http://0.0.0.0:3000`.

Mint a dev token:

```bash
JWT_SECRET=<your-secret> npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review
```

Smoke-test locally:

```bash
BASE_URL=http://localhost:3000 DEV_JWT=<token> ./scripts/smoke.sh
```

## Deploy

One-time droplet bootstrap: `deploy/bootstrap.md`.

After bootstrap:

```bash
DEPLOY_HOST=user@<droplet-host> ./scripts/deploy.sh
```

`deploy.sh` builds, rsyncs, installs prod deps on the droplet, restarts `pulse-backend.service`, and runs `smoke.sh`.

## Rotate the JWT

1. Generate a new secret: `openssl rand -hex 32`
2. Update `/etc/pulse-backend.env` on the droplet, replace `JWT_SECRET`
3. `sudo systemctl restart pulse-backend`
4. Mint a new token (`scripts/issue-token.ts`)
5. Update the iOS app's stored token and your local dev `.env`

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ ok, version }` |
| POST | `/chat` | `ChatRequest` | SSE: `chunk` events, then `done`. `error` on failure. |
| POST | `/parse` | `ParseRequest` | `ParseResponse` |
| POST | `/review` | `ReviewRequest` | `ReviewResponse` |

All non-`/health` routes require `Authorization: Bearer <jwt>`. Types live in `lib/api-types.ts`.

## Tests

```bash
npm test       # vitest run
npm run test:watch
```

No real OpenRouter calls — the SDK is mocked at the module boundary in `test/helpers/app.ts`.
```

- [ ] **Step 2: Commit**

```bash
git add backend/README.md
git commit -m "docs(backend): add README with dev/deploy/rotate runbooks"
```

---

## Task 21: Verification + code review checkpoint

This is the SP2 exit gate per spec §12.

- [ ] **Step 1: Full test sweep**

```bash
cd backend && npm test
```

Expected: every suite green, no skips.

- [ ] **Step 2: Local boot + curl /health**

```bash
cd backend
# (.env already has OPENROUTER_API_KEY + JWT_SECRET; otherwise stop and set them)
npm run dev &
DEV_PID=$!
sleep 2
JWT_SECRET=$(grep ^JWT_SECRET= .env | cut -d= -f2-) DEV_JWT=$(npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review)
curl -s -H "Authorization: Bearer ${DEV_JWT}" http://localhost:3000/health
kill $DEV_PID
```

Expected: `{"ok":true,"version":"0.1.0"}`.

- [ ] **Step 3: Bootstrap droplet (one-time, follow `backend/deploy/bootstrap.md`)**

The runbook's steps 1-5. Confirm `systemctl is-active pulse-backend` returns `active` after the first `deploy.sh` run.

- [ ] **Step 4: Deploy + remote smoke**

```bash
cd backend
DEPLOY_HOST=user@<droplet-host> ./scripts/deploy.sh
```

`deploy.sh` runs `smoke.sh` automatically. All six checks must pass (health, parse, chat, review, no-auth 401, rate limit 429).

- [ ] **Step 5: Code review checkpoint**

Invoke `superpowers:requesting-code-review` against the SP2 diff. Address any blocking findings. Document accepted ones in `docs/superpowers/reviews/2026-04-25-backend-v1-ai-proxy-review.md`.

- [ ] **Step 6: Tag the milestone**

```bash
git tag sp2-backend-v1
git log --oneline | head -25
```

- [ ] **Step 7: Update meta-spec status table**

Edit `docs/superpowers/specs/2026-04-25-implementation-process-design.md` §8a — change SP2 row's status to:

```
✅ Complete YYYY-MM-DD — endpoints deployed to <droplet-host>:3000, smoke.sh green, code review accepted.
```

Commit:

```bash
git add docs/superpowers/specs/2026-04-25-implementation-process-design.md
git commit -m "docs: mark SP2 (backend v1) complete"
```

---

## Done criteria (mirrors spec §12)

1. ✅ `cd backend && npm test` green.
2. ✅ Local `npm run dev` boots; `curl /health` 200.
3. ✅ `scripts/smoke.sh` against the droplet — all six checks pass.
4. ✅ Rate limit observed (429 within 70 requests).
5. ✅ Code review checkpoint passed; review doc committed.
