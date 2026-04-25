# SP2 Backend v1 (AI proxy) — Code Review

**Date:** 2026-04-25
**Reviewer:** superpowers:code-reviewer agent
**Range:** `f96bf51..HEAD` (all SP2 commits + GH Action)
**Plan:** [2026-04-25-backend-v1-ai-proxy.md](../plans/2026-04-25-backend-v1-ai-proxy.md)
**Spec:** [2026-04-25-backend-v1-ai-proxy-design.md](../specs/2026-04-25-backend-v1-ai-proxy-design.md)

## Summary

Two BLOCKING and three IMPORTANT findings; both BLOCKING and the spec-deviating IMPORTANTs are addressed. NITs and OBSERVATIONs deferred (documented below).

## Addressed in this commit

| ID | Severity | Issue | Fix |
|---|---|---|---|
| B1 | BLOCKING | systemd `ExecStart` pointed at `/srv/pulse-backend/dist/...` but `deploy.sh`/CI rsynced `dist/` with trailing slash, exploding `dist/` contents at the deploy root. | Drop trailing slashes in `rsync` source list (deploy.sh + GH Action) so `dist` lands as a directory at `${DEPLOY_PATH}/dist/`. |
| B2 | BLOCKING | `/chat` did not abort the upstream OpenAI/OpenRouter stream on client disconnect (spec §5.1 step 6). | Threaded an `AbortController` through `LlmClient.chatStream`; `req.on("close")` calls `controller.abort()`; suppress error-event emission when locally aborted. |
| I2 | IMPORTANT | `/parse` returned `502 upstream_error` for both non-JSON model output and Zod schema-fail. Spec §5.2 says schema-fail → `validation_failed` and log raw model output. | `/parse` now emits a `ZodError` (→ 400 `validation_failed`) for both non-JSON and bad-schema cases, and logs the raw model output via the request-scoped logger. Genuine `UpstreamError` (chatJson rejection) still maps to 502. |
| I3 | IMPORTANT | `bootstrap.md` used `env $(cat ... | xargs)` — fragile under whitespace/quoting. | Replaced with `sudo -u pulse bash -c 'set -a; . /etc/pulse-backend.env; set +a; ...'`. |
| I4 | IMPORTANT | `requestId` middleware adopted client-supplied `X-Request-Id` if a UUID — divergence from spec §7 ("mints `crypto.randomUUID()` per request") and a log-poisoning vector. | Always mint server-side; updated unit test to assert pass-through is rejected. |

## Deferred (accepted)

| ID | Severity | Issue | Why deferred |
|---|---|---|---|
| I1 | IMPORTANT | `smoke.sh` rate-limit step uses a hardcoded loop count of 70 against a default `RATE_LIMIT_PER_MIN=60`. Passes today; would silently pass-by-luck if the limit were raised above the loop count. | Single-user system, default limit unchanged; revisit when the limit is tuned. Tracked here. |
| N1 | NIT | `/parse` overwrites `raw` with the user's input before validation, hiding a model-instruction-following failure. | Defensive behavior preferred; the value the caller wants is the user's text. |
| N2 | NIT | `/chat` wraps every mid-stream throw as `upstream_error`. | Only the wrapped OpenAI SDK throws there today; revisit if more logic moves into the iterator. |
| N3 | NIT | `req.id` typed `string | undefined`; consumers fall back to `"unknown"`. | Cosmetic; tightening the type touches multiple files for no behavioral change. |
| N4 | NIT | `vitest.config.ts` lacks a `@api-types` path alias. | Today every `@api-types` import is `import type` (erased before Vite); first runtime import would break. Add `vite-tsconfig-paths` if/when that happens. |
| N5 | NIT | `health.ts` hardcodes `VERSION = "0.1.0"`. | Spec §5.4 only requires a string; rotate manually for v1. |
| N6 | NIT | SSE parser duplicated inline in `chat.test.ts`. | One usage today; promote to `test/helpers/sse.ts` if a second test reaches for it. |
| N7 | NIT | `index.ts` ESM "is main" check uses string compare (`file://${process.argv[1]}`); brittle on Windows. | Production runs on Linux droplet via systemd; dev uses `npm run dev` (tsx watch), not `npm start`. |
| O1 | OBSERVATION | CI uses `ssh-keyscan` (TOFU) for the droplet host key. | Consistent with the spec's plaintext-HTTP tradeoff. Pin via repo secret if/when paranoia warrants. |
| O2 | OBSERVATION | `deploy.sh` and GH Action both rsync `scripts/`, redeploying themselves. | Harmless. |
| O3 | OBSERVATION | `issue-token.ts` does not validate scopes against the known set. | Token is useless if scope mistyped — fails closed. |
| O4 | OBSERVATION (positive) | `errorHandler` does not leak request bodies; Zod messages do not include offending values. | Confirmed. Spec §7 honored. |
| O5 | OBSERVATION (positive) | LLM mock boundary is clean; tests never import the OpenAI SDK. | Matches spec §11.2. |
| O6 | OBSERVATION (positive) | Per-test fresh app + `pool: "forks"` keeps the in-memory rate-limit store isolated. | Good. |

## Verification status (spec §12)

| # | Gate | Status |
|---|---|---|
| 1 | `npm test` green | ✅ 49 tests passing across 12 files |
| 2 | Local boot + `curl /health` | ⏸ pending user — needs `.env` with real `OPENROUTER_API_KEY`/`JWT_SECRET` |
| 3 | Deployed smoke green | ⏸ pending user — needs droplet bootstrap + first deploy via GH Action |
| 4 | Rate limit observed in prod | ⏸ pending user — covered by `smoke.sh` step 6 once #3 runs |
| 5 | Code review checkpoint | ✅ this document |
