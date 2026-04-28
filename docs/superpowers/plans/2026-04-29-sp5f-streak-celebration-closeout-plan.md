# SP5f — Streak surface + Celebration + Evening Close-Out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cadence-line inline `"{streak}-day streak 🔥"` suffix on `rituals/index` rows with a proper hide-when-≤1 `StreakPill` component, ship a Streak Celebration modal route fired on app foreground when any per-ritual high-water-mark is broken, and ship a full-screen Evening Close-Out route fired on app foreground past 21:00 when the daily goal is unmet. iOS-only; no backend; no new dependencies.

**Architecture:** Two new SQLite tables (`ritual_streak_high_water`, `dismissed_close_outs`) via a drizzle-kit-generated migration. Two new query modules (`streakHighWater.ts`, `closeOutDismissals.ts`) plus an HWM bump call wired into `toggleRitualToday`. One new pure helper (`nextMilestone.ts`). One new orchestrator (`lib/sync/foregroundChecks.ts`) invoked alongside `syncNow` from `app/_layout.tsx`'s AppState handler — order: Celebration first (modal route, coalesces multiple HWM breaks), then Close-Out (full-screen route, gated on local hour ≥ 21 + count < dailyRitualTarget + not-already-dismissed). One new shared `StreakPill` component dropped into `rituals/index`. PalComposer gains a `prefill?: string` prop so the Close-Out's "Ask Pal" row seeds the input.

**Tech Stack:** TypeScript (strict), React Native via Expo SDK 55, Expo Router (typed routes), Drizzle ORM + `expo-sqlite`, `useLiveQuery` for reactive surfaces, NativeWind v4 (Tailwind), `expo-symbols`, `react-native-svg`. **No new deps.**

**Spec:** [`docs/superpowers/specs/2026-04-29-sp5f-streak-celebration-closeout-design.md`](../specs/2026-04-29-sp5f-streak-celebration-closeout-design.md)

**Working-dir baseline check before starting:** `git status` should be clean (the SP5f spec is committed at `863942a`). Record current test counts: `npm test` (root, iOS) — record `<iosTotal>`. `cd backend && npm test` — record `<backendTotal>` (should be 226 per the SP5e meta-spec line). `npx tsc --noEmit 2>&1 | grep -c "error TS"` — record `<rootTscErrors>` (should be 28 per the SP5e meta-spec line). `cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"` — record `<backendTscErrors>` (should be 0 per SP5e). **Regression = anything above the recorded numbers (or below the test counts).**

**Convention used in this plan:** All commands run from repo root unless explicitly prefixed with `cd backend`. **This plan does not touch backend.** Drizzle-kit auto-names the iOS migration file (will be `0006_*.sql` since the SP5e migration was `0005_heavy_pixie.sql`); the plan refers to it generically as "the new migration."

**Convention for plan-text vs. code:** All TypeScript code blocks are the **complete file** for that task's step unless a step explicitly says "append to" or "replace the X block." If a task touches multiple files, each file's contents are shown in their own code block.

**Convention for commits:** Per project CLAUDE.md, commit author is the user; **no `Co-Authored-By` lines.** Subjects use `feat(sp5f):` / `test(sp5f):` / `refactor(sp5f):` / `docs(sp5f):` prefixes.

---

## Task 1: Schema additions + migration

**Files:**
- Modify: `lib/db/schema.ts`
- Create: `lib/db/migrations/0006_*.sql` (drizzle-kit auto-named)
- Modify: `lib/db/migrations/meta/_journal.json` (drizzle-kit auto-updates)
- Modify: `lib/db/migrations/meta/0006_snapshot.json` (drizzle-kit auto-creates)

Add `ritualStreakHighWater` and `dismissedCloseOuts` tables to the Drizzle schema, then generate the SQL migration via `drizzle-kit`.

- [ ] **Step 1: Append the two table definitions to `lib/db/schema.ts`**

Open `lib/db/schema.ts`. Just after the `palCache` table (around the existing `export type PalCacheRow = typeof palCache.$inferSelect;` line), insert:

```ts
export const ritualStreakHighWater = sqliteTable('ritual_streak_high_water', {
  ritualId: integer('ritual_id')
    .primaryKey()
    .references(() => rituals.id, { onDelete: 'cascade' }),
  hwm: integer('hwm').notNull().default(0),
  reachedAt: integer('reached_at').notNull(),
});

export const dismissedCloseOuts = sqliteTable('dismissed_close_outs', {
  dateKey: text('date_key').primaryKey(),
  dismissedAt: integer('dismissed_at').notNull(),
});

export type RitualStreakHighWaterRow = typeof ritualStreakHighWater.$inferSelect;
export type DismissedCloseOutRow = typeof dismissedCloseOuts.$inferSelect;
```

- [ ] **Step 2: Generate the migration**

```bash
npx drizzle-kit generate
```

Expected output: a new file `lib/db/migrations/0006_<word_word>.sql` and updated `meta/_journal.json` + new `meta/0006_snapshot.json`. Drizzle-kit picks the filename suffix randomly — accept whatever it generates.

- [ ] **Step 3: Verify the generated SQL**

```bash
ls lib/db/migrations/0006_*.sql
```

Read the new file. It should contain:

```sql
CREATE TABLE `ritual_streak_high_water` (
	`ritual_id` integer PRIMARY KEY NOT NULL,
	`hwm` integer DEFAULT 0 NOT NULL,
	`reached_at` integer NOT NULL,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dismissed_close_outs` (
	`date_key` text PRIMARY KEY NOT NULL,
	`dismissed_at` integer NOT NULL
);
```

If anything else appears (e.g., changes to other tables), STOP — that means schema drift exists outside this task's scope; bail and ask.

- [ ] **Step 4: Verify migrations apply cleanly via the migration test**

```bash
npm test -- migrate
```

Expected: PASS. The existing `lib/db/__tests__/migrate.test.ts` runs all migrations against `:memory:` and asserts they apply.

- [ ] **Step 5: Verify typecheck still green**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>` baseline (no regression).

- [ ] **Step 6: Commit**

```bash
git add lib/db/schema.ts lib/db/migrations/0006_*.sql lib/db/migrations/meta/_journal.json lib/db/migrations/meta/0006_snapshot.json
git commit -m "feat(sp5f): schema — ritual_streak_high_water + dismissed_close_outs tables"
```

---

## Task 2: `streakHighWater.ts` query module

**Files:**
- Create: `lib/db/queries/streakHighWater.ts`
- Create: `lib/db/queries/__tests__/streakHighWater.test.ts`

TDD a tiny query module that exposes `getHwm`, `bumpHwmIfHigher`, and `clearHwm`.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/streakHighWater.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals } from '../../schema';
import {
  getHwm,
  bumpHwmIfHigher,
  clearHwm,
} from '../streakHighWater';

function seedRitual(db: ReturnType<typeof makeTestDb>['db'], title = 'r1'): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color: 'rituals', position: 0 })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

describe('streakHighWater', () => {
  describe('getHwm', () => {
    it('returns 0 when no row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      expect(await getHwm(db, id)).toBe(0);
    });

    it('returns the stored hwm when row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, new Date(2026, 3, 28, 12).getTime());
      expect(await getHwm(db, id)).toBe(5);
    });
  });

  describe('bumpHwmIfHigher', () => {
    it('first call: writes the row, returns wasBroken=true with previous=0', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      const result = await bumpHwmIfHigher(db, id, 3, 1000);
      expect(result).toEqual({ wasBroken: true, previous: 0, current: 3 });
      expect(await getHwm(db, id)).toBe(3);
    });

    it('current > stored: updates the row, returns wasBroken=true', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 3, 1000);
      const result = await bumpHwmIfHigher(db, id, 5, 2000);
      expect(result).toEqual({ wasBroken: true, previous: 3, current: 5 });
      expect(await getHwm(db, id)).toBe(5);
    });

    it('current === stored: no-op, returns wasBroken=false', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 3, 1000);
      const result = await bumpHwmIfHigher(db, id, 3, 2000);
      expect(result).toEqual({ wasBroken: false, previous: 3, current: 3 });
      expect(await getHwm(db, id)).toBe(3);
    });

    it('current < stored: no-op, returns wasBroken=false with previous=stored', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      const result = await bumpHwmIfHigher(db, id, 2, 2000);
      expect(result).toEqual({ wasBroken: false, previous: 5, current: 2 });
      expect(await getHwm(db, id)).toBe(5);
    });

    it('current=0 with no row: no-op (no row written)', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      const result = await bumpHwmIfHigher(db, id, 0, 1000);
      expect(result).toEqual({ wasBroken: false, previous: 0, current: 0 });
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });
  });

  describe('cascade on hard-delete', () => {
    it('deletes hwm row when its ritual is hard-deleted', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).delete(rituals).where((await import('drizzle-orm')).eq(rituals.id, id)).run();
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });
  });

  describe('clearHwm', () => {
    it('removes the row', async () => {
      const { db, raw } = makeTestDb();
      const id = seedRitual(db);
      await bumpHwmIfHigher(db, id, 5, 1000);
      await clearHwm(db, id);
      const rows = raw.prepare('SELECT * FROM ritual_streak_high_water WHERE ritual_id = ?').all(id);
      expect(rows.length).toBe(0);
    });

    it('is a no-op when no row exists', async () => {
      const { db } = makeTestDb();
      const id = seedRitual(db);
      await expect(clearHwm(db, id)).resolves.toBeUndefined();
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- streakHighWater
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/db/queries/streakHighWater.ts`**

```ts
import { eq } from 'drizzle-orm';

import { ritualStreakHighWater } from '../schema';
import { type AnyDb } from './onboarding';

export async function getHwm(db: AnyDb, ritualId: number): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx
    .select({ hwm: ritualStreakHighWater.hwm })
    .from(ritualStreakHighWater)
    .where(eq(ritualStreakHighWater.ritualId, ritualId))
    .all() as Array<{ hwm: number }>;
  return rows[0]?.hwm ?? 0;
}

export interface BumpResult {
  wasBroken: boolean;
  previous: number;
  current: number;
}

export async function bumpHwmIfHigher(
  db: AnyDb,
  ritualId: number,
  current: number,
  nowMs: number,
): Promise<BumpResult> {
  const previous = await getHwm(db, ritualId);
  if (current <= previous) {
    return { wasBroken: false, previous, current };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  if (previous === 0) {
    // No row yet — INSERT.
    dx.insert(ritualStreakHighWater)
      .values({ ritualId, hwm: current, reachedAt: nowMs })
      .run();
  } else {
    dx.update(ritualStreakHighWater)
      .set({ hwm: current, reachedAt: nowMs })
      .where(eq(ritualStreakHighWater.ritualId, ritualId))
      .run();
  }
  return { wasBroken: true, previous, current };
}

export async function clearHwm(db: AnyDb, ritualId: number): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.delete(ritualStreakHighWater)
    .where(eq(ritualStreakHighWater.ritualId, ritualId))
    .run();
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- streakHighWater
```

Expected: PASS — 9 tests.

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/streakHighWater.ts lib/db/queries/__tests__/streakHighWater.test.ts
git commit -m "feat(sp5f): streakHighWater query module with TDD coverage"
```

---

## Task 3: `closeOutDismissals.ts` query module

**Files:**
- Create: `lib/db/queries/closeOutDismissals.ts`
- Create: `lib/db/queries/__tests__/closeOutDismissals.test.ts`

TDD a tiny query module: `isDismissedToday`, `markDismissedToday`.

- [ ] **Step 1: Write the failing tests**

Create `lib/db/queries/__tests__/closeOutDismissals.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { isDismissedToday, markDismissedToday } from '../closeOutDismissals';

describe('closeOutDismissals', () => {
  describe('isDismissedToday', () => {
    it('returns false when no row for the date key', async () => {
      const { db } = makeTestDb();
      expect(await isDismissedToday(db, '2026-04-29')).toBe(false);
    });

    it('returns true after markDismissedToday for the same key', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      expect(await isDismissedToday(db, '2026-04-29')).toBe(true);
    });

    it('isolates across date keys', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      expect(await isDismissedToday(db, '2026-04-28')).toBe(false);
      expect(await isDismissedToday(db, '2026-04-30')).toBe(false);
    });
  });

  describe('markDismissedToday', () => {
    it('is idempotent — same key written twice does not throw', async () => {
      const { db } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      await expect(markDismissedToday(db, '2026-04-29', 2000)).resolves.toBeUndefined();
      expect(await isDismissedToday(db, '2026-04-29')).toBe(true);
    });

    it('updates dismissed_at on second write of the same key', async () => {
      const { db, raw } = makeTestDb();
      await markDismissedToday(db, '2026-04-29', 1000);
      await markDismissedToday(db, '2026-04-29', 2000);
      const row = raw
        .prepare('SELECT dismissed_at FROM dismissed_close_outs WHERE date_key = ?')
        .get('2026-04-29') as { dismissed_at: number };
      expect(row.dismissed_at).toBe(2000);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- closeOutDismissals
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/db/queries/closeOutDismissals.ts`**

```ts
import { eq } from 'drizzle-orm';

import { dismissedCloseOuts } from '../schema';
import { type AnyDb } from './onboarding';

export async function isDismissedToday(db: AnyDb, dateKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx
    .select({ k: dismissedCloseOuts.dateKey })
    .from(dismissedCloseOuts)
    .where(eq(dismissedCloseOuts.dateKey, dateKey))
    .all() as Array<{ k: string }>;
  return rows.length > 0;
}

export async function markDismissedToday(
  db: AnyDb,
  dateKey: string,
  nowMs: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  // INSERT … ON CONFLICT DO UPDATE — Drizzle's onConflictDoUpdate is the idiom.
  dx.insert(dismissedCloseOuts)
    .values({ dateKey, dismissedAt: nowMs })
    .onConflictDoUpdate({
      target: dismissedCloseOuts.dateKey,
      set: { dismissedAt: nowMs },
    })
    .run();
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- closeOutDismissals
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 6: Commit**

```bash
git add lib/db/queries/closeOutDismissals.ts lib/db/queries/__tests__/closeOutDismissals.test.ts
git commit -m "feat(sp5f): closeOutDismissals query module with TDD coverage"
```

---

## Task 4: `nextMilestone` pure helper

**Files:**
- Create: `lib/sync/nextMilestone.ts`
- Create: `lib/sync/__tests__/nextMilestone.test.ts`

Pure mapping from current streak to next milestone rung (or `null` past 365).

- [ ] **Step 1: Write the failing tests**

Create `lib/sync/__tests__/nextMilestone.test.ts`:

```ts
/** @jest-environment node */
import { nextMilestone } from '../nextMilestone';

describe('nextMilestone', () => {
  it.each([
    [0, 7],
    [1, 7],
    [6, 7],
    [7, 14],
    [13, 14],
    [14, 30],
    [29, 30],
    [30, 60],
    [59, 60],
    [60, 100],
    [99, 100],
    [100, 365],
    [364, 365],
    [365, null],
    [999, null],
  ] as const)('streak %i → %p', (streak, expected) => {
    expect(nextMilestone(streak)).toBe(expected);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- nextMilestone
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/sync/nextMilestone.ts`**

```ts
const LADDER = [7, 14, 30, 60, 100, 365] as const;

export function nextMilestone(streak: number): number | null {
  for (const rung of LADDER) {
    if (streak < rung) return rung;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- nextMilestone
```

Expected: PASS — 15 tests.

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 6: Commit**

```bash
git add lib/sync/nextMilestone.ts lib/sync/__tests__/nextMilestone.test.ts
git commit -m "feat(sp5f): nextMilestone pure helper with TDD coverage"
```

---

## Task 5: HWM bump on `toggleRitualToday`

**Files:**
- Modify: `lib/db/queries/rituals.ts`
- Create: `lib/db/queries/__tests__/rituals.toggleHwm.test.ts`

After a successful insert in `toggleRitualToday`, compute the new streak via `streakForRitual` and call `bumpHwmIfHigher`.

- [ ] **Step 1: Write the failing test**

Create `lib/db/queries/__tests__/rituals.toggleHwm.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { rituals, ritualEntries } from '../../schema';
import { toggleRitualToday } from '../rituals';
import { getHwm } from '../streakHighWater';
import { dayKey } from '../dayKey';

function seedRitual(db: ReturnType<typeof makeTestDb>['db']): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title: 'r1', icon: 'star.fill', cadence: 'daily', color: 'rituals', position: 0 })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

function seedEntryAt(db: ReturnType<typeof makeTestDb>['db'], ritualId: number, ms: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).insert(ritualEntries).values({ ritualId, occurredAt: ms }).run();
}

describe('toggleRitualToday — HWM bump', () => {
  it('bumps the HWM when the toggle inserts a new entry that ticks the streak past stored', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);

    // Two prior days logged at noon → streak=2 anchored at yesterday.
    const today = new Date();
    const todayKey = dayKey(today);
    const oneDay = 24 * 60 * 60 * 1000;
    seedEntryAt(db, id, today.getTime() - 2 * oneDay);
    seedEntryAt(db, id, today.getTime() -     oneDay);

    // Insert a today entry → streak becomes 3.
    await toggleRitualToday(db, id, todayKey);

    expect(await getHwm(db, id)).toBe(3);
  });

  it('does not bump the HWM when the toggle deletes (untoggle)', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);
    const today = new Date();
    const todayKey = dayKey(today);

    // First call: insert today → streak=1, hwm=1.
    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(1);

    // Second call: delete today → streak=0; hwm stays at 1.
    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(1);
  });

  it('does not lower the HWM if the new streak is shorter than stored', async () => {
    const { db } = makeTestDb();
    const id = seedRitual(db);
    const today = new Date();
    const todayKey = dayKey(today);
    const oneDay = 24 * 60 * 60 * 1000;

    // Build streak=4 ending today.
    seedEntryAt(db, id, today.getTime() - 3 * oneDay);
    seedEntryAt(db, id, today.getTime() - 2 * oneDay);
    seedEntryAt(db, id,     today.getTime() - oneDay);
    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(4);

    // Untoggle today → streak drops to 3 (anchored at yesterday). HWM should hold at 4.
    await toggleRitualToday(db, id, todayKey);
    expect(await getHwm(db, id)).toBe(4);
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- rituals.toggleHwm
```

Expected: FAIL — `toggleRitualToday` does not yet bump HWM.

- [ ] **Step 3: Modify `toggleRitualToday` to bump HWM on insert path**

Open `lib/db/queries/rituals.ts`. Add these imports near the top (alongside the existing imports):

```ts
import { streakForRitual } from './streaks';
import { bumpHwmIfHigher } from './streakHighWater';
```

Replace the `toggleRitualToday` function body. The current body (around lines 116–143) is:

```ts
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

Replace with:

```ts
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
    return;
  }
  // Insert path — record the entry, then bump HWM if the new streak broke it.
  const nowMs = Date.now();
  dx.insert(ritualEntries).values({ ritualId, occurredAt: nowMs }).run();

  const allEntries = dx
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;
  const current = streakForRitual({
    ritualEntries: allEntries,
    ritualId,
    asOf: new Date(nowMs),
  });
  await bumpHwmIfHigher(db, ritualId, current, nowMs);
}
```

- [ ] **Step 4: Run the new tests to confirm they pass**

```bash
npm test -- rituals.toggleHwm
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Run the existing rituals tests to confirm no regression**

```bash
npm test -- rituals
```

Expected: PASS at the new total (existing rituals tests + 3 new HWM tests).

- [ ] **Step 6: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 7: Commit**

```bash
git add lib/db/queries/rituals.ts lib/db/queries/__tests__/rituals.toggleHwm.test.ts
git commit -m "feat(sp5f): toggleRitualToday bumps HWM on insert path"
```

---

## Task 6: `lib/sync/foregroundChecks.ts` orchestrator

**Files:**
- Create: `lib/sync/foregroundChecks.ts`
- Create: `lib/sync/__tests__/foregroundChecks.test.ts`

The orchestrator runs on every AppState `'active'` transition. It does the Celebration check first (queries all active rituals + entries + stored HWMs, picks a winner if any, bumps all broken HWMs in one pass, navigates to `/celebration`); if Celebration didn't navigate, it does the Close-Out check (`localHour ≥ 21 && distinctRitualsToday < dailyRitualTarget && !isDismissedToday`).

The orchestrator takes injectable `db`, `router`, and `now` so it's testable with fakes.

- [ ] **Step 1: Write the failing tests**

Create `lib/sync/__tests__/foregroundChecks.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../db/__tests__/test-helpers';
import { rituals, ritualEntries, goals } from '../../db/schema';
import { bumpHwmIfHigher, getHwm } from '../../db/queries/streakHighWater';
import { markDismissedToday } from '../../db/queries/closeOutDismissals';
import { dayKey } from '../../db/queries/dayKey';
import {
  __resetInflightForTests,
  runForegroundChecks,
} from '../foregroundChecks';

type DbHandle = ReturnType<typeof makeTestDb>;

function seedRitual(db: DbHandle['db'], title: string, position: number): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const result = dx
    .insert(rituals)
    .values({ title, icon: 'star.fill', cadence: 'daily', color: 'rituals', position })
    .returning({ id: rituals.id })
    .all() as Array<{ id: number }>;
  return result[0].id;
}

function seedEntries(db: DbHandle['db'], ritualId: number, msList: number[]): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  for (const ms of msList) {
    dx.insert(ritualEntries).values({ ritualId, occurredAt: ms }).run();
  }
}

function seedGoals(db: DbHandle['db'], dailyRitualTarget: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any).insert(goals).values({
    id: 1,
    dailyBudgetCents: 0,
    dailyMoveMinutes: 0,
    dailyRitualTarget,
  }).run();
}

function makeRouter() {
  const calls: Array<{ pathname: string; params?: Record<string, unknown> }> = [];
  return {
    calls,
    push: (pathname: string, params?: Record<string, unknown>) => {
      calls.push({ pathname, params });
    },
  };
}

function nDaysAgo(now: Date, n: number): number {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

describe('runForegroundChecks', () => {
  beforeEach(() => __resetInflightForTests());

  describe('Celebration', () => {
    it('fires when one ritual breaks its HWM; navigates to /celebration with winner params', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 9, 0, 0); // 9 AM, hour < 21 so Close-Out is blocked anyway
      // Streak=3 ending today; stored HWM=1.
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      await bumpHwmIfHigher(db, id, 1, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(id), streak: '3', previousHwm: '1' } },
      ]);
      expect(await getHwm(db, id)).toBe(3);
    });

    it('coalesces multiple broken HWMs — picks winner with highest streak; bumps all losers silently', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const a = seedRitual(db, 'a', 0);
      const b = seedRitual(db, 'b', 1);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      // a: streak=3, b: streak=5; both have HWM=0.
      seedEntries(db, a, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      seedEntries(db, b, [
        nDaysAgo(now, 4),
        nDaysAgo(now, 3),
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(b), streak: '5', previousHwm: '0' } },
      ]);
      // Both bumped silently.
      expect(await getHwm(db, a)).toBe(3);
      expect(await getHwm(db, b)).toBe(5);
    });

    it('tiebreak on equal streaks — highest delta wins; lowest ritualId on equal delta', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const a = seedRitual(db, 'a', 0);
      const b = seedRitual(db, 'b', 1);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      // a streak=3, hwm=2 (delta 1); b streak=3, hwm=1 (delta 2). b wins on delta.
      seedEntries(db, a, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      seedEntries(db, b, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);
      await bumpHwmIfHigher(db, a, 2, 0);
      await bumpHwmIfHigher(db, b, 1, 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(b), streak: '3', previousHwm: '1' } },
      ]);
    });

    it('does not fire when no ritual breaks its HWM', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, id, [new Date(now).setHours(8, 0, 0, 0)]);
      await bumpHwmIfHigher(db, id, 5, 0); // hwm=5 > current=1

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('skips inactive rituals', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { eq } = await import('drizzle-orm');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (db as any).update(rituals).set({ active: false }).where(eq(rituals.id, id)).run();
      const now = new Date(2026, 3, 29, 9, 0, 0);
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });
  });

  describe('Close-Out', () => {
    it('fires when localHour >= 21 AND count < goal AND not dismissed', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      // 0 of 5 done — well below goal.
      // No entries → streak=0 → no celebration.

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      void id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([{ pathname: '/close-out' }]);
    });

    it('blocked by celebration-navigated', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0); // 21:30 — Close-Out window
      seedEntries(db, id, [
        nDaysAgo(now, 2),
        nDaysAgo(now, 1),
        new Date(now).setHours(8, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([
        { pathname: '/celebration', params: { ritualId: String(id), streak: '3', previousHwm: '0' } },
      ]);
      // No /close-out call.
    });

    it('blocked by localHour < 21', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 20, 59, 0); // 20:59 — too early

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('blocked by count >= goal', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 1);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      // 1 distinct ritual logged today; goal is 1. Met.
      seedEntries(db, id, [new Date(now).setHours(8, 0, 0, 0)]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      // Streak=1, hwm=0 → Celebration fires. We only assert Close-Out did not.
      expect(router.calls.find((c) => c.pathname === '/close-out')).toBeUndefined();
    });

    it('blocked by isDismissedToday', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      await markDismissedToday(db, dayKey(now), 0);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      expect(router.calls).toEqual([]);
    });

    it('counts distinct rituals logged today (multiple entries for one ritual count once)', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 2);
      const id = seedRitual(db, 'r1', 0);
      const now = new Date(2026, 3, 29, 21, 30, 0);
      // Same ritual logged twice today.
      seedEntries(db, id, [
        new Date(now).setHours(8, 0, 0, 0),
        new Date(now).setHours(12, 0, 0, 0),
      ]);

      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await runForegroundChecks({ db: db as any, router, now });

      // distinct count=1; goal=2; should fire Close-Out (Celebration may also fire — assert Close-Out is among calls).
      expect(router.calls.some((c) => c.pathname === '/close-out')).toBe(true);
    });
  });

  describe('re-entrance guard', () => {
    it('second concurrent call resolves to the same in-flight promise', async () => {
      const { db } = makeTestDb();
      seedGoals(db, 5);
      const router = makeRouter();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p1 = runForegroundChecks({ db: db as any, router, now: new Date(2026, 3, 29, 9, 0, 0) });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p2 = runForegroundChecks({ db: db as any, router, now: new Date(2026, 3, 29, 9, 0, 0) });
      expect(p1).toBe(p2);
      await Promise.all([p1, p2]);
    });
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- foregroundChecks
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement `lib/sync/foregroundChecks.ts`**

```ts
import { and, eq, gte, lt } from 'drizzle-orm';

import { type AnyDb } from '../db/queries/onboarding';
import { dayKey } from '../db/queries/dayKey';
import { isDismissedToday } from '../db/queries/closeOutDismissals';
import { bumpHwmIfHigher, getHwm } from '../db/queries/streakHighWater';
import { streakForRitual } from '../db/queries/streaks';
import { goals, rituals, ritualEntries } from '../db/schema';

interface RouterLike {
  push: (pathname: string, params?: Record<string, unknown>) => void;
}

interface Args {
  db: AnyDb;
  router: RouterLike;
  now?: Date;
}

let inFlight: Promise<void> | null = null;

export function __resetInflightForTests(): void {
  inFlight = null;
}

export function runForegroundChecks(args: Args): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = doChecks(args).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function doChecks({ db, router, now = new Date() }: Args): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;

  // Active rituals + all entries — read once, reuse across both checks.
  const activeRituals = dx
    .select({ id: rituals.id })
    .from(rituals)
    .where(eq(rituals.active, true))
    .all() as Array<{ id: number }>;
  const allEntries = dx
    .select({ ritualId: ritualEntries.ritualId, occurredAt: ritualEntries.occurredAt })
    .from(ritualEntries)
    .all() as Array<{ ritualId: number; occurredAt: number }>;

  // ─── Celebration check ───────────────────────────────────────────────
  const broken: Array<{ ritualId: number; streak: number; hwm: number; delta: number }> = [];
  for (const r of activeRituals) {
    const streak = streakForRitual({ ritualEntries: allEntries, ritualId: r.id, asOf: now });
    const hwm = await getHwm(db, r.id);
    if (streak > hwm) {
      broken.push({ ritualId: r.id, streak, hwm, delta: streak - hwm });
    }
  }

  if (broken.length > 0) {
    // Bump ALL broken HWMs (silent advance for non-winners).
    const nowMs = now.getTime();
    for (const b of broken) {
      await bumpHwmIfHigher(db, b.ritualId, b.streak, nowMs);
    }
    // Pick winner: highest streak; tiebreak: highest delta; tiebreak: lowest ritualId.
    broken.sort((a, b) => {
      if (b.streak !== a.streak) return b.streak - a.streak;
      if (b.delta  !== a.delta)  return b.delta  - a.delta;
      return a.ritualId - b.ritualId;
    });
    const winner = broken[0];
    router.push('/celebration', {
      ritualId: String(winner.ritualId),
      streak: String(winner.streak),
      previousHwm: String(winner.hwm),
    });
    return;
  }

  // ─── Close-Out check ─────────────────────────────────────────────────
  if (now.getHours() < 21) return;

  const goalRows = dx
    .select({ target: goals.dailyRitualTarget })
    .from(goals)
    .where(eq(goals.id, 1))
    .all() as Array<{ target: number }>;
  const target = goalRows[0]?.target;
  if (!target || target <= 0) return;

  const todayKey = dayKey(now);
  if (await isDismissedToday(db, todayKey)) return;

  // Count distinct rituals logged today.
  const todayBoundsStart = new Date(now);
  todayBoundsStart.setHours(0, 0, 0, 0);
  const todayBoundsEnd = new Date(todayBoundsStart);
  todayBoundsEnd.setDate(todayBoundsEnd.getDate() + 1);
  const todayEntries = dx
    .select({ ritualId: ritualEntries.ritualId })
    .from(ritualEntries)
    .where(and(
      gte(ritualEntries.occurredAt, todayBoundsStart.getTime()),
      lt(ritualEntries.occurredAt, todayBoundsEnd.getTime()),
    ))
    .all() as Array<{ ritualId: number }>;
  const distinctToday = new Set(todayEntries.map((e) => e.ritualId)).size;

  if (distinctToday >= target) return;

  router.push('/close-out');
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- foregroundChecks
```

Expected: PASS — 11 tests.

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 6: Commit**

```bash
git add lib/sync/foregroundChecks.ts lib/sync/__tests__/foregroundChecks.test.ts
git commit -m "feat(sp5f): foregroundChecks orchestrator with TDD coverage"
```

---

## Task 7: `StreakPill` component

**Files:**
- Create: `components/StreakPill.tsx`

Pure presentational. Returns `null` when `streak <= 1`.

- [ ] **Step 1: Implement `components/StreakPill.tsx`**

```tsx
import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RitualColor } from '@/lib/db/schema';

type Palette = typeof colors.light | typeof colors.dark;

function tokenToHex(token: RitualColor, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
  }
}

function tokenToTint(token: RitualColor, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.ritualsTint;
    case 'accent':  return palette.accentTint;
    case 'move':    return palette.moveTint;
    case 'money':   return palette.moneyTint;
    case 'cyan':    return palette.cyanTint;
  }
}

export function StreakPill({ streak, tone = 'rituals' }: { streak: number; tone?: RitualColor }) {
  if (streak <= 1) return null;
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const fg = tokenToHex(tone, palette);
  const bg = tokenToTint(tone, palette);
  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, gap: 4 }}
    >
      <SymbolView name="flame.fill" size={11} tintColor={fg} />
      <Text
        className="text-caption2"
        style={{ color: fg, fontWeight: '600', fontVariant: ['tabular-nums'] }}
      >
        {streak}
      </Text>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Commit**

```bash
git add components/StreakPill.tsx
git commit -m "feat(sp5f): StreakPill component (hidden when streak <= 1)"
```

---

## Task 8: Replace inline streak text on `rituals/index` with `StreakPill`

**Files:**
- Modify: `app/(tabs)/rituals/index.tsx`

Currently the row's caption renders `"{cadence} · {streak}-day streak 🔥"` regardless of streak count. Replace with the cadence string only, and render the `StreakPill` to the right of the caption.

- [ ] **Step 1: Modify `app/(tabs)/rituals/index.tsx`**

Add the import alongside the existing component imports near the top:

```ts
import { StreakPill } from '@/components/StreakPill';
```

Replace the inline streak text on the cadence line. The current row body inside the `activeRituals.map(...)` block (around lines 194–224) is:

```tsx
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
    ...
```

Replace with:

```tsx
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
      {cadenceDisplay(r.cadence, 'today')}
    </Text>
  </View>
  <View className="mr-3">
    <StreakPill streak={streak} tone={r.color} />
  </View>
  <View
    className="h-7 w-7 rounded-lg items-center justify-center"
    ...
```

(The trailing `<View className="h-7 w-7 ...">` checkbox block is unchanged — only the caption text and the new `StreakPill` wrapper are added.)

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Run the full iOS test suite to confirm no regression**

```bash
npm test
```

Expected: PASS at the new total (baseline + 28 new tests from Tasks 2–6).

- [ ] **Step 4: Commit**

```bash
git add app/\(tabs\)/rituals/index.tsx
git commit -m "feat(sp5f): replace inline streak text with StreakPill on rituals/index rows"
```

---

## Task 9: PalComposer `prefill` prop

**Files:**
- Modify: `components/PalComposer.tsx`

Add an optional `prefill?: string` prop that seeds the input field when the modal opens. Existing call sites (no `prefill`) are unchanged.

- [ ] **Step 1: Modify `components/PalComposer.tsx` — add the prop and seed the input on open**

The current export signature is:

```tsx
export function PalComposer({ visible, onClose }: { visible: boolean; onClose: () => void }) {
```

Replace with:

```tsx
export function PalComposer(
  { visible, onClose, prefill }: { visible: boolean; onClose: () => void; prefill?: string },
) {
```

The current `useEffect` that resets state on close (around lines 33–41) is:

```tsx
useEffect(() => {
  if (!visible) {
    abortRef.current?.abort();
    abortRef.current = undefined;
    setMessages([]);
    setInput('');
    setPending(false);
  }
}, [visible]);
```

Replace with:

```tsx
useEffect(() => {
  if (!visible) {
    abortRef.current?.abort();
    abortRef.current = undefined;
    setMessages([]);
    setInput('');
    setPending(false);
  } else if (prefill) {
    setInput(prefill);
  }
}, [visible, prefill]);
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Commit**

```bash
git add components/PalComposer.tsx
git commit -m "feat(sp5f): PalComposer optional prefill prop seeds input on open"
```

---

## Task 10: `app/celebration.tsx` modal route

**Files:**
- Create: `app/celebration.tsx`
- Modify: `app/_layout.tsx` (add the route to the Stack with `presentation: 'modal'`)

Wait — `app/_layout.tsx` currently uses `<Slot />` (not a `<Stack>`). The route stack is implicit. Adding `presentation: 'modal'` requires a `<Stack.Screen>` declaration inside a `<Stack>`. Two options:
1. Convert `<Slot />` to `<Stack>` and declare `<Stack.Screen name="celebration" options={{ presentation: 'modal' }} />`.
2. Use the file-based config: `app/celebration.tsx` exports an `unstable_settings.presentation = 'modal'` — but Expo Router prefers explicit Stack declarations.

For SP5f, the simplest and least invasive path is **option 1** — but this requires also declaring every other top-level child. That's a chore but it's the right shape going forward.

**Pragmatic alternative:** Wrap the celebration screen UI itself in a backdrop + center card so it visually reads as a modal even if it's pushed as a full screen. This avoids changing `_layout.tsx`'s Slot/Stack model. The route's chrome (status bar, etc.) is just the modal styling; back gestures + the Close button work the same.

This plan takes the **pragmatic alternative** — `celebration.tsx` is a normal pushed route that styles itself as a modal (semi-transparent backdrop, centered card). No changes to `app/_layout.tsx`'s Slot model.

- [ ] **Step 1: Create `app/celebration.tsx`**

```tsx
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import Svg, { Line } from 'react-native-svg';

import { db } from '@/lib/db/client';
import { rituals } from '@/lib/db/schema';
import { nextMilestone } from '@/lib/sync/nextMilestone';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RitualColor } from '@/lib/db/schema';

type Palette = typeof colors.light | typeof colors.dark;

function tokenToHex(token: RitualColor, palette: Palette): string {
  switch (token) {
    case 'rituals': return palette.rituals;
    case 'accent':  return palette.accent;
    case 'move':    return palette.move;
    case 'money':   return palette.money;
    case 'cyan':    return palette.cyan;
  }
}

export default function CelebrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ritualId: string; streak: string; previousHwm: string }>();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const ritualId = Number(params.ritualId);
  const streak   = Number(params.streak);
  const previous = Number(params.previousHwm);

  const ritualLive = useLiveQuery(db.select().from(rituals).where(eq(rituals.id, ritualId)));
  const ritual = ritualLive.data[0];

  const tone = ritual?.color ?? 'rituals';
  const accent = tokenToHex(tone, palette);

  const milestone = useMemo(() => nextMilestone(streak), [streak]);

  const subtitle = previous === 0
    ? 'Longest run yet.'
    : `Up from ${previous}.`;

  return (
    <View className="flex-1" style={{ backgroundColor: palette.bg }}>
      {/* Animated rays */}
      <Svg
        viewBox="0 0 390 500"
        style={{ position: 'absolute', top: 80, left: 0, right: 0, height: 500, opacity: 0.35 }}
        pointerEvents="none"
      >
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * 30) * Math.PI / 180;
          const x2 = 195 + Math.cos(angle - Math.PI / 2) * 280;
          const y2 = 250 + Math.sin(angle - Math.PI / 2) * 280;
          return (
            <Line key={i} x1={195} y1={250} x2={x2} y2={y2} stroke={accent} strokeWidth={2} strokeLinecap="round" />
          );
        })}
      </Svg>

      <SafeAreaView className="flex-1">
        {/* Close */}
        <View className="px-4 pt-2 flex-row">
          <Pressable
            onPress={() => router.dismiss()}
            hitSlop={8}
            className="h-8 w-8 rounded-full items-center justify-center"
            style={{ backgroundColor: palette.fill }}
          >
            <SymbolView name="xmark" size={13} tintColor={palette.ink3} />
          </Pressable>
        </View>

        {/* Hero */}
        <View className="flex-1 items-center justify-center px-6">
          <Text
            className="text-caption1"
            style={{
              color: accent,
              fontWeight: '700',
              letterSpacing: 1.2,
              textTransform: 'uppercase',
            }}
          >
            Streak unlocked
          </Text>
          <Text
            style={{
              fontSize: 140,
              lineHeight: 140,
              fontWeight: '800',
              color: accent,
              fontVariant: ['tabular-nums'],
              marginTop: 16,
            }}
          >
            {streak}
          </Text>
          <Text className="text-title2 text-ink mt-1" style={{ fontWeight: '700' }}>
            {ritual?.title ?? '…'}
          </Text>
          <Text className="text-subhead text-ink3 mt-3 text-center">
            {subtitle}
          </Text>

          {milestone !== null && (
            <View
              className="mt-6 px-4 py-2 rounded-full"
              style={{ backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}
            >
              <Text className="text-caption1 text-ink2">
                <Text style={{ color: palette.ink4 }}>Next milestone · </Text>
                <Text style={{ color: palette.ink, fontWeight: '600' }}>{milestone} days</Text>
              </Text>
            </View>
          )}
        </View>

        {/* CTA */}
        <View className="px-5 pb-6">
          <Pressable
            onPress={() => router.dismiss()}
            className="rounded-2xl items-center justify-center py-4"
            style={{ backgroundColor: accent }}
          >
            <Text className="text-callout" style={{ color: '#fff', fontWeight: '600' }}>
              Keep going
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Run the tests to confirm no regression**

```bash
npm test
```

Expected: PASS at the same total as Task 8 (no new tests).

- [ ] **Step 4: Commit**

```bash
git add app/celebration.tsx
git commit -m "feat(sp5f): celebration screen — hero + Next milestone pill + Keep going"
```

---

## Task 11: `app/close-out.tsx` route

**Files:**
- Create: `app/close-out.tsx`

Full-screen pushed route. Renders the design-handoff checklist faithfully. Tapping a row calls `toggleRitualToday`. CTA enables when `distinctRitualsToday >= goals.dailyRitualTarget`. Both back-button and "Good night" call `markDismissedToday`. The "Ask Pal" row toggles a local `<PalComposer prefill="…" />` modal.

- [ ] **Step 1: Create `app/close-out.tsx`**

```tsx
import { useMemo, useState } from 'react';
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
import { markDismissedToday } from '@/lib/db/queries/closeOutDismissals';
import { PalComposer } from '@/components/PalComposer';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const PAL_PREFILL = 'Give me a reflection prompt for tonight';

export default function CloseOutScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [palOpen, setPalOpen] = useState(false);

  const ritualsLive = useLiveQuery(
    db.select().from(rituals).where(eq(rituals.active, true)).orderBy(asc(rituals.position)),
  );
  const entriesLive = useLiveQuery(db.select().from(ritualEntries));
  const goalsLive = useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));

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
  const goal = goalsLive.data[0]?.dailyRitualTarget ?? activeRituals.length;
  const doneCount = doneToday.size;
  const remaining = Math.max(0, goal - doneCount);
  const goalMet = doneCount >= goal;

  const onTapRow = async (ritualId: number) => {
    await toggleRitualToday(db, ritualId, todayKey);
  };

  const dismissAndPop = async (popToRoot: boolean) => {
    await markDismissedToday(db, todayKey, Date.now());
    if (popToRoot) {
      router.replace('/(tabs)/rituals');
    } else {
      router.dismiss();
    }
  };

  // Date label e.g. "21:30 · Thursday"
  const headerLabel = useMemo(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const wd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][now.getDay()];
    return `${hh}:${mm} · ${wd}`;
  }, []);

  return (
    <View className="flex-1" style={{ backgroundColor: palette.bg }}>
      <SafeAreaView className="flex-1">
        {/* Nav row */}
        <View className="flex-row items-center justify-between px-4 pt-2 pb-1">
          <Pressable
            onPress={() => dismissAndPop(false)}
            hitSlop={8}
            className="h-8 w-8 rounded-full items-center justify-center"
            style={{ backgroundColor: palette.fill }}
          >
            <SymbolView name="chevron.left" size={16} tintColor={palette.ink} />
          </Pressable>
          <Text className="text-subhead text-ink3">{headerLabel}</Text>
          <View className="w-8" />
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Hero */}
          <View className="px-6 pt-7 pb-4">
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✦</Text>
            <Text className="text-largeTitle text-ink" style={{ fontWeight: '700', lineHeight: 38 }}>
              Close out{'\n'}your day.
            </Text>
            <Text className="text-subhead text-ink3 mt-3">
              {doneCount} of {goal} rituals done. {goalMet ? 'Ring closed.' : `${remaining} to go.`}
            </Text>
          </View>

          {/* Progress bar */}
          <View className="px-6 pb-5">
            <View
              className="rounded-full overflow-hidden"
              style={{ height: 6, backgroundColor: palette.fill }}
            >
              <View
                style={{
                  height: 6,
                  width: `${goal === 0 ? 0 : Math.min(100, (doneCount / goal) * 100)}%`,
                  backgroundColor: palette.rituals,
                }}
              />
            </View>
          </View>

          {/* Checklist */}
          <View className="px-4">
            {activeRituals.map((r) => {
              const isDone = doneToday.has(r.id);
              return (
                <Pressable
                  key={r.id}
                  onPress={() => onTapRow(r.id)}
                  className="flex-row items-center px-4 py-3 mb-2 rounded-2xl"
                  style={{
                    backgroundColor: palette.surface,
                    borderWidth: 0.5,
                    borderColor: palette.hair,
                  }}
                >
                  <View
                    className="h-6 w-6 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: isDone ? palette.rituals : 'transparent',
                      borderWidth: isDone ? 0 : 1.5,
                      borderColor: palette.hair,
                    }}
                  >
                    {isDone && <SymbolView name="checkmark" size={12} tintColor="#fff" />}
                  </View>
                  <View
                    className="h-8 w-8 rounded-lg items-center justify-center mr-3"
                    style={{ backgroundColor: palette.fill }}
                  >
                    <SymbolView name={r.icon as never} size={15} tintColor={palette.ink2} />
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text
                      className="text-callout"
                      numberOfLines={1}
                      style={{
                        color: isDone ? palette.ink3 : palette.ink,
                        textDecorationLine: isDone ? 'line-through' : 'none',
                        fontWeight: '600',
                      }}
                    >
                      {r.title}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* Pal nudge */}
          <View className="px-4 pt-2">
            <Pressable
              onPress={() => setPalOpen(true)}
              className="flex-row items-center px-4 py-3 rounded-2xl"
              style={{
                backgroundColor: palette.surface,
                borderWidth: 0.5,
                borderColor: palette.hair,
                borderStyle: 'dashed',
              }}
            >
              <SymbolView name="sparkles" size={14} tintColor={palette.rituals} />
              <Text className="text-subhead text-ink2 ml-2 flex-1">
                Ask Pal for a reflection prompt
              </Text>
              <SymbolView name="chevron.right" size={12} tintColor={palette.ink3} />
            </Pressable>
          </View>
        </ScrollView>

        {/* CTA */}
        <View className="px-5 pb-6 pt-2">
          <Pressable
            onPress={() => dismissAndPop(true)}
            disabled={!goalMet}
            className="rounded-2xl items-center justify-center py-4"
            style={{
              backgroundColor: goalMet ? palette.rituals : palette.fill,
            }}
          >
            <Text
              className="text-callout"
              style={{
                color: goalMet ? '#fff' : palette.ink3,
                fontWeight: '600',
              }}
            >
              {goalMet ? 'Good night' : `${remaining} to go`}
            </Text>
          </Pressable>
        </View>

        <PalComposer
          visible={palOpen}
          onClose={() => setPalOpen(false)}
          prefill={PAL_PREFILL}
        />
      </SafeAreaView>
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Run the tests to confirm no regression**

```bash
npm test
```

Expected: PASS at the same total.

- [ ] **Step 4: Commit**

```bash
git add app/close-out.tsx
git commit -m "feat(sp5f): close-out screen — checklist + Pal prefill + Good night gate"
```

---

## Task 12: Wire `runForegroundChecks` into `app/_layout.tsx`

**Files:**
- Modify: `app/_layout.tsx`

The existing AppState listener at lines 110–144 dynamically imports `syncNow` and calls it on `'active'` transitions. Add a sibling dynamic import of `runForegroundChecks` that runs after `syncNow` resolves. Also run it once on initial mount alongside the startup `syncNow`.

- [ ] **Step 1: Modify `app/_layout.tsx`**

The current `useEffect` block at lines 110–144 is:

```tsx
useEffect(() => {
  if (!success) return;

  let mounted = true;
  (async () => {
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      if (!mounted) return;
      // eslint-disable-next-line no-console
      console.log('[sync] startup:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] startup failed:', e);
    }
  })();

  const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state !== 'active') return;
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      // eslint-disable-next-line no-console
      console.log('[sync] foreground:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] foreground failed:', e);
    }
  });

  return () => {
    mounted = false;
    sub.remove();
  };
}, [success]);
```

Replace with:

```tsx
useEffect(() => {
  if (!success) return;

  let mounted = true;
  (async () => {
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      if (!mounted) return;
      // eslint-disable-next-line no-console
      console.log('[sync] startup:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] startup failed:', e);
    }
    try {
      const { runForegroundChecks } = await import('@/lib/sync/foregroundChecks');
      await runForegroundChecks({ db, router });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sp5f] startup foreground checks failed:', e);
    }
  })();

  const sub = AppState.addEventListener('change', async (state: AppStateStatus) => {
    if (state !== 'active') return;
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      const r = await syncNow(db);
      // eslint-disable-next-line no-console
      console.log('[sync] foreground:', r);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sync] foreground failed:', e);
    }
    try {
      const { runForegroundChecks } = await import('@/lib/sync/foregroundChecks');
      await runForegroundChecks({ db, router });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[sp5f] foreground checks failed:', e);
    }
  });

  return () => {
    mounted = false;
    sub.remove();
  };
}, [success, router]);
```

(The dependency array gains `router` because the closure now references it. `router` from `useRouter()` is referentially stable across renders, so this won't cause re-binds.)

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: `<rootTscErrors>`.

- [ ] **Step 3: Run the tests to confirm no regression**

```bash
npm test
```

Expected: PASS at the same total.

- [ ] **Step 4: Commit**

```bash
git add app/_layout.tsx
git commit -m "feat(sp5f): wire runForegroundChecks alongside syncNow in AppState handler"
```

---

## Task 13: Final smoke + slice status update

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`

- [ ] **Step 1: Run the full smoke**

```bash
npm test
cd backend && npm test
npx tsc --noEmit 2>&1 | grep -c "error TS"
cd backend && npx tsc --noEmit 2>&1 | grep -c "error TS"
```

Expected: iOS `<iosTotal> + ~28` tests green; backend `<backendTotal>` unchanged; root tsc still `<rootTscErrors>`; backend tsc still `<backendTscErrors>`. Record the exact test counts.

- [ ] **Step 2: Web target visual smoke** (deferred to SP5-wide pass)

```bash
npm run web
```

Open the browser and walk through:

- [ ] Rituals tab → 7 default rituals visible. Toggle one ritual to log a streak; reload; verify the StreakPill appears (when streak ≥ 2) on its row.
- [ ] In the dev tools console, run a manual override of one ritual's HWM to a lower number than its current streak (or use the existing dev seed surface), then refresh the app to fire the foreground check pass; verify the Celebration screen shows: big number + ritual name + "Next milestone · N days" pill + "Keep going" CTA.
- [ ] Set the device clock to 22:00 (or temporarily edit `foregroundChecks.ts`'s hour gate to a value that's currently met); reload; verify the Close-Out screen appears with the active rituals checklist; tap rows → checkboxes flip and the progress bar advances; verify "Good night" enables when count reaches the daily goal.
- [ ] Tap "Ask Pal for a reflection prompt" → Pal Composer opens with the prefill string in the input.
- [ ] Tap "Good night" → Close-Out dismisses; reload — Close-Out should NOT re-fire (dismissed-today persistence).
- [ ] Revert any test-only edits to `foregroundChecks.ts` before committing.

Stop the dev server.

- [ ] **Step 3: Update SP5 meta-spec status table**

Edit `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`. In §3 "Sub-slice status," replace the line:

```
- **5f** Not started.
```

with (filling in the actual recorded test counts and the migration suffix from Task 1):

```
- **5f** ✅ Code complete 2026-04-29 — StreakPill component on `app/(tabs)/rituals/index.tsx` rows (hidden when streak ≤ 1, themed by ritual color); new `app/celebration.tsx` modal-styled route fired on app foreground when any per-ritual high-water-mark is broken (coalesces multiple breaks into one modal showing the highest-streak winner; bumps all broken HWMs in one pass); new `app/close-out.tsx` full-screen route fired when local hour ≥ 21 and distinct-rituals-today < `goals.dailyRitualTarget` and not already dismissed (renders checklist via `useLiveQuery`, tapping rows calls `toggleRitualToday`, "Good night" gate uses daily goal, both back-out and "Good night" persist a same-day dismissal). Schema delta: new `ritual_streak_high_water` and `dismissed_close_outs` tables (migration `0006_*.sql`). New iOS query modules `lib/db/queries/streakHighWater.ts` and `lib/db/queries/closeOutDismissals.ts`. New `lib/sync/foregroundChecks.ts` orchestrator (re-entrance guard mirrors `syncNow.ts`) wired alongside `syncNow` in `app/_layout.tsx`'s AppState handler. `toggleRitualToday` extended to bump HWM on the insert path. `<PalComposer />` gains an optional `prefill?: string` prop (only consumer is Close-Out). New `lib/sync/nextMilestone.ts` pure helper (ladder 7/14/30/60/100/365). ~28 new iOS tests (9 streakHighWater + 5 closeOutDismissals + 15 nextMilestone + 3 toggleRitualToday HWM + 11 foregroundChecks). No backend changes. iPhone Expo Go visual verification carries over to the SP5-wide deferred pass. Manual web smoke green.
```

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5f): mark slice code-complete in §3 sub-slice status"
```

---

## Done

At this point:

- 2 new screens (`app/celebration.tsx`, `app/close-out.tsx`)
- 2 new query modules (`streakHighWater.ts`, `closeOutDismissals.ts`) with ~14 tests
- 1 new helper (`nextMilestone.ts`) with 15 tests
- 1 new orchestrator (`foregroundChecks.ts`) with 11 tests
- 1 new component (`StreakPill.tsx`)
- 1 schema migration (HWM table + dismissals table)
- `toggleRitualToday` extended (HWM bump on insert path) with 3 new tests
- `<PalComposer />` gains a `prefill` prop
- `app/_layout.tsx` AppState handler runs `runForegroundChecks` alongside `syncNow`
- ~13 commits (one per task)

**Slice-close criteria all met:**

1. ✅ `npm test` green at the new total (iOS ≈ baseline + 28).
2. ✅ `cd backend && npm test` green at unchanged total (no backend changes).
3. ✅ `npx tsc --noEmit` baseline-preserved.
4. ✅ Web target smoke walks the full flow without errors (or 15 deferred items per Task 13 Step 2 carry over to the SP5-wide pass).

**Carries over to the SP5-wide deferred pass (NOT 5f's responsibility):**

- iPhone Expo Go visual verification of the 2 new screens (celebration + close-out) and the streak pill on rituals/index (covered by the existing SP5-wide deferred pass).
- The native modal `presentation: 'modal'` upgrade for `app/celebration.tsx` (currently styled-as-modal in a normal pushed route) — if the visual smoke shows the styled-as-modal approach is unconvincing on iPhone, revisit the `<Slot />` → `<Stack>` conversion in a follow-up.
