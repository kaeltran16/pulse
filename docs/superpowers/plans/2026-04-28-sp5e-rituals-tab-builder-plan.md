# SP5e — iOS Rituals Tab + Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace the `<StubTab>` Rituals tab with the full handoff: Today list (tap-to-toggle, Pal-written nudge), Builder (drag-reorder, swipe-delete, LLM-suggested rituals, daily reminder, daily-goal picker), full add/edit form per ritual. Bundle two new backend endpoints (`POST /suggest-rituals`, `POST /nudge-today`) under the existing `"chat"` JWT scope.

**Architecture:** New route group `app/(tabs)/rituals/` with 5 screens (`index`, `builder`, `new`, `[id]/edit`, `goal`) + `_layout`. New iOS query modules: `lib/db/queries/rituals.ts`, `lib/db/queries/palCache.ts`, `lib/db/queries/reseedDefaults.ts`, `lib/db/queries/dayKey.ts` (extracts day-key helpers from `streaks.ts`). Two new hooks: `lib/sync/useRitualNudge.ts`, `lib/sync/usePalSuggestions.ts`. New iOS client `lib/sync/palClient.ts`. Notifications module `lib/notifications/dailyReminder.ts`. New backend routes + prompt builders + Zod schemas for both endpoints, plus shared API types extending `lib/api-types.ts` with `RitualCadence`, `RitualColor`, `RITUAL_ICON_SHORTLIST`. Schema delta: `rituals` gains `cadence` + `color` enum cols, `goals` gains `reminder_time_minutes`, new `pal_cache` table.

**Tech Stack:** TypeScript (strict), React Native via Expo SDK 55, Expo Router (typed routes), Drizzle ORM + `expo-sqlite`, `useLiveQuery` for reactive surfaces, NativeWind v4 (Tailwind), `expo-symbols`. Backend: Express + Zod + existing OpenRouter relay (`chatJson`). **New deps:** `expo-notifications` (~0.32.x), `react-native-draggable-flatlist`.

**Spec:** [`docs/superpowers/specs/2026-04-28-sp5e-rituals-tab-builder-design.md`](../specs/2026-04-28-sp5e-rituals-tab-builder-design.md)

**Working-dir baseline check before starting:** `git status` should be clean (the SP5e spec is committed at `4484a17`). `npm test` (root, iOS) should be green at **347 tests** (per the SP5d slice-close in commit `3f74ecd`). `cd backend && npm test` should be green at **205 tests**. `npx tsc --noEmit` baseline is **24 pre-existing errors** (carries over from SP5d — these are backend `@api-types` resolution + a few unrelated frontend issues; no SP5d code was added to that count). Record both numbers before starting; **regression = anything above 24 tsc errors or below the test counts.**

**Convention used in this plan:** All commands run from repo root unless explicitly prefixed with `cd backend`. **This plan touches both iOS and backend** — Tasks 13–17 are backend; Task 12 is shared types; everything else is iOS or root config. Drizzle-kit auto-names the iOS migration file (likely `0005_*.sql`); the plan refers to it generically as "the new migration."

**Convention for plan-text vs. code:** All TypeScript code blocks are the **complete file** for that task's step unless a step explicitly says "append to" or "replace the X block." If a task touches multiple files, each file's contents are shown in their own code block.

**Convention for commits:** Per project CLAUDE.md, commit author is the user; **no `Co-Authored-By` lines.** Subjects use `feat(sp5e):` / `test(sp5e):` / `docs(sp5e):` prefixes.

---

## Task 1: Add `cyan` theme token + tailwind parity

**Files:**
- Modify: `lib/theme/tokens.ts`
- Modify: `tailwind.config.js`

The 5th color choice in the picker uses a new theme token `cyan` (#5AC8FA light / #64D2FF dark) plus `cyanTint` for the 14%/18% backgrounds.

- [x] **Step 1: Add `cyan` + `cyanTint` to `lib/theme/tokens.ts`**

In `lib/theme/tokens.ts`, find the `light` block and add after `accentTint:`:

```ts
    accent: '#007AFF',
    accentTint: 'rgba(0,122,255,0.14)',
    cyan: '#5AC8FA',
    cyanTint: 'rgba(90,200,250,0.14)',
    red: '#FF3B30',
```

In the `dark` block, after `accentTint:`:

```ts
    accent: '#0A84FF',
    accentTint: 'rgba(10,132,255,0.18)',
    cyan: '#64D2FF',
    cyanTint: 'rgba(100,210,255,0.18)',
    red: '#FF453A',
```

- [x] **Step 2: Run the parity test to confirm it fails**

```bash
npm test -- parity
```

Expected: FAIL — `cyan` and `cyanTint` are in `tokens.ts` but not in `tailwind.config.js`.

- [x] **Step 3: Add `cyan` + `cyanTint` to `tailwind.config.js`**

Find the `colors:` block in `tailwind.config.js` and add the two new keys (alphabetical order alongside the others) wherever the existing `accent` / `accentTint` / `money` / `moneyTint` keys live. Pattern matches what's already there — each is `<key>: 'var(--<key>)'`.

- [x] **Step 4: Run the parity test to confirm it passes**

```bash
npm test -- parity
```

Expected: PASS.

- [x] **Step 5: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24` (no regression).

- [x] **Step 6: Commit**

```bash
git add lib/theme/tokens.ts tailwind.config.js
git commit -m "feat(sp5e): add cyan theme token + tailwind parity"
```

---

## Task 2: Day-key helpers refactor

**Files:**
- Create: `lib/db/queries/dayKey.ts`
- Modify: `lib/db/queries/streaks.ts`

Move private `dayKey` / `dayKeyForMs` / `previousDayKey` from `streaks.ts` into a shared module so `rituals.ts` (Task 11) can use them. Keep `streaks.ts` re-exporting them so existing callers don't break.

- [x] **Step 1: Create `lib/db/queries/dayKey.ts` with the extracted helpers**

```ts
/** ISO-like local-day key, e.g. "2026-04-28". */
export function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayKeyForMs(ms: number): string {
  return dayKey(new Date(ms));
}

export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Construct at noon to dodge DST hour shifts.
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return dayKey(prev);
}
```

- [x] **Step 2: Replace the helpers in `streaks.ts` with imports + re-exports**

Replace the top of `lib/db/queries/streaks.ts` (lines 1–24, the helpers + StreakInput) with:

```ts
import { dayKey, dayKeyForMs, previousDayKey } from './dayKey';

export { dayKey, dayKeyForMs, previousDayKey };

export interface StreakInput {
  ritualEntries: { ritualId: number; occurredAt: number }[];
  ritualId: number;
  asOf: Date;
}
```

The rest of the file (`streakForRitual` function) stays untouched.

- [x] **Step 3: Run the streaks tests to confirm no regression**

```bash
npm test -- streaks
```

Expected: PASS at the existing count (no behavior change, just module move).

- [x] **Step 4: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/dayKey.ts lib/db/queries/streaks.ts
git commit -m "refactor(sp5e): extract day-key helpers into shared module"
```

---

## Task 3: `cadenceDisplay` pure helper

**Files:**
- Create: `lib/sync/cadenceDisplay.ts`
- Create: `lib/sync/__tests__/cadenceDisplay.test.ts`

Pure mapping from `RitualCadence` enum + display context to display string. Tested standalone since both Today and Builder consume it.

- [x] **Step 1: Write the failing tests**

Create `lib/sync/__tests__/cadenceDisplay.test.ts`:

```ts
/** @jest-environment node */
import { cadenceDisplay } from '../cadenceDisplay';

describe('cadenceDisplay', () => {
  describe('today context', () => {
    it.each([
      ['morning',  'Morning'],
      ['evening',  'Evening'],
      ['all_day',  'All day'],
      ['weekdays', 'Weekdays'],
      ['daily',    'Daily'],
    ] as const)('%s → %s', (cadence, expected) => {
      expect(cadenceDisplay(cadence, 'today')).toBe(expected);
    });
  });

  describe('builder context', () => {
    it.each([
      ['morning',  'Every morning'],
      ['evening',  'Evenings'],
      ['all_day',  'All day'],
      ['weekdays', 'Weekdays'],
      ['daily',    'Daily'],
    ] as const)('%s → %s', (cadence, expected) => {
      expect(cadenceDisplay(cadence, 'builder')).toBe(expected);
    });
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- cadenceDisplay
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement `cadenceDisplay`**

Create `lib/sync/cadenceDisplay.ts`:

```ts
import type { RitualCadence } from '@/lib/api-types';

export type CadenceDisplayContext = 'today' | 'builder';

export function cadenceDisplay(cadence: RitualCadence, context: CadenceDisplayContext): string {
  if (context === 'today') {
    switch (cadence) {
      case 'morning':  return 'Morning';
      case 'evening':  return 'Evening';
      case 'all_day':  return 'All day';
      case 'weekdays': return 'Weekdays';
      case 'daily':    return 'Daily';
    }
  }
  // builder
  switch (cadence) {
    case 'morning':  return 'Every morning';
    case 'evening':  return 'Evenings';
    case 'all_day':  return 'All day';
    case 'weekdays': return 'Weekdays';
    case 'daily':    return 'Daily';
  }
}
```

(Note: the `RitualCadence` type lives in `lib/api-types.ts`. Task 12 adds it; this task imports it ahead of time. The import will type-error until Task 12 runs — see Step 4.)

- [x] **Step 4: Add a temporary local type so the file compiles before Task 12**

In `lib/sync/cadenceDisplay.ts`, replace the import with a local type definition (will be replaced with the real import in Task 12):

```ts
// Inlined ahead of Task 12 (which adds RitualCadence to lib/api-types.ts).
export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';

export type CadenceDisplayContext = 'today' | 'builder';

export function cadenceDisplay(cadence: RitualCadence, context: CadenceDisplayContext): string {
  // ... (same body as Step 3)
}
```

- [x] **Step 5: Run the tests to confirm they pass**

```bash
npm test -- cadenceDisplay
```

Expected: PASS — 10 tests.

- [x] **Step 6: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 7: Commit**

```bash
git add lib/sync/cadenceDisplay.ts lib/sync/__tests__/cadenceDisplay.test.ts
git commit -m "feat(sp5e): cadenceDisplay pure helper with TDD coverage"
```

---

## Task 4: Update `DEFAULT_RITUALS` with cadence/color + add Water

**Files:**
- Modify: `lib/db/seed-defaults.ts`

Update each existing seed to include cadence + color, and add `8 glasses water` as the 7th default. The columns themselves will be added in the migration in Task 5; until then `DEFAULT_RITUALS` is just data — no DB writes happen here.

- [x] **Step 1: Update `lib/db/seed-defaults.ts` to the new shape**

Replace the file with:

```ts
import type { RitualCadence, RitualColor } from '@/lib/api-types';

export interface DefaultRitual {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
}

export const DEFAULT_RITUALS: readonly DefaultRitual[] = [
  { title: 'Morning pages',     icon: 'book.closed.fill',           cadence: 'morning',  color: 'accent'  },
  { title: 'Inbox zero',        icon: 'tray.fill',                  cadence: 'weekdays', color: 'move'    },
  { title: 'Language practice', icon: 'character.book.closed.fill', cadence: 'daily',    color: 'move'    },
  { title: 'Stretch',           icon: 'dumbbell.fill',              cadence: 'evening',  color: 'money'   },
  { title: 'Read before bed',   icon: 'books.vertical.fill',        cadence: 'evening',  color: 'money'   },
  { title: 'Meditate',          icon: 'heart.fill',                 cadence: 'morning',  color: 'rituals' },
  { title: '8 glasses water',   icon: 'cup.and.saucer.fill',        cadence: 'all_day',  color: 'cyan'    },
] as const;
```

`RitualCadence` and `RitualColor` will be added to `lib/api-types.ts` in Task 12. Until then this file will type-error on the import. To unblock Task 4 in isolation:

- [x] **Step 2: Inline the types ahead of Task 12**

Replace the import line with:

```ts
// Inlined ahead of Task 12.
type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';
```

- [x] **Step 3: Verify the existing onboarding tests still pass**

```bash
npm test -- onboarding
```

Expected: PASS (the onboarding query just picks titles from `DEFAULT_RITUALS` — adding columns shouldn't break it; if it does, fix the onboarding query to ignore the new columns and keep this commit's scope to the data update).

- [x] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Commit**

```bash
git add lib/db/seed-defaults.ts
git commit -m "feat(sp5e): add cadence/color + 7th Water default to DEFAULT_RITUALS"
```

---

## Task 5: Drizzle migration — `cadence` + `color` + `reminder_time_minutes` + `pal_cache`

**Files:**
- Modify: `lib/db/schema.ts`
- Generate: `lib/db/migrations/<auto-named>.sql`

Add the new columns + new table to the schema and let drizzle-kit generate the SQL. Then add the `UPDATE rituals SET cadence=…` backfill statements by hand to the generated SQL (drizzle-kit doesn't author data migrations).

- [x] **Step 1: Update `lib/db/schema.ts` to add cadence + color cols + reminder_time_minutes + pal_cache table**

In `lib/db/schema.ts`, replace the `rituals` declaration:

```ts
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

Add the type aliases at the top of the file (just after the `import` block):

```ts
export type RitualCadence = 'morning' | 'evening' | 'all_day' | 'weekdays' | 'daily';
export type RitualColor   = 'rituals' | 'accent' | 'move' | 'money' | 'cyan';
```

Replace the `goals` declaration to add `reminderTimeMinutes`:

```ts
export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey(),
  dailyBudgetCents: integer('daily_budget_cents').notNull(),
  dailyMoveMinutes: integer('daily_move_minutes').notNull(),
  dailyRitualTarget: integer('daily_ritual_target').notNull(),
  reminderTimeMinutes: integer('reminder_time_minutes'),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});
```

Add the new `palCache` table at the bottom of the file (before the `export type` block):

```ts
export const palCache = sqliteTable('pal_cache', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  fetchedAt: integer('fetched_at').notNull(),
});

export type PalCacheRow = typeof palCache.$inferSelect;
```

- [x] **Step 2: Generate the migration SQL**

```bash
npx drizzle-kit generate
```

Expected output: a new migration file in `lib/db/migrations/` (likely `0005_*.sql`). Open it and confirm it has `ALTER TABLE rituals ADD COLUMN cadence …`, `ALTER TABLE rituals ADD COLUMN color …`, `ALTER TABLE goals ADD COLUMN reminder_time_minutes …`, and `CREATE TABLE pal_cache …`.

- [x] **Step 3: Append the backfill UPDATEs to the generated SQL**

Open the generated migration file. Append (at the end of the file) these 6 backfill statements:

```sql
-- Backfill known seed titles with cadence + color
UPDATE rituals SET cadence = 'morning',  color = 'accent'  WHERE title = 'Morning pages';
UPDATE rituals SET cadence = 'weekdays', color = 'move'    WHERE title = 'Inbox zero';
UPDATE rituals SET cadence = 'daily',    color = 'move'    WHERE title = 'Language practice';
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Stretch';
UPDATE rituals SET cadence = 'evening',  color = 'money'   WHERE title = 'Read before bed';
UPDATE rituals SET cadence = 'morning',  color = 'rituals' WHERE title = 'Meditate';
```

(These run after the column adds, so the column exists by the time `UPDATE` runs.)

- [x] **Step 4: Verify the migration applies cleanly to a fresh DB**

```bash
npm test -- onboarding
```

Expected: PASS. (The test helper `makeTestDb` runs all migrations against `:memory:`; if anything is wrong with the migration the tests will fail on setup.)

- [x] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/
git commit -m "feat(sp5e): drizzle migration for rituals.cadence/color, goals.reminder_time_minutes, pal_cache table"
```

---

## Task 6: TDD `reseedDefaults` query

**Files:**
- Create: `lib/db/queries/reseedDefaults.ts`
- Create: `lib/db/queries/__tests__/reseedDefaults.test.ts`

Idempotent insert of `DEFAULT_RITUALS` rows whose title isn't already present. Lets us add new defaults (like Water) for already-onboarded users without re-running onboarding.

- [x] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/reseedDefaults.test.ts`:

```ts
/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import { reseedDefaults } from '../reseedDefaults';
import { DEFAULT_RITUALS } from '../../seed-defaults';

describe('reseedDefaults', () => {
  it('inserts all defaults on a fresh DB', () => {
    const { db } = makeTestDb();
    reseedDefaults(db);
    const rows = (db as any).select().from(rituals).all() as Array<{ title: string }>;
    expect(rows.map((r) => r.title).sort()).toEqual(
      DEFAULT_RITUALS.map((d) => d.title).sort(),
    );
  });

  it('does not duplicate existing titles', () => {
    const { db } = makeTestDb();
    // Seed 3 of the 7 defaults manually
    (db as any).insert(rituals).values([
      { title: 'Morning pages',   icon: 'book.closed.fill',  cadence: 'morning', color: 'accent', position: 0 },
      { title: 'Inbox zero',      icon: 'tray.fill',         cadence: 'weekdays', color: 'move', position: 1 },
      { title: '8 glasses water', icon: 'cup.and.saucer.fill', cadence: 'all_day', color: 'cyan', position: 2 },
    ]).run();

    reseedDefaults(db);

    const rows = (db as any).select().from(rituals).all() as Array<{ title: string }>;
    expect(rows.length).toBe(DEFAULT_RITUALS.length); // no duplicates of the 3 pre-existing
    expect(rows.map((r) => r.title).sort()).toEqual(
      DEFAULT_RITUALS.map((d) => d.title).sort(),
    );
  });

  it('is idempotent — running twice has no effect after first run', () => {
    const { db } = makeTestDb();
    reseedDefaults(db);
    const before = (db as any).select().from(rituals).all().length;
    reseedDefaults(db);
    const after  = (db as any).select().from(rituals).all().length;
    expect(after).toBe(before);
  });

  it('assigns position MAX+1 to newly inserted rows', () => {
    const { db } = makeTestDb();
    (db as any).insert(rituals).values({
      title: 'Morning pages', icon: 'book.closed.fill', cadence: 'morning', color: 'accent', position: 5,
    }).run();
    reseedDefaults(db);
    const water = (db as any).select().from(rituals).where(eq(rituals.title, '8 glasses water')).all()[0];
    expect(water.position).toBeGreaterThan(5);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- reseedDefaults
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement `reseedDefaults`**

Create `lib/db/queries/reseedDefaults.ts`:

```ts
import { sql } from 'drizzle-orm';

import { DEFAULT_RITUALS } from '../seed-defaults';
import { type AnyDb } from './onboarding';

/**
 * Idempotent insert of DEFAULT_RITUALS rows whose title isn't already present.
 * New rows get position = MAX(position) + 1 (or 0 on a fresh table).
 *
 * Run once at app startup after migrations apply, so already-onboarded users
 * pick up new default rituals (e.g., the Water row added in SP5e) without
 * re-running onboarding.
 */
export function reseedDefaults(db: AnyDb): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  for (const def of DEFAULT_RITUALS) {
    dx.run(sql`
      INSERT INTO rituals (title, icon, cadence, color, active, position)
      SELECT ${def.title}, ${def.icon}, ${def.cadence}, ${def.color}, 1,
             COALESCE((SELECT MAX(position) + 1 FROM rituals), 0)
      WHERE NOT EXISTS (SELECT 1 FROM rituals WHERE title = ${def.title})
    `);
  }
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- reseedDefaults
```

Expected: PASS — 4 tests.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/reseedDefaults.ts lib/db/queries/__tests__/reseedDefaults.test.ts
git commit -m "feat(sp5e): reseedDefaults query with TDD coverage"
```

---

## Task 7: TDD `palCache` query

**Files:**
- Create: `lib/db/queries/palCache.ts`
- Create: `lib/db/queries/__tests__/palCache.test.ts`

Generic key/value JSON cache for the two LLM-backed surfaces. Read returns `null` on miss or stale; write is upsert; vacuum + prefix delete handle invalidation.

- [x] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/palCache.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import {
  readCache,
  writeCache,
  deleteCacheByPrefix,
  vacuumStaleNudges,
} from '../palCache';

describe('palCache', () => {
  describe('writeCache + readCache', () => {
    it('round-trips a value', () => {
      const { db } = makeTestDb();
      writeCache(db, 'k1', { a: 1, b: 'two' });
      expect(readCache(db, 'k1')).toEqual({ a: 1, b: 'two' });
    });

    it('overwrites on second write', () => {
      const { db } = makeTestDb();
      writeCache(db, 'k1', { v: 1 });
      writeCache(db, 'k1', { v: 2 });
      expect(readCache(db, 'k1')).toEqual({ v: 2 });
    });

    it('returns null on miss', () => {
      const { db } = makeTestDb();
      expect(readCache(db, 'nope')).toBeNull();
    });

    it('returns null when value is stale beyond maxAgeMs', () => {
      const { db, raw } = makeTestDb();
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
      raw.prepare(`INSERT INTO pal_cache (key, value, fetched_at) VALUES (?, ?, ?)`).run(
        'k1', JSON.stringify({ v: 1 }), tenMinutesAgo,
      );
      expect(readCache(db, 'k1', 5 * 60 * 1000)).toBeNull();
      expect(readCache(db, 'k1', 60 * 60 * 1000)).toEqual({ v: 1 });
    });
  });

  describe('deleteCacheByPrefix', () => {
    it('removes only matching prefix', () => {
      const { db } = makeTestDb();
      writeCache(db, 'suggestions:abc', { a: 1 });
      writeCache(db, 'suggestions:def', { b: 2 });
      writeCache(db, 'nudge:2026-04-28:0:5', { sub: 'x' });
      deleteCacheByPrefix(db, 'suggestions:');
      expect(readCache(db, 'suggestions:abc')).toBeNull();
      expect(readCache(db, 'suggestions:def')).toBeNull();
      expect(readCache(db, 'nudge:2026-04-28:0:5')).toEqual({ sub: 'x' });
    });
  });

  describe('vacuumStaleNudges', () => {
    it('keeps today nudges, drops other-day nudges', () => {
      const { db } = makeTestDb();
      writeCache(db, 'nudge:2026-04-28:0:5', { sub: 'today1' });
      writeCache(db, 'nudge:2026-04-28:1:5', { sub: 'today2' });
      writeCache(db, 'nudge:2026-04-27:3:5', { sub: 'yesterday' });
      writeCache(db, 'suggestions:abc', { v: 1 });
      vacuumStaleNudges(db, '2026-04-28');
      expect(readCache(db, 'nudge:2026-04-28:0:5')).toEqual({ sub: 'today1' });
      expect(readCache(db, 'nudge:2026-04-28:1:5')).toEqual({ sub: 'today2' });
      expect(readCache(db, 'nudge:2026-04-27:3:5')).toBeNull();
      expect(readCache(db, 'suggestions:abc')).toEqual({ v: 1 });
    });
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- palCache
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement `palCache`**

Create `lib/db/queries/palCache.ts`:

```ts
import { sql } from 'drizzle-orm';

import { type AnyDb } from './onboarding';

export function readCache<T>(db: AnyDb, key: string, maxAgeMs?: number): T | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx.all(sql`
    SELECT value, fetched_at AS fetchedAt FROM pal_cache WHERE key = ${key}
  `) as Array<{ value: string; fetchedAt: number }>;
  if (rows.length === 0) return null;
  const row = rows[0];
  if (maxAgeMs != null && Date.now() - Number(row.fetchedAt) > maxAgeMs) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function writeCache(db: AnyDb, key: string, value: unknown): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`
    INSERT OR REPLACE INTO pal_cache (key, value, fetched_at)
    VALUES (${key}, ${JSON.stringify(value)}, ${Date.now()})
  `);
}

export function deleteCacheByPrefix(db: AnyDb, prefix: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`DELETE FROM pal_cache WHERE key LIKE ${prefix + '%'}`);
}

export function vacuumStaleNudges(db: AnyDb, todayKey: string): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.run(sql`
    DELETE FROM pal_cache
    WHERE key LIKE 'nudge:%'
      AND key NOT LIKE ${'nudge:' + todayKey + ':%'}
  `);
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- palCache
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/palCache.ts lib/db/queries/__tests__/palCache.test.ts
git commit -m "feat(sp5e): palCache query module with TDD coverage"
```

---

## Task 8: TDD `rituals.ts` — `insertRitual` + `updateRitual`

**Files:**
- Create: `lib/db/queries/rituals.ts`
- Create: `lib/db/queries/__tests__/rituals.test.ts`

Two simple writes that anchor the rest of the module. The shared test helpers + sample factory live at the top of the test file so subsequent tasks can extend it.

- [x] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/rituals.test.ts`:

```ts
/** @jest-environment node */
import { eq } from 'drizzle-orm';
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import { insertRitual, updateRitual } from '../rituals';

const sample = (overrides: Partial<{
  title: string; icon: string; cadence: string; color: string;
}> = {}) => ({
  title: 'Test ritual',
  icon: 'sparkles',
  cadence: 'daily' as const,
  color: 'rituals' as const,
  active: true,
  ...overrides,
});

describe('insertRitual', () => {
  it('first insert gets position 0', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({ title: 'A' }));
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.position).toBe(0);
  });

  it('subsequent inserts get MAX(position) + 1', async () => {
    const { db } = makeTestDb();
    await insertRitual(db, sample({ title: 'A' }));
    await insertRitual(db, sample({ title: 'B' }));
    const idC = await insertRitual(db, sample({ title: 'C' }));
    const rowC = (db as any).select().from(rituals).where(eq(rituals.id, idC)).all()[0];
    expect(rowC.position).toBe(2);
  });

  it('persists all input fields', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({
      title: 'X', icon: 'leaf.fill', cadence: 'morning', color: 'accent',
    }));
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.title).toBe('X');
    expect(row.icon).toBe('leaf.fill');
    expect(row.cadence).toBe('morning');
    expect(row.color).toBe('accent');
    expect(row.active).toBe(true);
  });
});

describe('updateRitual', () => {
  it('updates title/icon/cadence/color but not position/active', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample({ title: 'Old' }));
    const before = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    await updateRitual(db, id, {
      title: 'New', icon: 'leaf.fill', cadence: 'morning', color: 'accent',
    });
    const after = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(after.title).toBe('New');
    expect(after.icon).toBe('leaf.fill');
    expect(after.cadence).toBe('morning');
    expect(after.color).toBe('accent');
    expect(after.position).toBe(before.position);
    expect(after.active).toBe(before.active);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rituals
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement `insertRitual` + `updateRitual`**

Create `lib/db/queries/rituals.ts`:

```ts
import { eq, sql } from 'drizzle-orm';

import { rituals, type RitualCadence, type RitualColor } from '../schema';
import { type AnyDb } from './onboarding';

export interface InsertRitualInput {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
  active?: boolean;
}

export async function insertRitual(db: AnyDb, input: InsertRitualInput): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const positionRows = dx.all(sql`
    SELECT COALESCE(MAX(position) + 1, 0) AS pos FROM rituals
  `) as Array<{ pos: number }>;
  const nextPos = Number(positionRows[0]?.pos ?? 0);

  const result = dx
    .insert(rituals)
    .values({
      title: input.title,
      icon: input.icon,
      cadence: input.cadence,
      color: input.color,
      active: input.active ?? true,
      position: nextPos,
    })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

export interface UpdateRitualInput {
  title: string;
  icon: string;
  cadence: RitualCadence;
  color: RitualColor;
}

export async function updateRitual(db: AnyDb, id: number, input: UpdateRitualInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.update(rituals)
    .set({
      title: input.title,
      icon: input.icon,
      cadence: input.cadence,
      color: input.color,
    })
    .where(eq(rituals.id, id))
    .run();
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- rituals
```

Expected: PASS — 4 tests.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/rituals.ts lib/db/queries/__tests__/rituals.test.ts
git commit -m "feat(sp5e): insertRitual + updateRitual with TDD coverage"
```

---

## Task 9: TDD `rituals.ts` — soft delete + restore + hard delete

**Files:**
- Modify: `lib/db/queries/rituals.ts`
- Modify: `lib/db/queries/__tests__/rituals.test.ts`

Three deletion paths. Soft delete preserves entries; restore re-activates and re-positions; hard delete cascades.

- [x] **Step 1: Append the failing tests**

Append to `lib/db/queries/__tests__/rituals.test.ts`:

```ts
import { ritualEntries } from '../../schema';
import { softDeleteRitual, restoreRitual, hardDeleteRitual } from '../rituals';

describe('softDeleteRitual', () => {
  it('sets active=false, leaves ritualEntries intact', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    (db as any).insert(ritualEntries).values({ ritualId: id, occurredAt: 1000 }).run();
    await softDeleteRitual(db, id);
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all()[0];
    expect(row.active).toBe(false);
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
  });

  it('reorders remaining active rituals to keep contiguous positions', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' })); // position 0
    const b = await insertRitual(db, sample({ title: 'B' })); // position 1
    const c = await insertRitual(db, sample({ title: 'C' })); // position 2
    await softDeleteRitual(db, b);
    const aRow = (db as any).select().from(rituals).where(eq(rituals.id, a)).all()[0];
    const cRow = (db as any).select().from(rituals).where(eq(rituals.id, c)).all()[0];
    expect(aRow.position).toBe(0);
    expect(cRow.position).toBe(1);
  });
});

describe('restoreRitual', () => {
  it('sets active=true, assigns position MAX(active.position) + 1', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' })); // position 0
    const b = await insertRitual(db, sample({ title: 'B' })); // position 1
    await softDeleteRitual(db, a); // a is inactive; b shifts to position 0
    await restoreRitual(db, a);
    const aRow = (db as any).select().from(rituals).where(eq(rituals.id, a)).all()[0];
    expect(aRow.active).toBe(true);
    expect(aRow.position).toBe(1); // after b (position 0)
  });
});

describe('hardDeleteRitual', () => {
  it('cascades delete to ritualEntries via FK', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    (db as any).insert(ritualEntries).values({ ritualId: id, occurredAt: 1000 }).run();
    await hardDeleteRitual(db, id);
    const row = (db as any).select().from(rituals).where(eq(rituals.id, id)).all();
    expect(row.length).toBe(0);
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rituals
```

Expected: FAIL — three new functions missing.

- [x] **Step 3: Append the three implementations to `lib/db/queries/rituals.ts`**

```ts
export async function softDeleteRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.transaction((tx: any) => {
    tx.update(rituals).set({ active: false }).where(eq(rituals.id, id)).run();
    // Recompact positions of remaining active rituals
    const activeIds = tx
      .select({ id: rituals.id })
      .from(rituals)
      .where(eq(rituals.active, true))
      .orderBy(sql`position ASC`)
      .all() as Array<{ id: number }>;
    activeIds.forEach((row, i) => {
      tx.update(rituals).set({ position: i }).where(eq(rituals.id, row.id)).run();
    });
  });
}

export async function restoreRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const positionRows = dx.all(sql`
    SELECT COALESCE(MAX(position) + 1, 0) AS pos
    FROM rituals WHERE active = 1
  `) as Array<{ pos: number }>;
  const nextPos = Number(positionRows[0]?.pos ?? 0);
  dx.update(rituals)
    .set({ active: true, position: nextPos })
    .where(eq(rituals.id, id))
    .run();
}

export async function hardDeleteRitual(db: AnyDb, id: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.delete(rituals).where(eq(rituals.id, id)).run();
  // ritualEntries cascade via FK ON DELETE CASCADE
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- rituals
```

Expected: PASS — 7 tests total.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/rituals.ts lib/db/queries/__tests__/rituals.test.ts
git commit -m "feat(sp5e): rituals soft-delete + restore + hard-delete with TDD coverage"
```

---

## Task 10: TDD `rituals.ts` — `reorderRitualPositions`

**Files:**
- Modify: `lib/db/queries/rituals.ts`
- Modify: `lib/db/queries/__tests__/rituals.test.ts`

DraggableFlatList's `onDragEnd` returns the new ordered ID array; this function commits new positions in one transaction.

- [x] **Step 1: Append the failing tests**

Append to `lib/db/queries/__tests__/rituals.test.ts`:

```ts
import { reorderRitualPositions } from '../rituals';

describe('reorderRitualPositions', () => {
  it('rewrites positions to match the supplied array order', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [c, a, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[c]).toBe(0);
    expect(byId[a]).toBe(1);
    expect(byId[b]).toBe(2);
  });

  it('preserves contiguous positions [0, 1, 2, ...] with no gaps', async () => {
    const { db } = makeTestDb();
    const ids: number[] = [];
    for (let i = 0; i < 5; i++) ids.push(await insertRitual(db, sample({ title: `R${i}` })));
    const shuffled = [ids[3], ids[0], ids[4], ids[2], ids[1]];
    await reorderRitualPositions(db, shuffled);
    const positions = ((db as any).select().from(rituals).all() as Array<{ position: number }>)
      .map((r) => r.position).sort((x, y) => x - y);
    expect(positions).toEqual([0, 1, 2, 3, 4]);
  });

  it('adjacent swap → just those two move', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [a, c, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[a]).toBe(0);
    expect(byId[c]).toBe(1);
    expect(byId[b]).toBe(2);
  });

  it('drag-to-end works', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [b, c, a]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[a]).toBe(2);
  });

  it('drag-to-start works', async () => {
    const { db } = makeTestDb();
    const a = await insertRitual(db, sample({ title: 'A' }));
    const b = await insertRitual(db, sample({ title: 'B' }));
    const c = await insertRitual(db, sample({ title: 'C' }));
    await reorderRitualPositions(db, [c, a, b]);
    const rows = (db as any).select().from(rituals).all() as Array<{ id: number; position: number }>;
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.position]));
    expect(byId[c]).toBe(0);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rituals
```

Expected: FAIL — `reorderRitualPositions` is not exported.

- [x] **Step 3: Append the implementation**

Append to `lib/db/queries/rituals.ts`:

```ts
export async function reorderRitualPositions(db: AnyDb, orderedIds: number[]): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.transaction((tx: any) => {
    orderedIds.forEach((id, i) => {
      tx.update(rituals).set({ position: i }).where(eq(rituals.id, id)).run();
    });
  });
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- rituals
```

Expected: PASS — 12 tests total.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/rituals.ts lib/db/queries/__tests__/rituals.test.ts
git commit -m "feat(sp5e): reorderRitualPositions with TDD coverage"
```

---

## Task 11: TDD `rituals.ts` — `toggleRitualToday`

**Files:**
- Modify: `lib/db/queries/rituals.ts`
- Modify: `lib/db/queries/__tests__/rituals.test.ts`

Tap-on-Today-row semantics. Inserts a `ritualEntries` row when missing today; deletes ALL of today's rows for that ritual when present.

- [x] **Step 1: Append the failing tests**

Append to `lib/db/queries/__tests__/rituals.test.ts`:

```ts
import { toggleRitualToday } from '../rituals';
import { dayKey } from '../dayKey';

describe('toggleRitualToday', () => {
  it('inserts a ritualEntries row when no entry exists today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    await toggleRitualToday(db, id, dayKey(new Date()));
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
  });

  it('deletes ALL today rows when at least one exists today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const now = Date.now();
    (db as any).insert(ritualEntries).values([
      { ritualId: id, occurredAt: now - 1000 },
      { ritualId: id, occurredAt: now - 500 },
      { ritualId: id, occurredAt: now },
    ]).run();
    await toggleRitualToday(db, id, dayKey(new Date()));
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });

  it("does not touch prior days' entries", async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const now = new Date();
    const today = dayKey(now);
    const yesterdayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 12).getTime();
    (db as any).insert(ritualEntries).values([
      { ritualId: id, occurredAt: yesterdayMs },
      { ritualId: id, occurredAt: Date.now() },
    ]).run();
    await toggleRitualToday(db, id, today); // currently has an entry today, toggles off
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(1);
    expect(entries[0].occurredAt).toBe(yesterdayMs);
  });

  it('toggles off then on then off again — final state has 0 entries today', async () => {
    const { db } = makeTestDb();
    const id = await insertRitual(db, sample());
    const today = dayKey(new Date());
    await toggleRitualToday(db, id, today); // off→on (insert)
    await toggleRitualToday(db, id, today); // on→off (delete all)
    await toggleRitualToday(db, id, today); // off→on (insert)
    await toggleRitualToday(db, id, today); // on→off (delete all)
    const entries = (db as any).select().from(ritualEntries).where(eq(ritualEntries.ritualId, id)).all();
    expect(entries.length).toBe(0);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rituals
```

Expected: FAIL — `toggleRitualToday` is not exported.

- [x] **Step 3: Append the implementation**

Append to `lib/db/queries/rituals.ts`:

```ts
import { and, gte, lt } from 'drizzle-orm';

import { ritualEntries } from '../schema';

function todayBounds(todayKey: string): { startMs: number; endMs: number } {
  const [y, m, d] = todayKey.split('-').map(Number);
  // Local-midnight bounds; constructed via new Date(y, m-1, d) is DST-safe
  // (unlike adding 24h, which breaks across DST transitions).
  const startMs = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
  const endMs   = new Date(y, m - 1, d + 1, 0, 0, 0, 0).getTime();
  return { startMs, endMs };
}

export async function toggleRitualToday(db: AnyDb, ritualId: number, todayKey: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const { startMs, endMs } = todayBounds(todayKey);
  const existing = dx
    .select({ id: ritualEntries.id })
    .from(ritualEntries)
    .where(and(
      eq(ritualEntries.ritualId, ritualId),
      gte(ritualEntries.occurredAt, startMs),
      lt(ritualEntries.occurredAt, endMs),
    ))
    .all() as Array<{ id: number }>;
  if (existing.length > 0) {
    dx.delete(ritualEntries)
      .where(and(
        eq(ritualEntries.ritualId, ritualId),
        gte(ritualEntries.occurredAt, startMs),
        lt(ritualEntries.occurredAt, endMs),
      ))
      .run();
  } else {
    dx.insert(ritualEntries).values({
      ritualId,
      occurredAt: Date.now(),
    }).run();
  }
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- rituals
```

Expected: PASS — 16 tests total.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/rituals.ts lib/db/queries/__tests__/rituals.test.ts
git commit -m "feat(sp5e): toggleRitualToday (insert + cascading-delete-today) with TDD coverage"
```

---

## Task 12: Shared API types extension

**Files:**
- Modify: `lib/api-types.ts`
- Modify: `lib/sync/cadenceDisplay.ts` (replace inlined type with import)
- Modify: `lib/db/seed-defaults.ts` (replace inlined types with imports)

Adds `RitualCadence`, `RitualColor`, `RITUAL_ICON_SHORTLIST`, `RitualIcon`, and the request/response types for the two new backend endpoints.

- [x] **Step 1: Append to `lib/api-types.ts`**

At the bottom of `lib/api-types.ts`:

```ts
// --- /suggest-rituals + /nudge-today (SP5e) ---

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

- [x] **Step 2: Replace the inlined `RitualCadence` type in `lib/sync/cadenceDisplay.ts`**

Replace the top of `lib/sync/cadenceDisplay.ts`:

```ts
import type { RitualCadence } from '@/lib/api-types';

export type { RitualCadence };  // re-export for convenience
export type CadenceDisplayContext = 'today' | 'builder';
```

(The function body stays.)

- [x] **Step 3: Replace the inlined types in `lib/db/seed-defaults.ts`**

Replace the inlined `type RitualCadence` / `type RitualColor` lines at the top of `lib/db/seed-defaults.ts` with:

```ts
import type { RitualCadence, RitualColor } from '@/lib/api-types';
```

(The `DEFAULT_RITUALS` declaration stays.)

- [x] **Step 4: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Verify all existing tests still pass**

```bash
npm test -- cadenceDisplay rituals reseedDefaults palCache
```

Expected: PASS at the existing counts.

- [x] **Step 6: Commit**

```bash
git add lib/api-types.ts lib/sync/cadenceDisplay.ts lib/db/seed-defaults.ts
git commit -m "feat(sp5e): add shared RitualCadence/RitualColor/RITUAL_ICON_SHORTLIST + endpoint request/response types"
```

---

## Task 13: TDD `/suggest-rituals` prompt builder (backend)

**Files:**
- Create: `backend/src/lib/prompts/suggestRituals.ts`
- Create: `backend/test/unit/suggestRituals.prompt.test.ts`

Pure prompt-string builder; no LLM, no HTTP. Exercised standalone before the route handler is wired.

- [x] **Step 1: Write the failing tests**

Create `backend/test/unit/suggestRituals.prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildSuggestRitualsPrompt } from "../../src/lib/prompts/suggestRituals.js";
import { RITUAL_ICON_SHORTLIST } from "@api-types";

describe("buildSuggestRitualsPrompt", () => {
  it("includes every active ritual title", () => {
    const result = buildSuggestRitualsPrompt(
      [
        { title: "Morning pages", cadence: "morning", color: "accent" },
        { title: "Inbox zero",    cadence: "weekdays", color: "move" },
      ],
      [],
    );
    expect(result).toContain("Morning pages");
    expect(result).toContain("Inbox zero");
  });

  it("emits the icon shortlist verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const icon of RITUAL_ICON_SHORTLIST) {
      expect(result).toContain(icon);
    }
  });

  it("emits the cadence enum verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const c of ["morning", "evening", "all_day", "weekdays", "daily"]) {
      expect(result).toContain(c);
    }
  });

  it("emits the color enum verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const k of ["rituals", "accent", "move", "money", "cyan"]) {
      expect(result).toContain(k);
    }
  });

  it("with 0 active rituals — still produces a prompt that asks for ≤2 suggestions", () => {
    const result = buildSuggestRitualsPrompt([], []);
    expect(result).toContain("at most 2");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
  });

  it("includes recent activity counts when provided", () => {
    const now = Date.now();
    const result = buildSuggestRitualsPrompt(
      [{ title: "Morning pages", cadence: "morning", color: "accent" }],
      [
        { title: "Morning pages", occurredAt: now - 1000 },
        { title: "Morning pages", occurredAt: now - 2000 },
      ],
    );
    expect(result).toContain("Morning pages");
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
cd backend && npm test -- suggestRituals.prompt
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement the prompt builder**

Create `backend/src/lib/prompts/suggestRituals.ts`:

```ts
import {
  RITUAL_ICON_SHORTLIST,
  type RitualCadence,
  type RitualColor,
  type SuggestRitualsRequest,
} from "@api-types";

const ICON_LIST = RITUAL_ICON_SHORTLIST.map((s) => `"${s}"`).join(", ");
const CADENCES: RitualCadence[] = ["morning", "evening", "all_day", "weekdays", "daily"];
const COLORS:   RitualColor[]   = ["rituals", "accent", "move", "money", "cyan"];

export function buildSuggestRitualsPrompt(
  active: SuggestRitualsRequest["active"],
  recent: NonNullable<SuggestRitualsRequest["recentRitualEntries"]>,
): string {
  const activeBullets = active.length > 0
    ? active.map((r) => `- ${r.title} (cadence: ${r.cadence}, color: ${r.color})`).join("\n")
    : "(none yet)";

  const recentCounts = new Map<string, number>();
  for (const e of recent) {
    recentCounts.set(e.title, (recentCounts.get(e.title) ?? 0) + 1);
  }
  const recentBullets = recentCounts.size > 0
    ? [...recentCounts.entries()].map(([t, n]) => `- ${t}: ${n} entries in last 30d`).join("\n")
    : "(no recent activity)";

  return [
    "You are Pal. Suggest at most 2 daily rituals for the user that complement (do not duplicate) their active list. Each suggestion must:",
    `- title: 1–40 chars, action-shaped ("Evening shutdown", not "Be productive")`,
    "- reason: one short sentence grounded in the user's patterns",
    `- icon: pick from this exact list: [${ICON_LIST}]`,
    `- cadence: pick from ${CADENCES.join("|")}`,
    `- color: pick from ${COLORS.join("|")}`,
    "",
    `Return ONLY a JSON object: {"suggestions": [...]}. No prose, no markdown.`,
    "",
    `Active rituals:\n${activeBullets}`,
    "",
    `Recent activity (last 30d):\n${recentBullets}`,
  ].join("\n");
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
cd backend && npm test -- suggestRituals.prompt
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add backend/src/lib/prompts/suggestRituals.ts backend/test/unit/suggestRituals.prompt.test.ts
git commit -m "feat(sp5e): /suggest-rituals prompt builder with TDD coverage"
```

---

## Task 14: `/suggest-rituals` route handler + Zod schema + integration test

**Files:**
- Create: `backend/src/schemas/suggestRituals.ts`
- Create: `backend/src/routes/suggestRituals.ts`
- Create: `backend/test/integration/suggestRituals.test.ts`
- Modify: `backend/src/index.ts` (mount the route)

Wires the prompt builder + Zod schemas + LLM call + retry-and-fallback into a route. Mounted under existing `"chat"` JWT scope.

- [x] **Step 1: Create the Zod schema**

Create `backend/src/schemas/suggestRituals.ts`:

```ts
import { z } from "zod";

const RitualCadence = z.enum(["morning", "evening", "all_day", "weekdays", "daily"]);
const RitualColor   = z.enum(["rituals", "accent", "move", "money", "cyan"]);

const RITUAL_ICON_SHORTLIST = [
  "book.closed.fill", "tray.fill", "character.book.closed.fill",
  "dumbbell.fill", "books.vertical.fill", "heart.fill",
  "sparkles", "cup.and.saucer.fill", "leaf.fill", "moon.fill",
  "figure.walk", "drop.fill", "fork.knife", "music.note",
  "bed.double.fill", "sun.max.fill",
] as const;
const RitualIcon = z.enum(RITUAL_ICON_SHORTLIST);

export const SuggestRitualsRequestSchema = z.object({
  active: z.array(
    z.object({ title: z.string(), cadence: RitualCadence, color: RitualColor }),
  ).max(50),
  recentRitualEntries: z.array(
    z.object({ title: z.string(), occurredAt: z.number().int() }),
  ).max(500).optional(),
});

export const SuggestRitualsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      title:   z.string().min(1).max(40),
      reason:  z.string().min(1).max(200),
      icon:    RitualIcon,
      cadence: RitualCadence,
      color:   RitualColor,
    }),
  ).max(2),
});

export type SuggestRitualsRequestParsed = z.infer<typeof SuggestRitualsRequestSchema>;
export type SuggestRitualsResponseParsed = z.infer<typeof SuggestRitualsResponseSchema>;
```

- [x] **Step 2: Create the route handler**

Create `backend/src/routes/suggestRituals.ts`:

```ts
import type { Router, Request, Response } from "express";
import { Router as createRouter } from "express";

import type { LlmClient } from "../lib/openrouter.js";
import { buildSuggestRitualsPrompt } from "../lib/prompts/suggestRituals.js";
import { SuggestRitualsRequestSchema, SuggestRitualsResponseSchema } from "../schemas/suggestRituals.js";

const STRICTER_RETRY = "\n\nReminder: respond with ONLY a JSON object. No prose, no markdown, no leading text.";

export function createSuggestRitualsRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const router = createRouter();
  router.post("/suggest-rituals", async (req: Request, res: Response) => {
    const body = SuggestRitualsRequestSchema.parse(req.body);
    const prompt = buildSuggestRitualsPrompt(body.active, body.recentRitualEntries ?? []);

    const messages = [{ role: "system" as const, content: prompt }, { role: "user" as const, content: "Suggest now." }];

    let parsed: ReturnType<typeof SuggestRitualsResponseSchema.parse> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await deps.llm.chatJson({
        messages: attempt === 0 ? messages : [...messages, { role: "system", content: STRICTER_RETRY }],
        model: deps.modelId,
      });
      try {
        const json = JSON.parse(raw);
        parsed = SuggestRitualsResponseSchema.parse(json);
        break;
      } catch {
        // try again with the stricter retry
      }
    }
    if (parsed === null) {
      // Graceful empty state on persistent LLM failure
      res.json({ suggestions: [] });
      return;
    }
    res.json(parsed);
  });
  return router;
}
```

- [x] **Step 3: Mount the route in `backend/src/index.ts`**

Find the section in `backend/src/index.ts` where existing `"chat"`-scoped routes are mounted (e.g., near `createChatRouter`). Add the import and mount:

```ts
import { createSuggestRitualsRouter } from "./routes/suggestRituals.js";

// ... where chat router is mounted:
app.use("/", requireScope("chat"), createSuggestRitualsRouter({ llm, modelId: config.modelId }));
```

(If `createChatRouter` already mounts at `/`, adding the new router at `/` works because Express dispatches by path. Verify by checking how `createChatRouter` is wired — match its pattern.)

- [x] **Step 4: Write the integration test**

Create `backend/test/integration/suggestRituals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestJwt } from "../helpers/jwt.js";

describe("POST /suggest-rituals", () => {
  it("returns 200 with parsed suggestions on valid LLM JSON", async () => {
    const llmJson = JSON.stringify({
      suggestions: [
        { title: "Evening shutdown", reason: "Caps your evening pages.", icon: "moon.fill", cadence: "evening", color: "rituals" },
        { title: "Morning walk",     reason: "Pairs with your daily move.", icon: "figure.walk", cadence: "morning", color: "move" },
      ],
    });
    const app = buildTestApp({ llm: { chatJson: async () => llmJson } });
    const token = signTestJwt({ scope: "chat" });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [{ title: "Morning pages", cadence: "morning", color: "accent" }] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2);
    expect(res.body.suggestions[0].title).toBe("Evening shutdown");
  });

  it("returns 200 with empty suggestions on persistent malformed JSON", async () => {
    const app = buildTestApp({ llm: { chatJson: async () => "not json at all {{{" } });
    const token = signTestJwt({ scope: "chat" });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  it("returns 200 with filtered suggestions when LLM returns out-of-shortlist icon", async () => {
    const llmJson = JSON.stringify({
      suggestions: [
        { title: "Good one", reason: "ok", icon: "made.up.symbol", cadence: "daily", color: "rituals" },
        { title: "Other",    reason: "ok", icon: "leaf.fill",      cadence: "daily", color: "rituals" },
      ],
    });
    const app = buildTestApp({ llm: { chatJson: async () => llmJson } });
    const token = signTestJwt({ scope: "chat" });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [] });

    expect(res.status).toBe(200);
    // Zod parse fails on the bad icon → falls into retry → empty.
    // (The route returns empty rather than partial; acceptable per spec.)
    expect(res.body.suggestions).toEqual([]);
  });

  it("rejects requests with no JWT", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/suggest-rituals").send({ active: [] });
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong scope", async () => {
    const app = buildTestApp();
    const token = signTestJwt({ scope: "review" });
    const res = await request(app).post("/suggest-rituals").set("Authorization", `Bearer ${token}`).send({ active: [] });
    expect(res.status).toBe(403);
  });
});
```

- [x] **Step 5: Run the tests**

```bash
cd backend && npm test -- suggestRituals
```

Expected: PASS — 5 integration + 6 prompt = 11 total.

- [x] **Step 6: Verify backend typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: same baseline as before (no new backend errors).

- [x] **Step 7: Commit**

```bash
git add backend/src/schemas/suggestRituals.ts backend/src/routes/suggestRituals.ts backend/src/index.ts backend/test/integration/suggestRituals.test.ts
git commit -m "feat(sp5e): POST /suggest-rituals route + Zod schema + integration tests"
```

---

## Task 15: TDD `/nudge-today` prompt builder (backend)

**Files:**
- Create: `backend/src/lib/prompts/nudgeToday.ts`
- Create: `backend/test/unit/nudgeToday.prompt.test.ts`

- [x] **Step 1: Write the failing tests**

Create `backend/test/unit/nudgeToday.prompt.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildNudgeTodayPrompt } from "../../src/lib/prompts/nudgeToday.js";

describe("buildNudgeTodayPrompt", () => {
  it("includes done/total counts", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 3,
      total: 5,
      remaining: [{ title: "Stretch", streak: 4, cadence: "evening" }],
    });
    expect(result).toContain("3/5");
  });

  it("includes each remaining ritual title + streak", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 0,
      total: 2,
      remaining: [
        { title: "Morning pages", streak: 12, cadence: "morning" },
        { title: "Stretch",       streak: 3,  cadence: "evening" },
      ],
    });
    expect(result).toContain("Morning pages");
    expect(result).toContain("12");
    expect(result).toContain("Stretch");
    expect(result).toContain("3");
  });

  it("includes bestStreak when provided", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28",
      done: 1,
      total: 5,
      remaining: [],
      bestStreak: { title: "8 glasses water", streak: 23 },
    });
    expect(result).toContain("8 glasses water");
    expect(result).toContain("23");
  });

  it("handles bestStreak undefined without error", () => {
    expect(() => buildNudgeTodayPrompt({
      date: "2026-04-28", done: 0, total: 1, remaining: [],
    })).not.toThrow();
  });

  it("instructs ≤120 chars + JSON-only output", () => {
    const result = buildNudgeTodayPrompt({
      date: "2026-04-28", done: 0, total: 0, remaining: [],
    });
    expect(result).toContain("120");
    expect(result.toLowerCase()).toContain("json");
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
cd backend && npm test -- nudgeToday.prompt
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement the prompt builder**

Create `backend/src/lib/prompts/nudgeToday.ts`:

```ts
import type { NudgeTodayRequest } from "@api-types";

export function buildNudgeTodayPrompt(req: NudgeTodayRequest): string {
  const remainingBullets = req.remaining.length > 0
    ? req.remaining.map((r) => `- ${r.title} (cadence: ${r.cadence}, ${r.streak}-day streak)`).join("\n")
    : "(none — user has completed everything today)";

  const bestStreakLine = req.bestStreak
    ? `Best ongoing streak: ${req.bestStreak.title} (${req.bestStreak.streak} days)`
    : "Best ongoing streak: (none yet)";

  return [
    "You are Pal. Write ONE warm, concrete sentence (≤120 chars) about the user's ritual progress today. Reference a specific ritual or streak by name. No filler (\"Great job!\"). No emoji unless one fits the noun (💧 water).",
    "",
    `Return ONLY a JSON object: {"sub": "..."}. No prose, no markdown.`,
    "",
    `Today (${req.date}): ${req.done}/${req.total} done.`,
    `Remaining:\n${remainingBullets}`,
    bestStreakLine,
  ].join("\n");
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
cd backend && npm test -- nudgeToday.prompt
```

Expected: PASS — 5 tests.

- [x] **Step 5: Commit**

```bash
git add backend/src/lib/prompts/nudgeToday.ts backend/test/unit/nudgeToday.prompt.test.ts
git commit -m "feat(sp5e): /nudge-today prompt builder with TDD coverage"
```

---

## Task 16: `/nudge-today` route handler + Zod schema + integration test

**Files:**
- Create: `backend/src/schemas/nudgeToday.ts`
- Create: `backend/src/routes/nudgeToday.ts`
- Create: `backend/test/integration/nudgeToday.test.ts`
- Modify: `backend/src/index.ts` (mount the route)

- [x] **Step 1: Create the Zod schema**

Create `backend/src/schemas/nudgeToday.ts`:

```ts
import { z } from "zod";

const RitualCadence = z.enum(["morning", "evening", "all_day", "weekdays", "daily"]);

export const NudgeTodayRequestSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  done: z.number().int().min(0),
  total: z.number().int().min(0),
  remaining: z.array(
    z.object({ title: z.string(), streak: z.number().int().min(0), cadence: RitualCadence }),
  ).max(50),
  bestStreak: z.object({
    title: z.string(),
    streak: z.number().int().min(0),
  }).optional(),
});

export const NudgeTodayResponseSchema = z.object({
  sub: z.string().min(1),
});

export type NudgeTodayRequestParsed = z.infer<typeof NudgeTodayRequestSchema>;
export type NudgeTodayResponseParsed = z.infer<typeof NudgeTodayResponseSchema>;
```

- [x] **Step 2: Create the route handler**

Create `backend/src/routes/nudgeToday.ts`:

```ts
import type { Router, Request, Response } from "express";
import { Router as createRouter } from "express";

import type { LlmClient } from "../lib/openrouter.js";
import { buildNudgeTodayPrompt } from "../lib/prompts/nudgeToday.js";
import { NudgeTodayRequestSchema, NudgeTodayResponseSchema } from "../schemas/nudgeToday.js";

const STRICTER_RETRY = "\n\nReminder: respond with ONLY a JSON object {\"sub\": \"...\"}. No prose, no markdown.";
const MAX_CHARS = 120;

function truncateToWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

function localFallback(req: NudgeTodayRequestParsed): string {
  if (req.remaining.length === 0) return "All done — nice work today.";
  const first = req.remaining[0];
  return `Your ${first.title} is waiting.`;
}

export function createNudgeTodayRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const router = createRouter();
  router.post("/nudge-today", async (req: Request, res: Response) => {
    const body = NudgeTodayRequestSchema.parse(req.body);
    const prompt = buildNudgeTodayPrompt(body);

    const messages = [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: "Write the sub now." },
    ];

    let sub: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const raw = await deps.llm.chatJson({
        messages: attempt === 0 ? messages : [...messages, { role: "system", content: STRICTER_RETRY }],
        model: deps.modelId,
      });
      try {
        const json = JSON.parse(raw);
        const parsed = NudgeTodayResponseSchema.parse(json);
        sub = parsed.sub;
        break;
      } catch {
        // try again
      }
    }
    if (sub === null) sub = localFallback(body);
    sub = truncateToWordBoundary(sub, MAX_CHARS);
    res.json({ sub });
  });
  return router;
}

import type { NudgeTodayRequestParsed } from "../schemas/nudgeToday.js";
```

(Move the trailing `import type` line to the top of the file once the editor stops complaining — the order matters for some linters but not for TS.)

- [x] **Step 3: Mount the route in `backend/src/index.ts`**

Add alongside the `/suggest-rituals` mount from Task 14:

```ts
import { createNudgeTodayRouter } from "./routes/nudgeToday.js";

// ... in the chat-scoped routes section:
app.use("/", requireScope("chat"), createNudgeTodayRouter({ llm, modelId: config.modelId }));
```

- [x] **Step 4: Write the integration test**

Create `backend/test/integration/nudgeToday.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestJwt } from "../helpers/jwt.js";

const VALID_BODY = {
  date: "2026-04-28",
  done: 2,
  total: 5,
  remaining: [
    { title: "Stretch", streak: 4, cadence: "evening" as const },
  ],
  bestStreak: { title: "8 glasses water", streak: 23 },
};

describe("POST /nudge-today", () => {
  it("returns 200 with sub on valid LLM JSON", async () => {
    const app = buildTestApp({
      llm: { chatJson: async () => JSON.stringify({ sub: "Your Stretch is waiting. 23-day water streak 💧" }) },
    });
    const token = signTestJwt({ scope: "chat" });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub).toContain("Stretch");
  });

  it("returns fallback string on persistent malformed JSON", async () => {
    const app = buildTestApp({ llm: { chatJson: async () => "garbage" } });
    const token = signTestJwt({ scope: "chat" });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub).toContain("Stretch"); // localFallback uses first remaining
  });

  it("truncates sub when LLM exceeds 120 chars", async () => {
    const longSub = "x".repeat(200);
    const app = buildTestApp({ llm: { chatJson: async () => JSON.stringify({ sub: longSub }) } });
    const token = signTestJwt({ scope: "chat" });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub.length).toBeLessThanOrEqual(121); // 120 + ellipsis
  });

  it("rejects without JWT", async () => {
    const app = buildTestApp();
    const res = await request(app).post("/nudge-today").send(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("rejects with wrong scope", async () => {
    const app = buildTestApp();
    const token = signTestJwt({ scope: "review" });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(403);
  });
});
```

- [x] **Step 5: Run the tests**

```bash
cd backend && npm test -- nudgeToday
```

Expected: PASS — 5 integration + 5 prompt = 10 total.

- [x] **Step 6: Verify backend typecheck**

```bash
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: same baseline as before.

- [x] **Step 7: Commit**

```bash
git add backend/src/schemas/nudgeToday.ts backend/src/routes/nudgeToday.ts backend/src/index.ts backend/test/integration/nudgeToday.test.ts
git commit -m "feat(sp5e): POST /nudge-today route + Zod schema + integration tests"
```

---

## Task 17: iOS `lib/sync/palClient.ts`

**Files:**
- Create: `lib/sync/palClient.ts`

Fetch wrappers for both new endpoints. Mirrors `lib/sync/client.ts` from SP5c (auth header from `PAL_TOKEN`, mapped error taxonomy).

- [x] **Step 1: Implement the client**

Create `lib/sync/palClient.ts`:

```ts
import type {
  NudgeTodayRequest,
  NudgeTodayResponse,
  SuggestRitualsRequest,
  SuggestRitualsResponse,
} from '../api-types';
import { PAL_BASE_URL, PAL_TOKEN } from '../pal/config';
import {
  AuthError,
  NetworkError,
  RateLimitError,
  UpstreamError,
  ValidationError,
} from './errors';

type ErrorEnvelope = { error: { code: string; message: string }; requestId?: string };

async function readError(res: Response): Promise<ErrorEnvelope | null> {
  try {
    return (await res.json()) as ErrorEnvelope;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${PAL_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

function mapHttpError(status: number, env: ErrorEnvelope | null): Error {
  const msg = env?.error.message ?? '';
  const rid = env?.requestId;
  if (status === 400) return new ValidationError(msg, rid);
  if (status === 401 || status === 403) return new AuthError(msg, rid);
  if (status === 429) return new RateLimitError(msg, rid);
  return new UpstreamError(msg, rid);
}

export async function postSuggestRituals(req: SuggestRitualsRequest): Promise<SuggestRitualsResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/suggest-rituals`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as SuggestRitualsResponse;
  throw mapHttpError(res.status, await readError(res));
}

export async function postNudgeToday(req: NudgeTodayRequest): Promise<NudgeTodayResponse> {
  let res: Response;
  try {
    res = await fetch(`${PAL_BASE_URL}/nudge-today`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(req),
    });
  } catch {
    throw new NetworkError();
  }
  if (res.ok) return (await res.json()) as NudgeTodayResponse;
  throw mapHttpError(res.status, await readError(res));
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Commit**

```bash
git add lib/sync/palClient.ts
git commit -m "feat(sp5e): palClient — postSuggestRituals + postNudgeToday fetch wrappers"
```

---

## Task 18: `usePalSuggestions` hook

**Files:**
- Create: `lib/sync/usePalSuggestions.ts`

24h TTL cache + invalidate-on-active-set-change + manual refresh. No tests (covered by Builder smoke).

- [x] **Step 1: Implement the hook**

Create `lib/sync/usePalSuggestions.ts`:

```ts
import { useCallback, useEffect, useState } from 'react';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

import { db } from '@/lib/db/client';
import { deleteCacheByPrefix, readCache, writeCache } from '@/lib/db/queries/palCache';
import type { Ritual, RitualEntry } from '@/lib/db/schema';
import { postSuggestRituals } from '@/lib/sync/palClient';
import type { SuggestRitualsResponse } from '@/lib/api-types';

const TTL_MS = 24 * 60 * 60 * 1000;

async function hashActive(active: Ritual[]): Promise<string> {
  const canonical = active
    .map((r) => [r.id, r.title, r.cadence, r.color])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  const digest = await digestStringAsync(
    CryptoDigestAlgorithm.SHA256,
    JSON.stringify(canonical),
  );
  return digest.slice(0, 16);
}

export type UsePalSuggestionsResult = {
  suggestions: SuggestRitualsResponse['suggestions'];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function usePalSuggestions(active: Ritual[], recent: RitualEntry[]): UsePalSuggestionsResult {
  const [suggestions, setSuggestions] = useState<SuggestRitualsResponse['suggestions']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAndStore = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const titleById = new Map(active.map((r) => [r.id, r.title]));
      const recentForRequest = recent
        .filter((e) => titleById.has(e.ritualId))
        .map((e) => ({ title: titleById.get(e.ritualId) as string, occurredAt: e.occurredAt }));
      const r = await postSuggestRituals({
        active: active.map((a) => ({ title: a.title, cadence: a.cadence, color: a.color })),
        recentRitualEntries: recentForRequest,
      });
      const key = `suggestions:${await hashActive(active)}`;
      writeCache(db, key, r);
      setSuggestions(r.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [active, recent]);

  const refresh = useCallback(async (): Promise<void> => {
    deleteCacheByPrefix(db, 'suggestions:');
    await fetchAndStore();
  }, [fetchAndStore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = `suggestions:${await hashActive(active)}`;
      const cached = readCache<SuggestRitualsResponse>(db, key, TTL_MS);
      if (cancelled) return;
      if (cached) {
        setSuggestions(cached.suggestions);
        return;
      }
      await fetchAndStore();
    })();
    return () => { cancelled = true; };
    // intentionally omit fetchAndStore — depends on active/recent which already trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.map((a) => a.id).join(','), active.map((a) => a.title).join(','), active.length]);

  return { suggestions, loading, error, refresh };
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Commit**

```bash
git add lib/sync/usePalSuggestions.ts
git commit -m "feat(sp5e): usePalSuggestions hook (24h TTL + active-hash invalidation + manual refresh)"
```

---

## Task 19: `useRitualNudge` hook

**Files:**
- Create: `lib/sync/useRitualNudge.ts`

Cache-keyed on `(todayKey, done, total)`; vacuums stale nudges on mount. Headline templated locally; sub from cache or fetch.

- [x] **Step 1: Implement the hook**

Create `lib/sync/useRitualNudge.ts`:

```ts
import { useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/db/client';
import { readCache, vacuumStaleNudges, writeCache } from '@/lib/db/queries/palCache';
import type { NudgeTodayRequest, NudgeTodayResponse } from '@/lib/api-types';
import type { Ritual } from '@/lib/db/schema';
import { postNudgeToday } from '@/lib/sync/palClient';

export type UseRitualNudgeInput = {
  done: number;
  total: number;
  rituals: Ritual[];
  doneSet: Set<number>;
  todayKey: string;
  bestStreak?: { title: string; streak: number };
  streakByRitual: Map<number, number>;
};

export type UseRitualNudgeResult = {
  headline: string;
  sub: string;
  loading: boolean;
};

function nudgeHeadline(done: number, total: number): string {
  if (total === 0) return 'Add a ritual to get going.';
  if (done === 0) return "Let's start the day.";
  if (done === total) return 'All done — nice.';
  if (done >= total - 1) return 'One to close the day';
  return `${total - done} to go`;
}

function localFallbackSub(input: UseRitualNudgeInput): string {
  const remaining = input.rituals.filter((r) => !input.doneSet.has(r.id));
  if (remaining.length === 0) return 'All done — nice work today.';
  return `Your ${remaining[0].title} is waiting.`;
}

export function useRitualNudge(input: UseRitualNudgeInput): UseRitualNudgeResult {
  const { done, total, todayKey } = input;
  const [sub, setSub] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const headline = useMemo(() => nudgeHeadline(done, total), [done, total]);

  useEffect(() => {
    vacuumStaleNudges(db, todayKey);
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;

    if (total === 0) { setSub(''); return; }

    const key = `nudge:${todayKey}:${done}:${total}`;
    const cached = readCache<NudgeTodayResponse>(db, key);
    if (cached) {
      setSub(cached.sub);
      return;
    }

    const remaining: NudgeTodayRequest['remaining'] = input.rituals
      .filter((r) => !input.doneSet.has(r.id))
      .map((r) => ({
        title: r.title,
        streak: input.streakByRitual.get(r.id) ?? 0,
        cadence: r.cadence,
      }));

    setLoading(true);
    postNudgeToday({
      date: todayKey,
      done,
      total,
      remaining,
      bestStreak: input.bestStreak,
    })
      .then((r) => {
        if (cancelled) return;
        writeCache(db, key, r);
        setSub(r.sub);
      })
      .catch(() => {
        if (cancelled) return;
        setSub(localFallbackSub(input));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, done, total]);

  return { headline, sub: sub ?? '', loading };
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Commit**

```bash
git add lib/sync/useRitualNudge.ts
git commit -m "feat(sp5e): useRitualNudge hook (state-keyed cache + local fallback sub)"
```

---

## Task 20: Add new deps — `expo-notifications` + `react-native-draggable-flatlist`

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Install both deps**

```bash
npx expo install expo-notifications react-native-draggable-flatlist
```

(`expo install` picks the version compatible with the current SDK; this is preferred over `npm install`.)

- [x] **Step 2: Verify deps land in `package.json`**

```bash
grep -E "expo-notifications|react-native-draggable-flatlist" package.json
```

Expected: both lines present.

- [x] **Step 3: Verify typecheck still green (no usage yet — should still be 24)**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 4: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS at the existing test count + the new query-module tests already added.

- [x] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps(sp5e): add expo-notifications + react-native-draggable-flatlist"
```

---

## Task 21: `lib/notifications/dailyReminder.ts`

**Files:**
- Create: `lib/notifications/dailyReminder.ts`
- Create: `lib/notifications/__tests__/dailyReminder.test.ts`

Wraps `expo-notifications` for the single repeating daily reminder. The pure `reminderBody()` templating is TDD'd; the schedule/cancel/permission wrappers are not (they're thin Expo SDK calls — covered by Builder smoke).

- [x] **Step 1: Write the failing tests for `reminderBody`**

Create `lib/notifications/__tests__/dailyReminder.test.ts`:

```ts
/** @jest-environment node */
import { reminderBody } from '../dailyReminder';

describe('reminderBody', () => {
  it('returns generic copy when zero rituals', () => {
    expect(reminderBody([])).toBe('Open Pulse — your rituals await.');
  });

  it('names the single ritual when count=1', () => {
    expect(reminderBody([{ title: 'Morning pages' }])).toBe('Morning pages waiting.');
  });

  it('lists titles when 2 or 3', () => {
    expect(reminderBody([{ title: 'A' }, { title: 'B' }])).toBe('A, B waiting.');
    expect(reminderBody([{ title: 'A' }, { title: 'B' }, { title: 'C' }])).toBe('A, B, C waiting.');
  });

  it('summarizes when 4 or more', () => {
    expect(reminderBody([
      { title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' },
    ])).toBe('4 rituals waiting today.');
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- dailyReminder
```

Expected: FAIL — module doesn't exist.

- [x] **Step 3: Implement the module**

Create `lib/notifications/dailyReminder.ts`:

```ts
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'pulse-daily-rituals';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined';

export async function ensurePermission(): Promise<PermissionStatus> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return 'granted';
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionStatus;
}

export async function scheduleDailyReminder(timeMinutes: number, body: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: 'Pulse', body, sound: 'default' },
    trigger: {
      type: 'daily' as const,
      hour,
      minute,
      // Expo SDK 55 trigger shape; equivalent to a repeating calendar trigger.
    } as Notifications.NotificationTriggerInput,
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

export function reminderBody(activeRituals: Array<{ title: string }>): string {
  const n = activeRituals.length;
  if (n === 0) return 'Open Pulse — your rituals await.';
  if (n === 1) return `${activeRituals[0].title} waiting.`;
  if (n <= 3) return `${activeRituals.map((r) => r.title).join(', ')} waiting.`;
  return `${n} rituals waiting today.`;
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- dailyReminder
```

Expected: PASS — 4 tests.

- [x] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`. (If the trigger type complains, accept the cast — Expo's typing for daily repeats is awkward across SDK versions; the cast keeps the runtime call shape correct.)

- [x] **Step 6: Commit**

```bash
git add lib/notifications/dailyReminder.ts lib/notifications/__tests__/dailyReminder.test.ts
git commit -m "feat(sp5e): dailyReminder module + reminderBody TDD coverage"
```

---

## Task 22: Wire `reseedDefaults` + scheduled-notification check into `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

Two new on-startup tasks: (1) reseed `DEFAULT_RITUALS` so already-onboarded users pick up Water; (2) ensure the scheduled notification matches `goals.reminderTimeMinutes`.

- [x] **Step 1: Find the post-`migrate()` block in `app/_layout.tsx`**

Open `app/_layout.tsx`. Locate where `migrate(...)` is called (likely inside a `useEffect`). The new logic runs immediately after `migrate()` succeeds.

- [x] **Step 2: Add the reseed + reminder-check after migrate**

Add the imports at the top:

```tsx
import { eq } from 'drizzle-orm';

import { reseedDefaults } from '@/lib/db/queries/reseedDefaults';
import {
  cancelDailyReminder,
  ensurePermission,
  reminderBody,
  scheduleDailyReminder,
} from '@/lib/notifications/dailyReminder';
import { goals, rituals } from '@/lib/db/schema';
```

Inside the `useEffect` that runs `migrate()`, add (after the migration completes):

```tsx
// SP5e: reseed any new DEFAULT_RITUALS (idempotent for already-onboarded users)
reseedDefaults(db);

// SP5e: ensure the scheduled daily reminder matches goals.reminder_time_minutes
const goalRows = await db.select().from(goals).where(eq(goals.id, 1)).all();
const reminderTime = goalRows[0]?.reminderTimeMinutes ?? null;
if (reminderTime == null) {
  await cancelDailyReminder();
} else {
  const perm = await ensurePermission();
  if (perm === 'granted') {
    const activeRituals = await db.select().from(rituals).where(eq(rituals.active, true)).all();
    await scheduleDailyReminder(reminderTime, reminderBody(activeRituals));
  } else {
    await cancelDailyReminder();
  }
}
```

(The `await ... .all()` syntax matches existing `app/_layout.tsx` usage. If the existing layout uses synchronous selects, mirror that pattern.)

- [x] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 4: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS at the existing count.

- [x] **Step 5: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(sp5e): startup wiring for reseedDefaults + scheduled-notification check"
```

---

## Task 23: Delete rituals stub + create rituals route group

**Files:**
- Delete: `app/(tabs)/rituals.tsx`
- Create: `app/(tabs)/rituals/_layout.tsx`
- Create: `app/(tabs)/rituals/index.tsx` (placeholder)

- [x] **Step 1: Delete the stub**

```bash
git rm "app/(tabs)/rituals.tsx"
```

- [x] **Step 2: Create the stack layout**

Create `app/(tabs)/rituals/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function RitualsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 3: Create a placeholder `index.tsx` (will be replaced in Task 24)**

Create `app/(tabs)/rituals/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RitualsTab() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-4 py-6">
        <Text className="text-largeTitle text-ink">Rituals</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 4: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Regenerate route types (so future tasks' `router.push` calls type-check)**

The plan's later tasks reference routes that don't exist yet (`builder`, `new`, `[id]/edit`, `goal`). Create stubs so the typed-routes generator knows about them:

```bash
mkdir -p "app/(tabs)/rituals/[id]"
```

Create `app/(tabs)/rituals/builder.tsx`:
```tsx
export default function RitualsBuilderScreen() { return null; }
```

Create `app/(tabs)/rituals/new.tsx`:
```tsx
export default function NewRitualScreen() { return null; }
```

Create `app/(tabs)/rituals/[id]/edit.tsx`:
```tsx
export default function EditRitualScreen() { return null; }
```

Create `app/(tabs)/rituals/goal.tsx`:
```tsx
export default function DailyGoalScreen() { return null; }
```

Then regenerate the typed-routes file (uses the helper added during SP5d execution):

```bash
node scripts/regen-route-types.js
```

Expected: prints `Wrote .../router.d.ts`.

- [x] **Step 6: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 7: Commit**

```bash
git add "app/(tabs)/rituals/" -A
git commit -m "feat(sp5e): scaffold rituals route group with stub screens for typed-route resolution"
```

---

## Task 24: Today screen — scaffold + Active list + tap-toggle

**Files:**
- Modify: `app/(tabs)/rituals/index.tsx`

Replace the placeholder with the full Today screen minus the Pal nudge card (Task 25 adds that).

- [x] **Step 1: Build the screen**

Replace `app/(tabs)/rituals/index.tsx` with:

```tsx
import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { goals, rituals, ritualEntries } from '@/lib/db/schema';
import { dayKey, dayKeyForMs } from '@/lib/db/queries/dayKey';
import { toggleRitualToday } from '@/lib/db/queries/rituals';
import { streakForRitual } from '@/lib/db/queries/streaks';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Palette = typeof colors.light | typeof colors.dark;

function colorTokenToHex(token: string, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
    default:        return palette.rituals;
  }
}

function colorTokenToTint(token: string, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.ritualsTint;
    case 'accent':  return palette.accentTint;
    case 'move':    return palette.moveTint;
    case 'money':   return palette.moneyTint;
    case 'cyan':    return palette.cyanTint;
    default:        return palette.ritualsTint;
  }
}

export default function RitualsTab() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const ritualsLive = useLiveQuery(
    db.select().from(rituals).where(eq(rituals.active, true)).orderBy(asc(rituals.position)),
  );
  const entriesLive = useLiveQuery(db.select().from(ritualEntries));
  const goalsLive   = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));

  const todayKey = useMemo(() => dayKey(new Date()), []);
  const doneToday = useMemo(
    () => new Set(
      entriesLive.data
        .filter((e) => dayKeyForMs(e.occurredAt) === todayKey)
        .map((e) => e.ritualId),
    ),
    [entriesLive.data, todayKey],
  );

  const activeRituals = ritualsLive.data;
  const total = activeRituals.length;
  const done  = doneToday.size;

  const onTap = async (ritualId: number) => {
    await toggleRitualToday(db, ritualId, todayKey);
  };

  if (total === 0) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-row items-center justify-between px-4 py-3">
          <Text className="text-largeTitle text-ink">Rituals</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <SymbolView name="sparkles" size={48} tintColor={palette.rituals} />
          <Text className="text-headline text-ink mt-4">No active rituals.</Text>
          <Text className="text-subhead text-ink3 mt-1 text-center">Add one to get going.</Text>
          <Pressable
            onPress={() => router.push('/(tabs)/rituals/new')}
            className="mt-6 rounded-full px-5 py-3"
            style={{ backgroundColor: palette.ink }}
          >
            <Text className="text-callout" style={{ color: palette.bg, fontWeight: '600' }}>+ New ritual</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="flex-row items-center justify-between px-4 py-3">
          <View>
            <Text className="text-largeTitle text-ink">Rituals</Text>
            <Text className="text-subhead text-ink3 mt-1">{done} of {total} done today</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(tabs)/rituals/builder')}
            hitSlop={8}
          >
            <SymbolView name="plus" size={22} tintColor={palette.accent} />
          </Pressable>
        </View>

        <View className="px-3 pb-3">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Today</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            {activeRituals.map((r, i) => {
              const isDone = doneToday.has(r.id);
              const tile = colorTokenToHex(r.color, palette);
              const tint = colorTokenToTint(r.color, palette);
              const streak = streakForRitual({
                ritualEntries: entriesLive.data,
                ritualId: r.id,
                asOf: new Date(),
              });
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onTap(r.id)}
                  className="flex-row items-center px-4 py-3"
                  style={{ borderBottomWidth: i === activeRituals.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <View
                    className="h-9 w-9 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: tint }}
                  >
                    <SymbolView name={r.icon as never} size={17} tintColor={tile} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-callout text-ink" numberOfLines={1}>{r.title}</Text>
                    <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                      {cadenceDisplay(r.cadence, 'today')} · {streak}-day streak 🔥
                    </Text>
                  </View>
                  <View
                    className="h-7 w-7 rounded-lg items-center justify-center"
                    style={{
                      backgroundColor: isDone ? tile : 'transparent',
                      borderWidth: isDone ? 0 : 1.5,
                      borderColor: palette.hair,
                    }}
                  >
                    {isDone && <SymbolView name="checkmark" size={14} tintColor="#fff" />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.push('/(tabs)/rituals/builder')}
            className="rounded-xl items-center justify-center py-3"
            style={{ backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}
          >
            <Text className="text-callout" style={{ color: palette.accent, fontWeight: '600' }}>+ New ritual</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add "app/(tabs)/rituals/index.tsx"
git commit -m "feat(sp5e): Today screen with active list + tap-toggle + empty state"
```

---

## Task 25: Today screen — Pal nudge card

**Files:**
- Modify: `app/(tabs)/rituals/index.tsx`

Insert the progress-ring + nudge card between the NavBar and the "Today" section.

- [x] **Step 1: Add the imports**

In `app/(tabs)/rituals/index.tsx`, add to the imports block:

```tsx
import Svg, { Circle } from 'react-native-svg';

import { useRitualNudge } from '@/lib/sync/useRitualNudge';
```

(`react-native-svg` is already a transitive Expo dep; if `npx tsc --noEmit` complains about a missing module, run `npx expo install react-native-svg` and update package.json/lock.)

- [x] **Step 2: Compute the streak map + bestStreak inside the component**

Add inside `RitualsTab()` after `done` and `total` computation:

```tsx
const streakByRitual = useMemo(() => {
  const map = new Map<number, number>();
  for (const r of activeRituals) {
    map.set(r.id, streakForRitual({
      ritualEntries: entriesLive.data,
      ritualId: r.id,
      asOf: new Date(),
    }));
  }
  return map;
}, [activeRituals, entriesLive.data]);

const bestStreak = useMemo(() => {
  let best: { title: string; streak: number } | undefined;
  for (const r of activeRituals) {
    const s = streakByRitual.get(r.id) ?? 0;
    if (s > 0 && (best === undefined || s > best.streak)) {
      best = { title: r.title, streak: s };
    }
  }
  return best;
}, [activeRituals, streakByRitual]);

const nudge = useRitualNudge({
  done, total,
  rituals: activeRituals,
  doneSet: doneToday,
  todayKey,
  bestStreak,
  streakByRitual,
});
```

- [x] **Step 3: Render the nudge card**

Insert the new card between the NavBar `View` and the "Today" section `View`:

```tsx
<View className="px-3 pb-3">
  <View
    className="rounded-2xl bg-surface flex-row items-center p-4"
    style={{ borderWidth: 0.5, borderColor: palette.hair }}
  >
    <View style={{ width: 72, height: 72, marginRight: 16, position: 'relative' }}>
      <Svg width={72} height={72} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={36} cy={36} r={30} fill="none" stroke={palette.ritualsTint} strokeWidth={8} />
        <Circle
          cx={36}
          cy={36}
          r={30}
          fill="none"
          stroke={palette.rituals}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${total > 0 ? (done / total) * 188 : 0} 188`}
        />
      </Svg>
      <View
        style={{
          position: 'absolute', inset: 0,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Text className="text-title3 text-ink" style={{ fontWeight: '700' }}>
          {done}/{total}
        </Text>
      </View>
    </View>
    <View className="flex-1 min-w-0">
      <Text className="text-callout text-ink">{nudge.headline}</Text>
      <Text className="text-caption1 text-ink3 mt-1" numberOfLines={2}>
        {nudge.loading ? '…' : nudge.sub || ' '}
      </Text>
    </View>
  </View>
</View>
```

- [x] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add "app/(tabs)/rituals/index.tsx"
git commit -m "feat(sp5e): Today screen Pal nudge card with progress ring + useRitualNudge"
```

---

## Task 26: Builder screen — scaffold + DraggableFlatList Active section

**Files:**
- Modify: `app/(tabs)/rituals/builder.tsx`

Replace the stub. Builds the NavBar + Active section with drag-reorder. Soft-delete + Inactive + Suggestions + Preferences ship in subsequent tasks.

- [x] **Step 1: Replace the stub with the scaffold**

Replace `app/(tabs)/rituals/builder.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import DraggableFlatList from 'react-native-draggable-flatlist';

import { db } from '@/lib/db/client';
import { rituals, ritualEntries, type Ritual } from '@/lib/db/schema';
import { reorderRitualPositions } from '@/lib/db/queries/rituals';
import { streakForRitual } from '@/lib/db/queries/streaks';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Palette = typeof colors.light | typeof colors.dark;

function colorTokenToHex(token: string, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
    default:        return palette.rituals;
  }
}

export default function RitualsBuilderScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const ritualsLive = useLiveQuery(db.select().from(rituals).orderBy(asc(rituals.position)));
  const entriesLive = useLiveQuery(db.select().from(ritualEntries));

  const active = useMemo(
    () => ritualsLive.data.filter((r) => r.active),
    [ritualsLive.data],
  );

  const onDragEnd = async ({ data }: { data: Ritual[] }) => {
    await reorderRitualPositions(db, data.map((r) => r.id));
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-3 py-3">
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text className="text-callout" style={{ color: palette.accent }}>‹ Rituals</Text>
        </Pressable>
        <View className="items-center">
          <Text className="text-headline text-ink">Rituals</Text>
          <Text className="text-caption1 text-ink3">Your daily anchors</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/rituals/new')} hitSlop={8}>
          <SymbolView name="plus" size={22} tintColor={palette.accent} />
        </Pressable>
      </View>

      <View className="px-3 pb-2">
        <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Active rituals</Text>
        <View className="rounded-xl bg-surface overflow-hidden">
          <DraggableFlatList<Ritual>
            data={active}
            keyExtractor={(r) => String(r.id)}
            onDragEnd={onDragEnd}
            renderItem={({ item, drag, isActive }) => {
              const tile = colorTokenToHex(item.color, palette);
              const streak = streakForRitual({
                ritualEntries: entriesLive.data,
                ritualId: item.id,
                asOf: new Date(),
              });
              return (
                <Pressable
                  onLongPress={drag}
                  onPress={() => router.push(`/(tabs)/rituals/${item.id}/edit`)}
                  delayLongPress={150}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    backgroundColor: isActive ? palette.fill : 'transparent',
                    borderBottomWidth: 0.5,
                    borderBottomColor: palette.hair,
                  }}
                >
                  <Text style={{ color: palette.ink4, fontSize: 14, marginRight: 8 }}>≡</Text>
                  <View
                    className="h-9 w-9 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: tile }}
                  >
                    <SymbolView name={item.icon as never} size={17} tintColor="#fff" />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className="text-callout text-ink" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                      {cadenceDisplay(item.cadence, 'builder')} ·{' '}
                      <Text style={{ color: palette.move, fontWeight: '600' }}>🔥 {streak}d</Text>
                    </Text>
                  </View>
                  <Text className="text-ink4">›</Text>
                </Pressable>
              );
            }}
          />
        </View>
        <Text className="text-caption2 text-ink4 mt-1 px-1">Drag to reorder · swipe to remove</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add "app/(tabs)/rituals/builder.tsx"
git commit -m "feat(sp5e): Builder scaffold with DraggableFlatList Active section + reorder"
```

---

## Task 27: Builder — swipe-to-remove + Inactive section + restore

**Files:**
- Modify: `app/(tabs)/rituals/builder.tsx`

Wraps each Active row in a `Swipeable` (from `react-native-gesture-handler`) for swipe-left "Remove"; renders an Inactive section below with swipe-right "Restore."

- [x] **Step 1: Add the imports**

In `app/(tabs)/rituals/builder.tsx`, add to the imports block:

```tsx
import { Alert, ScrollView } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { restoreRitual, softDeleteRitual } from '@/lib/db/queries/rituals';
```

- [x] **Step 2: Wrap the page in `ScrollView` so multiple sections fit**

Change the root `SafeAreaView` body to a `ScrollView`. Replace the previous Active section block + its outer `View`s with the structure below. (Active section now lives inside a ScrollView, with Inactive + future sections appended.)

Replace the JSX from `<View className="px-3 pb-2">` (Active section) onward with:

```tsx
<ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
  <View className="px-3 pb-2">
    <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Active rituals</Text>
    <View className="rounded-xl bg-surface overflow-hidden">
      <DraggableFlatList<Ritual>
        data={active}
        keyExtractor={(r) => String(r.id)}
        onDragEnd={onDragEnd}
        // Disabling internal scroll so the outer ScrollView handles it.
        // (DraggableFlatList ignores nested scroll lock by default; on iOS this is fine.)
        scrollEnabled={false}
        renderItem={({ item, drag, isActive }) => {
          const tile = colorTokenToHex(item.color, palette);
          const streak = streakForRitual({
            ritualEntries: entriesLive.data,
            ritualId: item.id,
            asOf: new Date(),
          });

          const renderRightActions = () => (
            <Pressable
              onPress={() => onRemove(item)}
              className="items-center justify-center px-6"
              style={{ backgroundColor: '#FF3B30' }}
            >
              <Text className="text-callout" style={{ color: '#fff', fontWeight: '600' }}>Remove</Text>
            </Pressable>
          );

          return (
            <Swipeable renderRightActions={renderRightActions}>
              <Pressable
                onLongPress={drag}
                onPress={() => router.push(`/(tabs)/rituals/${item.id}/edit`)}
                delayLongPress={150}
                className="flex-row items-center px-4 py-3"
                style={{
                  backgroundColor: isActive ? palette.fill : palette.surface,
                  borderBottomWidth: 0.5,
                  borderBottomColor: palette.hair,
                }}
              >
                <Text style={{ color: palette.ink4, fontSize: 14, marginRight: 8 }}>≡</Text>
                <View
                  className="h-9 w-9 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: tile }}
                >
                  <SymbolView name={item.icon as never} size={17} tintColor="#fff" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-callout text-ink" numberOfLines={1}>{item.title}</Text>
                  <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                    {cadenceDisplay(item.cadence, 'builder')} ·{' '}
                    <Text style={{ color: palette.move, fontWeight: '600' }}>🔥 {streak}d</Text>
                  </Text>
                </View>
                <Text className="text-ink4">›</Text>
              </Pressable>
            </Swipeable>
          );
        }}
      />
    </View>
    <Text className="text-caption2 text-ink4 mt-1 px-1">Drag to reorder · swipe to remove</Text>
  </View>

  {inactive.length > 0 && (
    <View className="px-3 pb-2">
      <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Inactive rituals</Text>
      <View className="rounded-xl bg-surface overflow-hidden" style={{ opacity: 0.55 }}>
        {inactive.map((item, i) => {
          const tile = colorTokenToHex(item.color, palette);
          const renderLeftActions = () => (
            <Pressable
              onPress={() => onRestore(item)}
              className="items-center justify-center px-6"
              style={{ backgroundColor: palette.move }}
            >
              <Text className="text-callout" style={{ color: '#fff', fontWeight: '600' }}>Restore</Text>
            </Pressable>
          );
          return (
            <Swipeable key={item.id} renderLeftActions={renderLeftActions}>
              <View
                className="flex-row items-center px-4 py-3"
                style={{
                  backgroundColor: palette.surface,
                  borderBottomWidth: i === inactive.length - 1 ? 0 : 0.5,
                  borderBottomColor: palette.hair,
                }}
              >
                <View
                  className="h-9 w-9 rounded-lg items-center justify-center mr-3"
                  style={{ backgroundColor: tile }}
                >
                  <SymbolView name={item.icon as never} size={17} tintColor="#fff" />
                </View>
                <View className="flex-1 min-w-0">
                  <Text className="text-callout text-ink" numberOfLines={1}>{item.title}</Text>
                  <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                    {cadenceDisplay(item.cadence, 'builder')}
                  </Text>
                </View>
              </View>
            </Swipeable>
          );
        })}
      </View>
      <Text className="text-caption2 text-ink4 mt-1 px-1">Swipe right to restore</Text>
    </View>
  )}
</ScrollView>
```

Add the `inactive` derivation alongside `active`:

```tsx
const inactive = useMemo(
  () => ritualsLive.data.filter((r) => !r.active),
  [ritualsLive.data],
);
```

Add the two handler functions inside the component:

```tsx
const onRemove = (r: Ritual) => {
  Alert.alert(
    'Remove ritual?',
    'Past entries kept. You can restore from Inactive.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => softDeleteRitual(db, r.id) },
    ],
  );
};

const onRestore = async (r: Ritual) => {
  await restoreRitual(db, r.id);
};
```

- [x] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 4: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add "app/(tabs)/rituals/builder.tsx"
git commit -m "feat(sp5e): Builder swipe-to-remove + Inactive section + swipe-to-restore"
```

---

## Task 28: Builder — Suggested by Pal section

**Files:**
- Modify: `app/(tabs)/rituals/builder.tsx`

Loads two LLM suggestions; "Add" inserts and re-fetches; manual `↻` button.

- [x] **Step 1: Add the imports**

In `app/(tabs)/rituals/builder.tsx`:

```tsx
import { ActivityIndicator } from 'react-native';

import { insertRitual } from '@/lib/db/queries/rituals';
import { usePalSuggestions } from '@/lib/sync/usePalSuggestions';
```

- [x] **Step 2: Add the hook call inside the component**

After the `inactive` derivation:

```tsx
const suggestions = usePalSuggestions(active, entriesLive.data);

const onAddSuggestion = async (s: typeof suggestions.suggestions[number]) => {
  await insertRitual(db, {
    title: s.title,
    icon: s.icon,
    cadence: s.cadence,
    color: s.color,
    active: true,
  });
  // The active set just changed; usePalSuggestions invalidates cache and refetches.
  await suggestions.refresh();
};
```

- [x] **Step 3: Render the Suggested section above Preferences**

Add inside the `ScrollView`, after the Inactive section (or after Active when there's no Inactive):

```tsx
<View className="px-3 pb-2">
  <View className="flex-row items-center justify-between px-1 mb-1">
    <Text className="text-caption1 text-ink3 uppercase">Suggested by Pal</Text>
    <Pressable onPress={() => suggestions.refresh()} hitSlop={8}>
      <SymbolView name="arrow.clockwise" size={16} tintColor={palette.ink3} />
    </Pressable>
  </View>
  <View className="rounded-xl bg-surface overflow-hidden">
    {suggestions.loading ? (
      <View className="px-4 py-6 items-center">
        <ActivityIndicator size="small" color={palette.ink3} />
      </View>
    ) : suggestions.error ? (
      <View className="px-4 py-3 flex-row items-center">
        <Text className="flex-1 text-caption1 text-ink3">Couldn't load suggestions.</Text>
        <Pressable onPress={() => suggestions.refresh()} hitSlop={8}>
          <SymbolView name="arrow.clockwise" size={14} tintColor={palette.accent} />
        </Pressable>
      </View>
    ) : suggestions.suggestions.length === 0 ? null : (
      suggestions.suggestions.map((s, i) => {
        const tile = colorTokenToHex(s.color, palette);
        return (
          <View
            key={`${s.title}-${i}`}
            className="flex-row items-center px-4 py-3"
            style={{
              borderBottomWidth: i === suggestions.suggestions.length - 1 ? 0 : 0.5,
              borderBottomColor: palette.hair,
            }}
          >
            <View
              className="h-9 w-9 rounded-lg items-center justify-center mr-3"
              style={{ backgroundColor: tile }}
            >
              <SymbolView name={s.icon as never} size={17} tintColor="#fff" />
            </View>
            <View className="flex-1 min-w-0">
              <Text className="text-callout text-ink" numberOfLines={1}>{s.title}</Text>
              <Text className="text-caption1 text-ink3 mt-1" numberOfLines={2}>{s.reason}</Text>
            </View>
            <Pressable onPress={() => onAddSuggestion(s)} hitSlop={8}>
              <Text className="text-callout" style={{ color: palette.accent, fontWeight: '600' }}>Add</Text>
            </Pressable>
          </View>
        );
      })
    )}
  </View>
</View>
```

(If `suggestions.suggestions.length === 0` and not loading and no error → the section doesn't render at all per spec; the conditional above hides the inner box but keeps the section header. Adjust if you'd rather hide the whole section: wrap the entire `<View>` in a conditional `{(suggestions.loading || suggestions.error || suggestions.suggestions.length > 0) && (…)}`.)

- [x] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add "app/(tabs)/rituals/builder.tsx"
git commit -m "feat(sp5e): Builder Suggested by Pal section with manual refresh + Add CTA"
```

---

## Task 29: Builder — Preferences (Remind me + Daily goal rows)

**Files:**
- Modify: `app/(tabs)/rituals/builder.tsx`

- [x] **Step 1: Add the imports**

In `app/(tabs)/rituals/builder.tsx`:

```tsx
import DateTimePicker from '@react-native-community/datetimepicker';

import { goals } from '@/lib/db/schema';
import {
  cancelDailyReminder,
  ensurePermission,
  reminderBody,
  scheduleDailyReminder,
} from '@/lib/notifications/dailyReminder';
```

(`@react-native-community/datetimepicker` is already in the project per Expo SDK 55 baseline; if not, run `npx expo install @react-native-community/datetimepicker`.)

- [x] **Step 2: Add live-query for goals + state**

Inside the component:

```tsx
const goalsLive = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));
const goalRow = goalsLive.data[0];
const reminderTime = goalRow?.reminderTimeMinutes ?? null;
const dailyTarget = goalRow?.dailyRitualTarget ?? 0;

const [showTimePicker, setShowTimePicker] = useState(false);
const [permissionDenied, setPermissionDenied] = useState(false);

const onTimeChange = async (_event: unknown, date?: Date) => {
  setShowTimePicker(false);
  if (!date) return;
  const minutes = date.getHours() * 60 + date.getMinutes();
  // Persist regardless of permission outcome.
  await db.update(goals).set({ reminderTimeMinutes: minutes }).where(eq(goals.id, 1)).run();
  const perm = await ensurePermission();
  if (perm === 'granted') {
    setPermissionDenied(false);
    await scheduleDailyReminder(minutes, reminderBody(active));
  } else {
    setPermissionDenied(true);
  }
};

const onTurnOff = async () => {
  await db.update(goals).set({ reminderTimeMinutes: null }).where(eq(goals.id, 1)).run();
  await cancelDailyReminder();
};

const formatTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
};
```

- [x] **Step 3: Render the Preferences section after Suggested**

Inside the `ScrollView`, after Suggested:

```tsx
<View className="px-3 pb-3">
  <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Preferences</Text>
  <View className="rounded-xl bg-surface overflow-hidden">
    {/* Remind me row */}
    <Pressable
      onPress={() => setShowTimePicker(true)}
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}
    >
      <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: '#FF3B30' }}>
        <SymbolView name="bell.fill" size={14} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">Remind me</Text>
      <Text className="text-callout text-ink3 mr-1">
        {reminderTime != null ? formatTime(reminderTime) : 'Off'}
      </Text>
      <Text className="text-ink4">›</Text>
    </Pressable>

    {permissionDenied && (
      <View className="px-4 py-2" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
        <Text className="text-caption1" style={{ color: '#FF3B30' }}>
          Notifications denied. Enable in iOS Settings → Pulse.
        </Text>
      </View>
    )}

    {reminderTime != null && (
      <Pressable onPress={onTurnOff} className="px-4 py-2" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
        <Text className="text-caption1" style={{ color: palette.accent }}>Turn off</Text>
      </Pressable>
    )}

    {/* Daily goal row */}
    <Pressable
      onPress={() => router.push('/(tabs)/rituals/goal')}
      className="flex-row items-center px-4 py-3"
    >
      <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: palette.accent }}>
        <SymbolView name="target" size={14} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">Daily goal</Text>
      <Text className="text-callout text-ink3 mr-1">{dailyTarget} of {active.length}</Text>
      <Text className="text-ink4">›</Text>
    </Pressable>
  </View>
</View>

{showTimePicker && (
  <DateTimePicker
    mode="time"
    value={(() => {
      const d = new Date();
      if (reminderTime != null) {
        d.setHours(Math.floor(reminderTime / 60), reminderTime % 60, 0, 0);
      } else {
        d.setHours(8, 0, 0, 0);
      }
      return d;
    })()}
    onChange={onTimeChange}
    display="spinner"
  />
)}
```

- [x] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add "app/(tabs)/rituals/builder.tsx"
git commit -m "feat(sp5e): Builder Preferences (Remind me + Daily goal rows)"
```

---

## Task 30: `RitualForm` shared component + `new.tsx` + `[id]/edit.tsx`

**Files:**
- Create: `components/RitualForm.tsx`
- Modify: `app/(tabs)/rituals/new.tsx`
- Modify: `app/(tabs)/rituals/[id]/edit.tsx`

- [x] **Step 1: Create the shared form component**

Create `components/RitualForm.tsx`:

```tsx
import { useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { db } from '@/lib/db/client';
import {
  hardDeleteRitual,
  insertRitual,
  updateRitual,
} from '@/lib/db/queries/rituals';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import {
  RITUAL_ICON_SHORTLIST,
  type RitualCadence,
  type RitualColor,
  type RitualIcon,
} from '@/lib/api-types';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const COLOR_TOKENS: RitualColor[] = ['rituals', 'accent', 'move', 'money', 'cyan'];
const CADENCES: RitualCadence[] = ['morning', 'evening', 'all_day', 'weekdays', 'daily'];

type RitualFormProps =
  | { mode: 'new' }
  | {
      mode: 'edit';
      id: number;
      initial: { title: string; icon: RitualIcon; cadence: RitualCadence; color: RitualColor };
    };

export default function RitualForm(props: RitualFormProps) {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const initial = props.mode === 'edit'
    ? props.initial
    : { title: '', icon: 'sparkles' as RitualIcon, cadence: 'daily' as RitualCadence, color: 'rituals' as RitualColor };

  const [title, setTitle] = useState(initial.title);
  const [cadence, setCadence] = useState<RitualCadence>(initial.cadence);
  const [icon, setIcon] = useState<RitualIcon>(initial.icon);
  const [color, setColor] = useState<RitualColor>(initial.color);

  const canSave = title.trim().length >= 1 && title.trim().length <= 40;

  const colorHex = (token: RitualColor): string => {
    switch (token) {
      case 'rituals': return palette.rituals;
      case 'accent':  return palette.accent;
      case 'move':    return palette.move;
      case 'money':   return palette.money;
      case 'cyan':    return palette.cyan;
    }
  };

  const onPickCadence = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [...CADENCES.map((c) => cadenceDisplay(c, 'today')), 'Cancel'],
        cancelButtonIndex: CADENCES.length,
      },
      (i) => {
        if (i < CADENCES.length) setCadence(CADENCES[i]);
      },
    );
  };

  const onSave = async () => {
    if (!canSave) return;
    if (props.mode === 'new') {
      await insertRitual(db, { title: title.trim(), icon, cadence, color, active: true });
    } else {
      await updateRitual(db, props.id, { title: title.trim(), icon, cadence, color });
    }
    router.back();
  };

  const onDelete = () => {
    if (props.mode !== 'edit') return;
    Alert.alert(
      `Delete '${title || initial.title}'?`,
      'This permanently removes the ritual and all its history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await hardDeleteRitual(db, props.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>Cancel</Text>
          </Pressable>
          <Text className="text-headline text-ink">{props.mode === 'new' ? 'New ritual' : 'Edit ritual'}</Text>
          <Pressable onPress={onSave} disabled={!canSave} hitSlop={8}>
            <Text className="text-callout" style={{ color: canSave ? palette.accent : palette.ink4, fontWeight: '600' }}>
              Save
            </Text>
          </Pressable>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Basics</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
              <Text className="text-callout text-ink2 w-24">Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Morning pages"
                placeholderTextColor={palette.ink4}
                autoCapitalize="sentences"
                maxLength={40}
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
            <Pressable onPress={onPickCadence} className="flex-row items-center px-4 py-3">
              <Text className="text-callout text-ink2 w-24">Cadence</Text>
              <Text className="flex-1 text-callout text-ink3 text-right mr-1">
                {cadenceDisplay(cadence, 'today')}
              </Text>
              <Text className="text-ink4">›</Text>
            </Pressable>
          </View>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Style</Text>
          <View className="rounded-xl bg-surface p-4">
            {/* Icon picker — 4×4 grid */}
            <Text className="text-caption2 text-ink3 mb-2">Icon</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {RITUAL_ICON_SHORTLIST.map((sym) => {
                const selected = icon === sym;
                return (
                  <Pressable
                    key={sym}
                    onPress={() => setIcon(sym)}
                    className="h-14 w-14 rounded-xl items-center justify-center"
                    style={{
                      backgroundColor: palette.fill,
                      opacity: selected ? 1 : 0.5,
                      borderWidth: selected ? 2 : 0,
                      borderColor: palette.accent,
                    }}
                  >
                    <SymbolView name={sym as never} size={22} tintColor={palette.ink} />
                  </Pressable>
                );
              })}
            </View>

            <Text className="text-caption2 text-ink3 mt-4 mb-2">Color</Text>
            <View className="flex-row" style={{ gap: 12 }}>
              {COLOR_TOKENS.map((c) => {
                const selected = color === c;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    className="h-8 w-8 rounded-full items-center justify-center"
                    style={{
                      backgroundColor: colorHex(c),
                      borderWidth: selected ? 3 : 0,
                      borderColor: palette.ink,
                    }}
                  />
                );
              })}
            </View>
          </View>
        </View>

        {props.mode === 'edit' && (
          <View className="px-3 pb-2">
            <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Danger</Text>
            <Pressable
              onPress={onDelete}
              className="rounded-xl bg-surface flex-row items-center px-4 py-3"
            >
              <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: '#FF3B30' }}>
                <SymbolView name="trash.fill" size={14} tintColor="#fff" />
              </View>
              <Text className="text-callout" style={{ color: '#FF3B30', fontWeight: '500' }}>Delete ritual</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Wire `new.tsx`**

Replace `app/(tabs)/rituals/new.tsx`:

```tsx
import RitualForm from '@/components/RitualForm';

export default function NewRitualScreen() {
  return <RitualForm mode="new" />;
}
```

- [x] **Step 3: Wire `[id]/edit.tsx`**

Replace `app/(tabs)/rituals/[id]/edit.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import RitualForm from '@/components/RitualForm';
import { db } from '@/lib/db/client';
import { rituals } from '@/lib/db/schema';
import type { RitualCadence, RitualColor, RitualIcon } from '@/lib/api-types';

export default function EditRitualScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const live = useLiveQuery(db.select().from(rituals).where(eq(rituals.id, id)));
  const row = live.data[0];

  if (!row) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center">
          <Text className="text-callout text-ink3">Ritual not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RitualForm
      mode="edit"
      id={id}
      initial={{
        title: row.title,
        icon: row.icon as RitualIcon,
        cadence: row.cadence as RitualCadence,
        color: row.color as RitualColor,
      }}
    />
  );
}
```

- [x] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 5: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add components/RitualForm.tsx "app/(tabs)/rituals/new.tsx" "app/(tabs)/rituals/[id]/edit.tsx"
git commit -m "feat(sp5e): RitualForm + new.tsx + [id]/edit.tsx routes"
```

---

## Task 31: Daily-goal picker (`goal.tsx`)

**Files:**
- Modify: `app/(tabs)/rituals/goal.tsx`

Tiny screen: radio rows 1…N where N = active rituals count. Persists to `goals.dailyRitualTarget`.

- [x] **Step 1: Replace the stub**

Replace `app/(tabs)/rituals/goal.tsx`:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { goals, rituals } from '@/lib/db/schema';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function DailyGoalScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const goalsLive = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));
  const ritualsLive = useLiveQuery(db.select().from(rituals).where(eq(rituals.active, true)));

  const current = goalsLive.data[0]?.dailyRitualTarget ?? 0;
  const totalActive = ritualsLive.data.length;

  const onPick = async (n: number) => {
    await db.update(goals).set({ dailyRitualTarget: n }).where(eq(goals.id, 1)).run();
    router.back();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ Back</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-1 pb-3">
          <Text className="text-largeTitle text-ink">Daily goal</Text>
          <Text className="text-subhead text-ink3 mt-1">
            How many rituals to count as "done" each day.
          </Text>
        </View>

        <View className="px-3">
          <View className="rounded-xl bg-surface overflow-hidden">
            {Array.from({ length: totalActive }, (_, i) => i + 1).map((n, i) => {
              const selected = n === current;
              return (
                <Pressable
                  key={n}
                  onPress={() => onPick(n)}
                  className="flex-row items-center px-4 py-3"
                  style={{
                    borderBottomWidth: i === totalActive - 1 ? 0 : 0.5,
                    borderBottomColor: palette.hair,
                  }}
                >
                  <Text className="flex-1 text-callout text-ink">{n} of {totalActive}</Text>
                  {selected && <SymbolView name="checkmark" size={16} tintColor={palette.accent} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `24`.

- [x] **Step 3: Verify tests still green**

```bash
npm test 2>&1 | tail -6
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add "app/(tabs)/rituals/goal.tsx"
git commit -m "feat(sp5e): Daily-goal picker screen"
```

---

## Task 32: Apply meta-spec amendments A / B / C / D

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`

Per the spec §10, four amendments to land before slice close.

- [x] **Step 1: Amendment A — §2 row 10 ("Triggers")**

Find the row in the §2 table where the "Triggers" decision lives ("All Reviews / Celebrations / Close-Out triggers are app-foreground checks…"). Replace its "Choice" column text with:

```
All Reviews / Celebrations / Close-Out triggers are **app-foreground checks** comparing local DB state to last-seen value. **No push notifications.** Local notifications via `expo-notifications` are allowed for one specific surface — the daily ritual reminder added in 5e (single repeating local notification scheduled at the user's chosen time). Permission is requested in-context (only when the user first sets a reminder time), not at app launch. No silent push, no remote push, no APNs config.
```

- [x] **Step 2: Amendment B — §6 (Scope cuts) — color/icon picker line**

Find the row in the §6 table where "Editing rituals' icon/color picker beyond the seeded set" lives. Replace the "Reason" column with:

```
The Builder lets you edit name, cadence, icon (16-symbol shortlist), color (5-token shortlist), and active-state, plus reorder. **No** custom icon uploads, **no** free-form color (HSL/hex). The 5 color tokens reuse existing theme tokens (`rituals`, `accent`, `move`, `money`) plus one new token `cyan` (#5AC8FA / #64D2FF) added to `lib/theme/tokens.ts`.
```

- [x] **Step 3: Amendment C — §3 5e row Surface + TDD columns**

Find the **5e** row in the §3 decomposition table. Replace the "Surface" column with:

```
Full `app/(tabs)/rituals/` route group (`index`, `builder`, `new`, `[id]/edit`, `goal`). Schema delta: `rituals` gains `cadence` + `color` enum columns; `goals` gains `reminder_time_minutes`; new `pal_cache` table for nudge + suggestion caches. New iOS deps: `expo-notifications`, `react-native-draggable-flatlist`. **New backend endpoints** `POST /suggest-rituals` and `POST /nudge-today` (under `"chat"` scope) consumed by Builder's "Suggested by Pal" section and Today's nudge card. New theme token `cyan`. Idempotent reseed of `DEFAULT_RITUALS` (adds `8 glasses water` for already-onboarded users).
```

Replace the "TDD applies to" column with:

```
Reorder semantics (position math, gap-handling, contiguous-position invariant), active/soft-delete/restore/hard-delete behavior, tap-toggle today (insert vs. cascading-delete-all-today's), reminder body templating, cache read/write/vacuum, `cadenceDisplay` mapping, idempotent reseed, prompt builders for both new endpoints, and route-level integration tests for both endpoints (auth + LLM-failure resilience).
```

- [x] **Step 4: Amendment D — §4 (Cross-cutting dependencies) — new row**

Append a new row to the §4 table (after the last existing row):

```
| `expo-notifications` | 5e only — single repeating local notification for daily ritual reminder. Permission asked in-context (Builder Preferences row). | New stack addition. Expo Go supports local notifications for development smoke; production iPhone install requires a dev-client rebuild (carry-over to end-of-SP5 deferred pass). |
```

- [x] **Step 5: Commit the amendments**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5e): meta-spec amendments A/B/C/D — notifications, color picker, 5e cross-tier scope, expo-notifications dep"
```

---

## Task 33: Final smoke + slice status update

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`

- [x] **Step 1: Run the full smoke**

```bash
npm test
cd backend && npm test
npx tsc --noEmit 2>&1 | grep -c "error TS"
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: iOS ~372 tests green; backend ~220 tests green; root tsc still 24 errors; backend tsc baseline preserved. Record the exact test counts.

- [ ] **Step 2: Web target visual smoke** (deferred to SP5-wide pass)

```bash
npm run web
```

Open the browser and walk through the full flow:

- [ ] Rituals tab → 7 default rituals visible (Water present), "X of 7 done today" subtitle
- [ ] Pal nudge card renders with progress ring + headline + sub (sub may show "…" if backend isn't reachable; that's OK)
- [ ] Tap a ritual row → checkbox flips, count increments, nudge re-fetches
- [ ] Tap again → checkbox flips back, count decrements
- [ ] Tap "+ New ritual" → form opens, fill name, pick icon + cadence + color, Save → row appears in Builder
- [ ] Open Builder → drag a row → reorder persists across reload
- [ ] Swipe-left "Remove" → moves to Inactive section; swipe-right "Restore" → returns to Active
- [ ] Tap a Builder row → opens Edit form (name + cadence + icon + color prefilled)
- [ ] Edit form → "Delete ritual" → confirm → row + history gone
- [ ] "Suggested by Pal" → 2 rows render (or empty if backend unreachable; loading spinner OK)
- [ ] Click ↻ refresh → suggestions re-fetch
- [ ] "Add" on a suggestion → row appears in Active list
- [ ] "Remind me" row → time picker opens; pick a time; permission prompt fires; row updates
- [ ] "Daily goal" row → picker screen → tap value → row updates

Stop the dev server.

- [x] **Step 3: Update SP5 meta-spec status table**

Edit `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`. In §3 "Sub-slice status," replace the line:

```
- **5e** Not started.
```

with:

```
- **5e** ✅ Code complete 2026-04-28 — full `app/(tabs)/rituals/` route group (index, builder, new, [id]/edit, goal) replacing the SP3a stub. New iOS query modules: `lib/db/queries/rituals.ts` (insert/update/soft-delete/restore/hard-delete/reorder/toggle-today), `lib/db/queries/palCache.ts`, `lib/db/queries/reseedDefaults.ts`, `lib/db/queries/dayKey.ts` (extracted from streaks.ts). New hooks `lib/sync/usePalSuggestions.ts` (24h TTL + active-hash invalidation) and `lib/sync/useRitualNudge.ts` (state-keyed cache + local fallback sub). New iOS client `lib/sync/palClient.ts`. New `lib/notifications/dailyReminder.ts` module. New iOS deps: `expo-notifications`, `react-native-draggable-flatlist`. New theme token `cyan`. Schema delta: `rituals.cadence` + `rituals.color` enum cols, `goals.reminder_time_minutes`, new `pal_cache` table; idempotent reseed adds `8 glasses water` for already-onboarded users. New backend endpoints `POST /suggest-rituals` and `POST /nudge-today` mounted under existing `"chat"` JWT scope. Meta-spec amendments A/B/C/D applied (per spec §10) — notifications carve-out, color picker shortlist, 5e cross-tier scope, expo-notifications dep row. ~25 new iOS query tests + ~15 new backend tests. Live `/suggest-rituals` and `/nudge-today` against real OpenRouter + iPhone Expo Go visual verification + dev-client rebuild for `expo-notifications` carry over to the SP5-wide deferred pass — gated on the `OPENROUTER_API_KEY` deploy carryover from SP5b/SP5c. Manual web smoke green.
```

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5e): mark slice code-complete in §3 sub-slice status"
```

---

## Done

At this point:

- 5 new screens (`rituals/index`, `builder`, `new`, `[id]/edit`, `goal`) + scaffolding `_layout`
- 4 new query modules (`rituals.ts`, `palCache.ts`, `reseedDefaults.ts`, `dayKey.ts`) with ~25 unit tests
- 3 new helpers in `lib/sync/` (`palClient`, `usePalSuggestions`, `useRitualNudge`) + `cadenceDisplay`
- 1 new notifications module (`dailyReminder.ts`)
- 2 new backend routes + 2 prompt builders + 2 Zod schemas + ~15 backend tests
- 2 new iOS deps (`expo-notifications`, `react-native-draggable-flatlist`)
- 1 new theme token (`cyan`/`cyanTint`)
- 1 schema migration (cadence + color + reminder_time_minutes + pal_cache)
- 1 new default ritual (8 glasses water)
- 4 meta-spec amendments
- ~33 commits (one per task)

**Slice-close criteria all met:**

1. ✅ `npm test` green at the new total (iOS ~372).
2. ✅ `cd backend && npm test` green at the new total (backend ~220).
3. ✅ `npx tsc --noEmit` baseline-preserved (still 24).
4. ✅ Web target smoke walks the full nav tree without errors.

**Carries over to the SP5-wide deferred pass (NOT 5e's responsibility):**

- iPhone Expo Go visual verification of the 5 new screens (covered by the existing SP5 deferred pass).
- Live `/suggest-rituals` + `/nudge-today` against real OpenRouter (gated on the `OPENROUTER_API_KEY` deploy carryover from SP5b/SP5c).
- Dev-client rebuild for `expo-notifications` (covered by the existing SP5 deferred pass).
