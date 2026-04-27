# SP5e — iOS Rituals Tab + Builder Design

**Date:** 2026-04-28
**Status:** Draft, pending user review
**Parent:** [`./meta/2026-04-26-sp5-email-review-design.md`](./meta/2026-04-26-sp5-email-review-design.md) (SP5 meta-spec, slice 5e)
**Builds on:** SP3a (`rituals` + `ritual_entries` schema, `streakForRitual` math, `DEFAULT_RITUALS` seed) and SP5d (`app/(tabs)/you/` route-group pattern, sectioned-list visual conventions)
**Scope:** Replace the `app/(tabs)/rituals.tsx` stub with a full Rituals tab — Today list with tap-to-toggle + Pal-written nudge; Builder with drag-reorder, soft/hard delete, LLM-backed "Suggested by Pal" suggestions, daily reminder time, daily-goal picker; full add/edit form per ritual. Adds two backend endpoints (`POST /suggest-rituals`, `POST /nudge-today`) under the existing `"chat"` JWT scope. Adds two iOS deps (`expo-notifications`, `react-native-draggable-flatlist`) and one new theme token (`cyan`). Schema delta: `rituals` gains `cadence` + `color` enum columns; `goals` gains `reminder_time_minutes`; new `pal_cache` table; `8 glasses water` joins `DEFAULT_RITUALS`.

**Cross-tier:** This slice deviates from the meta-spec's implicit "iOS-only for 5e" framing — it bundles two new backend endpoints. See §10 for the meta-spec amendments this requires.

---

## 1. What 5e ships

- **Rituals tab landing** at `app/(tabs)/rituals/index.tsx` (replaces the SP3a stub). NavBar with "X of Y done today" subtitle + `+` button to Builder. Pal nudge card with progress ring + locally-templated headline ("One to close the day" / "All done — nice" / "{n} to go") + LLM-written sub-line ("Your evening journal is waiting. 23-day water streak 💧"). Today list of active rituals ordered by `position`, each with tap-to-toggle checkbox semantics: tap empty → insert `ritualEntries` row; tap filled → delete *all* of today's rows for that ritual (binary "done today: yes/no"). Bottom CTA "+ New ritual" → Builder.
- **Builder screen** at `app/(tabs)/rituals/builder.tsx`. Active rituals section with `react-native-draggable-flatlist` for drag-reorder + swipe-left to soft-delete (Alert confirm; sets `active=false`, preserves entries). Inactive rituals section appears below when any exist; swipe-right restores. "Suggested by Pal" section with two LLM-generated suggestions + "Add" CTA each + manual `↻ Refresh` affordance in the section header. Preferences section with two rows: "Remind me · {time}" (tap → native iOS `DateTimePicker` time wheel) and "Daily goal · {target} of {totalActive}" (tap → picker screen).
- **Add / edit ritual form** at `app/(tabs)/rituals/new.tsx` and `app/(tabs)/rituals/[id]/edit.tsx`. Shared `components/RitualForm.tsx` component. Three sections: Basics (name TextInput + cadence action sheet), Style (16-symbol icon grid + 5-token color row), Danger (edit-only "Delete ritual" — hard delete with cascade to `ritualEntries`).
- **Daily-goal picker** at `app/(tabs)/rituals/goal.tsx`. Tiny screen with radio rows 1…N where N = active rituals count. Persists to `goals.dailyRitualTarget`.
- **Two new backend endpoints** under the existing `"chat"` JWT scope:
  - **`POST /suggest-rituals`** — non-streaming JSON. Request: `{ active: [...], recentRitualEntries?: [...] }`. Response: `{ suggestions: [{ title, reason, icon, cadence, color }, ...] }` (0–2 items). Validated against the icon shortlist + cadence/color enums; out-of-shortlist values get filtered out, malformed JSON triggers one stricter retry then `{ suggestions: [] }`.
  - **`POST /nudge-today`** — non-streaming JSON. Request: `{ date, done, total, remaining: [...], bestStreak? }`. Response: `{ sub: string }` (≤120 chars). Same retry-and-fallback posture as `/suggest-rituals`; on persistent failure the client falls back to a locally-templated string.
- **Schema delta** (one Drizzle migration):
  - `rituals` gains `cadence text NOT NULL DEFAULT 'daily'` + `color text NOT NULL DEFAULT 'rituals'`.
  - `goals` gains `reminder_time_minutes integer` (nullable; null = reminder off).
  - New table `pal_cache(key text PRIMARY KEY, value text NOT NULL, fetched_at integer NOT NULL)` for nudge + suggestion caches.
  - Backfill `UPDATE rituals SET cadence=…, color=… WHERE title=…` for the 6 known seed titles.
  - The new `8 glasses water` row is *not* in the migration — it's added via an idempotent reseed at app startup (`INSERT … WHERE NOT EXISTS`), so previously-onboarded users pick it up without re-running onboarding.
- **One new iOS dep:** `expo-notifications` (latest matching SDK 55, `~0.32.x`). Permission asked in-context (only when the user first sets a reminder time). One repeating local notification scheduled at `goals.reminderTimeMinutes`. Notification body templated locally at schedule-time from the active ritual list — *no* LLM call at fire-time (notifications fire while app is suspended).
- **Second new iOS dep:** `react-native-draggable-flatlist` (community pkg, builds on `react-native-gesture-handler` + `react-native-reanimated` already in the project). Used for Builder's drag-reorder and swipe-to-remove rows.
- **One new theme token:** `cyan` (#5AC8FA light / #64D2FF dark) + `cyanTint` for the 5th color choice. Added to `lib/theme/tokens.ts`.
- **New iOS modules:**
  - `lib/db/queries/rituals.ts` — CRUD + reorder + soft/restore/hard delete + tap-toggle today + cadence display map.
  - `lib/db/queries/palCache.ts` — `readCache` / `writeCache` / `deleteCacheByPrefix` / `vacuumStaleNudges`.
  - `lib/db/queries/reseedDefaults.ts` — idempotent `INSERT … WHERE NOT EXISTS` for `DEFAULT_RITUALS`.
  - `lib/sync/useRitualNudge.ts` — hook returning `{ headline, sub, loading }`; cache-keyed on `(todayKey, done, total)`.
  - `lib/sync/usePalSuggestions.ts` — hook returning `{ suggestions, loading, error, refresh }`; cache-keyed on the active-rituals hash with 24h TTL.
  - `lib/sync/palClient.ts` — fetch wrappers for both new endpoints (mirrors `lib/sync/client.ts` from SP5c).
  - `lib/notifications/dailyReminder.ts` — `ensurePermission` / `scheduleDailyReminder(timeMinutes, body)` / `cancelDailyReminder` + `reminderBody(activeRituals)` pure templater.
- **No changes** to `lib/db/queries/streaks.ts` (the SP3a `streakForRitual` math is reused as-is). No changes to existing tab routes other than the rituals route group.

**Smoke test (5e's slice-close criteria):**

1. `npm test` green (existing 347 + ~25 new iOS = ~372 iOS tests; existing 205 + ~15 new backend = ~220 backend tests).
2. `npx tsc --noEmit` clean.
3. **Web target sanity check** (Windows browser): Rituals tab renders 7 default rituals after a fresh onboarding (Water present); tap toggles checkbox + count + nudge re-fetch; Builder drag-reorder persists across reload; swipe-remove → Inactive section, swipe-restore → Active; "+ New ritual" form saves; "Suggested by Pal" loads two rows; "Remind me" picks time + grants permission + schedules notification; "Daily goal" picker persists.

iPhone Expo Go visual smoke + live `/suggest-rituals` + `/nudge-today` against real OpenRouter + dev-client rebuild for `expo-notifications` carry over to the SP5-wide deferred pass per parent meta-spec §5.

---

## 2. Locked decisions (resolved during brainstorming)

| # | Decision | Choice | Reason |
|---|---|---|---|
| 1 | Overall posture | **Match the design handoff faithfully**, even at the cost of expanding scope (new backend endpoints, new iOS deps, schema additions). | User explicitly chose handoff fidelity over a minimum-viable shape; the handoff features that conflict with meta-spec locks (notifications, color picker) get amendments rather than cuts. |
| 2 | "Remind me" preference row | **Local notifications via `expo-notifications`.** Single global daily reminder at user-chosen time. Permission asked in-context (only when the user first picks a time, not at app launch). Body templated locally from active ritual list at schedule-time. **Requires meta-spec §2 row 10 amendment** to allow `expo-notifications` for this single surface. | The handoff shows it; (a) "render disabled" is dishonest UX; (c) "drop the row" deviates from handoff. Local notifications (no remote push, no APNs config) are a small surface area with no privacy implications. |
| 3 | Per-ritual cadence | **Single `cadence` enum column** with values `'morning' \| 'evening' \| 'all_day' \| 'weekdays' \| 'daily'`. Display layer maps to per-screen wording (Today: "Morning"; Builder: "Every morning"). One source of truth, validated by enum. | Handoff's two screens use *different* labels for what's logically the same field. A single typed column with a display map is cleaner than two free-text fields and less brittle than two structured columns. |
| 4 | Per-ritual color | **`color` text column constrained to a 5-token shortlist** (`'rituals' \| 'accent' \| 'move' \| 'money' \| 'cyan'`). Builder edit screen exposes a 5-swatch picker. **Requires meta-spec §6 amendment** to allow a constrained color picker (consistent with the existing icon-shortlist pattern). | Handoff Today list shows visible color variety; "auto-rotate by position" causes weird color shuffling on reorder; "single color for all" deviates. The shortlist matches the icon-picker scope-cut philosophy: structured choice over free input. |
| 5 | Drag-to-reorder + swipe-to-remove | **`react-native-draggable-flatlist`** (community package; builds on the `react-native-gesture-handler` + `react-native-reanimated` stack already in the project). One JS dep, near-zero native impact. Same library exposes a row primitive used for swipe-left to soft-delete. | Custom gesture math is ~150 LOC of fiddly code with auto-scroll edge cases; the community library is well-maintained (~6k stars). Up/down arrow buttons would deviate from handoff. |
| 6 | "Suggested by Pal" section | **LLM-powered via a new structured `POST /suggest-rituals` endpoint** bundled in 5e. Request includes active rituals + 30-day entry summary; response is typed JSON `{ suggestions: [{title, reason, icon, cadence, color}, ...] }` (0–2 items). Mounted under existing `"chat"` JWT scope. Cache TTL 24h, invalidated on active-set change OR manual `↻ Refresh`. **Bundling backend code into 5e requires meta-spec §3 5e-row amendment** (no longer iOS-only). | Static-curated suggestions are dishonest about Pal; extending `/chat` for structured output is fragile (free-text JSON parsing). A new endpoint with Zod-validated response is the clean answer. The `"chat"` scope is already in use for LLM surfaces; no new scope. |
| 7 | "One to close the day" Pal nudge | **LLM-driven via `POST /nudge-today`** with cache key `nudge:<YYYY-MM-DD>:<done>:<total>`. Cache invalidates exactly when copy needs to change (toggle a ritual today / day rollover). Realistic LLM call rate ~1 + N transitions per day (~2–5¢/day per active user). Headline ("One to close the day" / "All done — nice" / "{n} to go") computed locally; LLM only writes the sub-line. | Local-templated copy ("Your X is waiting") feels canned after the third day; LLM with state-keyed caching gives fresh copy when state changes and is free between transitions. |
| 8 | Tap-on-Today-row semantics | **Toggle.** Empty → insert `ritualEntries` row with `occurredAt = Date.now()`. Filled → delete *all* of today's rows for that ritual (cascade-delete-today). Mental model matches handoff's binary checkbox UI exactly. | "Insert-only" can't represent untoggle without a separate affordance; "delete most recent today" leaves N>1 rows after rapid taps, giving a confusing "filled but secretly multi-counted" state. Cascade-delete-today keeps the data store agreeing with what the UI shows. |
| 9 | Add / edit flow | **Push to dedicated routes** — `app/(tabs)/rituals/new.tsx` for add, `app/(tabs)/rituals/[id]/edit.tsx` for edit. Shared `components/RitualForm.tsx` component, mode prop discriminates. Mirrors the existing `app/(tabs)/move/[routineId]/edit.tsx` pattern. | Modal sheets feel cramped with a 16-symbol icon grid; inline edit doesn't scale beyond a name field. Push-to-route gives space and matches an established pattern. |
| 10 | Reminder time picker | **iOS native `DateTimePicker` (mode='time') wheel.** Every minute selectable. Stored as `goals.reminder_time_minutes` int (e.g., `480` for 8:00 AM). | Fixed shortlist (6/7/8/9 AM) is clinical; the native wheel matches platform expectations and lets the user pick exactly the time their morning starts. |
| 11 | DEFAULT_RITUALS migration defaults | **Per-title cadence + color in `DEFAULT_RITUALS`**, *plus* add `8 glasses water` (`cadence='all_day'`, `color='cyan'`) as a 7th default. Migration backfills the 6 existing seed titles by `WHERE title=` match; new Water row added by an idempotent reseed at app startup (`INSERT … WHERE NOT EXISTS`). | Handoff Today screen specifically shows the Water ritual with cyan tile; option (b) "uniform default for all" loses the handoff variety on first run. The reseed pattern lets future `DEFAULT_RITUALS` additions land additively without re-running onboarding. |
| 12 | Daily goal "X of N" semantics | **`X = goals.dailyRitualTarget`, N = active rituals count.** Reads as "you have N active rituals, you only need to hit X to close the day." Tap → `app/(tabs)/rituals/goal.tsx` picker (radio rows 1…N) → writes back to `goals.dailyRitualTarget`. | Matches the handoff's "5 of 6" copy literally. The picker gives the user real control without re-running onboarding. |
| 13 | Soft vs. hard delete | **Two paths.** Builder swipe-left = soft delete (`active=false`; row drops to Inactive section; entries preserved; restorable via swipe-right). Edit screen "Delete ritual" button = hard delete (cascade `ritualEntries` via existing FK; permanent). Both confirm via `Alert.alert`. | Soft delete via swipe is reversible and matches the handoff footer copy ("swipe to remove"). Hard delete is intentional, lives behind a longer path (open edit → tap red button → confirm), and is the only way to actually purge history. |
| 14 | Two endpoints vs. one combined `/pal-rituals` | **Two separate endpoints.** Cache lifecycles diverge (nudge invalidates per state-tick; suggestions invalidate per active-set change + 24h TTL); Today opens 10–20× more often than Builder. Combining would force one to over- or under-fetch. | Two small endpoints are simpler to test, simpler to cache, and don't tie unrelated cache invalidations together. |
| 15 | JWT scope for new endpoints | **Existing `"chat"` scope.** No new scope token to manage. | Both new endpoints are LLM-backed conversational surfaces — same category as `/chat`. Adding a `"pal"` scope would require regenerating the iOS app's JWT on the droplet, which is unnecessary churn. |
| 16 | Dev-client / Expo Go for `expo-notifications` | **Defer dev-client rebuild to the end-of-SP5 deferred pass.** Local notifications work in Expo Go for development smoke; production iPhone install needs a dev-client build (already exists from SP4, just needs `expo-notifications` linked into a fresh build). | Same rationale as the existing SP5 deferral: iPhone visual smoke + dev-client churn is one combined session at slice-pack close. |

---

## 3. Architecture

### 3.1 Route map

All under `app/(tabs)/rituals/`:

```
rituals/
├── _layout.tsx              # Stack, headerShown: false
├── index.tsx                # RitualsTabScreen (Today)
├── builder.tsx              # RitualsBuilderScreen
├── new.tsx                  # Add-ritual (wraps RitualForm with mode='new')
├── [id]/edit.tsx            # Edit-ritual (wraps RitualForm with mode='edit')
└── goal.tsx                 # Daily-goal picker (1…N)
```

The existing `app/(tabs)/rituals.tsx` stub is deleted. The tab-bar entry in `app/(tabs)/_layout.tsx` keeps `name="rituals"` and the `sparkles` icon — no change needed.

### 3.2 Schema delta

```sql
-- Rituals: per-row cadence + color (enum-validated at TS layer)
ALTER TABLE rituals ADD COLUMN cadence TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE rituals ADD COLUMN color TEXT NOT NULL DEFAULT 'rituals';

-- Goals: nullable reminder time, minutes since midnight (480 = 8:00 AM)
ALTER TABLE goals ADD COLUMN reminder_time_minutes INTEGER;

-- Pal cache: shared store for /nudge-today + /suggest-rituals responses
CREATE TABLE pal_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

-- Backfill known seed titles (idempotent — no-op if titles don't match)
UPDATE rituals SET cadence = 'morning',  color = 'accent'  WHERE title = 'Morning pages';
UPDATE rituals SET cadence = 'weekdays', color = 'move'    WHERE title = 'Inbox zero';
UPDATE rituals SET cadence = 'daily',    color = 'move'    WHERE title = 'Language practice';
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Stretch';
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Read before bed';
UPDATE rituals SET cadence = 'morning',  color = 'rituals' WHERE title = 'Meditate';
```

The `8 glasses water` row is **not** in the migration. Instead, `lib/db/queries/reseedDefaults.ts` runs once at app startup (in `app/_layout.tsx` after `migrate()`) and inserts each entry of `DEFAULT_RITUALS` only if its title isn't already present. This keeps onboarding additive — future default additions land for already-onboarded users without re-running the onboarding flow.

TypeScript types in `lib/db/schema.ts`:

```ts
export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
export type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';

export const rituals = sqliteTable('rituals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
  cadence: text('cadence').$type<RitualCadence>().notNull().default('daily'),
  color: text('color').$type<RitualColor>().notNull().default('rituals'),
});
```

Existing `goals` columns (`dailyBudgetCents`, `dailyMoveMinutes`, `dailyRitualTarget`) are unchanged. Existing `ritualEntries` table is unchanged.

### 3.3 New iOS modules

```
lib/db/queries/
├── rituals.ts           # CRUD, reorder, toggle-today, soft/restore/hard delete
├── palCache.ts          # readCache / writeCache / deleteCacheByPrefix / vacuumStaleNudges
└── reseedDefaults.ts    # Idempotent INSERT-WHERE-NOT-EXISTS on DEFAULT_RITUALS

lib/sync/
├── palClient.ts         # postSuggestRituals, postNudgeToday (fetch wrappers)
├── useRitualNudge.ts    # Hook: { headline, sub, loading }
├── usePalSuggestions.ts # Hook: { suggestions, loading, error, refresh }
└── cadenceDisplay.ts    # Pure: (cadence, context: 'today' | 'builder') => display string

lib/notifications/
└── dailyReminder.ts     # ensurePermission, scheduleDailyReminder, cancelDailyReminder, reminderBody

components/
└── RitualForm.tsx       # Shared add/edit form (props: mode, initial?)

app/(tabs)/rituals/
├── _layout.tsx
├── index.tsx
├── builder.tsx
├── new.tsx
├── [id]/edit.tsx
└── goal.tsx
```

### 3.4 New backend modules

```
backend/src/routes/
├── suggestRituals.ts        # POST /suggest-rituals handler
└── nudgeToday.ts            # POST /nudge-today handler

backend/src/lib/prompts/
├── suggestRituals.ts        # buildSuggestRitualsPrompt(active, recent)
└── nudgeToday.ts            # buildNudgeTodayPrompt({date, done, total, remaining, bestStreak?})

backend/src/schemas/
├── suggestRituals.ts        # Zod for SuggestRitualsRequest + SuggestRitualsResponse
└── nudgeToday.ts            # Zod for NudgeTodayRequest + NudgeTodayResponse
```

Both routes mounted under the existing `"chat"` JWT scope in `backend/src/index.ts`.

### 3.5 Shared API types

In `lib/api-types.ts` (used by both iOS client and backend schemas):

```ts
export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
export type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';

export const RITUAL_ICON_SHORTLIST = [
  'book.closed.fill', 'tray.fill', 'character.book.closed.fill',
  'dumbbell.fill', 'books.vertical.fill', 'heart.fill',
  'sparkles', 'cup.and.saucer.fill', 'leaf.fill', 'moon.fill',
  'figure.walk', 'drop.fill', 'fork.knife', 'music.note',
  'bed.double.fill', 'sun.max.fill',
] as const;
export type RitualIcon = typeof RITUAL_ICON_SHORTLIST[number];

export type SuggestRitualsRequest = {
  active: Array<{ title: string; cadence: RitualCadence; color: RitualColor }>;
  recentRitualEntries?: Array<{ title: string; occurredAt: number }>;
};

export type SuggestRitualsResponse = {
  suggestions: Array<{
    title: string;
    reason: string;
    icon: RitualIcon;
    cadence: RitualCadence;
    color: RitualColor;
  }>;
};

export type NudgeTodayRequest = {
  date: string;          // YYYY-MM-DD local
  done: number;
  total: number;
  remaining: Array<{ title: string; streak: number; cadence: RitualCadence }>;
  bestStreak?: { title: string; streak: number };
};

export type NudgeTodayResponse = { sub: string };
```

---

## 4. Today screen behavior (`app/(tabs)/rituals/index.tsx`)

### 4.1 Layout

```
SafeAreaView (bg)
├── NavBar (px-4, py-3)
│   ├── title: "Rituals"  (largeTitle)
│   ├── subtitle: "{done} of {total} done today"  (subhead, ink3)
│   └── trailing: + button → router.push('/(tabs)/rituals/builder')
│
├── Pal nudge card (px-3, mb-4)
│   ├── 72×72 progress ring (theme.rituals stroke, dasharray = done/total fraction)
│   ├── Center: "{done}/{total}" tabular-nums, title3 weight 700
│   ├── Headline: "One to close the day" (or templated by state — see §4.4)
│   └── Subline: nudge.sub (from useRitualNudge)
│
├── "Today" section header (caption1, ink3, uppercase)
├── Active rituals list (rounded-xl bg-surface, ordered by position):
│   For each:
│   ├── 36×36 icon tile (color: ritual.color tint @22% bg, ritual.color symbol)
│   ├── Title (callout, weight 500)
│   ├── Subtitle: "{cadenceDisplay(cadence, 'today')} · {streak}-day streak 🔥"
│   └── 28×28 checkbox: filled ritual.color when done today, hollow with ink3 border otherwise
│
└── "+ New ritual" button (full-width, surface bg, accent text) → /(tabs)/rituals/builder
```

### 4.2 State sources

```ts
const ritualsLive = useLiveQuery(
  db.select().from(rituals).where(eq(rituals.active, true)).orderBy(asc(rituals.position))
);
const entriesLive = useLiveQuery(db.select().from(ritualEntries));
const goalsLive   = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));

const todayKey = dayKey(new Date());
const doneToday = useMemo(
  () => new Set(
    entriesLive.data
      .filter(e => dayKeyForMs(e.occurredAt) === todayKey)
      .map(e => e.ritualId)
  ),
  [entriesLive.data, todayKey]
);
const total = ritualsLive.data.length;
const done  = doneToday.size;
```

Streaks per ritual via the existing `streakForRitual({ ritualEntries, ritualId, asOf })` from `lib/db/queries/streaks.ts`. No new streak code.

### 4.3 Tap-on-row behavior

```ts
const onTapRitual = async (ritual: Ritual) => {
  if (doneToday.has(ritual.id)) {
    await deleteTodaysRitualEntries(db, ritual.id, todayKey);
  } else {
    await db.insert(ritualEntries).values({
      ritualId: ritual.id,
      occurredAt: Date.now(),
    });
  }
  // useLiveQuery re-fires automatically; nudge cache key (todayKey, done, total)
  // changes, triggering useRitualNudge to refetch.
};
```

`deleteTodaysRitualEntries(db, ritualId, todayKey)` is a new function in `lib/db/queries/rituals.ts`:

```ts
export async function deleteTodaysRitualEntries(
  db: AnyDb,
  ritualId: number,
  todayKey: string,
): Promise<void> {
  const [y, m, d] = todayKey.split('-').map(Number);
  // Local-midnight bounds; constructing via new Date(y, m-1, d) is DST-safe
  // (unlike adding 24h, which breaks across DST transitions).
  const startOfDayMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const startOfNextDayMs = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
  await (db as any).delete(ritualEntries)
    .where(and(
      eq(ritualEntries.ritualId, ritualId),
      gte(ritualEntries.occurredAt, startOfDayMs),
      lt(ritualEntries.occurredAt, startOfNextDayMs),
    )).run();
}
```

**Day-key helpers refactor:** `dayKey(d: Date)` and `dayKeyForMs(ms: number)` are currently private to `lib/db/queries/streaks.ts`. As part of 5e they're moved to a new `lib/db/queries/dayKey.ts` and re-exported from `streaks.ts` for backward compat (no behavior change to `streakForRitual`). `rituals.ts` then imports them from `dayKey.ts`. No need for a `nextDayKey` helper — the inline `(y, m-1, d+1)` constructor above is DST-safe and used only in this one place.

### 4.4 Pal nudge headline (locally templated)

```ts
function nudgeHeadline(done: number, total: number): string {
  if (total === 0) return 'Add a ritual to get going.';
  if (done === 0) return "Let's start the day.";
  if (done === total) return 'All done — nice.';
  if (done >= total - 1) return 'One to close the day';
  return `${total - done} to go`;
}
```

Sub-line comes from `useRitualNudge` (see §7).

### 4.5 Empty states

- **Zero active rituals:** Replace the "Today" section with an empty-state card — sparkles icon, "No active rituals." heading, "Add one to get going." sub, and a primary "+ New ritual" button. Pal nudge card is suppressed (no progress to ring).
- **Zero ritual entries today (`done=0`):** Pal nudge headline is "Let's start the day."; sub is whatever `/nudge-today` returns for that state.

---

## 5. Builder screen behavior (`app/(tabs)/rituals/builder.tsx`)

### 5.1 Layout

```
SafeAreaView
├── NavBar
│   ├── leading: "‹ Rituals" (matches the back-stack entry — Today is in the same tab)
│   ├── title: "Rituals"
│   ├── subtitle: "Your daily anchors"  (handoff's "five" dropped — now 7 defaults)
│   └── trailing: + button → router.push('/(tabs)/rituals/new')
│
├── "Active rituals" section (footer: "Drag to reorder · swipe to remove")
│   └── DraggableFlatList<Ritual>
│       For each (active=true, ordered by position):
│       ├── Drag handle "≡" (ink4, dragHandleProps from library)
│       ├── 34×34 icon tile (solid ritual.color bg, white symbol)
│       ├── Title (16pt, weight 500)
│       ├── Subtitle: "{cadenceDisplay(cadence, 'builder')} · 🔥 {streak}d"
│       ├── chevron → router.push(`/(tabs)/rituals/${id}/edit`)
│       └── Swipe-left action: red "Remove" button → Alert confirm → soft delete
│
├── "Inactive rituals" section (only renders when ≥1 inactive)
│   └── Same row layout, opacity 0.55, no drag handle
│       Swipe-right action: "Restore" → active=true, position=MAX(position)+1
│
├── "Suggested by Pal" section (header right: ↻ refresh icon)
│   ├── Loading: 2 skeleton rows (44pt height)
│   ├── Loaded: 0–2 suggestion rows
│   │   ├── 34×34 icon tile (suggestion.color bg, white symbol)
│   │   ├── Title (15pt) + reason (12pt, ink3)
│   │   └── "Add" button (accent, 14pt, weight 600)
│   ├── Error: small inline "Couldn't load suggestions. ↻"
│   └── Empty (LLM returned 0): hide section entirely
│
└── "Preferences" section
    ├── Row "Remind me"
    │   ├── Icon: bell.fill on red bg
    │   ├── Trailing: "{format(reminderTime)}" or "Off"
    │   ├── Tap: native iOS DateTimePicker (mode='time')
    │   └── (When set) Inline secondary "Turn off" link below
    │
    └── Row "Daily goal"
        ├── Icon: target on accent bg
        ├── Trailing: "{target} of {totalActive}" + chevron
        └── Tap: router.push('/(tabs)/rituals/goal')
```

### 5.2 Reorder

DraggableFlatList's `onDragEnd` returns the new array order. We compute new `position` values by reassigning `0, 1, 2, …` to the array indices and write all rows in one transaction:

```ts
export async function reorderRitualPositions(
  db: AnyDb,
  orderedIds: number[],
): Promise<void> {
  await (db as any).transaction((tx: any) => {
    orderedIds.forEach((id, i) => {
      tx.update(rituals).set({ position: i }).where(eq(rituals.id, id)).run();
    });
  });
}
```

Invariant: positions are contiguous from 0 to N-1 with no gaps and no duplicates. TDD covers this.

### 5.3 Swipe-to-remove (soft delete)

```ts
const onRemove = (ritual: Ritual) => {
  Alert.alert(
    'Remove ritual?',
    'Past entries kept. You can restore from Inactive.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => softDeleteRitual(db, ritual.id),
      },
    ],
  );
};
```

`softDeleteRitual` sets `active=false` and reorders the remaining active rituals' positions to stay contiguous.

### 5.4 Swipe-to-restore (in Inactive section)

```ts
const onRestore = async (ritual: Ritual) => {
  // Compute next position = MAX(active.position) + 1
  await restoreRitual(db, ritual.id);
};
```

### 5.5 Suggestion "Add" insert

The LLM returns a fully-specified suggestion (`{ title, reason, icon, cadence, color }`). The "Add" tap inserts a new ritual with those exact values, no edit step:

```ts
const onAddSuggestion = async (s: Suggestion) => {
  await insertRitual(db, {
    title: s.title,
    icon: s.icon,
    cadence: s.cadence,
    color: s.color,
    active: true,
  });
  // The active set just changed; usePalSuggestions invalidates cache and refetches
};
```

### 5.6 Reminder time picker

Tap the "Remind me" row → present iOS native `<DateTimePicker mode="time" value={...} />`. On change:

1. Compute `timeMinutes = hour * 60 + minute`.
2. Write `goals.reminder_time_minutes = timeMinutes` **regardless of permission state** (so the user can grant permission later via iOS Settings without losing their picked time).
3. Call `ensurePermission()`. If permission was previously undetermined, this surfaces the iOS prompt now.
4. If `granted`: call `scheduleDailyReminder(timeMinutes, reminderBody(activeRituals))`.
5. If `denied`: surface inline copy under the row — *"Notifications denied. Enable in iOS Settings → Pulse."* The persisted time stays; the once-on-mount check in `app/_layout.tsx` (§9.3) re-attempts scheduling on next app start in case permission was granted via Settings in the meantime.

A secondary "Turn off" affordance (only visible when reminder is set) writes `null` to the column and calls `cancelDailyReminder()`.

---

## 6. Add / edit form (`components/RitualForm.tsx` + route wrappers)

### 6.1 Layout

```
SafeAreaView
├── NavBar
│   ├── leading: "Cancel" → router.back()
│   ├── title: "New ritual" / "Edit ritual"
│   └── trailing: "Save" — accent when canSave, ink4 when disabled
│
├── "Basics" section
│   ├── Row "Name" → right-aligned TextInput (autoCapitalize='sentences', maxLength=40)
│   └── Row "Cadence" → trailing "{cadenceDisplay(cadence, 'today')} ›"
│                       Tap: action sheet (5 options)
│
├── "Style" section (header)
│   ├── 4×4 icon picker grid (16 expo-symbols)
│   │   Selected: ring + opacity 1; unselected: opacity 0.5
│   └── 5-swatch color row (32×32 circles)
│       Selected: ring around the swatch
│
└── "Danger" section (only when mode='edit')
    └── Row "Delete ritual" — destructive (red) text
        Tap: Alert "Delete '{title}'?" → confirm → hard delete (cascade entries) → router.back()
```

### 6.2 Validation (`canSave`)

- `name.trim().length >= 1 && name.trim().length <= 40` — only runtime check
- `cadence`, `icon`, `color` are statically constrained by their pickers

### 6.3 Save behavior

```ts
// New
await insertRitual(db, {
  title: name.trim(), icon, cadence, color, active: true,
  // position assigned by insertRitual: MAX(position) + 1 (or 0 on first row)
});

// Edit
await updateRitual(db, id, {
  title: name.trim(), icon, cadence, color,
  // position + active untouched (toggled elsewhere)
});

router.back();
```

### 6.4 Defaults for "New"

| Field | Default |
|---|---|
| title | `''` |
| cadence | `'daily'` |
| icon | `'sparkles'` |
| color | `'rituals'` |

### 6.5 Hard delete

```ts
const onDelete = () => {
  Alert.alert(
    `Delete '${ritual.title}'?`,
    'This permanently removes the ritual and all its history.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await hardDeleteRitual(db, ritual.id);
          // FK on ritualEntries cascades automatically
          router.back();
        },
      },
    ],
  );
};
```

---

## 7. Caching layer

### 7.1 Table

```sql
CREATE TABLE pal_cache (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,         -- JSON-stringified response object
  fetched_at INTEGER NOT NULL  -- ms epoch
);
```

### 7.2 Key namespaces

| Namespace | Key format | Value | Invalidation |
|---|---|---|---|
| `nudge:*` | `nudge:<YYYY-MM-DD>:<done>:<total>` | `{"sub": "..."}` | Implicit — key changes when state changes; `vacuumStaleNudges` drops `nudge:*` keys ≠ today on app foreground |
| `suggestions:*` | `suggestions:<activeRitualsHash>` | `{"suggestions": [...]}` | TTL 24h + active-set hash change + manual `↻ Refresh` button |

### 7.3 Active-rituals hash

```ts
function hashActive(active: Ritual[]): string {
  const canonical = active
    .map(r => [r.id, r.title, r.cadence, r.color])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  return sha256(JSON.stringify(canonical)).slice(0, 16);
}
```

(Uses an off-the-shelf small JS sha256 or `expo-crypto.digestStringAsync`.)

### 7.4 Query module signatures

```ts
// lib/db/queries/palCache.ts
export function readCache<T>(db: AnyDb, key: string, maxAgeMs?: number): T | null;
export function writeCache(db: AnyDb, key: string, value: unknown): void;
export function deleteCacheByPrefix(db: AnyDb, prefix: string): void;
export function vacuumStaleNudges(db: AnyDb, todayKey: string): void;
```

### 7.5 Hooks

`useRitualNudge` and `usePalSuggestions` both follow the same shape: read cache → if miss, fetch → write cache → return result. `useRitualNudge` keys on `(todayKey, done, total)`; `usePalSuggestions` keys on the active hash with 24h TTL and exposes a `refresh()` that calls `deleteCacheByPrefix(db, 'suggestions:')` then refetches.

`vacuumStaleNudges(db, todayKey)` is called from `useRitualNudge`'s mount effect (cheap `DELETE … WHERE LIKE`).

---

## 8. Backend endpoints

### 8.1 `POST /suggest-rituals`

**Auth:** `"chat"` JWT scope.

**Request:**
```ts
{
  active: Array<{ title: string; cadence: RitualCadence; color: RitualColor }>;
  recentRitualEntries?: Array<{ title: string; occurredAt: number }>;
}
```

**Response:** `{ suggestions: Array<{ title, reason, icon, cadence, color }> }` (0–2 items).

**Prompt builder** (`backend/src/lib/prompts/suggestRituals.ts`):

```
SYSTEM: You are Pal. Suggest at most 2 daily rituals for the user that
complement (do not duplicate) their active list. Each suggestion must:
- title: 1–40 chars, action-shaped ("Evening shutdown", not "Be productive")
- reason: one short sentence grounded in the user's patterns
- icon: pick from this exact list: <16 shortlist symbols>
- cadence: pick from morning|evening|all_day|weekdays|daily
- color: pick from rituals|accent|move|money|cyan
Return ONLY a JSON object: {"suggestions": [...]}. No prose, no markdown.

USER: Active rituals: <bulleted list>
Recent activity (last 30d): <count of entries per active title>
```

**Validation:** Zod-parse the LLM response. On parse failure, single retry with a stricter "JSON ONLY" amendment to the prompt. On second failure, return `{ suggestions: [] }` (graceful empty state). Filter out suggestions whose `icon` isn't in the shortlist or whose `cadence`/`color` aren't valid enum values.

**Errors:** Standard `errorHandler` integration. 401 / 403 / 429 / 500 mapped per existing taxonomy.

### 8.2 `POST /nudge-today`

**Auth:** `"chat"` JWT scope.

**Request:**
```ts
{
  date: string;  // YYYY-MM-DD local
  done: number;
  total: number;
  remaining: Array<{ title: string; streak: number; cadence: RitualCadence }>;
  bestStreak?: { title: string; streak: number };
}
```

**Response:** `{ sub: string }` — one short sentence, ≤120 chars.

**Prompt builder** (`backend/src/lib/prompts/nudgeToday.ts`):

```
SYSTEM: You are Pal. Write ONE warm, concrete sentence (≤120 chars) about
the user's ritual progress today. Reference a specific ritual or streak by
name. No filler ("Great job!"). No emoji unless one fits the noun (💧 water).
Return ONLY a JSON object: {"sub": "..."}.

USER: {done}/{total} done today.
Remaining: <bulleted titles + streaks + cadence>
Best ongoing streak: {bestStreak.title} {bestStreak.streak} days
```

**Validation:** Same Zod + retry pattern. On second failure, the *client* falls back to a locally-templated string (`"Your {firstRemaining.title} is waiting."`). The endpoint always returns 200 with a `sub`; the fallback is *client-side* in case the endpoint itself errors.

**Truncation:** If the LLM exceeds 120 chars, truncate at the last word boundary ≤120 chars and append `…`.

### 8.3 OpenRouter relay

Both endpoints reuse the existing OpenRouter proxy (same as `/chat`, `/parse`, `/review`). Same model selection logic. Same `OPENROUTER_API_KEY` env requirement on the droplet.

### 8.4 iOS client (`lib/sync/palClient.ts`)

Mirrors `lib/sync/client.ts` from SP5c — fetch wrapper, mapped error taxonomy, returns parsed JSON or throws typed errors:

```ts
export async function postSuggestRituals(
  req: SuggestRitualsRequest,
): Promise<SuggestRitualsResponse>;

export async function postNudgeToday(
  req: NudgeTodayRequest,
): Promise<NudgeTodayResponse>;
```

---

## 9. Notifications

### 9.1 Module (`lib/notifications/dailyReminder.ts`)

```ts
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'pulse-daily-rituals';

export async function ensurePermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export async function scheduleDailyReminder(timeMinutes: number, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: 'Pulse', body, sound: 'default' },
    trigger: { hour, minute, repeats: true },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

export function reminderBody(activeRituals: Array<{ title: string }>): string {
  const n = activeRituals.length;
  if (n === 0) return 'Open Pulse — your rituals await.';
  if (n === 1) return `${activeRituals[0].title} waiting.`;
  if (n <= 3) return `${activeRituals.map(r => r.title).join(', ')} waiting.`;
  return `${n} rituals waiting today.`;
}
```

### 9.2 Permission posture

- **No permission prompt at app launch.** The user encounters the iOS notification permission ask only when they first tap the "Remind me" row in Builder Preferences and pick a time.
- If the user denies: surface inline copy under the row — *"Notifications denied. Enable in iOS Settings → Pulse."* The row stays editable but `scheduleDailyReminder` won't fire any actual notification.

### 9.3 Reschedule triggers

The reminder body changes when the active ritual list changes (add / remove / rename / soft-delete / restore). Every mutation in `lib/db/queries/rituals.ts` calls `rescheduleDailyReminderIfActive(db)`:

```ts
async function rescheduleDailyReminderIfActive(db: AnyDb): Promise<void> {
  const goalRow = await readGoals(db);
  if (goalRow.reminder_time_minutes == null) return;
  const active = await readActiveRituals(db);
  await scheduleDailyReminder(goalRow.reminder_time_minutes, reminderBody(active));
}
```

`app/_layout.tsx` also runs a once-on-mount check:

1. Read `goals.reminder_time_minutes`.
2. If non-null AND permission is `granted`: ensure a scheduled notification exists with the right content; if not, reschedule.
3. If null: ensure no scheduled notification exists.

This handles cases like app reinstall, OS clearing scheduled notifications, or user manually denying permission via Settings.

### 9.4 Notification tap

Opens the app to its default route (Today tab). No deep-linking work in 5e.

---

## 10. Meta-spec amendments required

Three amendments to `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`:

### 10.1 Amendment A — §2 row 10 ("Triggers")

Replace:

> All Reviews / Celebrations / Close-Out triggers are **app-foreground checks** comparing local DB state to last-seen value. **No `expo-notifications`, no permission prompts, no push.**

With:

> All Reviews / Celebrations / Close-Out triggers are **app-foreground checks** comparing local DB state to last-seen value. **No push notifications.** Local notifications via `expo-notifications` are allowed for one specific surface — the daily ritual reminder added in 5e (single repeating local notification scheduled at the user's chosen time). Permission is requested in-context (only when the user first sets a reminder time), not at app launch. No silent push, no remote push, no APNs config.

### 10.2 Amendment B — §6 (Scope cuts) — color/icon picker line

Replace:

> Editing rituals' icon/color picker beyond the seeded set | The Builder lets you edit name and active-state and reorder. Icon picker uses a fixed shortlist of `expo-symbols` names — no custom uploads.

With:

> The Builder lets you edit name, cadence, icon (16-symbol shortlist), color (5-token shortlist), and active-state, plus reorder. **No** custom icon uploads, **no** free-form color (HSL/hex). The 5 color tokens reuse existing theme tokens (`rituals`, `accent`, `move`, `money`) plus one new token `cyan` (#5AC8FA / #64D2FF) added to `lib/theme/tokens.ts`.

### 10.3 Amendment C — §3 5e row "Surface" + "TDD applies to" columns

Replace the "Surface" column with:

> Full `app/(tabs)/rituals/` route group (`index`, `builder`, `new`, `[id]/edit`, `goal`). Schema delta: `rituals` gains `cadence` + `color` enum columns; `goals` gains `reminder_time_minutes`; new `pal_cache` table for nudge + suggestion caches. New iOS deps: `expo-notifications`, `react-native-draggable-flatlist`. **New backend endpoints** `POST /suggest-rituals` and `POST /nudge-today` (under `"chat"` scope) consumed by Builder's "Suggested by Pal" section and Today's nudge card. New theme token `cyan`. Idempotent reseed of `DEFAULT_RITUALS` (adds `8 glasses water` for already-onboarded users).

Replace the "TDD applies to" column with:

> Reorder semantics (position math, gap-handling, contiguous-position invariant), active/soft-delete/restore/hard-delete behavior, tap-toggle today (insert vs. cascading-delete-all-today's), reminder body templating, cache read/write/vacuum, `cadenceDisplay` mapping, idempotent reseed, prompt builders for both new endpoints, and route-level integration tests for both endpoints (auth + LLM-failure resilience).

### 10.4 Amendment D — §4 (Cross-cutting dependencies) — new row

Add row:

> | `expo-notifications` | 5e only — single repeating local notification for daily ritual reminder. Permission asked in-context (Builder Preferences row). | New stack addition. Expo Go supports local notifications for development smoke; production iPhone install requires a dev-client rebuild (carry-over to end-of-SP5 deferred pass). |

### 10.5 Cross-tier scope note

5e is no longer iOS-only. It bundles two backend endpoints. No new JWT scope (reuses `"chat"`). No new env var. No droplet config change beyond a redeploy. The live verification gate is the same as 5b/5c: **`OPENROUTER_API_KEY` must be set on the droplet** for the LLM-backed surfaces to work end-to-end.

---

## 11. Testing posture

### 11.1 iOS unit tests (~25 new)

`lib/db/queries/__tests__/rituals.test.ts`
- `toggleRitualToday` — insert when missing today; deletes ALL of today's rows when present
- `toggleRitualToday` — preserves prior days' entries (never touches `occurredAt < startOfToday`)
- `reorderRitualPositions` — `[3,1,2]` → positions `[0,1,2]` reassigned in correct order
- `reorderRitualPositions` — no gaps, no duplicates after any permutation
- `reorderRitualPositions` — adjacent swap, drag-to-end, drag-to-start
- `softDeleteRitual` — sets `active=false`, leaves `ritualEntries` intact
- `restoreRitual` — sets `active=true`, assigns `MAX(active.position) + 1`
- `hardDeleteRitual` — cascades to `ritualEntries`
- `insertRitual` — assigns `MAX(position) + 1`; first insert gets `0`
- `updateRitual` — title/icon/cadence/color writable, position/active untouched

`lib/db/queries/__tests__/palCache.test.ts`
- `readCache` — null on miss, parsed JSON on hit, null when stale beyond `maxAgeMs`
- `writeCache` — INSERT OR REPLACE behavior (write twice, second wins)
- `deleteCacheByPrefix` — removes only matching prefix, leaves others
- `vacuumStaleNudges` — keeps today's nudges, drops yesterday's

`lib/db/queries/__tests__/reseedDefaults.test.ts`
- Adds missing seeds; never duplicates existing titles
- Idempotent — running twice has no effect after first run

`lib/sync/__tests__/cadenceDisplay.test.ts`
- All 5 enum values × 2 contexts = 10 cases

`lib/notifications/__tests__/dailyReminder.test.ts`
- `reminderBody()` for 0 / 1 / 2 / 3 / 4+ rituals → expected string

### 11.2 Backend unit tests (~15 new)

`backend/test/unit/suggestRituals.prompt.test.ts`
- `buildSuggestRitualsPrompt(active, recent)` includes all active titles
- Includes the icon shortlist + cadence/color enum lists verbatim
- 0 active rituals → still produces a valid prompt

`backend/test/integration/suggestRituals.route.test.ts` (mocked OpenRouter)
- Valid LLM JSON → 200 + parsed suggestions
- Malformed LLM JSON → single retry → `{ suggestions: [] }` on second failure (no 500)
- LLM returns out-of-shortlist icon → filtered (1 suggestion not 2)
- Auth: missing JWT → 401; wrong scope → 403

`backend/test/unit/nudgeToday.prompt.test.ts`
- `buildNudgeTodayPrompt({date, done, total, remaining, bestStreak?})` includes done/total
- Handles `bestStreak` undefined

`backend/test/integration/nudgeToday.route.test.ts`
- Valid LLM → 200 + sub
- Malformed LLM → retry → fallback string returned
- Truncates `sub` if LLM exceeds 120 chars

### 11.3 Smoke (manual web target, deferred per meta-spec §5)

- 7 default rituals visible after fresh onboarding (Water present)
- Tap a ritual → checkbox flips, count increments, nudge sub re-fetches
- Tap again → checkbox flips back, count decrements
- "+ New ritual" → form opens, fill name + pick icon/cadence/color, save → row appears in Builder
- Drag a row up/down in Builder → order persists across reload
- Swipe-left "Remove" → moves to Inactive section; swipe-right "Restore" → returns to Active
- Edit row → "Delete ritual" → confirm → row + history gone
- "Suggested by Pal" → 2 rows render after first Builder open; "Add" inserts and re-fetches
- "Remind me" → time picker → grants permission → notification scheduled
- "Daily goal" → picker → save → "X of Y" updates in row

### 11.4 Out of scope for 5e (deferred to end-of-SP5 visual pass)

- Live `/suggest-rituals` against real OpenRouter
- Live `/nudge-today` against real OpenRouter
- iPhone Expo Go visual verification of all screens
- Dev-client rebuild for `expo-notifications` (Expo Go's local-notif fallback suffices for dev iteration)

---

## 12. Open items requiring user input before plan-writing

(None — all decisions resolved during brainstorming. See §2.)

---

## 13. What this spec is NOT

- Not a redesign of `streakForRitual` math (SP3a; reused as-is).
- Not a multi-user surface — `goals.reminder_time_minutes` is single-row (id=1) like every other goal column.
- Not a deep-linking spec — notification tap opens the default route (Today tab); no `Linking.parseURL` work.
- Not a Pal-personality spec — both new endpoints reuse the existing OpenRouter relay; no system-prompt revisions to `chat.ts`.
- Not a dev-client rebuild plan — that's part of the end-of-SP5 deferred pass.
- Not a "Daily goal" deep-edit — the picker only writes `goals.dailyRitualTarget`; budget/move targets are unchanged from onboarding.
