# Pulse — Sub-project 2: Backend v1 (AI proxy)

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Parent:** [Implementation Process Design](2026-04-25-implementation-process-design.md)
**Sub-project:** 2 of 7

---

## 1. Purpose

Stand up the small, stateless HTTP service that sits between the Pulse iOS app and the LLM provider. The service exposes three endpoints — `/chat`, `/parse`, `/review` — and is the only thing in the system that holds the provider API key.

This sub-project ships the backend in isolation: deployed, tested with `curl`, and ready to be consumed by SP3b (Ask Pal) and SP5 (monthly review). No iOS code is written here.

---

## 2. Non-goals

- **Receipt parsing** (email worker). That is a separate endpoint and a separate concern, addressed in SP5 ("Backend v2 + iOS v3 — email + review"). `/parse` in v1 is for **user-typed entries only**.
- **TLS / HTTPS.** Deferred. Plaintext HTTP for v1 — the risk (token interception on hostile networks) is documented in §10 and accepted by the user.
- **Cloudflare Tunnel / Cloudflare Access.** Considered and deferred; revisitable later without app changes.
- **Auth UX in the iOS app.** Token bootstrap (paste into Keychain, Settings screen, etc.) is decided in SP3b. SP2 only ships the server-side verification.
- **Conversation history persistence.** Server is stateless. History lives in the phone's SQLite (SP3a/3b).
- **Multi-user, login flows, refresh tokens, account UI.** None of these. One user, one long-lived JWT.
- **Docker, nginx, Caddy, PM2, cluster mode, queues, Redis, a database.** Single Node process under `systemd`. YAGNI for v1.
- **Quality benchmarking of model output.** We test the contract (shapes, status codes, streaming format), not the prose.

---

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| Runtime | Node.js LTS | Same major as iOS app's tooling |
| Language | TypeScript (strict) | Shared types with the RN client |
| Framework | Express 4 | Boring, well-known, AI generates it cleanly |
| Validation | Zod | Parses request bodies; schemas mirror `lib/api-types.ts` |
| LLM provider | **OpenRouter** | Targeting `anthropic/claude-haiku-4.5` |
| LLM SDK | `openai` npm package, base URL pointed at OpenRouter | OpenRouter is OpenAI-API-compatible |
| Logging | `pino` → stdout (JSON lines) | Captured by `journalctl` |
| Auth | JSON Web Token, HS256, long-lived | Single token, no refresh, no `exp` for v1 |
| Rate limit | `express-rate-limit` | 60 req/min per IP, in-memory store |
| Test runner | `vitest` | Native TS, fast, good ESM story |
| HTTP test client | `supertest` | Used by integration tests |
| Process supervision | `systemd` unit on the droplet | Restart on failure |
| Deploy | `rsync` over SSH + `systemctl restart` | No Docker, no CI for v1 |
| TLS | **None for v1** | Plaintext HTTP — see §10 |

The meta-spec listed Anthropic SDK direct; this spec switches to OpenRouter. Reason: simpler billing for a solo dev, single key for future model swaps, no behavior change for the app.

---

## 4. Architecture

Single stateless Express process. One port, one binary, no background workers.

```
iPhone (Pulse app)                        DO droplet
─────────────────                         ──────────────────────────
POST /chat   ──────▶  HTTP (no TLS v1)  ▶ Express app (port 3000)
POST /parse                                  ├─ requestId middleware
POST /review                                  ├─ jwt-verify middleware
                                              ├─ rate-limit middleware
                                              ├─ route handlers
                                              └─ OpenRouter SDK ──▶ OpenRouter API
                              SSE  ◀──────         (HTTPS, server-side)
                              JSON ◀──────
```

Properties:

- **Stateless.** No DB, no Redis, no in-memory session. Every request carries everything it needs.
- **Single process.** `node dist/index.js` under systemd. No PM2, no clustering — one user can't saturate one core through OpenRouter latency.
- **Config via env.** `OPENROUTER_API_KEY`, `JWT_SECRET`, `PORT`, `RATE_LIMIT_PER_MIN`, `LOG_LEVEL`, `MODEL_ID`. Loaded by `dotenv` in dev; by systemd `EnvironmentFile=` in prod.
- **Crash semantics.** Uncaught exceptions log + exit non-zero; systemd restarts. The error handler middleware catches request-scoped errors and returns the error envelope.

---

## 5. Endpoint contracts

All requests:
- `Content-Type: application/json`
- `Authorization: Bearer <jwt>`

All non-2xx responses use the error envelope:

```ts
{ error: { code: ErrorCode, message: string }, requestId: string }
```

Error codes: `unauthorized`, `forbidden`, `rate_limited`, `validation_failed`, `upstream_error`, `internal`.

Shared TypeScript types live at repo root in `lib/api-types.ts`, imported by both `app/` (RN) and `backend/` (Express). Zod schemas in `backend/src/schemas/` are the runtime mirror; CI/test-time check ensures they stay in sync structurally.

> **Note on entity shapes.** `Entry`, `FoodEntry`, `WorkoutEntry`, `SpendEntry`, the `*Aggregate` types, and `TodaySummary` are stubbed in `lib/api-types.ts` for SP2 with minimal fields needed to validate request shape. SP3a (data model) tightens them. SP2 must not assume more structure than the stubs declare.

### 5.1 `POST /chat` — streaming (SSE)

**Request**

```ts
type ChatRequest = {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    recentEntries?: Entry[];
    today?: TodaySummary;
  };
};
```

The client manages full conversation history; server is stateless.

**Response** — `Content-Type: text/event-stream`

```
event: chunk
data: {"delta":"Sure, "}

event: chunk
data: {"delta":"based on your..."}

event: done
data: {"usage":{"input_tokens":123,"output_tokens":45}}
```

On failure mid-stream:

```
event: error
data: {"code":"upstream_error","message":"...","requestId":"..."}
```

The handler:
1. Validates body with Zod.
2. Builds the system prompt (persona + formatting rules + context block from `context`).
3. Calls OpenRouter with `stream: true`, `model: process.env.MODEL_ID`.
4. Forwards each delta as a `chunk` SSE event.
5. Emits `done` with usage on completion, or `error` on upstream failure.
6. Aborts the upstream request if the client disconnects.

### 5.2 `POST /parse` — batched JSON

**Request**

```ts
type ParseRequest = {
  text: string;
  hint?: "food" | "workout" | "spend"; // optional; server can infer
};
```

**Response**

```ts
type ParseResponse =
  | { kind: "food";    data: FoodEntry;    confidence: "high" | "low"; raw: string }
  | { kind: "workout"; data: WorkoutEntry; confidence: "high" | "low"; raw: string }
  | { kind: "spend";   data: SpendEntry;   confidence: "high" | "low"; raw: string };
```

Implementation uses Haiku via OpenRouter with structured-output (JSON mode or tool-call equivalent — the handler picks one and validates the result with Zod before returning). On Zod failure, returns `validation_failed` and logs the raw model output (not the user's input text).

`confidence: "low"` is a hint to the iOS app to surface a confirmation UI before committing the entry.

### 5.3 `POST /review` — batched JSON

**Request**

```ts
type ReviewRequest = {
  month: string; // "YYYY-MM"
  aggregates: {
    workouts: WorkoutAggregate;
    food: FoodAggregate;
    spend: SpendAggregate;
    rituals: RitualAggregate;
  };
};
```

**Response**

```ts
type ReviewResponse = {
  markdown: string;
  generatedAt: string; // ISO 8601 UTC
};
```

Long generation; client shows a spinner. Handler is wired and tested in SP2 but not consumed by the app until SP5.

### 5.4 `GET /health`

```ts
{ ok: true, version: string }
```

No auth, no rate limit. Used by the deploy smoke test and any uptime monitor.

---

## 6. Auth

**Algorithm.** HS256.

**Secret.** `JWT_SECRET`, ≥32 random bytes, generated once and stored only on the droplet (in the systemd `EnvironmentFile`). Never committed.

**Payload.**

```ts
{ sub: "kael", iat: <number>, scope: ["chat", "parse", "review"] }
```

No `exp` for v1 (single user, manual rotation). `scope` is forward-looking — middleware checks the request's route is in the token's scope, so a future read-only token can be issued without code changes.

**Verification.** `jsonwebtoken.verify` in middleware. On any failure (missing header, wrong scheme, bad signature, scope mismatch) → `401 unauthorized` (or `403 forbidden` for scope mismatch) with the error envelope. `/health` is exempt.

**Issuance.** `backend/scripts/issue-token.ts` — small CLI run on the droplet. Prints a token to stdout. The user pastes it into the iOS Keychain (UX is SP3b's problem) or an `.env` file in dev.

**Rotation.** Documented in `backend/README.md`:
1. Generate new `JWT_SECRET` (e.g., `openssl rand -hex 32`).
2. Update `/etc/pulse-backend.env`.
3. `systemctl restart pulse-backend`.
4. Run `issue-token.ts` to mint the new token.
5. Update phone (SP3b will provide the UX; for SP2 it's manual).

---

## 7. Rate limit, errors, logging

**Rate limit.** `express-rate-limit`, default 60 req/min per IP, in-memory store. Returns `429` with standard `RateLimit-*` headers and the error envelope (`code: rate_limited`). Configurable via `RATE_LIMIT_PER_MIN` env var. Single instance, so an in-memory store is sufficient.

**Error handler.** Express error-handling middleware at the end of the chain. Maps known error classes to the envelope:

| Source | Status | Code |
|---|---|---|
| Missing/invalid JWT | 401 | `unauthorized` |
| Token scope mismatch | 403 | `forbidden` |
| Rate limit exceeded | 429 | `rate_limited` |
| Zod parse failure | 400 | `validation_failed` |
| OpenRouter non-2xx or network error | 502 | `upstream_error` |
| Anything else | 500 | `internal` |

Every error response includes `requestId`.

**Request ID.** Middleware mints `crypto.randomUUID()` per request, attaches to `req.id`, returns it in `X-Request-Id` response header, and includes it in every log line.

**Logging.** `pino` → stdout, JSON lines, captured by `journalctl`. Per request: method, path, status, duration ms, `requestId`. On `upstream_error`: log OpenRouter response status and the first 200 chars of the body. **Never log request bodies** (they contain user message text and entry content).

---

## 8. Repo layout

```
pulse/
  backend/
    src/
      index.ts              # express app + listen
      routes/
        chat.ts             # SSE handler
        parse.ts
        review.ts
        health.ts
      middleware/
        auth.ts
        rateLimit.ts
        requestId.ts
        errorHandler.ts
      lib/
        openrouter.ts       # SDK wrapper
        prompts/
          chat.ts           # system prompt + persona
          parse.ts          # parse instruction + JSON schema
          review.ts         # review instruction
        logger.ts           # pino instance
      schemas/              # Zod schemas mirroring api-types
    scripts/
      issue-token.ts        # JWT minting CLI
      deploy.sh             # rsync + ssh restart
      smoke.sh              # post-deploy curl checks
    test/
      unit/
      integration/
      fixtures/
    .env.example
    package.json
    tsconfig.json
    README.md
  lib/
    api-types.ts            # SHARED — imported by app/ and backend/
```

`lib/api-types.ts` at the repo root is imported by both packages via TypeScript path mapping. No npm workspaces are introduced for v1 — both `package.json` files exist independently in the same git repo.

---

## 9. Dev loop and deploy

### Local dev (Windows)

- `cd backend && npm run dev` → `tsx watch src/index.ts`, listens on `0.0.0.0:3000`.
- iOS app reads `EXPO_PUBLIC_API_BASE_URL` from the Expo env. In dev: `http://<windows-LAN-IP>:3000`. In prod (EAS build): the droplet's URL.
- Dev JWT lives in the app's `.env` for convenience; rotation is per-developer (here, just the user).

### Deploy

`backend/scripts/deploy.sh`:

1. `npm run build` (tsc → `dist/`).
2. `rsync -avz --delete dist/ package.json package-lock.json` to droplet `/srv/pulse-backend/`.
3. `ssh` → `cd /srv/pulse-backend && npm ci --production && systemctl restart pulse-backend`.
4. `scripts/smoke.sh` against the droplet — exits non-zero if any check fails.

### Droplet bootstrap (one-time, SP2 plan turns this into a runbook)

- Create `pulse` system user.
- Install Node LTS via NodeSource.
- Drop `/etc/systemd/system/pulse-backend.service` (`Restart=on-failure`, `EnvironmentFile=/etc/pulse-backend.env`, `User=pulse`).
- Drop `/etc/pulse-backend.env` with `OPENROUTER_API_KEY`, `JWT_SECRET`, `PORT=3000`, `MODEL_ID=anthropic/claude-haiku-4.5`, `NODE_ENV=production`. Mode 600, owned by `pulse`.
- `systemctl enable --now pulse-backend`.
- `ufw allow 3000` (or restrict to specific IPs if the user prefers).

No Docker, no nginx, no Caddy. Express binds directly to `:3000` over plaintext.

---

## 10. Accepted tradeoffs

| Tradeoff | Risk | Why accepted |
|---|---|---|
| **Plaintext HTTP** | Long-lived JWT can be sniffed on hostile networks (coffee-shop WiFi, ISP MITM) and replayed against `/parse` and `/review` (drains OpenRouter credit) and `/chat` (reads message text). | Single-user personal endpoint; user opts to defer TLS. Mitigated partially by rate limit (60 req/min/IP caps cost blast radius). Reversible without app changes by dropping Caddy in front later. |
| **No `exp` on JWT** | Stolen token is valid until manual rotation. | Single user with one device. Adding `exp` requires a refresh flow; not worth the complexity until there are multiple users or app installs. |
| **In-memory rate limit store** | Counters reset on every restart. | Single instance, restarts are rare. `redis-store` is a one-line swap if symptoms appear. |
| **No quality benchmark for model output** | A bad prompt or model regression ships unnoticed. | Caught by hand the first time the iOS app uses it (SP3b). YAGNI to build an LLM eval harness for v1. |
| **OpenRouter dependency** | Outage stops Pal and Review. | Acceptable for personal use. Migration path: swap base URL + model ID; the SDK code stays. |
| **Stub entity types** | `lib/api-types.ts` shapes are loose in SP2 and tighten in SP3a. | Avoids speculative design before the data model is real. SP3a explicitly revisits and replaces. |

---

## 11. Testing strategy

TDD applies to: all three route handlers, prompt assembly, JWT auth middleware. Tests written first.

### 11.1 Unit (pure functions)

- `buildChatPrompt(messages, context) → string` — given fixtures, produces expected text (golden test).
- `buildParsePrompt(text, hint) → { system, user }` — same.
- `buildReviewPrompt(month, aggregates) → string` — same.
- Zod schemas — valid input passes, invalid input throws with expected error paths (one negative test per required field).
- JWT helper — valid token → claims; expired/wrong-sig/missing-scope → throws specific error class.

### 11.2 Integration (Express + supertest, OpenRouter mocked)

The OpenRouter SDK is mocked at the module boundary. Integration tests cover:

- `GET /health` → `200 { ok: true }`, no auth required.
- Missing `Authorization` → `401`, error envelope, `code: unauthorized`.
- Bad signature → `401`.
- Scope mismatch → `403`.
- Rate limit: 61 requests in <60s → at least one `429` with `code: rate_limited`.
- `/parse` with invalid body → `400 validation_failed`.
- `/parse` happy path → `200`, body matches `ParseResponse` schema.
- `/chat` happy path → SSE: at least one `chunk` event, then a `done` event; `Content-Type: text/event-stream`.
- `/chat` upstream failure → SSE `error` event with `upstream_error` code.
- `/review` happy path → `200`, non-empty `markdown`.
- Every response carries `X-Request-Id` and matching `requestId` in error bodies.

### 11.3 Smoke (real network, post-deploy)

`backend/scripts/smoke.sh` runs against the deployed droplet, with a fixed token in `$DEV_JWT`:

- `GET /health` → `200`.
- `POST /parse` with `{ "text": "ate 2 eggs and toast" }` → `200`, parsed JSON validates against `ParseResponse`, `kind === "food"`.
- `POST /chat` with one user message → SSE stream with at least one `chunk` and one `done`.
- `POST /review` with fixture aggregates → `200`, `markdown` non-empty.
- `POST /chat` without `Authorization` → `401`.
- 70 rapid requests → at least one `429`.

Total runtime <30s. Used by deploy script and as the §12 verification gate.

### 11.4 Out of scope

- Real OpenRouter network calls in unit/integration. Mocked at SDK boundary.
- Quality of model prose. Tested by the human in SP3b and onward.
- iOS-side SSE parsing. Tested in SP3b.

---

## 12. Verification surface

SP2 is **complete** when all five pass:

1. **`npm test` is green** in `backend/` — unit and integration suites, no skips.
2. **Local dev loop works.** `cd backend && npm run dev` boots; `curl -H "Authorization: Bearer $DEV_JWT" http://localhost:3000/health` → `200`.
3. **Deployed smoke test passes.** `backend/scripts/smoke.sh` against the droplet, all checks green.
4. **Rate limit observable on the deployed instance.** A loop of 70 requests in <60s yields at least one `429` with the standard envelope.
5. **Code review checkpoint passes.** `superpowers:requesting-code-review` against the SP2 diff; blocking findings addressed; accepted ones documented in `docs/superpowers/reviews/2026-04-25-backend-v1-ai-proxy-review.md`.

Out of scope for SP2 verification: iOS app calling these endpoints (SP3b's job), OpenRouter quality/cost tuning, TLS, monitoring beyond `journalctl`.

---

## 13. Inputs needed before the SP2 plan can execute

These are not blockers for *this* spec; they are inputs for the SP2 plan.

- **Droplet OS** — confirm distro and version (Ubuntu LTS expected). Affects systemd unit and Node install steps.
- **OpenRouter account + API key** — user confirmed they have one. Plan must include "store key in `/etc/pulse-backend.env`, never commit."
- **Droplet hostname/IP** — the URL the iOS app's prod build will hit. Plan can leave it as `<droplet-host>` until known.
- **Windows LAN IP** — needed for the dev `EXPO_PUBLIC_API_BASE_URL`. Easy to look up at plan time.

---

## 14. What this spec is NOT

- Not the iOS-side SSE consumer or token-bootstrap UX. That is SP3b.
- Not the receipt-parsing email worker. That is SP5.
- Not the implementation plan. The next step is `superpowers:writing-plans` against this spec.
