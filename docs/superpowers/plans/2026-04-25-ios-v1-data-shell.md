# Sub-Project 3a — iOS v1, Data + Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the SQLite + Drizzle data layer, the 4-step Onboarding, the tab shell with three stub tabs, and a Today screen whose three rings render real aggregates against `__DEV__`-seeded data.

**Architecture:** Drizzle ORM over `expo-sqlite`. Pure-function aggregates live in `lib/db/queries/` and are TDD'd against fixtures with `better-sqlite3` for migration / transaction tests. Onboarding state is form-local until a single commit transaction. The presence of `goals.id = 1` is the onboarding gate. Today subscribes via Drizzle's `useLiveQuery` so dev-seed mutations rerender automatically. Rings are Skia arcs animated with Reanimated.

**Tech Stack:** TypeScript (strict), Expo SDK 54, React Native 0.81, expo-router, NativeWind v4 (already wired), `expo-sqlite`, `drizzle-orm` + `drizzle-kit`, `@shopify/react-native-skia`, `react-native-reanimated`, `better-sqlite3` (jest only), `jest-expo`.

**Spec:** `docs/superpowers/specs/2026-04-25-ios-v1-data-shell-design.md`

**Conventions (from `CLAUDE.md`):**
- Commit subjects: short imperative under 70 chars; no `Co-Authored-By: Claude`.
- After every task that ends in a commit, run `npm test` (if any tests exist) and visually note the result before committing.

---

## File map

**Created:**
```
drizzle.config.ts
lib/db/schema.ts
lib/db/client.ts
lib/db/migrate.ts
lib/db/migrations/0000_initial.sql
lib/db/migrations/meta/_journal.json
lib/db/migrations/meta/0000_snapshot.json
lib/db/queries/today.ts
lib/db/queries/streaks.ts
lib/db/queries/onboarding.ts
lib/db/seed-defaults.ts
lib/db/__tests__/aggregates.test.ts
lib/db/__tests__/streaks.test.ts
lib/db/__tests__/migrate.test.ts
lib/db/__tests__/onboarding.test.ts
lib/db/__tests__/test-helpers.ts
app/onboarding/_layout.tsx
app/onboarding/index.tsx
app/(tabs)/_layout.tsx
app/(tabs)/today.tsx
app/(tabs)/move.tsx
app/(tabs)/rituals.tsx
app/(tabs)/you.tsx
components/Ring.tsx
components/RingTriad.tsx
components/StatBlock.tsx
components/StubTab.tsx
components/DevSeedButton.tsx
components/Fab.tsx
```

**Modified:**
- `package.json` (deps + scripts)
- `jest.config.js` (allow node-env DB tests)
- `app/_layout.tsx` (DB init + onboarding gate)
- `app/index.tsx` (delete or replace — the SP1 preview screen is retired; keep it under `/preview` if useful)
- `tsconfig.json` (no change expected)

**Deleted:**
- `app/index.tsx` is replaced by routing to `/(tabs)/today` from root layout. The SP1 preview content is moved to `app/preview.tsx` for reference (kept, not exported in tab bar).

---

## Task 1: Install dependencies and configure Drizzle tooling

**Files:**
- Modify: `package.json`
- Create: `drizzle.config.ts`

- [ ] **Step 1: Install runtime deps**

```bash
npx expo install expo-sqlite @shopify/react-native-skia
npm install drizzle-orm
npm install --save-dev drizzle-kit better-sqlite3 @types/better-sqlite3
```

- [ ] **Step 2: Add db scripts to `package.json`**

Add under `"scripts"` (preserve existing keys):

```json
"db:generate": "drizzle-kit generate",
"db:check": "drizzle-kit check"
```

- [ ] **Step 3: Create `drizzle.config.ts`**

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
} satisfies Config;
```

- [ ] **Step 4: Verify install**

Run: `npx drizzle-kit --version`
Expected: prints a version (no error).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json drizzle.config.ts
git commit -m "feat(deps): add drizzle, expo-sqlite, skia, better-sqlite3"
```

---

## Task 2: Define the Drizzle schema (5 tables)

**Files:**
- Create: `lib/db/schema.ts`

- [ ] **Step 1: Write `lib/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey(),
  dailyBudgetCents: integer('daily_budget_cents').notNull(),
  dailyMoveMinutes: integer('daily_move_minutes').notNull(),
  dailyRitualTarget: integer('daily_ritual_target').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});

export const rituals = sqliteTable('rituals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  icon: text('icon').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  position: integer('position').notNull(),
  createdAt: integer('created_at').notNull().default(sql`(unixepoch() * 1000)`),
});

export const spendingEntries = sqliteTable(
  'spending_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    cents: integer('cents').notNull(),
    note: text('note'),
    category: text('category'),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    occurredAtIdx: index('idx_spending_occurred_at').on(t.occurredAt),
  }),
);

export const movementEntries = sqliteTable(
  'movement_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    minutes: integer('minutes').notNull(),
    kind: text('kind'),
    note: text('note'),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    occurredAtIdx: index('idx_movement_occurred_at').on(t.occurredAt),
  }),
);

export const ritualEntries = sqliteTable(
  'ritual_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ritualId: integer('ritual_id')
      .notNull()
      .references(() => rituals.id, { onDelete: 'cascade' }),
    occurredAt: integer('occurred_at').notNull(),
  },
  (t) => ({
    ritualIdIdx: index('idx_ritual_entries_ritual_id').on(t.ritualId),
    occurredAtIdx: index('idx_ritual_entries_occurred_at').on(t.occurredAt),
  }),
);

export type Goals = typeof goals.$inferSelect;
export type Ritual = typeof rituals.$inferSelect;
export type SpendingEntry = typeof spendingEntries.$inferSelect;
export type MovementEntry = typeof movementEntries.$inferSelect;
export type RitualEntry = typeof ritualEntries.$inferSelect;
```

- [ ] **Step 2: Generate the initial migration**

Run: `npm run db:generate`
Expected: writes `lib/db/migrations/0000_<slug>.sql` plus `meta/_journal.json` and `meta/0000_snapshot.json`. The `<slug>` is autogenerated by drizzle-kit; leave it as-is.

- [ ] **Step 3: Sanity-check the SQL**

Run: `cat lib/db/migrations/0000_*.sql`
Expected: contains `CREATE TABLE \`goals\``, `\`rituals\``, `\`spending_entries\``, `\`movement_entries\``, `\`ritual_entries\``, plus three `CREATE INDEX` lines for the indexes defined.

- [ ] **Step 4: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations
git commit -m "feat(db): drizzle schema (goals, rituals, entries) + initial migration"
```

---

## Task 3: Allow node-env DB tests in jest

**Files:**
- Modify: `jest.config.js`

- [ ] **Step 1: Update `jest.config.js`**

```js
module.exports = {
  preset: 'jest-expo',
  testPathIgnorePatterns: ['/node_modules/', '/.expo/'],
  // Per-file `@jest-environment node` docblocks let DB suites swap the
  // jest-expo default env for plain node so better-sqlite3 can load.
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
};
```

- [ ] **Step 2: Verify the existing parity test still passes**

Run: `npm test`
Expected: PASS for `lib/theme/__tests__/parity.test.ts`.

- [ ] **Step 3: Commit**

```bash
git add jest.config.js
git commit -m "test: allow node-env exports for db tests"
```

---

## Task 4: Test helpers for in-memory DB

**Files:**
- Create: `lib/db/__tests__/test-helpers.ts`

- [ ] **Step 1: Write helper**

```ts
/** @jest-environment node */
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

import * as schema from '../schema';

export type TestDb = BetterSQLite3Database<typeof schema>;

export function makeTestDb(): { db: TestDb; raw: Database.Database } {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  const db = drizzle(raw, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, '../migrations') });
  return { db, raw };
}

/** Construct a Date at local-TZ midnight + the given offsets. */
export function atLocal(year: number, month: number, day: number, hour = 12): Date {
  return new Date(year, month - 1, day, hour, 0, 0, 0);
}

/** ms-since-epoch for a local-time tuple. */
export function tsLocal(year: number, month: number, day: number, hour = 12): number {
  return atLocal(year, month, day, hour).getTime();
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/__tests__/test-helpers.ts
git commit -m "test(db): in-memory drizzle helper"
```

---

## Task 5: Migration parity test (TDD)

**Files:**
- Test: `lib/db/__tests__/migrate.test.ts`

- [ ] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { makeTestDb } from './test-helpers';

describe('migrations apply cleanly', () => {
  it('creates the expected table set', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'goals',
      'movement_entries',
      'ritual_entries',
      'rituals',
      'spending_entries',
    ]);
  });

  it('creates the expected indexes', () => {
    const { raw } = makeTestDb();
    const rows = raw
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name).sort();
    expect(names).toEqual([
      'idx_movement_occurred_at',
      'idx_ritual_entries_occurred_at',
      'idx_ritual_entries_ritual_id',
      'idx_spending_occurred_at',
    ]);
  });

  it('enforces ritual_entries.ritual_id foreign key', () => {
    const { raw } = makeTestDb();
    expect(() =>
      raw
        .prepare('INSERT INTO ritual_entries (ritual_id, occurred_at) VALUES (?, ?)')
        .run(999, Date.now()),
    ).toThrow(/FOREIGN KEY/i);
  });
});
```

- [ ] **Step 2: Run — should pass already (migration was generated in Task 2)**

Run: `npm test -- migrate.test`
Expected: PASS.

If a table or index name disagrees, the failure tells you what drizzle actually emitted; rename the schema item rather than editing the test (the test encodes the spec).

- [ ] **Step 3: Commit**

```bash
git add lib/db/__tests__/migrate.test.ts
git commit -m "test(db): migration parity"
```

---

## Task 6: `getTodayAggregates` (TDD pure)

**Files:**
- Create: `lib/db/queries/today.ts`
- Test: `lib/db/__tests__/aggregates.test.ts`

- [ ] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { getTodayAggregates, localDayBounds } from '../queries/today';
import { tsLocal, atLocal } from './test-helpers';

const asOf = atLocal(2026, 4, 25, 14); // Sat Apr 25 2026, 14:00 local

describe('localDayBounds', () => {
  it('spans local midnight to next local midnight', () => {
    const { startMs, endMs } = localDayBounds(asOf);
    expect(new Date(startMs).getHours()).toBe(0);
    expect(endMs - startMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe('getTodayAggregates', () => {
  const goals = { dailyBudgetCents: 8500, dailyMoveMinutes: 60, dailyRitualTarget: 5 };
  const activeRituals = [
    { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 },
  ] as { id: number }[];

  it('zeros out for empty inputs', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [],
      movement: [],
      ritualEntries: [],
    });
    expect(r).toEqual({
      spentCents: 0,
      moveMinutes: 0,
      ritualsDone: 0,
      activeRitualCount: 5,
    });
  });

  it('excludes yesterday and tomorrow', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [
        { cents: 100, occurredAt: tsLocal(2026, 4, 24, 23) },
        { cents: 700, occurredAt: tsLocal(2026, 4, 25, 9) },
        { cents: 200, occurredAt: tsLocal(2026, 4, 26, 1) },
      ],
      movement: [
        { minutes: 30, occurredAt: tsLocal(2026, 4, 24, 22) },
        { minutes: 45, occurredAt: tsLocal(2026, 4, 25, 8) },
      ],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 12) },
        { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 7) },
      ],
    });
    expect(r.spentCents).toBe(700);
    expect(r.moveMinutes).toBe(45);
    expect(r.ritualsDone).toBe(1);
  });

  it('dedupes a ritual logged twice in one day', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals,
      spending: [],
      movement: [],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 18) },
        { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 9) },
      ],
    });
    expect(r.ritualsDone).toBe(2);
  });

  it('ignores entries for inactive rituals', () => {
    const r = getTodayAggregates({
      asOf,
      goals,
      activeRituals: [{ id: 1 }, { id: 2 }],
      spending: [],
      movement: [],
      ritualEntries: [
        { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
        { ritualId: 99, occurredAt: tsLocal(2026, 4, 25, 8) }, // inactive
      ],
    });
    expect(r.ritualsDone).toBe(1);
    expect(r.activeRitualCount).toBe(2);
  });

  it('handles a DST spring-forward day correctly', () => {
    // 2026 US DST start is Sun Mar 8. 02:00 → 03:00.
    const dstAsOf = atLocal(2026, 3, 8, 14);
    const r = getTodayAggregates({
      asOf: dstAsOf,
      goals,
      activeRituals,
      spending: [
        { cents: 500, occurredAt: tsLocal(2026, 3, 7, 23) },
        { cents: 800, occurredAt: tsLocal(2026, 3, 8, 4) },
      ],
      movement: [],
      ritualEntries: [],
    });
    expect(r.spentCents).toBe(800);
  });
});
```

- [ ] **Step 2: Run — fails (file does not exist)**

Run: `npm test -- aggregates.test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/db/queries/today.ts`**

```ts
export interface DayBounds {
  startMs: number;
  endMs: number;
}

export function localDayBounds(asOf: Date): DayBounds {
  const start = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate(),
    0, 0, 0, 0,
  );
  const end = new Date(
    asOf.getFullYear(),
    asOf.getMonth(),
    asOf.getDate() + 1,
    0, 0, 0, 0,
  );
  return { startMs: start.getTime(), endMs: end.getTime() };
}

export interface TodayAggregateInput {
  asOf: Date;
  goals: { dailyBudgetCents: number; dailyMoveMinutes: number; dailyRitualTarget: number };
  activeRituals: { id: number }[];
  spending: { cents: number; occurredAt: number }[];
  movement: { minutes: number; occurredAt: number }[];
  ritualEntries: { ritualId: number; occurredAt: number }[];
}

export interface TodayAggregates {
  spentCents: number;
  moveMinutes: number;
  ritualsDone: number;
  activeRitualCount: number;
}

export function getTodayAggregates(input: TodayAggregateInput): TodayAggregates {
  const { startMs, endMs } = localDayBounds(input.asOf);
  const inToday = (ms: number) => ms >= startMs && ms < endMs;

  const spentCents = input.spending
    .filter((r) => inToday(r.occurredAt))
    .reduce((acc, r) => acc + r.cents, 0);

  const moveMinutes = input.movement
    .filter((r) => inToday(r.occurredAt))
    .reduce((acc, r) => acc + r.minutes, 0);

  const activeIds = new Set(input.activeRituals.map((r) => r.id));
  const doneToday = new Set<number>();
  for (const e of input.ritualEntries) {
    if (!inToday(e.occurredAt)) continue;
    if (!activeIds.has(e.ritualId)) continue;
    doneToday.add(e.ritualId);
  }

  return {
    spentCents,
    moveMinutes,
    ritualsDone: doneToday.size,
    activeRitualCount: activeIds.size,
  };
}
```

- [ ] **Step 4: Run — passes**

Run: `npm test -- aggregates.test`
Expected: PASS (5 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/today.ts lib/db/__tests__/aggregates.test.ts
git commit -m "feat(db): getTodayAggregates with TZ-aware day boundary"
```

---

## Task 7: `streakForRitual` (TDD pure)

**Files:**
- Create: `lib/db/queries/streaks.ts`
- Test: `lib/db/__tests__/streaks.test.ts`

- [ ] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { streakForRitual } from '../queries/streaks';
import { atLocal, tsLocal } from './test-helpers';

const asOf = atLocal(2026, 4, 25, 14);

describe('streakForRitual', () => {
  it('is 0 with no entries', () => {
    expect(streakForRitual({ ritualEntries: [], ritualId: 1, asOf })).toBe(0);
  });

  it('is 1 when logged today only', () => {
    expect(
      streakForRitual({
        ritualEntries: [{ ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) }],
        ritualId: 1,
        asOf,
      }),
    ).toBe(1);
  });

  it('is 2 when logged today and yesterday', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('counts only the run ending today/yesterday when there is a gap', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
          // gap on Apr 23
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 22, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 21, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('still counts when last log is yesterday but not today', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 24, 7) },
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 23, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(2);
  });

  it('is 0 when last log is 3+ days ago', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 4, 22, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(0);
  });

  it('only counts entries for the matching ritualId', () => {
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 2, occurredAt: tsLocal(2026, 4, 25, 7) },
          { ritualId: 2, occurredAt: tsLocal(2026, 4, 24, 7) },
        ],
        ritualId: 1,
        asOf,
      }),
    ).toBe(0);
  });

  it('increments correctly across DST spring-forward', () => {
    // 2026 US DST: Sun Mar 8. Streak across Mar 7→8.
    const dstAsOf = atLocal(2026, 3, 8, 20);
    expect(
      streakForRitual({
        ritualEntries: [
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 8, 9) },
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 7, 9) },
          { ritualId: 1, occurredAt: tsLocal(2026, 3, 6, 9) },
        ],
        ritualId: 1,
        asOf: dstAsOf,
      }),
    ).toBe(3);
  });
});
```

- [ ] **Step 2: Run — fails (module missing)**

Run: `npm test -- streaks.test`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/db/queries/streaks.ts`**

```ts
export interface StreakInput {
  ritualEntries: { ritualId: number; occurredAt: number }[];
  ritualId: number;
  asOf: Date;
}

/** ISO-like local-day key, e.g. "2026-04-25". */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dayKeyForMs(ms: number): string {
  return dayKey(new Date(ms));
}

function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  // Construct at noon to dodge DST hour shifts.
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return dayKey(prev);
}

export function streakForRitual(input: StreakInput): number {
  const days = new Set<string>();
  for (const e of input.ritualEntries) {
    if (e.ritualId !== input.ritualId) continue;
    days.add(dayKeyForMs(e.occurredAt));
  }
  if (days.size === 0) return 0;

  const todayKey = dayKey(input.asOf);
  // Anchor: today if logged, otherwise yesterday if logged, else 0.
  let cursor: string;
  if (days.has(todayKey)) {
    cursor = todayKey;
  } else {
    const y = previousDayKey(todayKey);
    if (!days.has(y)) return 0;
    cursor = y;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDayKey(cursor);
  }
  return streak;
}
```

- [ ] **Step 4: Run — passes**

Run: `npm test -- streaks.test`
Expected: PASS (8 cases).

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/streaks.ts lib/db/__tests__/streaks.test.ts
git commit -m "feat(db): streakForRitual with DST-safe day keys"
```

---

## Task 8: Default ritual list

**Files:**
- Create: `lib/db/seed-defaults.ts`

- [ ] **Step 1: Write the canonical defaults**

```ts
export interface DefaultRitual {
  title: string;
  icon: string;
}

export const DEFAULT_RITUALS: readonly DefaultRitual[] = [
  { title: 'Morning pages',      icon: 'book.closed.fill' },
  { title: 'Inbox zero',         icon: 'tray.fill' },
  { title: 'Language practice',  icon: 'character.book.closed.fill' },
  { title: 'Stretch',            icon: 'dumbbell.fill' },
  { title: 'Read before bed',    icon: 'books.vertical.fill' },
  { title: 'Meditate',           icon: 'heart.fill' },
] as const;
```

- [ ] **Step 2: Commit**

```bash
git add lib/db/seed-defaults.ts
git commit -m "feat(db): default ritual definitions"
```

---

## Task 9: `finishOnboarding` transaction (TDD)

**Files:**
- Create: `lib/db/queries/onboarding.ts`
- Test: `lib/db/__tests__/onboarding.test.ts`

- [ ] **Step 1: Write failing test**

```ts
/** @jest-environment node */
import { eq } from 'drizzle-orm';

import { finishOnboarding, isOnboardingComplete } from '../queries/onboarding';
import { goals, rituals } from '../schema';
import { makeTestDb } from './test-helpers';

describe('isOnboardingComplete', () => {
  it('is false on a fresh DB', async () => {
    const { db } = makeTestDb();
    expect(await isOnboardingComplete(db)).toBe(false);
  });
});

describe('finishOnboarding', () => {
  it('inserts goals + active rituals in one go', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 8500,
      dailyMoveMinutes: 60,
      activeRitualTitles: ['Morning pages', 'Stretch', 'Meditate'],
    });

    const goalRows = await db.select().from(goals);
    expect(goalRows).toHaveLength(1);
    expect(goalRows[0]).toMatchObject({
      id: 1,
      dailyBudgetCents: 8500,
      dailyMoveMinutes: 60,
      dailyRitualTarget: 3,
    });

    const ritualRows = await db.select().from(rituals).orderBy(rituals.position);
    expect(ritualRows.map((r) => r.title)).toEqual([
      'Morning pages',
      'Stretch',
      'Meditate',
    ]);
    expect(ritualRows.map((r) => r.position)).toEqual([0, 1, 2]);
    for (const r of ritualRows) expect(r.active).toBe(true);

    expect(await isOnboardingComplete(db)).toBe(true);
  });

  it('omits toggled-off rituals', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 5000,
      dailyMoveMinutes: 45,
      activeRitualTitles: ['Inbox zero'],
    });
    const ritualRows = await db.select().from(rituals);
    expect(ritualRows.map((r) => r.title)).toEqual(['Inbox zero']);
  });

  it('uses INSERT OR REPLACE for the singleton goals row', async () => {
    const { db } = makeTestDb();
    await finishOnboarding(db, {
      dailyBudgetCents: 5000,
      dailyMoveMinutes: 45,
      activeRitualTitles: ['Stretch'],
    });
    await finishOnboarding(db, {
      dailyBudgetCents: 12000,
      dailyMoveMinutes: 90,
      activeRitualTitles: ['Stretch', 'Meditate'],
    });
    const goalRows = await db.select().from(goals).where(eq(goals.id, 1));
    expect(goalRows).toHaveLength(1);
    expect(goalRows[0].dailyBudgetCents).toBe(12000);
    expect(goalRows[0].dailyRitualTarget).toBe(2);
  });
});
```

- [ ] **Step 2: Run — fails**

Run: `npm test -- onboarding.test`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement `lib/db/queries/onboarding.ts`**

```ts
import { eq } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import { goals, rituals } from '../schema';
import { DEFAULT_RITUALS } from '../seed-defaults';

// Both DB drivers expose the same `select`/`insert`/`delete`/`transaction` surface
// we use; type as a union so production code (expo-sqlite) and tests
// (better-sqlite3) share one implementation.
export type AnyDb =
  | BetterSQLite3Database<Record<string, unknown>>
  | ExpoSQLiteDatabase<Record<string, unknown>>;

export interface FinishOnboardingInput {
  dailyBudgetCents: number;
  dailyMoveMinutes: number;
  /** Titles drawn from DEFAULT_RITUALS; order = on-screen order. */
  activeRitualTitles: string[];
}

export async function isOnboardingComplete(db: AnyDb): Promise<boolean> {
  const rows = await db.select({ id: goals.id }).from(goals).where(eq(goals.id, 1));
  return rows.length > 0;
}

export async function finishOnboarding(
  db: AnyDb,
  input: FinishOnboardingInput,
): Promise<void> {
  const target = input.activeRitualTitles.length;
  await (db as AnyDb).transaction(async (tx) => {
    // Singleton: clobber any prior values.
    await tx.delete(goals).where(eq(goals.id, 1));
    await tx.insert(goals).values({
      id: 1,
      dailyBudgetCents: input.dailyBudgetCents,
      dailyMoveMinutes: input.dailyMoveMinutes,
      dailyRitualTarget: target,
    });

    // Replace any prior ritual definitions (idempotent re-onboarding).
    await tx.delete(rituals);

    let position = 0;
    for (const title of input.activeRitualTitles) {
      const def = DEFAULT_RITUALS.find((d) => d.title === title);
      if (!def) {
        throw new Error(`Unknown default ritual: ${title}`);
      }
      await tx.insert(rituals).values({
        title: def.title,
        icon: def.icon,
        active: true,
        position,
      });
      position += 1;
    }
  });
}
```

- [ ] **Step 4: Run — passes**

Run: `npm test -- onboarding.test`
Expected: PASS (3 cases). If `transaction` is async vs sync mismatched between drivers, narrow the type to whichever signature your installed Drizzle exposes; both sides eventually return `Promise<void>` for our usage.

- [ ] **Step 5: Commit**

```bash
git add lib/db/queries/onboarding.ts lib/db/__tests__/onboarding.test.ts
git commit -m "feat(db): finishOnboarding transaction + isOnboardingComplete"
```

---

## Task 10: DB client + boot migration

**Files:**
- Create: `lib/db/client.ts`
- Create: `lib/db/migrate.ts`

- [ ] **Step 1: Write `lib/db/client.ts`**

```ts
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';

import * as schema from './schema';

const sqlite = openDatabaseSync('pulse.db');
sqlite.execSync('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { sqlite };
```

- [ ] **Step 2: Write `lib/db/migrate.ts`**

The Drizzle Expo migrator reads from a generated migrations bundle. We import the journal + sql files directly; the helper hashes them.

```ts
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

// drizzle-kit emits this default-export as the migrations bundle.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const migrations = require('./migrations/migrations.js');

import { db } from './client';

export function useDbMigrations() {
  return useMigrations(db, migrations);
}
```

- [ ] **Step 3: Generate the JS migrations bundle**

The `expo-sqlite` migrator needs a JS index of migrations alongside the SQL files. Drizzle-kit produces `migrations.js` automatically when the `dialect: 'sqlite'` driver is configured in newer drizzle-kit; if `lib/db/migrations/migrations.js` is missing, regenerate.

Run: `npm run db:generate`
Verify: `ls lib/db/migrations/migrations.js` exists.

If still missing (older drizzle-kit), add `out: './lib/db/migrations'` and `driver: 'expo'` to `drizzle.config.ts`:

```ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

Then re-run `npm run db:generate`.

- [ ] **Step 4: Commit**

```bash
git add lib/db/client.ts lib/db/migrate.ts lib/db/migrations
git commit -m "feat(db): expo-sqlite client + migrations bundle"
```

---

## Task 11: Onboarding gate in root layout

**Files:**
- Modify: `app/_layout.tsx`
- Create: `app/preview.tsx` (carrying over the SP1 token preview content)
- Modify: `app/index.tsx` (replace with redirect)

- [ ] **Step 1: Move existing `app/index.tsx` content to `app/preview.tsx`**

Run: `git mv app/index.tsx app/preview.tsx`

Adjust the file's first export name if needed to match the new route (the function name need not change; the route comes from the filename).

- [ ] **Step 2: Replace `app/index.tsx` with a router redirect**

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
```

- [ ] **Step 3: Update `app/_layout.tsx` to gate on migration + onboarding**

```tsx
import '../global.css';

import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { db } from '@/lib/db/client';
import { useDbMigrations } from '@/lib/db/migrate';
import { isOnboardingComplete } from '@/lib/db/queries/onboarding';
import { ThemeProvider } from '@/lib/theme/provider';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <Boot>
        <Slot />
      </Boot>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

function Boot({ children }: { children: React.ReactNode }) {
  const { success, error } = useDbMigrations();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      const done = await isOnboardingComplete(db);
      if (cancelled) return;
      const inOnboarding = segments[0] === 'onboarding';
      if (!done && !inOnboarding) {
        router.replace('/onboarding');
      } else if (done && inOnboarding) {
        router.replace('/(tabs)/today');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, segments, router]);

  if (error) {
    throw error;
  }
  if (!success) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator />
      </View>
    );
  }
  return <>{children}</>;
}
```

- [ ] **Step 4: Verify dev server starts**

Run: `npm run web` (in another terminal, or just confirm metro bundles)
Expected: bundles cleanly. The app renders a brief spinner, then the onboarding screen (or the tab shell once those tasks land).

For now (`onboarding/` and `(tabs)/` routes don't exist yet), the redirect will 404 — that's expected until Task 12+ land. Just confirm no compile errors.

- [ ] **Step 5: Commit**

```bash
git add app/_layout.tsx app/preview.tsx app/index.tsx
git commit -m "feat(app): boot gates on db migrate + onboarding"
```

---

## Task 12: Tab layout + stub tabs

**Files:**
- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/today.tsx` (placeholder content; real content lands in Task 16)
- Create: `app/(tabs)/move.tsx`
- Create: `app/(tabs)/rituals.tsx`
- Create: `app/(tabs)/you.tsx`
- Create: `components/StubTab.tsx`

- [ ] **Step 1: Write `components/StubTab.tsx`**

```tsx
import { Text, View } from 'react-native';

export function StubTab({ title, comingIn }: { title: string; comingIn: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg p-6">
      <Text className="text-title2 text-ink">{title}</Text>
      <Text className="mt-2 text-subhead text-ink3">Coming in {comingIn}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Write `app/(tabs)/_layout.tsx`**

```tsx
import { SymbolView } from 'expo-symbols';
import { Tabs } from 'expo-router';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function TabsLayout() {
  const { resolvedScheme } = useTheme();
  const palette = colors[resolvedScheme];

  const icon = (name: string) => ({ color, size }: { color: string; size: number }) => (
    <SymbolView name={name as any} size={size} tintColor={color} />
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.ink3,
        tabBarStyle: { backgroundColor: palette.surface, borderTopColor: palette.hair },
      }}
    >
      <Tabs.Screen name="today"   options={{ title: 'Today',   tabBarIcon: icon('circle.grid.2x2.fill') }} />
      <Tabs.Screen name="move"    options={{ title: 'Move',    tabBarIcon: icon('figure.run') }} />
      <Tabs.Screen name="rituals" options={{ title: 'Rituals', tabBarIcon: icon('sparkles') }} />
      <Tabs.Screen name="you"     options={{ title: 'You',     tabBarIcon: icon('person.crop.circle') }} />
    </Tabs>
  );
}
```

If `useTheme` does not currently expose `resolvedScheme` (the resolved Light/Dark after System resolution), check `lib/theme/provider.tsx`. If it only exposes `mode`, adapt: derive resolved scheme via `useColorScheme()` from `react-native` when `mode === 'system'`, else use `mode`. Pick a name and encapsulate in a small helper inside this file rather than touching the provider, unless the provider already exposes the resolved value.

- [ ] **Step 3: Stub the three non-Today tabs**

`app/(tabs)/move.tsx`:

```tsx
import { StubTab } from '@/components/StubTab';
export default function MoveTab() {
  return <StubTab title="Move" comingIn="SP4" />;
}
```

`app/(tabs)/rituals.tsx`:

```tsx
import { StubTab } from '@/components/StubTab';
export default function RitualsTab() {
  return <StubTab title="Rituals" comingIn="SP5" />;
}
```

`app/(tabs)/you.tsx`:

```tsx
import { StubTab } from '@/components/StubTab';
export default function YouTab() {
  return <StubTab title="You" comingIn="SP3b" />;
}
```

- [ ] **Step 4: Stub `app/(tabs)/today.tsx` (placeholder; replaced in Task 16)**

```tsx
import { Text, View } from 'react-native';

export default function TodayTab() {
  return (
    <View className="flex-1 items-center justify-center bg-bg">
      <Text className="text-title2 text-ink">Today (under construction)</Text>
    </View>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\) components/StubTab.tsx
git commit -m "feat(app): tab shell with three stub tabs"
```

---

## Task 13: Onboarding stepper

**Files:**
- Create: `app/onboarding/_layout.tsx`
- Create: `app/onboarding/index.tsx`

- [ ] **Step 1: Write `app/onboarding/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: Write `app/onboarding/index.tsx`**

The stepper holds local state, advances through 4 steps, and on finish calls `finishOnboarding` and routes to Today.

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { finishOnboarding } from '@/lib/db/queries/onboarding';
import { DEFAULT_RITUALS } from '@/lib/db/seed-defaults';

const BUDGET_CHIPS_DOLLARS = [50, 85, 120, 200];
const BUDGET_DEFAULT = 85;
const MOVE_CHIPS_MIN = [20, 45, 60, 90];
const MOVE_DEFAULT = 60;

type StepKey = 0 | 1 | 2 | 3;

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState<StepKey>(0);
  const [budget, setBudget] = useState(BUDGET_DEFAULT);
  const [moveGoal, setMoveGoal] = useState(MOVE_DEFAULT);
  const [activeTitles, setActiveTitles] = useState<string[]>(
    DEFAULT_RITUALS.map((r) => r.title),
  );
  const [busy, setBusy] = useState(false);

  const ritualToggle = (title: string) => {
    setActiveTitles((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const advance = () => {
    if (step < 3) setStep((step + 1) as StepKey);
    else void commit();
  };

  const skip = () => {
    if (step === 1) setBudget(BUDGET_DEFAULT);
    if (step === 2) setMoveGoal(MOVE_DEFAULT);
    if (step === 3) setActiveTitles(DEFAULT_RITUALS.map((r) => r.title));
    if (step < 3) setStep((step + 1) as StepKey);
    else void commit();
  };

  const commit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // Preserve display order from DEFAULT_RITUALS for active titles.
      const ordered = DEFAULT_RITUALS.map((r) => r.title).filter((t) =>
        activeTitles.includes(t),
      );
      await finishOnboarding(db, {
        dailyBudgetCents: budget * 100,
        dailyMoveMinutes: moveGoal,
        activeRitualTitles: ordered,
      });
      router.replace('/(tabs)/today');
    } finally {
      setBusy(false);
    }
  };

  const ritualCount = activeTitles.length;
  const canAdvance = step !== 3 || ritualCount > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView className="flex-1" contentContainerClassName="px-6 pb-12 pt-8">
        <ProgressDots step={step} total={4} />
        {step === 0 && <WelcomeStep />}
        {step === 1 && (
          <BudgetStep value={budget} onChange={setBudget} />
        )}
        {step === 2 && (
          <MoveStep value={moveGoal} onChange={setMoveGoal} />
        )}
        {step === 3 && (
          <RitualsStep activeTitles={activeTitles} onToggle={ritualToggle} />
        )}
      </ScrollView>
      <View className="px-6 pb-8">
        <Pressable
          accessibilityRole="button"
          disabled={!canAdvance || busy}
          onPress={advance}
          className={
            canAdvance && !busy
              ? 'bg-accent rounded-2xl py-4 items-center'
              : 'bg-fill rounded-2xl py-4 items-center'
          }
        >
          <Text className="text-headline text-white">
            {step === 0 ? 'Get started' : step === 3 ? 'Start tracking' : 'Continue'}
          </Text>
        </Pressable>
        {step > 0 && (
          <Pressable onPress={skip} className="mt-3 items-center py-2">
            <Text className="text-subhead text-ink3">Skip</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <View className="flex-row justify-center gap-1.5 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={
            i === step
              ? 'h-1.5 w-5 rounded-full bg-accent'
              : 'h-1.5 w-1.5 rounded-full bg-fill'
          }
        />
      ))}
    </View>
  );
}

function WelcomeStep() {
  return (
    <View className="items-center mt-8">
      <Hero glyph="✦" tone="accent" />
      <Text className="mt-6 text-largeTitle text-ink text-center">
        Welcome to{'\n'}Pulse
      </Text>
      <Text className="mt-3 text-body text-ink3 text-center px-4">
        One app for money, movement, and the little rituals that hold your day together.
      </Text>
    </View>
  );
}

function BudgetStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View className="items-center mt-8">
      <Hero glyph="$" tone="money" />
      <Text className="mt-6 text-largeTitle text-ink text-center">Set a daily{'\n'}budget</Text>
      <Text className="mt-3 text-body text-ink3 text-center">
        We&apos;ll help you stay under it — gently.
      </Text>
      <Text className="mt-6 text-largeTitle text-ink">${value}</Text>
      <ChipRow
        items={BUDGET_CHIPS_DOLLARS.map((n) => ({ label: `$${n}`, value: n }))}
        selected={value}
        onSelect={onChange}
        tone="money"
      />
    </View>
  );
}

function MoveStep({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <View className="items-center mt-8">
      <Hero glyph="◐" tone="move" />
      <Text className="mt-6 text-largeTitle text-ink text-center">Pick a{'\n'}move goal</Text>
      <Text className="mt-3 text-body text-ink3 text-center">
        Any kind of movement counts — run, walk, yoga, anything.
      </Text>
      <Text className="mt-6 text-largeTitle text-ink">{value} MIN</Text>
      <ChipRow
        items={MOVE_CHIPS_MIN.map((n) => ({ label: `${n} min`, value: n }))}
        selected={value}
        onSelect={onChange}
        tone="move"
      />
    </View>
  );
}

function RitualsStep({
  activeTitles,
  onToggle,
}: {
  activeTitles: string[];
  onToggle: (title: string) => void;
}) {
  return (
    <View className="mt-8">
      <View className="items-center">
        <Hero glyph="✧" tone="rituals" />
        <Text className="mt-6 text-largeTitle text-ink text-center">
          Choose your{'\n'}rituals
        </Text>
        <Text className="mt-3 text-body text-ink3 text-center px-4">
          Five small things you want to do each day. You can edit these anytime.
        </Text>
      </View>
      <View className="mt-8 bg-surface rounded-2xl overflow-hidden">
        {DEFAULT_RITUALS.map((r, i) => {
          const on = activeTitles.includes(r.title);
          return (
            <Pressable
              key={r.title}
              onPress={() => onToggle(r.title)}
              accessibilityRole="switch"
              accessibilityState={{ checked: on }}
              className={
                'flex-row items-center px-4 py-3 ' +
                (i < DEFAULT_RITUALS.length - 1 ? 'border-b border-hair' : '')
              }
            >
              <View className="h-7 w-7 rounded-md bg-rituals mr-3" />
              <Text className="flex-1 text-callout text-ink">{r.title}</Text>
              <View
                className={
                  on
                    ? 'h-6 w-10 rounded-full bg-move items-end justify-center pr-0.5'
                    : 'h-6 w-10 rounded-full bg-fill items-start justify-center pl-0.5'
                }
              >
                <View className="h-5 w-5 rounded-full bg-white" />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Hero({ glyph, tone }: { glyph: string; tone: 'accent' | 'money' | 'move' | 'rituals' }) {
  const tintBg = {
    accent: 'bg-accentTint',
    money: 'bg-moneyTint',
    move: 'bg-moveTint',
    rituals: 'bg-ritualsTint',
  }[tone];
  const fg = {
    accent: 'text-accent',
    money: 'text-money',
    move: 'text-move',
    rituals: 'text-rituals',
  }[tone];
  return (
    <View className={`h-24 w-24 rounded-3xl items-center justify-center ${tintBg}`}>
      <Text className={`text-title1 ${fg}`}>{glyph}</Text>
    </View>
  );
}

function ChipRow<T>({
  items,
  selected,
  onSelect,
  tone,
}: {
  items: { label: string; value: T }[];
  selected: T;
  onSelect: (v: T) => void;
  tone: 'money' | 'move';
}) {
  const onClass = tone === 'money' ? 'bg-money' : 'bg-move';
  return (
    <View className="flex-row gap-2 mt-6 flex-wrap justify-center">
      {items.map((item) => {
        const isSel = item.value === selected;
        return (
          <Pressable
            key={item.label}
            onPress={() => onSelect(item.value)}
            className={
              isSel
                ? `${onClass} px-4 py-2.5 rounded-full`
                : 'bg-surface border border-hair px-4 py-2.5 rounded-full'
            }
          >
            <Text className={isSel ? 'text-subhead text-white' : 'text-subhead text-ink'}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

- [ ] **Step 3: Visually verify**

Run: `npm run web` (start metro / web target if not already running).
Open the app: should land on the onboarding flow. Walk all four steps. On finish, the redirect to `/(tabs)/today` should now work (Task 12 routes exist).

If errors point to missing color tokens (e.g. `bg-moneyTint`), confirm Task 12 / SP1 setup includes them — they should be in the Tailwind palette already from `lib/theme/tokens.ts`.

- [ ] **Step 4: Manual DB sanity check (optional but recommended)**

Use Drizzle Studio: `npx drizzle-kit studio` (in another terminal, with the *runtime* DB path); or just trust the test suite for now.

- [ ] **Step 5: Commit**

```bash
git add app/onboarding
git commit -m "feat(onboarding): 4-step stepper persists goals + rituals"
```

---

## Task 14: `Ring` and `RingTriad` components

**Files:**
- Create: `components/Ring.tsx`
- Create: `components/RingTriad.tsx`

- [ ] **Step 1: Write `components/Ring.tsx`**

```tsx
import { Canvas, Path, Skia, BlurMask } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withTiming, Easing } from 'react-native-reanimated';

interface RingProps {
  size: number;
  strokeWidth: number;
  /** 0..1 (clamped). Values > 1 still render as a full ring in SP3a. */
  progress: number;
  color: string;
  trackColor: string;
}

export function Ring({ size, strokeWidth, progress, color, trackColor }: RingProps) {
  const target = Math.max(0, Math.min(1, progress));
  const animated = useSharedValue(target);

  useEffect(() => {
    animated.value = withTiming(target, { duration: 400, easing: Easing.inOut(Easing.ease) });
  }, [target, animated]);

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  // Background track
  const trackPath = Skia.Path.Make();
  trackPath.addCircle(cx, cy, r);

  // Progress arc
  const sweepPath = useDerivedValue(() => {
    const p = Skia.Path.Make();
    const sweep = Math.PI * 2 * animated.value;
    p.addArc(
      { x: cx - r, y: cy - r, width: r * 2, height: r * 2 },
      -90, // start at 12 o'clock
      (sweep * 180) / Math.PI,
    );
    return p;
  });

  return (
    <Canvas style={{ width: size, height: size }}>
      <Path
        path={trackPath}
        color={trackColor}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
      />
      <Path
        path={sweepPath}
        color={color}
        style="stroke"
        strokeWidth={strokeWidth}
        strokeCap="round"
      >
        <BlurMask blur={0} style="solid" />
      </Path>
    </Canvas>
  );
}
```

If `react-native-skia` does not load in the current Expo Go runtime (verified per Task 1 install), the spec's documented fallback is plain SVG arcs. Implement the same `RingProps` interface using `react-native-svg`'s `Circle` with a `strokeDasharray` trick. Skip this fallback unless Skia actually fails at runtime.

- [ ] **Step 2: Write `components/RingTriad.tsx`**

```tsx
import { View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

import { Ring } from './Ring';

export interface RingTriadProps {
  money: number;   // 0..1+ (clamp inside)
  move: number;
  rituals: number;
  size?: number;
}

export function RingTriad({ money, move, rituals, size = 240 }: RingTriadProps) {
  const { resolvedScheme } = useTheme();
  const palette = colors[resolvedScheme];

  const stroke = Math.round(size * 0.085);
  const gap = stroke + 4;
  const moveSize = size - 2 * gap;
  const ritualSize = moveSize - 2 * gap;

  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: 'absolute' }}>
        <Ring
          size={size}
          strokeWidth={stroke}
          progress={Math.min(money, 1)}
          color={palette.money}
          trackColor={palette.fill}
        />
      </View>
      <View style={{ position: 'absolute', top: gap, left: gap }}>
        <Ring
          size={moveSize}
          strokeWidth={stroke}
          progress={Math.min(move, 1)}
          color={palette.move}
          trackColor={palette.fill}
        />
      </View>
      <View style={{ position: 'absolute', top: gap * 2, left: gap * 2 }}>
        <Ring
          size={ritualSize}
          strokeWidth={stroke}
          progress={Math.min(rituals, 1)}
          color={palette.rituals}
          trackColor={palette.fill}
        />
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Ring.tsx components/RingTriad.tsx
git commit -m "feat(ui): Ring and RingTriad with Skia"
```

---

## Task 15: `StatBlock`, `Fab`, `DevSeedButton`

**Files:**
- Create: `components/StatBlock.tsx`
- Create: `components/Fab.tsx`
- Create: `components/DevSeedButton.tsx`

- [ ] **Step 1: Write `components/StatBlock.tsx`**

```tsx
import { Text, View } from 'react-native';

interface StatBlockProps {
  label: string;
  value: string;
  goal: string;
  toneClass: string; // e.g. "text-money"
}

export function StatBlock({ label, value, goal, toneClass }: StatBlockProps) {
  return (
    <View className="flex-1 items-center">
      <Text className={`text-caption2 ${toneClass}`}>{label}</Text>
      <Text className="text-title3 text-ink mt-1" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text className="text-caption1 text-ink3 mt-0.5">{goal}</Text>
    </View>
  );
}
```

- [ ] **Step 2: Write `components/Fab.tsx`**

```tsx
import { Pressable, Text } from 'react-native';

export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Log entry"
      className="absolute right-6 bottom-8 h-14 w-14 rounded-full bg-accent items-center justify-center"
      style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
    >
      <Text className="text-title2 text-white">+</Text>
    </Pressable>
  );
}
```

- [ ] **Step 3: Write `components/DevSeedButton.tsx`**

```tsx
import { ActionSheetIOS, Alert, Platform, Pressable, Text } from 'react-native';

import { db, sqlite } from '@/lib/db/client';
import { rituals, ritualEntries, movementEntries, spendingEntries } from '@/lib/db/schema';
import { localDayBounds } from '@/lib/db/queries/today';
import { gte, lt, and } from 'drizzle-orm';

if (!__DEV__) {
  // Defensive: ensure tree-shaking truly drops this.
  // (Bundler already strips the export when __DEV__ is false in release.)
}

const OPTIONS = ['Seed today (partial)', 'Seed today (full)', 'Clear today', 'Cancel'] as const;

export function DevSeedButton() {
  if (!__DEV__) return null;

  const open = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: [...OPTIONS], cancelButtonIndex: 3, destructiveButtonIndex: 2 },
        (idx) => {
          if (idx === 0) void seedPartial();
          if (idx === 1) void seedFull();
          if (idx === 2) void clearToday();
        },
      );
    } else {
      // Web / Android fallback: cycle via simple Alert.
      Alert.alert('Dev seed', undefined, [
        { text: OPTIONS[0], onPress: () => void seedPartial() },
        { text: OPTIONS[1], onPress: () => void seedFull() },
        { text: OPTIONS[2], style: 'destructive', onPress: () => void clearToday() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      className="absolute top-2 right-2 px-2 py-1 rounded-full bg-fill"
    >
      <Text className="text-caption2 text-ink3">seed</Text>
    </Pressable>
  );
}

async function seedPartial() {
  const now = Date.now();
  const activeRituals = await db.select().from(rituals);
  await db.insert(spendingEntries).values([
    { cents: 1400, occurredAt: now - 60 * 60 * 1000 },
    { cents: 2800, occurredAt: now },
  ]);
  await db.insert(movementEntries).values({ minutes: 35, occurredAt: now });
  for (const r of activeRituals.slice(0, Math.min(3, activeRituals.length))) {
    await db.insert(ritualEntries).values({ ritualId: r.id, occurredAt: now });
  }
}

async function seedFull() {
  const now = Date.now();
  const goalsRow = sqlite.getFirstSync<{
    daily_budget_cents: number;
    daily_move_minutes: number;
  }>(`SELECT daily_budget_cents, daily_move_minutes FROM goals WHERE id = 1`);
  if (!goalsRow) return;

  await db.insert(spendingEntries).values({
    cents: goalsRow.daily_budget_cents,
    occurredAt: now,
  });
  await db.insert(movementEntries).values({
    minutes: goalsRow.daily_move_minutes,
    occurredAt: now,
  });
  const activeRituals = await db.select().from(rituals);
  for (const r of activeRituals) {
    await db.insert(ritualEntries).values({ ritualId: r.id, occurredAt: now });
  }
}

async function clearToday() {
  const { startMs, endMs } = localDayBounds(new Date());
  await db.delete(spendingEntries).where(
    and(gte(spendingEntries.occurredAt, startMs), lt(spendingEntries.occurredAt, endMs)),
  );
  await db.delete(movementEntries).where(
    and(gte(movementEntries.occurredAt, startMs), lt(movementEntries.occurredAt, endMs)),
  );
  await db.delete(ritualEntries).where(
    and(gte(ritualEntries.occurredAt, startMs), lt(ritualEntries.occurredAt, endMs)),
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add components/StatBlock.tsx components/Fab.tsx components/DevSeedButton.tsx
git commit -m "feat(ui): StatBlock, Fab, DevSeedButton"
```

---

## Task 16: Wire the Today screen

**Files:**
- Modify: `app/(tabs)/today.tsx`

- [ ] **Step 1: Replace placeholder with real Today**

```tsx
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { eq } from 'drizzle-orm';

import { DevSeedButton } from '@/components/DevSeedButton';
import { Fab } from '@/components/Fab';
import { RingTriad } from '@/components/RingTriad';
import { StatBlock } from '@/components/StatBlock';
import { db } from '@/lib/db/client';
import {
  goals,
  rituals,
  spendingEntries,
  movementEntries,
  ritualEntries,
} from '@/lib/db/schema';
import { getTodayAggregates } from '@/lib/db/queries/today';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function dollars(cents: number) {
  return `$${Math.round(cents / 100)}`;
}

export default function TodayTab() {
  const goalsQuery       = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));
  const activeRitualsQuery = useLiveQuery(
    db.select().from(rituals).where(eq(rituals.active, true)),
  );
  const spendingQuery   = useLiveQuery(db.select().from(spendingEntries));
  const movementQuery   = useLiveQuery(db.select().from(movementEntries));
  const ritualEntriesQuery = useLiveQuery(db.select().from(ritualEntries));

  const goalsRow      = goalsQuery.data[0];
  const activeRituals = activeRitualsQuery.data;

  const aggregates = useMemo(() => {
    if (!goalsRow) return null;
    return getTodayAggregates({
      asOf: new Date(),
      goals: {
        dailyBudgetCents: goalsRow.dailyBudgetCents,
        dailyMoveMinutes: goalsRow.dailyMoveMinutes,
        dailyRitualTarget: goalsRow.dailyRitualTarget,
      },
      activeRituals,
      spending: spendingQuery.data,
      movement: movementQuery.data,
      ritualEntries: ritualEntriesQuery.data,
    });
  }, [
    goalsRow,
    activeRituals,
    spendingQuery.data,
    movementQuery.data,
    ritualEntriesQuery.data,
  ]);

  if (!goalsRow || !aggregates) {
    return <View className="flex-1 bg-bg" />;
  }

  const today = new Date();
  const datePill = `${WEEKDAYS[today.getDay()]} · ${MONTHS[today.getMonth()]} ${today.getDate()}`;

  const moneyP   = aggregates.spentCents   / Math.max(goalsRow.dailyBudgetCents, 1);
  const moveP    = aggregates.moveMinutes  / Math.max(goalsRow.dailyMoveMinutes, 1);
  const ritualsP = aggregates.activeRitualCount === 0
    ? 0
    : aggregates.ritualsDone / aggregates.activeRitualCount;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-1">
        <DevSeedButton />
        <View className="px-6 pt-4">
          <Text className="text-caption1 text-ink3">{datePill}</Text>
          <Text className="text-largeTitle text-ink mt-1">Today</Text>
        </View>
        <View className="items-center mt-6">
          <RingTriad money={moneyP} move={moveP} rituals={ritualsP} size={240} />
        </View>
        <View className="flex-row mt-10 px-4">
          <StatBlock
            label="MONEY"
            value={dollars(aggregates.spentCents)}
            goal={`/ ${dollars(goalsRow.dailyBudgetCents)}`}
            toneClass="text-money"
          />
          <StatBlock
            label="MOVE"
            value={`${aggregates.moveMinutes}`}
            goal={`/ ${goalsRow.dailyMoveMinutes} MIN`}
            toneClass="text-move"
          />
          <StatBlock
            label="RITUALS"
            value={`${aggregates.ritualsDone}`}
            goal={`/ ${aggregates.activeRitualCount}`}
            toneClass="text-rituals"
          />
        </View>
        <Fab onPress={() => console.log('Log entry — SP3b')} />
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Boot and verify visually**

Run: `npm run web`

Walk the smoke test (spec §8):
1. Fresh state: onboarding shows, complete the four steps, land on Today with three rings at 0.
2. Tap dev `seed` → "Seed today (partial)": rings animate to roughly money 33% / move 58% / rituals 60%; numbers match.
3. Tap dev `seed` → "Clear today": rings return to 0.
4. Force-reload page (or stop / start metro): land directly on Today (onboarding skipped).
5. Tab bar navigates between Today / Move / Rituals / You; only Today is wired; the FAB is only on Today.
6. FAB tap logs `Log entry — SP3b` to console.

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/today.tsx
git commit -m "feat(today): rings + stat blocks against live SQLite aggregates"
```

---

## Task 17: Final verification + status update

**Files:**
- Modify: `docs/superpowers/specs/2026-04-25-implementation-process-design.md` (status table)

- [ ] **Step 1: Run the full automated verification**

```bash
npm test
npx drizzle-kit check
```

Expected: all suites pass; drizzle-kit reports no drift.

- [ ] **Step 2: Re-run the smoke test on web** — confirm all six steps from Task 16 still pass on a clean DB. To force-reset the device DB during web dev, clear Application Storage in DevTools (or rename the DB file in `client.ts` temporarily).

- [ ] **Step 3: (Best-effort) iPhone Expo Go**

If reachable, scan the QR with Expo Go on the user's iPhone. Walk steps 1–6. If blocked (network, account), defer per SP1 precedent — note in the commit message and the meta-spec status row.

- [ ] **Step 4: Update meta-spec status row for SP3a**

Edit `docs/superpowers/specs/2026-04-25-implementation-process-design.md`. Change row 3a in the §8a status table from "⏳ Next" to:

```
| 3a | iOS v1 — data + shell | ✅ Complete YYYY-MM-DD — Drizzle schema with 5 tables, generated migrations, TDD'd aggregates + streak math, 4-step onboarding, 4-tab shell with 3 stubs, Today rings against live SQLite via useLiveQuery, dev seed flow, web verified. iPhone Expo Go [verified | deferred per SP1 precedent]. |
```

Replace `YYYY-MM-DD` with the completion date and pick one of the bracketed iPhone options.

Also flip row 3b from "Not started" to "⏳ Next".

- [ ] **Step 5: Final commit**

```bash
git add docs/superpowers/specs/2026-04-25-implementation-process-design.md
git commit -m "docs: mark SP3a complete; SP3b is next"
```

---

## Self-review checklist (already run inline; documenting for future me)

- **Spec coverage:**
  - §3 schema (5 tables) → Task 2 ✓
  - §4 migrations → Tasks 1, 2, 10 ✓
  - §5 onboarding flow + gate → Tasks 11, 13, 9 ✓
  - §6 tab shell + Today + FAB + dev seed → Tasks 12, 14, 15, 16 ✓
  - §7 TDD targets — `getTodayAggregates`, `streakForRitual`, migration parity, `finishOnboarding` → Tasks 5, 6, 7, 9 ✓
  - §8 verification → Task 17 ✓
- **Placeholders:** none — all code blocks complete.
- **Type consistency:** `getTodayAggregates`, `streakForRitual`, `finishOnboarding` signatures match between defining task and consumer task.
- **Risk fallbacks:** Skia → SVG fallback noted at the point of use (Task 14). DST tests included in Tasks 6 + 7. Drizzle Expo migrator config alternative noted in Task 10.
