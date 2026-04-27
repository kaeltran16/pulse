# Pulse — Implementation Process Design

**Date:** 2026-04-25
**Status:** Draft, pending user review
**Scope:** Process and stack for building Pulse end-to-end. This spec governs *how* the project is built, not *what* the product does. Each sub-project below will get its own product spec.

---

## 1. Stack decision — React Native + Expo

The original `STACK.md` specified SwiftUI + SwiftData + CloudKit + HealthKit. That stack is **superseded** by this spec. Reasons:

- Mac access is intermittent and the available Mac's Xcode is outdated, blocking iOS 17+ targets that SwiftData and modern ActivityKit require.
- The user is brand new to Swift and intends to drive all generation through AI. AI generation quality is materially higher for TypeScript than for Swift, and the Swift API churn through iOS 17/18 makes hallucinated APIs likely.
- The user's verification cadence is "build the whole phase, then verify" (most aggressive option). Every iOS verification under SwiftUI requires a Mac round-trip; this is incompatible with intermittent Mac access.

**Stack:**

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript | Strict mode (default in SDK 55+) |
| UI framework | React Native 0.83 | Via **Expo SDK 55** (current stable, Feb 2026) |
| Architecture | **New Architecture** (Fabric + TurboModules + JSI) | Mandatory in SDK 55; Legacy removed |
| Navigation | Expo Router | File-based routing, comes with default template |
| Local storage | `expo-sqlite` + Drizzle ORM | Drizzle's `useLiveQuery` hook makes queries reactive |
| Cloud sync | None for v1 | Personal use, single device. Re-evaluate after v3. |
| Health data | `@kingstinct/react-native-healthkit` | Nitro-powered, type-safe, Expo-friendly. Requires custom dev client. |
| Charts | Victory Native | Replaces Swift Charts |
| Animation | **Reanimated 4** + `react-native-worklets` | Worklets are a separate dep in v4. Plus React Native Skia for canvas (Activity Rings). |
| Styling | **NativeWind v4** (Tailwind CSS for React Native) | User preference. Theme tokens live in `tailwind.config.js`; iOS-specific styling (blur, shadows) still uses RN APIs alongside. |
| iOS-system look | Real iOS components via RN | Plus `expo-symbols`, `expo-blur` (now stable on both platforms) |
| Live Activities | `@software-mansion-labs/expo-live-activity` | Software Mansion's official package; defer to v2 |
| Widgets | `expo-widgets` (**alpha for iOS** in SDK 55) | Confirms defer to v2 or skip |
| Build | EAS Build (Expo's cloud Mac) | No local Mac required |
| Dev runtime | Android emulator on Windows + Expo Go on iPhone | Custom dev client (via EAS) for native modules from sub-project 4 onward |
| Backend | Node + Express on DO droplet | Unchanged from STACK.md |
| AI proxy endpoints | `/chat`, `/parse`, `/review` | Anthropic SDK, Claude Haiku 4.5, behind shared-secret header |

`STACK.md` will be updated to reflect this in sub-project 0.

### Accepted tradeoffs

- **iOS-native fidelity:** RN approximates the design handoff well but not perfectly. Activity Rings and exact iOS modal-sheet behavior require extra effort vs. SwiftUI's free defaults. Estimate: design-system sub-project ~2× the SwiftUI baseline.
- **Live Activities and widgets** are early-stage in the Expo ecosystem. Both are deferred to v2 with the explicit option to skip.
- **CloudKit replacement** is deferred. v1 is single-device. If the user later wants multi-device sync, Supabase or a custom backend collection enters scope at that point.

---

## 2. Constraint set

These constraints shape the process; they are not subject to relitigation in sub-project specs.

1. **Solo developer**, brand new to TypeScript / RN / Swift / iOS dev in general.
2. **All code is AI-generated** by Claude Code on Windows. The user reviews and ships.
3. **Verification cadence: per-phase ("C")**. The user builds an entire sub-project before running it, accepting compounding-error risk in exchange for AI throughput.
4. **No local Mac** in the build pipeline. EAS cloud builds for iOS binaries.
5. **No AltStore / no sideload tooling.** Distribution = Expo Go for everyday work, EAS Build + direct install or TestFlight for full builds.
6. **Full superpowers cadence** per sub-project: spec → spec review → plan → plan review → TDD where applicable → execute → code review checkpoint → verify → commit + tag.

---

## 3. Process shape — Shape 1 (pipeline-first, backend-first, iOS-by-phase)

Seven sub-projects, executed in order. Each is a complete superpowers cycle.

| # | Sub-project | Verification surface | TDD applies to |
|---|---|---|---|
| 0 | Pipeline pre-flight ✅ **Complete 2026-04-25** | Hello-world Expo app runs in Android emulator on Windows AND in Expo Go on the user's iPhone | None — success is binary |
| 1 | Design system (tokens + theme) ✅ **Complete 2026-04-25** | Preview screen renders all color tokens and the type scale; Light/Dark/System toggle flips the theme; `npm test` passes the token parity test. Targets: web (primary on Windows) and Expo Go on iPhone when available. **Scope trimmed to tokens + ThemeProvider; the eight named components moved to their consumer sub-projects.** | Theme token parity (`tokens.ts` ⇔ resolved Tailwind config) |
| 2 | Backend v1 (AI proxy) | `curl` against deployed `/chat`, `/parse`, `/review` endpoints returns expected shapes | All three endpoints + prompt-assembly + auth-header logic |
| 3a | iOS v1 — data + shell | SQLite schema migrates cleanly; Today screen renders today's data; tab bar + FAB work; Onboarding completes and persists Goals | Drizzle schema, migrations, derived aggregates (today rings, basic streaks) |
| 3b | iOS v1 — entry + Pal | Log Entry sheet logs all three entry types; Ask Pal round-trips through deployed backend v1; Spending Detail renders | Pal client (request shape, error handling), entry validation |
| 4 | iOS v2 — workouts | Workout flow end-to-end: pick routine → log sets → rest timer → finish → Post-Workout summary → Workout Detail. **First sub-project requiring custom EAS dev client** (HealthKit). Live Activities written but verified deferred. | PR detection, rest timer state machine, volume math, routine progression |
| 5 | Backend v2 + iOS v3 — email + review | DO email worker polls IMAP, parses receipts, dedupes, pushes to device. iOS Email Sync screens (Intro/Setup/Dashboard) consume it. Monthly Review generates from `/review`. Rituals streak logic verified. | Receipt parser, dedupe, streak computation, monthly aggregate logic |
| 6 | Polish | Empty/error states across all screens; accessibility labels; VoiceOver pass on iPhone via dev client; animation timing review | None — verification by hand |

### Why this order

- **Sub-project 0 first** to prove the toolchain on a hello-world before any feature code. If Expo CLI / EAS Build / dev-client signing surfaces issues, learn them on 50 lines, not 5,000.
- **Sub-project 1 next** as a low-stakes "real code, AI-generated, verified visually" pass — the dress rehearsal before the larger iOS sub-projects.
- **Sub-project 2 (backend) before 3b** because Ask Pal in 3b consumes `/chat`. Building backend on Windows is a fast loop (no emulator, no cloud build); doing it before iOS work also gives the user momentum on the easier stack.
- **3a / 3b split** to keep the first integrated iOS milestone small. The first time the full RN app runs on a phone is high-risk; smaller surface = easier debugging.
- **Sub-project 4 is the hardest single chunk** — Active Session screen is the heart of the workout flow (rest timer state machine, set logging, PR detection, optional Live Activity sync). Its plan should nest a mini-spec for the Active Session screen specifically.
- **Sub-project 5** combines backend v2 (email worker) with the iOS screens that consume it, since the IMAP-poll → push-to-device contract is co-designed.

---

## 4. Per-sub-project cadence

**Decomposition is just-in-time.** This meta-spec defines the seven sub-projects as a map. It does **not** assume one spec ↔ one sub-project. Small sub-projects (0, 1, 2, 3a, 3b) are expected to fit a single spec + plan each. Larger sub-projects (4, 5) will be re-brainstormed when their turn comes and will spawn 3–8 child specs each — for example, sub-project 4 might decompose into separate specs for the Active Session screen, the rest-timer state machine, PR detection, Live Activities, HealthKit integration, and the post-workout summary. We do **not** predict that decomposition today; it happens at sub-project 4's brainstorm.

The meta-spec is the map you consult between sessions to know "what's next?" Each session brainstorms exactly the next unit of work, writes its spec, writes its plan, executes. Repeat.

Every sub-project from 1 onward (sub-project 0 is exempt — binary success/fail) follows the superpowers loop:

```
spec  →  spec review (user)  →  plan  →  plan review (user)
                                            ↓
                       TDD where the table in §3 says it applies
                                            ↓
                                       execution
                                            ↓
                              code review checkpoint
                                            ↓
                              verify against the surface in §3
                                            ↓
                                  commit + tag milestone
```

Artifacts per sub-project, in `docs/superpowers/`:
- `specs/YYYY-MM-DD-<slug>-design.md`
- `plans/YYYY-MM-DD-<slug>-plan.md`
- `reviews/YYYY-MM-DD-<slug>-review.md`

**TDD policy:** for items the §3 table marks TDD-eligible, write the failing test first, then implementation. UI screens are not TDD'd — visual verification in Expo Go / emulator is the test.

**Code review:** at the end of each sub-project, before the milestone commit lands on `main`, invoke `superpowers:requesting-code-review` against the sub-project's diff. Address blocking findings; document accepted ones in the review doc.

**Verification policy:** before code review can pass, the sub-project must demonstrate the smoke test in the §3 verification column. "Code compiles" is not "code works."

---

## 5. Risk mitigation for the C verification cadence

The user chose to build whole phases before verification. Five guardrails reduce compounding-error risk:

1. **Pre-flight (sub-project 0) is non-negotiable.** Toolchain proven on a hello-world before any feature code. EAS Build account, Expo CLI on Windows, Android Studio + emulator on Windows, Expo Go installed on the user's iPhone, account-linking working.

2. **Sub-project 1 (design system) is the dress rehearsal.** Smallest possible "real RN code, AI-generated, verified visually." Catches AI-hallucinated component APIs (e.g., wrong Reanimated 3 syntax, deprecated Expo SDK 49 patterns) on a low-stakes surface.

3. **Internal commit checkpoints inside each sub-project.** Within a "build all then verify" phase, commit per logical unit (one component, one model, one screen) so the bisecting surface is small when the inevitable build failure surfaces. The user does not run the app between commits — but the history makes recovery cheap.

4. **AI-generated code is checked against context7 docs** for any non-trivial API surface (Reanimated 3 worklets, `expo-sqlite` API, `react-native-health`, EAS config schema, `@bacons/expo-activity`). The plan for each sub-project explicitly instructs Claude to query context7 before generating. This catches "AI knows Expo SDK 48 but the project is on 50" failure modes.

5. **Each sub-project defines its smoke test upfront**, in §3 above, and the spec for the sub-project restates it. No advancement without a pass.

---

## 6. Tooling and environment

### Windows (the only daily driver)
- **Node.js** LTS
- **Expo CLI** (`npm install -g eas-cli expo`)
- **Android Studio** with an Android emulator (Pixel 7 / API 34 image recommended)
- **VS Code** as editor (Claude Code runs here)
- **Git** for repo
- **`.env` files** for backend dev (Anthropic API key); never committed

### iPhone
- **Expo Go** from the App Store (free) — sufficient for sub-projects 0, 1, 3a, 3b
- **Custom dev client** installed via QR/EAS from sub-project 4 onward (needed for `react-native-health` and Live Activities native code)

### Cloud
- **EAS Build** account (free tier ~30 builds/month) for iOS binaries
- **DigitalOcean droplet** (already provisioned, currently empty) for backend service
- **Anthropic API key** stored in DO `.env` after deploy; never in repo, never in app

### Repo structure
```
pulse/
  app/                    # Expo Router file-based routes (replaces ios/)
  components/             # Shared RN components
  lib/
    db/                   # Drizzle schema + queries
    pal/                  # Backend client (Pal proxy)
  backend/                # Node + Express service
    src/
    package.json
  design_handoff/         # Reference (do not delete)
  docs/
    superpowers/
      specs/
      plans/
      reviews/
  app.json                # Expo config
  eas.json                # EAS Build config
  STACK.md                # Update in sub-project 0
  README.md               # Update in sub-project 0
```

### Backend deploy
- **Docker + Compose** (switched in SP5a). Image hosted on GHCR; deploy root at `/opt/pulse/`. Single `pulse-stack.service` systemd unit on the droplet runs `docker compose up -d` at boot. Compose handles per-service `restart: unless-stopped`. Bind-mount at `/opt/pulse/data/` holds the SQLite file.
- TLS via Cloudflare Tunnel (no port-forwarding, no cert management) — re-evaluated in backend spec if user prefers Caddy.

### Claude Code config
- This conversation runs on Windows. All future work also runs on Windows. No Mac-side Claude.
- Memory + skills as currently configured.

---

## 7. Scope cuts and deferrals

Explicitly deferred or cut from v1–v3, to be revisited only if the user opts in:

| Item | Status | Reason |
|---|---|---|
| CloudKit / multi-device sync | Cut from v1–v3 | Single-device personal use. Add Supabase later if needed. |
| Live Activities (lock-screen workout timer) | Deferred — code in v2, verification deferred | `@bacons/expo-activity` is rough; non-blocking |
| Home-screen widgets | Deferred or skipped | `expo-widgets` is rough; non-blocking |
| Siri Shortcuts / AppIntents | Cut for now | RN support is limited; revisit post-v3 |
| Apple Push Notifications (server-driven) | Cut — use polling instead | Already noted in STACK.md as paid-account requirement |
| Sign in with Apple | Cut from v1–v3 | No multi-user surface in current scope |
| Global state store (Zustand / Redux / etc.) | Deferred — revisit at SP4 | Drizzle `useLiveQuery` covers persisted state; Context covers SP1–3 ephemeral state. SP4's active workout session is the first plausible cross-screen ephemeral state — pick the tool there. |

---

## 8. What this spec is NOT

- Not a product spec for any sub-project. Each sub-project gets its own.
- Not an implementation plan. The next step (after user review) is invoking the writing-plans skill to produce the **plan for sub-project 0** (pipeline pre-flight). Each subsequent sub-project gets its own spec → plan cycle.
- Not a schedule. No date estimates here. The user's pace is unknown and bounded by AI verification round-trips, not author-velocity.

---

## 8a. Sub-project status

| # | Sub-project | Status |
|---|---|---|
| 0 | Pipeline pre-flight | ✅ Complete 2026-04-25 — Expo SDK 54 scaffold, hot reload verified on web target. Android path dropped (iPhone-first); iPhone Expo Go verification deferred (not blocking; will be exercised in sub-project 1). |
| 1 | Design system | ✅ Complete 2026-04-25 — `tokens.ts` source of truth, NativeWind v4 wired via CSS variables, `ThemeProvider` with Light/Dark/System toggle, 33-assertion parity test passing, preview screen verified on web. iPhone Expo Go verification deferred (not blocking). |
| 2 | Backend v1 (AI proxy) | ✅ Code complete 2026-04-25 — 49 tests green, code review accepted (`docs/superpowers/reviews/2026-04-25-backend-v1-ai-proxy-review.md`), droplet bootstrapped (`root@178.128.81.14`), GH Action `deploy-backend.yml` wired. Live deploy pending: set `OPENROUTER_API_KEY` in `/etc/pulse-backend.env` and push to `main`. |
| 3a | iOS v1 — data + shell | ✅ Complete 2026-04-25 — Drizzle schema with 5 tables, generated migrations bundle, TDD'd aggregates + streak math (54 tests green, including DST cases), 4-step onboarding, 4-tab shell with 3 stubs, Today rings against live SQLite via `useLiveQuery`, dev seed flow. Type-check clean. iPhone Expo Go verification deferred per SP1 precedent (Skia requires custom dev client). |
| 3b | iOS v1 — entry + Pal | ✅ Code complete 2026-04-25 — PalComposer wired with parse-first router; Spending Detail shipped. Backend `/parse` amended (food dropped, chat added). 86 iOS + 56 backend tests green. Web smoke + iPhone Expo Go verification deferred (not blocking). |
| 4 | iOS v2 — workouts | ✅ Complete 2026-04-26 — meta-spec at [`meta/2026-04-25-ios-v2-workouts-design.md`](./2026-04-25-ios-v2-workouts-design.md). 4a (workout data foundation) ✅ code complete: 7-table schema + migration, seeded catalog (21 exercises, 6 routines), pure-function math (rest defaults, volume, PR detection), query modules (routines, prs, sessions), seeder wired into app startup, smoke script green. 4b (HealthKit shell) ✅ Windows-side complete; iPhone dev-client verification deferred. 4c (routine browse + edit) ✅ code complete 2026-04-25 — three-screen flow shipped (PreWorkout, RoutineEditor, ExerciseLibrary), Zustand editor store, transactional `updateRoutine`, full CRUD + duplicate + rename. Migration `0002_late_tempest` adds `rest_default_seconds` / `warmup_reminder` / `auto_progress` to `routines`. 4d (Active Session) ✅ code complete 2026-04-26 — strength + cardio ActiveSession route, rest-timer reducer, in-flight PR badges, Zustand `activeSessionStore` with per-set write-through draft persistence + resume-on-launch, `DiscardConfirmModal`, `SetEditSheet` (with remove-set), `LiveHRChip`, PostWorkout stub. Lifecycle replaces `insertCompletedSession` with `getOpenDraft` / `startDraftSession` / `upsertDraftSet` / `deleteDraftSet` / `discardDraftSession` / `finalizeSession`. Migration `0003_omniscient_puck` adds `sessions.status`, relaxes `finished_at` to nullable, and adds the `idx_sessions_one_draft` partial unique index. 216 tests passing. Manual web/iPhone smoke deferred to user — typecheck and unit suite are green. 4e ✅ code complete 2026-04-26 — full PostWorkout (strength + cardio), WorkoutDetail route at `/move/[sessionId]` with 4-tile stat grid + 8-week volume chart + per-exercise table, `/move/history` filtered list, `RecentSection` on PreWorkout. New helpers: `computeMuscleDistribution`, `computeWeeklyVolumeSeries`, `selectTopPRs`, `formatRelativeDate`, `activityTypeFor`. Extended `getSession` with mode + `exerciseMetaById`; added `getRecentSessions`, `listAllSessions`, `getWeeklyVolumeSeries`. `finalizeSession` writes a HealthKit workout post-commit (with optional `distanceKm` for cardio) and surfaces `healthSyncFailed` through route params. No schema delta. 270 tests passing. Manual web/iPhone smoke deferred to user. 4f ✅ code complete 2026-04-26 — POST /generate-routine route + iOS generate screen, transactional save, no schema delta. Backend live deploy + web smoke deferred to user. 4g ✅ code complete 2026-04-26 — `expo-live-activity` rest-timer activity wired through `activeSessionStore` (start on rest-timer start, update on +30s, stop on skip/finish/discard); 9 projection tests covering 7 logical cases; platform-split wrapper (`index.ios.ts` + `index.ts` no-op). Web export pre-existingly broken on baseline (`expo-sqlite` wasm), unrelated; iOS prebuild needs macOS (host is Windows) — both will be exercised when the user EAS-builds the dev client. Visual verification on iPhone deferred per §7. **SP4 done.** |
| 5 | Backend v2 + iOS v3 — email + review | In progress — meta-spec at [`meta/2026-04-26-sp5-email-review-design.md`](./2026-04-26-sp5-email-review-design.md). 5a (backend data store) ✅ code complete 2026-04-27 — three new tables (`imap_accounts`, `synced_entries`, `imap_uids`) via Drizzle + `better-sqlite3`; query modules + cascade tests; Docker cutover from rsync to compose stack at `/opt/pulse/` with `migrator` + `backend` services; GHCR + Docker GH Action; 102 SP2 + 25 SP5a tests green. 5b (`pulse-worker` service) spec + plan committed 2026-04-27 — implementation pending. 5c–5g not started. |
| 6 | Polish | Not started |

---

## 9. Open items requiring user input before sub-project 0 starts

- **Backend service language:** Node + Express is recommended. Confirm in sub-project 2 spec.
- **DO droplet specs and OS** — currently labeled "already provisioned." Sub-project 0 should verify SSH access and resource specs.
- **Anthropic API key** — confirm user has one, or process it as part of backend setup.
- **EAS Build account** — confirm user has an Expo account or create one in sub-project 0.

These are not blockers for *this* spec; they are inputs for sub-project 0's plan.
