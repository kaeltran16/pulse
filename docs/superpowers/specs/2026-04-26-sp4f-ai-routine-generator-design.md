# SP4f — AI Routine Generator

**Date:** 2026-04-26
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-25-ios-v2-workouts-design.md`](./meta/2026-04-25-ios-v2-workouts-design.md) §3 row 6
**Scope:** A new `/(tabs)/move/generate` route that takes a free-text fitness goal, calls a new backend `/generate-routine` endpoint, previews the AI-built routine, and saves it into 4a's tables so it appears in 4c's PreWorkout list and is editable.

---

## 1. What this slice ships

A complete, end-to-end AI routine generator:

- **iOS route** at `app/(tabs)/move/generate.tsx`. Reachable from PreWorkout (entry point already wired in `app/(tabs)/move/index.tsx:107`). Renders the design at `design_handoff/src/routine-generator.jsx` — gradient hero, prompt textarea, six quick-pick goal chips, loading pill, error banner, generated-routine preview hero with rationale, per-exercise list with set chips, "Try again" / "Save routine" footer.
- **Backend route** at `POST /generate-routine` (Express, on the existing droplet). New, dedicated to routine generation; `/parse` is untouched.
- **Save path** that turns the LLM's JSON into rows in 4a's `routines` / `routine_exercises` / `routine_sets` tables using the editor's existing transactional helpers, then navigates the user into 4c's RoutineEditor for the new routine.

After this slice, only **4g (Live Activities — visual verification deferred)** remains in SP4.

---

## 2. Locked decisions (from brainstorm)

These are settled inputs to the plan and are **not** open for relitigation.

| Decision | Choice | Reason |
|---|---|---|
| Backend endpoint shape | New `/generate-routine` route; `/parse` untouched | Routine generation has its own prompt, schema, validation, and save path; mixing it into `/parse` would muddy a small focused route. No `/coach/*` family — YAGNI. |
| Prompt context | **Cold** — request body is `{ goal: string }`; no PR history sent | Result is editable twice (preview + 4c editor); "intermediate lifter" defaults are decisive and easy to nudge. Warm prompt adds a query, payload, prompt-token cost, and a cold-start branch — all for a fix the user can do in 5 seconds in the editor. |
| Validation strictness | **Strict fail** — any Zod / catalog-id failure → 502; iOS shows "couldn't generate, try again" | "Try again" is already a first-class action in the UI. Best-effort recovery ships a degraded routine the user has to repair in 4c. Repair-pass doubles latency on a rare error class. |
| Strength/cardio discriminator | `tag === "Cardio"` | The handoff already uses `tag` as the signal; no parallel `mode` field. Validator branches per arm. |
| Save path | Reuse `createEmptyRoutine` + `updateRoutine` inside a single Drizzle transaction | Same code path as 4c's editor (162 tests already covering it); no parallel save logic to drift. |
| `rationale` persistence | **Ephemeral** — shown on result hero, discarded on Save | Persisting requires either a notes column the editor doesn't use or an audit table for a personal-use app with no analyst behind it. |
| Post-Save destination | `router.replace` to `/(tabs)/move/[routineId]/edit` | Most generated routines benefit from at least one nudge; landing in the editor acknowledges that. `replace` so back-button returns to PreWorkout, not the generator. |
| Quick-pick chips | Ship the handoff's six chips verbatim | Push, Full-body, Pull-back, HIIT, Legs-posterior, Home-no-gear. Not a brainstorm decision worth re-litigating. |

Architectural shape was not optional: parent meta-spec §1 forbids API keys on device ("never in app") and §7 keeps storage local-only, so the only viable shape is **iOS → backend → LLM → JSON back → iOS validates + saves locally**.

---

## 3. Architecture

```
┌─ iOS (Expo Router) ──────────────────────────────────────────┐
│  app/(tabs)/move/index.tsx  ── existing "Generate routine    │
│        │                       with AI" button at line 107   │
│        │ router.push                                          │
│        ▼                                                      │
│  app/(tabs)/move/generate.tsx  ── NEW route                  │
│        │                                                      │
│        ├─ State: idle / loading / error / result             │
│        │                                                      │
│        ├─ Calls: generateRoutine(goal)                        │
│        │           ▲ NEW function in lib/pal/client.ts;       │
│        │           │ Authorization: Bearer header from SP2    │
│        ▼                                                      │
│   On Save → lib/db/queries/saveGeneratedRoutine(generated)   │
│              │ NEW; wraps createEmptyRoutine + updateRoutine │
│              ▼                                                │
│   router.replace → /(tabs)/move/[routineId]/edit              │
└────────────────────────────────────────────────────────────────┘
                       │ HTTPS, Authorization: Bearer <jwt>
                       ▼
┌─ Backend (DO droplet, existing) ─────────────────────────────┐
│  POST /generate-routine                ── NEW route          │
│   ├─ middleware: authMiddleware(secret, "generate-routine")  │
│   ├─ schema:  GenerateRoutineRequestSchema  (Zod)            │
│   │           GenerateRoutineResponseSchema (Zod)            │
│   ├─ prompt assembly: prompts/generate-routine.ts             │
│   │     enumerates the 21 seeded exercises inline             │
│   └─ openrouter.ts (existing) → claude-haiku-4-5             │
│        validate → 200 JSON | 502 generation_failed           │
└────────────────────────────────────────────────────────────────┘
```

### Dependencies on prior slices

- **4a**'s seeded exercise catalog (21 exercises in the `exercises` table). Backend mirrors this list in `backend/src/lib/exercise-catalog.ts`; an iOS-side parity test asserts the two match.
- **4a**'s `createEmptyRoutine` + **4c**'s `updateRoutine` — the save path reuses both. **No DB schema migration.**
- **SP2**'s iOS client conventions in `lib/pal/client.ts` (module-level functions, `PAL_BASE_URL`/`PAL_TOKEN` from `./config`, `Authorization: Bearer` header, typed errors from `./errors`). The new `generateRoutine` function is added to that file alongside `parse` / `chatStream`.
- **SP2**'s backend conventions: `lib/openrouter.ts`'s `chatJson` LLM client, `authMiddleware(secret, scope)` with scoped JWTs, `errorHandler` middleware that maps thrown errors to a typed `ErrorEnvelope`. `/generate-routine` mirrors `/parse` and `/chat` in shape.

### No schema migration

Every column the save path writes already exists in 4a + migration `0002_late_tempest`.

---

## 4. Backend route

### 4.1 File layout

```
backend/src/
  routes/generate-routine.ts        ← Express handler
  schemas/generate-routine.ts       ← Zod request + response
  lib/
    exercise-catalog.ts             ← canonical id → {name, group, muscle}
    prompts/generate-routine.ts     ← prompt builder
```

### 4.2 Request

`POST /generate-routine`, header `Authorization: Bearer <jwt>`, scoped JWT issued for the new scope `"generate-routine"` (a small additive change to the `Scope` type in `backend/src/middleware/auth.ts`). Mounted with `authMiddleware(secret, "generate-routine")` exactly like `/parse` and `/chat`.

```ts
GenerateRoutineRequestSchema = z.object({
  goal: z.string().min(3).max(280),
});
```

### 4.3 Response (200)

Discriminated union on `tag`:

```ts
type GenerateRoutineResponse =
  | { tag: "Cardio";
      name: string; estMin: number; rationale: string;
      exercises: [{
        id: string;
        sets: { duration?: number; distance?: number; pace?: string }[];
      }];
    }
  | { tag: "Upper" | "Lower" | "Full" | "Custom";
      name: string; estMin: number; rationale: string;
      exercises: {
        id: string;
        sets: { reps: number; weight: number }[];
      }[];
    };
```

Strength arm: 3–6 exercises × 3–4 sets each, `weight ≥ 0` (bodyweight = 0).
Cardio arm: exactly 1 exercise × 1+ sets; each set has `duration` (min) **or** `distance` (km).

### 4.4 Error responses

All responses use the existing typed `ErrorEnvelope` from `@api-types`: `{ error: { code, message }, requestId }`.

| Status | `error.code` | Cause | Mechanism |
|---|---|---|---|
| 400 | `validation_failed` | Zod fails on the request body. | `next(ZodError)` → existing `errorHandler` mapping. |
| 401 | `unauthorized` | Missing / malformed bearer token. | Existing `authMiddleware`. |
| 403 | `forbidden` | Token lacks the `generate-routine` scope. | Existing `authMiddleware`. |
| 502 | `generation_failed` | LLM output failed JSON parsing, response schema, or catalog-id check. | **NEW** `GenerationFailedError` class added to `errorHandler.ts`; **NEW** `"generation_failed"` member added to the `ErrorCode` union in `@api-types`. |
| 502 | `upstream_error` | OpenRouter returned non-2xx, threw, or the call exceeded `PROMPT_TIMEOUT_MS`. | Existing `UpstreamError`. (Timeout doesn't get its own status — it manifests as `upstream_error`, matching the pattern that `lib/openrouter.ts` already establishes for `/parse`.) |
| 500 | `internal` | Unhandled. | Existing fallback in `errorHandler`. |

`PROMPT_TIMEOUT_MS` defaults to **20 000 ms** and is read from env (matches the existing pattern; if `lib/openrouter.ts` doesn't yet expose a timeout knob, the plan adds it as a constructor option to `chatJson`).

### 4.5 Prompt strategy

`prompts/generate-routine.ts` exports `buildGenerateRoutinePrompt(goal, catalog) → MessageParam[]`:

- **System message:** brief role ("strength coach selecting from a fixed exercise catalog"), output constraints (JSON only, no fences, no prose), and the rules block (3–6 strength exercises × 3–4 sets, intermediate-lifter weights in kg, bodyweight = 0, 1 cardio exercise, etc.).
- **User message:** `Goal: "${goal}"\n\nCatalog (use these EXACT ids):\n${catalog.map(e => `- ${e.id}: ${e.name} (${e.group}/${e.muscle})`).join('\n')}\n\nReturn JSON matching the schema.`
- Sampling: `temperature: 0.5`, `max_tokens: 800`.
- Model: `claude-haiku-4-5` via OpenRouter (parent meta-spec §1).

### 4.6 Catalog mirroring (drift defense)

`backend/src/lib/exercise-catalog.ts` exports `EXERCISE_CATALOG: { id, name, group, muscle }[]` — backend's canonical source, used by both the prompt builder and the validator.

A parity test in the iOS suite (`lib/db/__tests__/exercise-catalog-parity.test.ts`) imports the backend file via relative path and asserts `seed-workouts.ts` and `EXERCISE_CATALOG` contain the same id set with the same `name` / `group` / `muscle` values. Fails CI if either side drifts.

### 4.7 Validation order in the handler

1. **Request schema** — `GenerateRoutineRequestSchema.parse(req.body)` → throws `ZodError` → `errorHandler` returns 400 `validation_failed`.
2. **Call OpenRouter** via `deps.llm.chatJson(...)` (subject to `PROMPT_TIMEOUT_MS`). Throws → `next(UpstreamError)` → 502 `upstream_error`.
3. **JSON parse** the model output (strip code fences first if present). On syntax error → `next(new GenerationFailedError("model output was not valid JSON"))` → 502 `generation_failed`.
4. **Response schema** — `GenerateRoutineResponseSchema.safeParse(parsed)`. On fail → `next(new GenerationFailedError(zodIssues))` → 502 `generation_failed`. (Note: this differs from `/parse`'s current behavior, which mis-routes model-output failures through `ZodError`/400. We do not retrofit `/parse` here.)
5. **Catalog ID check** — every `exercises[].id` must be in `EXERCISE_CATALOG` set. On miss → `next(new GenerationFailedError(\`unknown exercise id: ${id}\`))` → 502 `generation_failed`.

### 4.8 TDD scope (backend)

- Request schema validation (rejects empty / oversize goal).
- Response schema validation:
  - Strength arm happy path.
  - Cardio arm happy path.
  - Each rejection: missing fields, wrong types, wrong cardinality (e.g., 2 cardio exercises, 7 strength exercises), wrong arm shape (cardio sets in a strength arm).
- Catalog ID resolution (rejects unknown id; reports the offending id in `error.message`).
- Prompt builder: catalog enumeration order is stable, escape behavior on goal text.
- `GenerationFailedError` mapping in `errorHandler` (asserts 502 + `code === "generation_failed"`).
- Handler integration with mocked `LlmClient` (`chatJson`):
  - 200 happy path (strength + cardio).
  - 502 `generation_failed` on mock-returned junk JSON.
  - 502 `generation_failed` on mock-returned valid JSON that fails the response schema.
  - 502 `generation_failed` on mock-returned valid JSON with unknown id.
  - 502 `upstream_error` on mock `chatJson` throw / timeout.
  - 401 / 403 from middleware (existing tests cover the middleware, but a happy-auth integration test on the new route is worth adding).

---

## 5. iOS route

### 5.1 File layout

```
app/(tabs)/move/
  generate.tsx                              ← NEW route (orchestrator)
components/move/generate/                   ← NEW folder (presentational)
  GenerateHero.tsx                          ← gradient pitch card (idle state)
  PromptCard.tsx                            ← textarea + Generate button
  QuickPickGrid.tsx                         ← 6 chip grid (idle state)
  LoadingPill.tsx                           ← spinner + "Pal is building…"
  ErrorBanner.tsx                           ← red-tinted error card
  ResultHero.tsx                            ← gradient generated-routine card
  ResultExerciseList.tsx                    ← per-exercise rows + set chips
  ResultActions.tsx                         ← "Try again" + "Save routine" footer
lib/pal/
  client.ts                                 ← MODIFY: add `generateRoutine` alongside `parse` / `chatStream`
  errors.ts                                 ← MODIFY: add `GenerationFailedError`
lib/db/queries/
  saveGeneratedRoutine.ts                   ← NEW save helper
```

The route is the orchestrator; sub-components are presentational and stateless (props in, callbacks out). This matches how 4e split PostWorkout into hero / stat-grid / recap-card pieces.

### 5.2 State machine

Route-local `useReducer`:

```ts
type State =
  | { phase: "idle";    prompt: string }
  | { phase: "loading"; prompt: string }
  | { phase: "error";   prompt: string; message: string }
  | { phase: "result";  prompt: string; data: GenerateRoutineResponse };

type Action =
  | { type: "edit_prompt"; value: string }
  | { type: "submit" }
  | { type: "succeeded"; data: GenerateRoutineResponse }
  | { type: "failed"; message: string }
  | { type: "reset" };          // "Try again" → back to idle, prompt cleared
```

Transitions:

- `idle → loading` on `submit`.
- `loading → result` on `succeeded`.
- `loading → error` on `failed`.
- `error → loading` on `submit` (re-tries with same prompt; user can edit first).
- `result → idle` on `reset`. Prompt cleared so the next attempt is a fresh thought.

Quick-pick chip behavior: tap → `dispatch({ type: "edit_prompt", value: chip.label })` → immediately `dispatch({ type: "submit" })`. Same as handoff.

### 5.3 Backend client

A new function added to `lib/pal/client.ts` (mirroring `parse()`'s shape — same imports, same envelope handling, same error classes from `./errors`):

```ts
export async function generateRoutine(goal: string): Promise<GenerateRoutineResponse>
```

It does `POST ${PAL_BASE_URL}/generate-routine` with `Authorization: Bearer ${PAL_TOKEN}`, reads the typed `ErrorEnvelope` on non-2xx, and throws the appropriate typed error from `./errors`:

| Backend response | Thrown error class |
|---|---|
| 400 `validation_failed` | `ValidationError` (existing) |
| 401 `unauthorized` | `AuthError` (existing) |
| 403 `forbidden` | `AuthError` (existing — message distinguishes) |
| 429 | `RateLimitError` (existing) |
| 502 `generation_failed` | `GenerationFailedError` (**NEW** in `./errors`) |
| 502 `upstream_error` | `UpstreamError` (existing) |
| 500 / other 5xx | `UpstreamError` (existing fallback) |
| network / fetch throw | `NetworkError` (existing) |

### 5.4 Error → user message mapping

| Caught error class | UI message |
|---|---|
| `GenerationFailedError` | "Pal couldn't put that together. Try a different goal?" |
| `UpstreamError` | "Pal's having trouble right now. Try again in a moment." |
| `NetworkError` | "No connection. Check your internet and try again." |
| `RateLimitError` | "Too many tries — wait a moment and retry." |
| `AuthError` / `ValidationError` / unknown | "Something's off — try again." (generic; shouldn't surface in normal use) |

### 5.5 Save query

`lib/db/queries/saveGeneratedRoutine.ts` exports:

```ts
export async function saveGeneratedRoutine(
  db: AnyDb,
  generated: GenerateRoutineResponse,
): Promise<number>  // returns new routine id
```

Implementation, in a single `db.transaction(async (tx) => ...)`:

1. `createEmptyRoutine(tx, { name: generated.name, tag: generated.tag })` → returns new id. Position is auto-computed (`MAX(position) + 1`) by the helper. Color is omitted, so the helper assigns its default `'accent'` — same color behavior as 4c's "New Routine" flow. Color rotation is not in scope here; the user can change color in the editor (a 4c affordance).
2. Build a `DraftInput` from `generated.exercises` (positions = array index, no per-exercise `restSeconds` override, sets mapped 1:1).
3. `updateRoutine(tx, draft)`.
4. Return id.

Both helpers already accept `db: AnyDb` and use `(db as any).insert(...)` casts that work against either the top-level db or a transaction handle. The plan's first task confirms `db.transaction(...)` actually composes with the existing helper signatures (this is straightforward in better-sqlite3 + Drizzle but worth a unit test before relying on rollback semantics).

What the save path **discards** from the LLM response:
- `estMin` — recomputed by `estimateMinutesForRow()` from the saved data, keeping generated routines consistent with hand-edited ones.
- `rationale` — shown on the result hero only; not persisted.

What the save path **defaults** (LLM doesn't supply):
- `restDefaultSeconds` — DB default `120`.
- `warmupReminder`, `autoProgress` — DB defaults `false`.
- per-exercise `restSeconds` — `null` (inherits routine default).

### 5.6 Save flow on user tap

```ts
async function onSave() {
  try {
    const id = await saveGeneratedRoutine(db, state.data);
    router.replace({
      pathname: '/(tabs)/move/[routineId]/edit',
      params: { routineId: String(id) },
    });
  } catch (e) {
    setSaveError("Couldn't save. Try again.");
  }
}
```

`router.replace` so back-button from the editor returns to PreWorkout, not the generator.

### 5.7 TDD scope (iOS)

- `saveGeneratedRoutine` happy path (writes correct rows, returns id; covers strength + cardio).
- `saveGeneratedRoutine` rollback on injected mid-transaction failure (no half-saved routine).
- `generateRoutine` client error mapping (mock `fetch` for each backend status → assert thrown error class matches the §5.3 table).
- Reducer transitions (pure function, all 5 actions × phase combinations).
- Catalog parity test (asserts backend `EXERCISE_CATALOG` matches `seed-workouts.ts`).

**NOT TDD'd** (per parent meta-spec §3 — UI screens are visual-verify only):
- The route component, sub-components, and visual states.

---

## 6. Smoke test

### 6.1 Backend deploy

Set `OPENROUTER_API_KEY` in `/etc/pulse-backend.env` on the droplet (`root@178.128.81.14`); merge SP4f to `main` so the existing `deploy-backend.yml` GH Action ships the new route. Smoke `curl`:

```bash
curl -sS -X POST https://<host>/generate-routine \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"goal":"Quick full-body, no barbell"}' | jq .
```

Where `$TOKEN` is a JWT signed by the backend with the `generate-routine` scope (issued via the same key-management procedure SP2 established for `parse` / `chat` / `review` scopes).

Expect: 200 with a strength-arm response. Same `curl` with `goal: "20 min easy run"` → cardio arm.

### 6.2 iOS web smoke (Windows, primary)

1. Tap "Generate routine with AI" on PreWorkout → lands on `/(tabs)/move/generate`.
2. Tap the "Quick full-body, no barbell" chip → loading pill appears for ~3–10 s → result hero + exercise list renders.
3. Tap "Try again" → returns to idle, prompt cleared.
4. Tap a chip again → wait for result → tap "Save routine" → app navigates to RoutineEditor for the new routine.
5. Back-button from editor lands on PreWorkout (not on the generator). The new routine appears at the bottom of the list.
6. Reopen the routine in 4c: exercises and sets match what the preview showed.

### 6.3 Failure path smoke

- Temporarily point `EXPO_PUBLIC_BACKEND_URL` to a non-existent host → tap Generate → red error banner ("No connection..."). Restore the URL.
- Optional: send `{ goal: "" }` via `curl` to confirm 400.

### 6.4 Cardio variant smoke (separate iOS pass)

Type "Short 20-minute run" → result shows 1 cardio exercise with duration set chip → Save → routine appears in PreWorkout list with "Cardio" tag → opens in editor as a cardio routine.

### 6.5 iPhone verification — deferred

Per the precedent set by 4b–4e in the parent meta-spec §8a. SP4 routes from 4b onward depend on a custom dev client that's not yet installed. When the dev client lands, this same smoke runs there in addition to web.

### 6.6 Closing condition for SP4f

- All TDD tests green.
- Typecheck clean (iOS + backend).
- Web smoke 6.2 + 6.3 + 6.4 pass.
- Backend `curl` smoke 6.1 passes against the live droplet.
- iPhone verification deferred to user (same posture as 4d / 4e).

### 6.7 Verification target

- **Web is sufficient** for SP4f to close (consistent with 4c–4e). The route uses no native modules — it's pure RN + fetch + SQLite.
- **iPhone Expo Go is NOT a valid target** here: SP4 routes from 4b onward depend on the custom dev client. SP4f isn't downgraded to Expo Go just because it happens not to need HealthKit — the rest of the workout flow doesn't run there anyway.

---

## 7. Scope cuts

Explicitly cut from SP4f, even though plausible:

| Item | Reason |
|---|---|
| Streaming response from the LLM | Handoff has a discrete "Thinking…" pill, not token-by-token rendering. JSI / SSE complexity for no visible win on a 3–10 s call. |
| Conversational refinement ("make it shorter") | Parent meta-spec §2 locks "One-shot prompt → backend → save". v3+ if requested. |
| Saving the prompt + LLM response for retraining/audit | Personal app, no analyst — no audit table. |
| Warm prompt / PR-aware tuning | Defer to v3+ if defaults feel consistently off. |
| Fuzzy / best-effort recovery from invalid LLM output | Strict fail; user retries. |
| Exercise-id resolution by name | Strict id check by design — prompt enumerates ids and the response schema rejects unknowns. |
| Per-exercise rest override from the LLM | Routine-default-only on save; user adjusts in editor. |
| Live-deploy automation | Reuses existing `deploy-backend.yml` GH Action; no new infra. |
| Multi-language goal handling | English-only (matches user's locale). |
| Load testing / prompt-quality regression suite | Single-user app; smoke test is sufficient. |
| iPhone smoke verification | Carries the deferral 4b–4e accepted (no custom dev client yet). |

---

## 8. Open items requiring user input before the plan starts

1. **`OPENROUTER_API_KEY` on the droplet.** SP4f's smoke test 6.1 cannot pass until this is set in `/etc/pulse-backend.env`. The plan can be written and the code can be implemented without it — deploy + smoke happen once the key is in place. (Same blocker the parent meta-spec called out for `/parse`; resolves both.)
2. **Quick-pick chip wording.** Handoff has six labels (Push, Full-body, Pull-back, HIIT, Legs-posterior, Home-no-gear). Default: ship the handoff six. Swap if any feel off.
3. **Goal length cap.** Schema has `min(3).max(280)`. 280 is a tweet-length sentinel — fine for prompts like "20-min push day with dumbbells, focus on chest." Bump if longer composite prompts are desired. Default: 280.

These are not blockers for writing the plan — they're inputs for the plan's deploy / config steps.

---

## 9. What this spec is NOT

- Not an implementation plan. The next step (after user review) is invoking `superpowers:writing-plans` to produce the **plan for SP4f**.
- Not a schedule. Pace is unknown.
- Not a substitute for the parent meta-spec — it inherits SP4's verification posture, locked decisions, and deferrals.
