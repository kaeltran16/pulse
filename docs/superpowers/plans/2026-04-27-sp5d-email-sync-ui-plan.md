# SP5d — iOS Email Sync UI + Subscriptions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the iOS surface that closes the email-sync chain — replace the `You` tab stub with a sectioned Settings landing, ship Email Sync screens (Intro / Connect / Dashboard / Allowlist) and a Subscriptions screen, all on top of SP5c's existing `lib/sync/` client.

**Architecture:** New route group `app/(tabs)/you/` (replaces the single-file `you.tsx`) with a nested `email-sync/` stack. One new query module `lib/db/queries/syncedEntries.ts` providing `recentSynced`, `syncedStats`, `subscriptionList`. Two new hooks: `useImapStatus` (server-state fetcher driven by mount + AppState foreground + after-sync) and `useRelativeTime` (pure client-side 60s tick). One new utility: `categoryColor` (category → theme-token map for the Subscriptions stacked bar). All screens use NativeWind `className=` styling per the project's stack memory; transient feedback uses `useState + setTimeout` chips; confirmations use `Alert.alert`.

**Tech Stack:** TypeScript (strict), React Native via Expo SDK 55, Expo Router (file-based routing), Drizzle ORM + `expo-sqlite`, `useLiveQuery` for reactive local-DB surfaces, NativeWind v4 (Tailwind), `react-native-safe-area-context`, vitest/jest test runner already configured. **No new deps.**

**Spec:** [`docs/superpowers/specs/2026-04-27-sp5d-email-sync-ui-design.md`](../specs/2026-04-27-sp5d-email-sync-ui-design.md)

**Working-dir baseline check before starting:** `git status` should be clean (the SP5d spec is committed at `05ba3e1`). `npm test` (root, iOS) should be green at the existing count (~331 tests). `npx tsc --noEmit` should be clean. Record both numbers before starting; any regression after a task means stop and investigate before moving on.

**Convention used in this plan:** All commands run from the repo root unless explicitly prefixed with `cd backend`. There is **no backend work in this plan** — every task is iOS-only.

---

## Task 1: Scaffold the `you/` route group

**Files:**
- Delete: `app/(tabs)/you.tsx`
- Create: `app/(tabs)/you/_layout.tsx`
- Create: `app/(tabs)/you/index.tsx`
- Create: `app/(tabs)/you/email-sync/_layout.tsx`

- [x] **Step 1: Delete the existing `you.tsx` stub**

```bash
git rm app/(tabs)/you.tsx
```

- [x] **Step 2: Create the You stack layout**

Create `app/(tabs)/you/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function YouLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 3: Create a placeholder index that proves the route resolves**

Create `app/(tabs)/you/index.tsx`:

```tsx
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function YouTabLanding() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-4 py-6">
        <Text className="text-largeTitle text-ink">You</Text>
      </View>
    </SafeAreaView>
  );
}
```

- [x] **Step 4: Create the nested email-sync stack layout**

Create `app/(tabs)/you/email-sync/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';

export default function EmailSyncLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [x] **Step 5: Verify typecheck + tests still green**

```bash
npx tsc --noEmit
npm test
```

Expected: tsc clean; test count unchanged (~331).

- [x] **Step 6: Commit**

```bash
git add app/(tabs)/you/_layout.tsx app/(tabs)/you/index.tsx app/(tabs)/you/email-sync/_layout.tsx
git commit -m "feat(sp5d): scaffold You route group with nested email-sync stack"
```

---

## Task 2: `useRelativeTime` hook

**Files:**
- Create: `lib/sync/useRelativeTime.ts`

This is a pure UI helper (no network, no DB). No tests — covered by visual smoke. Lives in `lib/sync/` because it's used only by the Sync card.

- [x] **Step 1: Implement the hook**

Create `lib/sync/useRelativeTime.ts`:

```ts
import { useEffect, useState } from 'react';

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function formatRelative(timestamp: number, now: number): string {
  const diff = Math.max(0, now - timestamp);
  if (diff < MIN) return 'just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MIN);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return h === 1 ? '1 hr ago' : `${h} hrs ago`;
  }
  const d = Math.floor(diff / DAY);
  return d === 1 ? '1 day ago' : `${d} days ago`;
}

/**
 * Returns a relative-time string ("4 min ago") that re-renders on a 60s timer.
 * Returns null when timestamp is null/undefined.
 */
export function useRelativeTime(timestamp: number | null | undefined): string | null {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);
  if (timestamp == null) return null;
  return formatRelative(timestamp, Date.now());
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Commit**

```bash
git add lib/sync/useRelativeTime.ts
git commit -m "feat(sp5d): useRelativeTime hook with 60s tick"
```

---

## Task 3: `categoryColor` map

**Files:**
- Create: `lib/sync/categoryColor.ts`

- [x] **Step 1: Implement the map**

Create `lib/sync/categoryColor.ts`:

```ts
/**
 * Maps a /parse-emitted spending category to a theme color token name (Tailwind suffix).
 * Used by the Subscriptions stacked bar (SubscriptionsScreen) to color per-merchant segments.
 * Returns 'fill' as the fallback for null / unknown categories.
 */
export function categoryToToken(category: string | null | undefined): string {
  if (!category) return 'fill';
  switch (category) {
    case 'Subscriptions':
    case 'Music':
    case 'Video':
    case 'AI':
    case 'News':
      return 'rituals';
    case 'Storage':
    case 'Work':
      return 'accent';
    case 'Fitness':
    case 'Transit':
      return 'move';
    case 'Food & Drink':
    case 'Groceries':
      return 'money';
    default:
      return 'fill';
  }
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Commit**

```bash
git add lib/sync/categoryColor.ts
git commit -m "feat(sp5d): categoryColor map for Subscriptions stacked bar"
```

---

## Task 4: TDD `recentSynced` query

**Files:**
- Create: `lib/db/queries/syncedEntries.ts`
- Create: `lib/db/queries/__tests__/syncedEntries.test.ts`

- [x] **Step 1: Write the failing tests for `recentSynced`**

Create `lib/db/queries/__tests__/syncedEntries.test.ts`:

```ts
/** @jest-environment node */
import { makeTestDb } from '../../__tests__/test-helpers';
import { insertSyncedBatch } from '../insertSyncedEntry';
import { recentSynced } from '../syncedEntries';

const sample = (id: number, occurredAt: number, recurring = false) => ({
  id,
  merchant: `Merchant ${id}`,
  cents: 100 * id,
  currency: 'USD',
  category: 'Food',
  occurredAt,
  recurring,
  emailFrom: 'alerts@bank.com',
});

describe('recentSynced', () => {
  it('returns at most `limit` rows', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 2_000),
      sample(3, 3_000),
      sample(4, 4_000),
    ]);
    const rows = recentSynced(db, 2);
    expect(rows).toHaveLength(2);
  });

  it('orders by occurred_at desc', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 3_000),
      sample(3, 2_000),
    ]);
    const rows = recentSynced(db, 10);
    expect(rows.map((r) => r.syncedEntryId)).toEqual([2, 3, 1]);
  });

  it('excludes hand-logged entries (synced_entry_id IS NULL)', () => {
    const { db, raw } = makeTestDb();
    raw.prepare(
      `INSERT INTO spending_entries (cents, occurred_at, note) VALUES (500, 5000, 'cash coffee')`,
    ).run();
    insertSyncedBatch(db, [sample(1, 1_000)]);
    const rows = recentSynced(db, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0].syncedEntryId).toBe(1);
  });

  it('returns [] on empty table', () => {
    const { db } = makeTestDb();
    expect(recentSynced(db, 10)).toEqual([]);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- syncedEntries
```

Expected: FAIL — "recentSynced is not a function" (module doesn't exist yet).

- [x] **Step 3: Implement `recentSynced`**

Create `lib/db/queries/syncedEntries.ts`:

```ts
import { sql, isNotNull, desc } from 'drizzle-orm';

import { spendingEntries } from '../schema';
import { type AnyDb } from './onboarding';

export type SyncedRow = {
  id: number;
  cents: number;
  merchant: string | null;
  category: string | null;
  currency: string;
  recurring: boolean;
  occurredAt: number;
  syncedEntryId: number;
};

export function recentSynced(db: AnyDb, limit = 6): SyncedRow[] {
  const rows = db
    .select({
      id: spendingEntries.id,
      cents: spendingEntries.cents,
      merchant: spendingEntries.merchant,
      category: spendingEntries.category,
      currency: spendingEntries.currency,
      recurring: spendingEntries.recurring,
      occurredAt: spendingEntries.occurredAt,
      syncedEntryId: spendingEntries.syncedEntryId,
    })
    .from(spendingEntries)
    .where(isNotNull(spendingEntries.syncedEntryId))
    .orderBy(desc(spendingEntries.occurredAt))
    .limit(limit)
    .all() as Array<SyncedRow & { syncedEntryId: number | null }>;
  return rows.filter((r): r is SyncedRow => r.syncedEntryId !== null);
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- syncedEntries
```

Expected: 4 tests PASS.

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/syncedEntries.ts lib/db/queries/__tests__/syncedEntries.test.ts
git commit -m "feat(sp5d): recentSynced query with TDD coverage"
```

---

## Task 5: TDD `syncedStats` query

**Files:**
- Modify: `lib/db/queries/syncedEntries.ts`
- Modify: `lib/db/queries/__tests__/syncedEntries.test.ts`

- [x] **Step 1: Append failing tests for `syncedStats`**

Append to `lib/db/queries/__tests__/syncedEntries.test.ts`:

```ts
import { syncedStats } from '../syncedEntries';

describe('syncedStats', () => {
  it('thisMonth counts only current local-month rows', () => {
    const { db } = makeTestDb();
    const now = new Date();
    const thisMonthTs = new Date(now.getFullYear(), now.getMonth(), 15, 12).getTime();
    const lastMonthTs = new Date(now.getFullYear(), now.getMonth() - 1, 15, 12).getTime();
    insertSyncedBatch(db, [
      sample(1, thisMonthTs),
      sample(2, thisMonthTs),
      sample(3, lastMonthTs),
    ]);
    expect(syncedStats(db).thisMonth).toBe(2);
  });

  it('thisMonth boundary case: row at 23:59:59 on last day of prior month is excluded', () => {
    const { db } = makeTestDb();
    const now = new Date();
    const lastDayPriorMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    insertSyncedBatch(db, [sample(1, lastDayPriorMonth)]);
    expect(syncedStats(db).thisMonth).toBe(0);
  });

  it('allTime counts all synced rows regardless of date', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      sample(1, 1_000),
      sample(2, 2_000_000_000_000),
    ]);
    expect(syncedStats(db).allTime).toBe(2);
  });

  it('recurringMerchants = COUNT DISTINCT merchant', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix' },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
      { ...sample(3, 3_000, true), merchant: 'Spotify' },
      { ...sample(4, 4_000, false), merchant: 'OnceOff' },
      { ...sample(5, 5_000, true), merchant: null },
    ]);
    expect(syncedStats(db).recurringMerchants).toBe(2);
  });

  it('excludes hand-logged from all three counts', () => {
    const { db, raw } = makeTestDb();
    raw.prepare(
      `INSERT INTO spending_entries (cents, occurred_at, note, recurring) VALUES (500, 5000, 'cash', 1)`,
    ).run();
    expect(syncedStats(db)).toEqual({ thisMonth: 0, allTime: 0, recurringMerchants: 0 });
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- syncedEntries
```

Expected: FAIL — "syncedStats is not a function".

- [x] **Step 3: Implement `syncedStats`**

Append to `lib/db/queries/syncedEntries.ts`:

```ts
export type SyncedStats = {
  thisMonth: number;
  allTime: number;
  recurringMerchants: number;
};

function startOfMonthLocalMs(now: Date): number {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
}

export function syncedStats(db: AnyDb, now: Date = new Date()): SyncedStats {
  const startMs = startOfMonthLocalMs(now);
  const dx = db as unknown as { run: (q: unknown) => unknown; all: (q: unknown) => Array<{ n?: number }> };
  const all = dx.all(sql`
    SELECT
      (SELECT COUNT(*) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL AND occurred_at >= ${startMs}) AS thisMonth,
      (SELECT COUNT(*) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL) AS allTime,
      (SELECT COUNT(DISTINCT merchant) FROM spending_entries
        WHERE synced_entry_id IS NOT NULL AND recurring = 1 AND merchant IS NOT NULL) AS recurringMerchants
  `) as Array<{ thisMonth: number; allTime: number; recurringMerchants: number }>;
  const row = all[0] ?? { thisMonth: 0, allTime: 0, recurringMerchants: 0 };
  return {
    thisMonth: Number(row.thisMonth) || 0,
    allTime: Number(row.allTime) || 0,
    recurringMerchants: Number(row.recurringMerchants) || 0,
  };
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- syncedEntries
```

Expected: 9 tests PASS (4 from Task 4 + 5 new).

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/syncedEntries.ts lib/db/queries/__tests__/syncedEntries.test.ts
git commit -m "feat(sp5d): syncedStats query with TDD coverage"
```

---

## Task 6: TDD `subscriptionList` query

**Files:**
- Modify: `lib/db/queries/syncedEntries.ts`
- Modify: `lib/db/queries/__tests__/syncedEntries.test.ts`

- [x] **Step 1: Append failing tests for `subscriptionList`**

Append to `lib/db/queries/__tests__/syncedEntries.test.ts`:

```ts
import { subscriptionList, MS_PER_DAY_30 } from '../syncedEntries';

describe('subscriptionList', () => {
  it('groups multiple receipts per merchant into one entry', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix', cents: 1599 },
      { ...sample(2, 2_000, true), merchant: 'Netflix', cents: 1599 },
      { ...sample(3, 3_000, true), merchant: 'Spotify', cents: 1099 },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant).sort()).toEqual(['Netflix', 'Spotify']);
  });

  it('lastCents = cents of the most recent occurrence', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix', cents: 1499 },
      { ...sample(2, 2_000, true), merchant: 'Netflix', cents: 1599 },
    ]);
    const rows = subscriptionList(db);
    expect(rows).toHaveLength(1);
    expect(rows[0].lastCents).toBe(1599);
    expect(rows[0].monthlyAmountCents).toBe(1599);
  });

  it('lastSeenAt = max(occurred_at) per merchant', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: 'Netflix' },
      { ...sample(2, 5_000, true), merchant: 'Netflix' },
      { ...sample(3, 3_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows[0].lastSeenAt).toBe(5_000);
  });

  it('predictedNextChargeAt = lastSeenAt + 30 days', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows[0].predictedNextChargeAt).toBe(1_000_000 + MS_PER_DAY_30);
  });

  it('sorts by predictedNextChargeAt ASC', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 5_000, true), merchant: 'A' },
      { ...sample(2, 1_000, true), merchant: 'B' },
      { ...sample(3, 3_000, true), merchant: 'C' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['B', 'C', 'A']);
  });

  it('excludes recurring=0 merchants', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, false), merchant: 'OnceOff' },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['Netflix']);
  });

  it('excludes merchant=NULL', () => {
    const { db } = makeTestDb();
    insertSyncedBatch(db, [
      { ...sample(1, 1_000, true), merchant: null },
      { ...sample(2, 2_000, true), merchant: 'Netflix' },
    ]);
    const rows = subscriptionList(db);
    expect(rows.map((r) => r.merchant)).toEqual(['Netflix']);
  });
});
```

- [x] **Step 2: Run the tests to confirm they fail**

```bash
npm test -- syncedEntries
```

Expected: FAIL — "subscriptionList is not a function" / "MS_PER_DAY_30 is not exported".

- [x] **Step 3: Implement `subscriptionList`**

Append to `lib/db/queries/syncedEntries.ts`:

```ts
export const MS_PER_DAY_30 = 30 * 24 * 60 * 60 * 1000;

export type SubscriptionGroup = {
  merchant: string;
  category: string | null;
  currency: string;
  lastCents: number;
  lastSeenAt: number;
  count: number;
  monthlyAmountCents: number;
  predictedNextChargeAt: number;
};

export function subscriptionList(db: AnyDb): SubscriptionGroup[] {
  const dx = db as unknown as { all: (q: unknown) => Array<{
    merchant: string;
    category: string | null;
    currency: string;
    lastCents: number;
    lastSeenAt: number;
    count: number;
  }> };
  const rows = dx.all(sql`
    SELECT
      se.merchant AS merchant,
      MAX(se.occurred_at) AS lastSeenAt,
      COUNT(*) AS count,
      MAX(se.currency) AS currency,
      (SELECT inner1.cents FROM spending_entries inner1
         WHERE inner1.merchant = se.merchant
           AND inner1.synced_entry_id IS NOT NULL
           AND inner1.recurring = 1
         ORDER BY inner1.occurred_at DESC LIMIT 1) AS lastCents,
      (SELECT inner2.category FROM spending_entries inner2
         WHERE inner2.merchant = se.merchant
           AND inner2.synced_entry_id IS NOT NULL
           AND inner2.recurring = 1
         ORDER BY inner2.occurred_at DESC LIMIT 1) AS category
    FROM spending_entries se
    WHERE se.synced_entry_id IS NOT NULL
      AND se.recurring = 1
      AND se.merchant IS NOT NULL
    GROUP BY se.merchant
    ORDER BY lastSeenAt ASC
  `);
  return rows.map((r) => ({
    merchant: r.merchant,
    category: r.category,
    currency: r.currency,
    lastCents: Number(r.lastCents),
    lastSeenAt: Number(r.lastSeenAt),
    count: Number(r.count),
    monthlyAmountCents: Number(r.lastCents),
    predictedNextChargeAt: Number(r.lastSeenAt) + MS_PER_DAY_30,
  }));
}
```

- [x] **Step 4: Run the tests to confirm they pass**

```bash
npm test -- syncedEntries
```

Expected: 16 tests PASS (4 + 5 + 7 new).

- [x] **Step 5: Commit**

```bash
git add lib/db/queries/syncedEntries.ts lib/db/queries/__tests__/syncedEntries.test.ts
git commit -m "feat(sp5d): subscriptionList query with TDD coverage"
```

---

## Task 7: `useImapStatus` hook

**Files:**
- Create: `lib/sync/useImapStatus.ts`

This hook owns the dashboard's server-state surface (per spec §3.5). No tests — AppState wiring isn't unit-testable in this codebase (mirrors existing `app/_layout.tsx` AppState wiring which is also untested); covered by visual smoke.

- [x] **Step 1: Implement the hook**

Create `lib/sync/useImapStatus.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { imapStatus } from './client';
import type { ImapStatusResponse } from './types';

export type UseImapStatusResult = {
  status: ImapStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Fetches /imap/status on mount, on AppState 'active' transitions, and on demand
 * via refetch(). Screens that own a syncNow() trigger should call refetch() after
 * the sync resolves to update server-state surfaces (status pill, lastPolledAt).
 */
export function useImapStatus(): UseImapStatusResult {
  const [status, setStatus] = useState<ImapStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await imapStatus();
      if (mounted.current) setStatus(r);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refetch();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void refetch();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [refetch]);

  return { status, isLoading, error, refetch };
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Commit**

```bash
git add lib/sync/useImapStatus.ts
git commit -m "feat(sp5d): useImapStatus hook (mount + foreground + on-demand)"
```

---

## Task 8: YouTabLanding skeleton with disabled rows

**Files:**
- Modify: `app/(tabs)/you/index.tsx`

This task builds the full sectioned-list UI with all rows visible-but-disabled. Tasks 9–10 wire the two functional rows (Email sync, Subscriptions) on top of this scaffold.

- [x] **Step 1: Replace placeholder with the sectioned list**

Replace `app/(tabs)/you/index.tsx` with:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Row = {
  key: string;
  icon: string;
  iconBg: string;
  title: string;
  value?: string;
  disabled?: boolean;
  onPress?: () => void;
};

type Section = { title: string; rows: Row[] };

function ListRow({ row, isLast, palette }: { row: Row; isLast: boolean; palette: typeof colors.light }) {
  const muted = row.disabled === true;
  return (
    <Pressable
      onPress={muted ? undefined : row.onPress}
      disabled={muted}
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair, opacity: muted ? 0.55 : 1 }}
    >
      <View
        className="h-8 w-8 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: row.iconBg }}
      >
        <SymbolView name={row.icon as never} size={16} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">{row.title}</Text>
      {row.value !== undefined && (
        <Text className="text-callout text-ink3 mr-1">{row.value}</Text>
      )}
      {!muted && <Text className="text-ink4">›</Text>}
    </Pressable>
  );
}

export default function YouTabLanding() {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const sections: Section[] = [
    {
      title: 'Reviews',
      rows: [
        { key: 'weekly', icon: 'calendar', iconBg: palette.rituals, title: 'Weekly review', value: 'Coming soon', disabled: true },
        { key: 'monthly', icon: 'chart.bar.fill', iconBg: palette.accent, title: 'Monthly review', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Money',
      rows: [
        { key: 'bills', icon: 'house.fill', iconBg: palette.accent, title: 'Bills', value: 'Coming soon', disabled: true },
        { key: 'subscriptions', icon: 'repeat', iconBg: palette.rituals, title: 'Subscriptions', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Integrations',
      rows: [
        { key: 'email-sync', icon: 'tray.fill', iconBg: palette.accent, title: 'Email sync', value: 'Not connected', disabled: true },
      ],
    },
    {
      title: 'Data',
      rows: [
        { key: 'stats', icon: 'chart.bar.fill', iconBg: palette.move, title: 'All stats', value: 'Coming soon', disabled: true },
        { key: 'export', icon: 'tray.fill', iconBg: '#8E8E93', title: 'Export data', value: 'Coming soon', disabled: true },
        { key: 'notif', icon: 'bell.fill', iconBg: '#FF9500', title: 'Notifications', value: 'Coming soon', disabled: true },
      ],
    },
    {
      title: 'Account',
      rows: [
        { key: 'settings', icon: 'gearshape.fill', iconBg: '#8E8E93', title: 'Settings', value: 'Coming soon', disabled: true },
        { key: 'help', icon: 'heart.fill', iconBg: '#FF3B30', title: 'Help & feedback', value: 'Coming soon', disabled: true },
      ],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-4 py-3">
          <Text className="text-largeTitle text-ink">You</Text>
        </View>
        {sections.map((s) => (
          <View key={s.title} className="px-3 pb-4">
            <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">{s.title}</Text>
            <View className="rounded-xl bg-surface overflow-hidden">
              {s.rows.map((row, i) => (
                <ListRow key={row.key} row={row} isLast={i === s.rows.length - 1} palette={palette} />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Run web target to visually confirm**

```bash
npm run web
```

Open the You tab in the browser. Expected: sectioned list renders with all rows greyed; no taps respond. Stop the dev server.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/index.tsx
git commit -m "feat(sp5d): You tab landing skeleton with disabled scaffold rows"
```

---

## Task 9: Wire functional Email-sync row

**Files:**
- Modify: `app/(tabs)/you/index.tsx`

- [x] **Step 1: Replace the disabled email-sync row with a status-driven implementation**

In `app/(tabs)/you/index.tsx`, add at top:

```tsx
import { useRouter } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { useImapStatus } from '@/lib/sync/useImapStatus';
```

Replace the entire `Integrations` section construction so it reads from `useImapStatus`:

```tsx
const router = useRouter();
const { status, isLoading } = useImapStatus();

const emailSyncPill = (() => {
  if (isLoading || status === null) return { text: '—', color: palette.ink4, kind: 'loading' as const };
  if (!status.connected) return { text: 'Not connected', color: palette.ink3, kind: 'idle' as const };
  if (status.status === 'active') return { text: 'Gmail · On', color: palette.move, kind: 'idle' as const };
  if (status.status === 'paused') return { text: 'Paused', color: palette.money, kind: 'idle' as const };
  return { text: 'Error', color: '#FF3B30', kind: 'idle' as const };
})();

const onTapEmailSync = () => {
  if (emailSyncPill.kind === 'loading') return;
  if (status && status.connected) {
    router.push('/(tabs)/you/email-sync/dashboard');
  } else {
    router.push('/(tabs)/you/email-sync/intro');
  }
};
```

Then in the `sections` definition, change the Integrations section to:

```tsx
{
  title: 'Integrations',
  rows: [
    {
      key: 'email-sync',
      icon: 'tray.fill',
      iconBg: palette.accent,
      title: 'Email sync',
      // value rendered via custom pill below; using value field would lose color
      disabled: emailSyncPill.kind === 'loading',
      onPress: onTapEmailSync,
    },
  ],
},
```

And update `ListRow` to accept an optional `valueElement` prop and render the colored pill for this row:

```tsx
type Row = {
  key: string;
  icon: string;
  iconBg: string;
  title: string;
  value?: string;
  valueElement?: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
};
```

Inside `ListRow`, replace the `{row.value !== undefined && ...}` block with:

```tsx
{row.valueElement ?? (row.value !== undefined && (
  <Text className="text-callout text-ink3 mr-1">{row.value}</Text>
))}
```

Pass `valueElement` for the Email sync row:

```tsx
{
  key: 'email-sync',
  icon: 'tray.fill',
  iconBg: palette.accent,
  title: 'Email sync',
  valueElement: emailSyncPill.kind === 'loading'
    ? <ActivityIndicator size="small" color={palette.ink3} style={{ marginRight: 4 }} />
    : <Text className="text-callout mr-1" style={{ color: emailSyncPill.color }}>{emailSyncPill.text}</Text>,
  disabled: emailSyncPill.kind === 'loading',
  onPress: onTapEmailSync,
},
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Verify tests still green**

```bash
npm test
```

Expected: no regression (~16 + existing).

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/index.tsx
git commit -m "feat(sp5d): wire functional Email sync row with status pill"
```

---

## Task 10: Wire functional Subscriptions row

**Files:**
- Modify: `app/(tabs)/you/index.tsx`

- [x] **Step 1: Add live monthly total to the Subscriptions row**

In `app/(tabs)/you/index.tsx`, add imports:

```tsx
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { spendingEntries } from '@/lib/db/schema';
import { subscriptionList } from '@/lib/db/queries/syncedEntries';
```

Add inside the component, near the `useImapStatus` call:

```tsx
const subsLiveQuery = useLiveQuery(db.select().from(spendingEntries));
const subsMonthly = (() => {
  // Recompute on any spending_entries change.
  void subsLiveQuery.data;
  const groups = subscriptionList(db);
  const total = groups.reduce((s, g) => s + g.monthlyAmountCents, 0);
  return { count: groups.length, total };
})();
```

Replace the Subscriptions row in the `Money` section:

```tsx
{
  key: 'subscriptions',
  icon: 'repeat',
  iconBg: palette.rituals,
  title: 'Subscriptions',
  value: subsMonthly.count === 0 ? 'None yet' : `$${(subsMonthly.total / 100).toFixed(0)}/mo`,
  onPress: () => router.push('/(tabs)/you/subscriptions'),
},
```

(Bills row stays disabled.)

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean. (`Subscriptions` route is created in Task 24; for now `router.push` will resolve at runtime — that's fine, web smoke covers it after Task 24.)

- [x] **Step 3: Verify tests still green**

```bash
npm test
```

Expected: no regression.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/index.tsx
git commit -m "feat(sp5d): wire functional Subscriptions row with live monthly total"
```

---

## Task 11: `EmailSyncIntroScreen`

**Files:**
- Create: `app/(tabs)/you/email-sync/intro.tsx`

- [x] **Step 1: Build the screen**

Create `app/(tabs)/you/email-sync/intro.tsx`:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const STEPS = [
  { icon: 'bell.fill', tone: 'money', title: 'Your bank sends alerts', sub: '"You spent $12.40 at Blue Bottle" — most cards do this' },
  { icon: 'magnifyingglass', tone: 'accent', title: 'Pal reads only those', sub: 'Filtered by sender list before anything is parsed' },
  { icon: 'sparkles', tone: 'rituals', title: 'It lands on Today', sub: 'Categorized, deduped, tagged as synced' },
] as const;

export default function EmailSyncIntroScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} className="flex-row items-center" hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ You</Text>
          </Pressable>
        </View>

        <View className="px-6 pt-2 pb-6 items-center">
          <View
            className="h-28 w-28 rounded-3xl items-center justify-center mb-5"
            style={{ backgroundColor: palette.accentTint }}
          >
            <SymbolView name="tray.fill" size={48} tintColor={palette.accent} />
          </View>
          <Text className="text-title1 text-ink text-center" style={{ lineHeight: 32 }}>
            Stop logging card{'\n'}charges by hand.
          </Text>
          <Text className="text-subhead text-ink2 text-center mt-3">
            Connect your inbox with a read-only app password. Pal scans for bank alert emails in the background and drops them on your timeline — categorized, deduped, silent.
          </Text>
        </View>

        <View className="px-3 pb-4">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">How it works</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            {STEPS.map((step, i) => {
              const tone = palette[step.tone];
              const tint =
                step.tone === 'money' ? palette.moneyTint :
                step.tone === 'accent' ? palette.accentTint : palette.ritualsTint;
              return (
                <View
                  key={i}
                  className="flex-row px-4 py-3"
                  style={{ borderBottomWidth: i === STEPS.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: tint }}>
                    <SymbolView name={step.icon as never} size={16} tintColor={tone} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-callout text-ink">{step.title}</Text>
                    <Text className="text-caption1 text-ink3 mt-1">{step.sub}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View className="px-4 pb-4">
          <View className="rounded-xl p-3" style={{ backgroundColor: palette.accentTint, borderWidth: 0.5, borderColor: palette.accent + '33' }}>
            <Text className="text-caption1 text-ink2">
              <Text className="text-ink">App password, not your real one. </Text>
              You generate a disposable password in your email settings — Pal stores it encrypted at rest on our server. Revoke it anytime from Gmail without touching anything else.
            </Text>
          </View>
        </View>

        <View className="px-4 pt-2">
          <Pressable
            onPress={() => router.push('/(tabs)/you/email-sync/connect')}
            className="rounded-2xl py-4 items-center"
            style={{ backgroundColor: palette.ink }}
          >
            <Text className="text-headline" style={{ color: palette.bg }}>Set up Gmail sync</Text>
          </Pressable>
          <Text className="text-caption1 text-ink4 text-center mt-2">iCloud, Outlook, any IMAP coming</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Web smoke**

```bash
npm run web
```

You tab → "Email sync" → Intro renders. Tapping "Set up Gmail sync" 404s for now (Connect screen is Task 12). Stop dev server.

- [x] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/email-sync/intro.tsx
git commit -m "feat(sp5d): EmailSyncIntroScreen with copy amendment per meta-spec §2 row 3"
```

---

## Task 12: `EmailSyncConnectScreen` — form structure

**Files:**
- Create: `app/(tabs)/you/email-sync/connect.tsx`

This task builds the form skeleton (fields, layout, advanced section). Tasks 13–14 wire submit + error mapping.

- [x] **Step 1: Build the screen scaffold**

Create `app/(tabs)/you/email-sync/connect.tsx`:

```tsx
import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function EmailSyncConnectScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const canSave = email.trim().length > 3 && password.trim().length > 3;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>Cancel</Text>
          </Pressable>
          <Text className="text-headline text-ink">Gmail setup</Text>
          <Pressable
            onPress={() => { /* wired in Task 13 */ }}
            disabled={!canSave}
            hitSlop={8}
          >
            <Text
              className="text-callout"
              style={{ color: canSave ? palette.accent : palette.ink4, fontWeight: '600' }}
            >
              Save
            </Text>
          </Pressable>
        </View>

        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Account</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <View className="flex-row items-center px-4 py-3" style={{ borderBottomWidth: 0.5, borderBottomColor: palette.hair }}>
              <Text className="text-callout text-ink2 w-24">Email</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@gmail.com"
                placeholderTextColor={palette.ink4}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
            <View className="flex-row items-center px-4 py-3">
              <Text className="text-callout text-ink2 w-24">App password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="xxxx xxxx xxxx xxxx"
                placeholderTextColor={palette.ink4}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                className="flex-1 text-callout text-ink text-right"
              />
            </View>
          </View>
          <Text className="text-caption1 text-ink3 mt-1 px-1">
            Use the Gmail address whose inbox contains your bank alert emails.
          </Text>
        </View>

        <View className="px-3 pb-2">
          <View className="rounded-xl bg-surface p-3">
            <Text className="text-caption1 text-ink uppercase mb-2">Generate a Gmail app password</Text>
            <Text className="text-caption1 text-ink2" style={{ lineHeight: 18 }}>
              1. Turn on 2-Step Verification in your Google Account.{'\n'}
              2. Open <Text style={{ color: palette.accent }}>myaccount.google.com/apppasswords</Text>.{'\n'}
              3. Create an app password labeled "Pulse" — paste the 16 characters above.
            </Text>
          </View>
        </View>

        <View className="px-3 pb-2">
          <Pressable
            onPress={() => setAdvancedOpen((v) => !v)}
            className="rounded-xl bg-surface px-4 py-3 flex-row items-center"
          >
            <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: palette.fill }}>
              <SymbolView name="gearshape.fill" size={14} tintColor={palette.ink2} />
            </View>
            <View className="flex-1">
              <Text className="text-callout text-ink">IMAP server</Text>
              <Text className="text-caption1 text-ink3 mt-1">imap.gmail.com · port 993 · SSL</Text>
            </View>
            <Text className="text-ink4">{advancedOpen ? '▾' : '›'}</Text>
          </Pressable>
          {advancedOpen && (
            <View className="rounded-xl bg-surface mt-2 overflow-hidden">
              {[
                { label: 'Host', value: 'imap.gmail.com' },
                { label: 'Port', value: '993' },
                { label: 'Encryption', value: 'SSL / TLS' },
              ].map((row, i, arr) => (
                <View
                  key={row.label}
                  className="flex-row items-center px-4 py-3"
                  style={{ borderBottomWidth: i === arr.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <Text className="text-callout text-ink2 w-24">{row.label}</Text>
                  <Text className="flex-1 text-callout text-ink3 text-right">{row.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Web smoke**

```bash
npm run web
```

Navigate to Connect via Intro. Form renders, fields accept input, advanced disclosure expands. Save button is grey when fields empty, blue when filled. Tap Save → no-op (next task wires it). Stop dev server.

- [x] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/email-sync/connect.tsx
git commit -m "feat(sp5d): EmailSyncConnectScreen form scaffold (no submit yet)"
```

---

## Task 13: Connect — wire submit, success path, `already_connected`

**Files:**
- Modify: `app/(tabs)/you/email-sync/connect.tsx`

- [x] **Step 1: Add submit handler with success path**

In `connect.tsx`, add imports (only what Task 13 needs — Task 14 adds the error classes):

```tsx
import { ActivityIndicator } from 'react-native';

import { imapConnect } from '@/lib/sync/client';
```

Add state + handler inside the component, replacing the empty `onPress`:

```tsx
const [submitting, setSubmitting] = useState(false);
const [bannerError, setBannerError] = useState<string | null>(null);

const onSave = async () => {
  if (!canSave || submitting) return;
  setBannerError(null);
  setSubmitting(true);
  try {
    await imapConnect({ email: email.trim(), appPassword: password.trim() });
    router.replace('/(tabs)/you/email-sync/dashboard');
  } catch (e) {
    // Generic fallback — Task 14 replaces this with full mapping + already_connected branch.
    setBannerError(e instanceof Error ? e.message : 'Something went wrong.');
  } finally {
    setSubmitting(false);
  }
};
```

Render a temporary banner above the Account section so the bannerError state has a UI surface (Task 14 replaces this with the full banner component):

```tsx
{bannerError && (
  <View className="px-3 pt-1 pb-2">
    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#FF3B3014', borderWidth: 0.5, borderColor: '#FF3B3033' }}>
      <Text className="text-callout" style={{ color: '#FF3B30' }}>{bannerError}</Text>
    </View>
  </View>
)}
```

Update the Save header button:

```tsx
<Pressable
  onPress={onSave}
  disabled={!canSave || submitting}
  hitSlop={8}
>
  {submitting ? (
    <ActivityIndicator size="small" color={palette.accent} />
  ) : (
    <Text
      className="text-callout"
      style={{ color: canSave ? palette.accent : palette.ink4, fontWeight: '600' }}
    >
      Save
    </Text>
  )}
</Pressable>
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Verify tests still green**

```bash
npm test
```

Expected: no regression.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/email-sync/connect.tsx
git commit -m "feat(sp5d): wire Connect submit with success-path replace to dashboard"
```

---

## Task 14: Connect — inline error banner with mapping

**Files:**
- Modify: `app/(tabs)/you/email-sync/connect.tsx`

- [x] **Step 1: Import error classes + Linking**

In `connect.tsx`, add imports:

```tsx
import { Linking } from 'react-native';

import { ValidationError, AuthError, NetworkError, RateLimitError, UpstreamError } from '@/lib/sync/errors';
```

- [x] **Step 2: Add an error-mapping helper**

Add above `EmailSyncConnectScreen`:

```tsx
type BannerSpec = { copy: string; cta?: { label: string; onPress: () => void } } | null;

function mapConnectError(e: unknown): BannerSpec {
  // imap_auth_failed comes back as ValidationError per lib/sync/client.ts mapHttpError
  // (status 400 → ValidationError). The message string contains "imap_auth_failed"
  // when the backend rejects the credentials. We branch on message contents.
  if (e instanceof ValidationError) {
    const msg = (e.message ?? '').toLowerCase();
    if (msg.includes('imap_auth_failed') || msg.includes('app password') || msg.includes('credentials')) {
      return {
        copy: 'Wrong app password — Gmail rejected it.',
        cta: {
          label: 'Generate a new one →',
          onPress: () => { void Linking.openURL('https://myaccount.google.com/apppasswords'); },
        },
      };
    }
    if (msg.includes('already_connected')) {
      // Caller should instead route to dashboard; treat as a sentinel.
      return null;
    }
    return { copy: 'Check the email format and try again.' };
  }
  if (e instanceof RateLimitError) return { copy: 'Too many attempts. Wait a moment, then try again.' };
  if (e instanceof NetworkError)   return { copy: "Couldn't reach the server. Check your connection." };
  if (e instanceof AuthError)      return { copy: 'Server error. Try again.' };
  if (e instanceof UpstreamError)  return { copy: 'Server error. Try again.' };
  return { copy: 'Something went wrong. Try again.' };
}
```

- [x] **Step 3: Update the submit handler**

Replace the existing `onSave` body:

```tsx
const onSave = async () => {
  if (!canSave || submitting) return;
  setBannerError(null);
  setSubmitting(true);
  try {
    await imapConnect({ email: email.trim(), appPassword: password.trim() });
    router.replace('/(tabs)/you/email-sync/dashboard');
  } catch (e) {
    if (e instanceof ValidationError && (e.message ?? '').toLowerCase().includes('already_connected')) {
      router.replace('/(tabs)/you/email-sync/dashboard');
      return;
    }
    setBanner(mapConnectError(e));
  } finally {
    setSubmitting(false);
  }
};
```

Replace the `bannerError` state with a richer banner state:

```tsx
const [submitting, setSubmitting] = useState(false);
const [banner, setBanner] = useState<BannerSpec>(null);
```

Render the banner above the Account section (insert after the nav row, before the Account section):

```tsx
{banner && (
  <View className="px-3 pt-1 pb-2">
    <View className="rounded-xl px-4 py-3" style={{ backgroundColor: '#FF3B3014', borderWidth: 0.5, borderColor: '#FF3B3033' }}>
      <Text className="text-callout" style={{ color: '#FF3B30' }}>{banner.copy}</Text>
      {banner.cta && (
        <Pressable onPress={banner.cta.onPress} className="mt-2">
          <Text className="text-callout" style={{ color: palette.accent, fontWeight: '600' }}>{banner.cta.label}</Text>
        </Pressable>
      )}
    </View>
  </View>
)}
```

- [x] **Step 4: Remove the now-superseded `bannerError` state and its temporary banner**

Delete the `bannerError` state declaration from Task 13 (`const [bannerError, setBannerError] = useState<string | null>(null);`) and the temporary banner JSX block from Task 13 (the one rendered when `bannerError` is set). The new `banner` state and richer banner JSX above replace both.

- [x] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 6: Commit**

```bash
git add app/(tabs)/you/email-sync/connect.tsx
git commit -m "feat(sp5d): Connect inline error banner with mapped copy + linking CTA"
```

---

## Task 15: Dashboard skeleton — Sync card + status pill + relative time

**Files:**
- Create: `app/(tabs)/you/email-sync/dashboard.tsx`

This task builds the Dashboard up to the Sync card. Stats tiles, Pal card, Recently synced, settings, disconnect, sync-now, error banner ship in Tasks 16–22.

- [x] **Step 1: Build the skeleton**

Create `app/(tabs)/you/email-sync/dashboard.tsx`:

```tsx
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { useImapStatus } from '@/lib/sync/useImapStatus';
import { useRelativeTime } from '@/lib/sync/useRelativeTime';

export default function EmailSyncDashboard() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { status, isLoading } = useImapStatus();
  const lastPolledStr = useRelativeTime(status?.connected ? status.lastPolledAt : null);

  // If status confirms disconnected, bounce to Intro.
  useEffect(() => {
    if (!isLoading && status && !status.connected) {
      router.replace('/(tabs)/you/email-sync/intro');
    }
  }, [isLoading, status, router]);

  if (isLoading || !status || !status.connected) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center">
          <Text className="text-callout text-ink3">Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pillColor =
    status.status === 'active' ? palette.move :
    status.status === 'paused' ? palette.money : '#FF3B30';
  const pillText =
    status.status === 'active' ? 'Connected' :
    status.status === 'paused' ? 'Paused' : 'Error';

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="flex-row items-center px-3 py-3">
          <Text
            className="text-callout"
            style={{ color: palette.accent }}
            onPress={() => router.replace('/(tabs)/you')}
          >
            ‹ You
          </Text>
        </View>

        <View className="px-4 pt-1 pb-2">
          <Text className="text-largeTitle text-ink">Email sync</Text>
        </View>

        <View className="px-3 pb-3">
          <View className="rounded-2xl bg-surface p-4" style={{ borderWidth: 0.5, borderColor: palette.hair }}>
            <View className="flex-row items-center">
              <View className="h-10 w-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: palette.accentTint }}>
                <Text className="text-callout">📧</Text>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center">
                  <Text className="text-callout text-ink" numberOfLines={1}>{status.emailAddress}</Text>
                  <View
                    className="rounded-full px-2 py-0.5 ml-2"
                    style={{ backgroundColor: pillColor + '22' }}
                  >
                    <Text className="text-caption2" style={{ color: pillColor, fontWeight: '600' }}>{pillText}</Text>
                  </View>
                </View>
                <Text className="text-caption1 text-ink3 mt-1">
                  {lastPolledStr ? `Last sync ${lastPolledStr}` : 'Waiting for first sync…'}
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Web smoke**

```bash
npm run web
```

Tap the You tab → "Email sync" row routes to either Intro (if not connected) or Dashboard (if connected). Without a real connected account in the local DB, this lands on Intro. To smoke the Dashboard skeleton, you can temporarily simulate by hitting the route directly: navigate to `/you/email-sync/dashboard` in the browser URL — you'll see the loading state, then the bounce to Intro. Stop dev server.

- [x] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): EmailSyncDashboard skeleton with Sync card + relative time"
```

---

## Task 16: Dashboard — stats tiles

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Add live-query stats**

In `dashboard.tsx`, add imports:

```tsx
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { spendingEntries } from '@/lib/db/schema';
import { syncedStats } from '@/lib/db/queries/syncedEntries';
```

Inside the component, after the `useImapStatus` line:

```tsx
const liveSpending = useLiveQuery(db.select().from(spendingEntries));
const stats = (() => {
  void liveSpending.data; // re-run on any change
  return syncedStats(db);
})();
```

After the Sync card `View`, append:

```tsx
<View className="px-3 pb-3">
  <View
    className="rounded-2xl bg-surface flex-row"
    style={{ borderWidth: 0.5, borderColor: palette.hair, paddingVertical: 16 }}
  >
    {[
      { label: 'This month', value: stats.thisMonth, color: palette.accent },
      { label: 'All time',   value: stats.allTime,   color: palette.money  },
      { label: 'Recurring',  value: stats.recurringMerchants, color: palette.rituals },
    ].map((tile, i, arr) => (
      <View
        key={tile.label}
        className="flex-1 items-center"
        style={{ borderRightWidth: i === arr.length - 1 ? 0 : 0.5, borderRightColor: palette.hair }}
      >
        <Text className="text-title2" style={{ color: tile.color, fontWeight: '700' }}>{tile.value}</Text>
        <Text className="text-caption2 text-ink3 mt-1">{tile.label}</Text>
      </View>
    ))}
  </View>
</View>
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard stats tiles via useLiveQuery"
```

---

## Task 17: Dashboard — Recently synced list

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Add Recently-synced section**

Add import:

```tsx
import { recentSynced, type SyncedRow } from '@/lib/db/queries/syncedEntries';
```

Inside component, after the `stats` derivation:

```tsx
const recent = (() => {
  void liveSpending.data;
  return recentSynced(db, 6);
})();
```

After the stats tiles `View`, append:

```tsx
<View className="px-3 pb-3">
  <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Recently synced</Text>
  <View className="rounded-xl bg-surface overflow-hidden">
    {recent.length === 0 ? (
      <View className="px-4 py-6 items-center">
        <Text className="text-callout text-ink3 text-center">
          No receipts yet — most banks send within ~24h.
        </Text>
      </View>
    ) : (
      recent.map((row, i) => (
        <RecentRow key={row.id} row={row} isLast={i === recent.length - 1} palette={palette} />
      ))
    )}
  </View>
</View>
```

Define `RecentRow` above `EmailSyncDashboard`:

```tsx
function RecentRow({ row, isLast, palette }: { row: SyncedRow; isLast: boolean; palette: typeof colors.light }) {
  const dollars = `−$${(row.cents / 100).toFixed(2)}`;
  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair }}
    >
      <View className="flex-1 min-w-0">
        <Text className="text-callout text-ink" numberOfLines={1}>{row.merchant ?? 'Unknown merchant'}</Text>
        <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
          {row.category ?? 'Uncategorized'}
        </Text>
      </View>
      <Text className="text-callout text-ink ml-3">{dollars}</Text>
    </View>
  );
}
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard Recently synced list with empty-state placeholder"
```

---

## Task 18: Dashboard — Pal-noticed card

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Compute monthly total + render the Pal card**

Add import:

```tsx
import { subscriptionList } from '@/lib/db/queries/syncedEntries';
```

Inside component, after `recent`:

```tsx
const palCard = (() => {
  void liveSpending.data;
  const groups = subscriptionList(db);
  if (groups.length === 0) return null;
  const total = groups.reduce((s, g) => s + g.monthlyAmountCents, 0);
  return { count: groups.length, totalDollars: Math.round(total / 100) };
})();
```

After the stats tiles `View` and BEFORE the Recently-synced section, insert:

```tsx
{palCard && (
  <View className="px-3 pb-3">
    <View
      className="rounded-2xl p-4"
      style={{ backgroundColor: palette.accentTint, borderWidth: 0.5, borderColor: palette.accent + '22' }}
    >
      <Text className="text-caption2 uppercase mb-1" style={{ color: palette.accent, fontWeight: '700', letterSpacing: 0.5 }}>
        ✨ Pal noticed
      </Text>
      <Text className="text-callout text-ink">
        You have <Text style={{ fontWeight: '700' }}>{palCard.count} recurring subscription{palCard.count === 1 ? '' : 's'}</Text> totaling ${palCard.totalDollars}/mo.
      </Text>
      <Pressable
        className="mt-3 rounded-full self-start px-3 py-1.5"
        style={{ backgroundColor: palette.accent }}
        onPress={() => router.push('/(tabs)/you/subscriptions')}
      >
        <Text className="text-caption1" style={{ color: '#fff', fontWeight: '600' }}>Review subscriptions</Text>
      </Pressable>
    </View>
  </View>
)}
```

Add `Pressable` to the imports if not already present.

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard Pal-noticed card (hidden when count=0)"
```

---

## Task 19: Dashboard — Sync settings list

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Add the settings list section**

After the Recently-synced section, append:

```tsx
<View className="px-3 pb-3">
  <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Sync settings</Text>
  <View className="rounded-xl bg-surface overflow-hidden">
    <SettingsRow
      icon="arrow.triangle.2.circlepath"
      iconBg={palette.accent}
      title="Background sync"
      value={`Every ${Math.round(status.pollIntervalSeconds / 60)} min`}
      palette={palette}
      isLast={false}
    />
    <SettingsRow
      icon="bell.fill"
      iconBg="#FF9500"
      title="Notify on new detection"
      value="Off"
      palette={palette}
      isLast={false}
    />
    <SettingsRow
      icon="sparkles"
      iconBg={palette.rituals}
      title="Pal auto-categorize"
      value="On"
      palette={palette}
      isLast={false}
    />
    <SettingsRow
      icon="magnifyingglass"
      iconBg={palette.money}
      title="Detected senders"
      value={`${status.senderAllowlist.length}`}
      onPress={() => router.push('/(tabs)/you/email-sync/senders')}
      palette={palette}
      isLast
    />
  </View>
</View>
```

Define `SettingsRow` above `EmailSyncDashboard`:

```tsx
function SettingsRow({
  icon, iconBg, title, value, onPress, palette, isLast,
}: {
  icon: string;
  iconBg: string;
  title: string;
  value: string;
  onPress?: () => void;
  palette: typeof colors.light;
  isLast: boolean;
}) {
  const interactive = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair }}
    >
      <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: iconBg }}>
        <SymbolView name={icon as never} size={14} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">{title}</Text>
      <Text className="text-callout text-ink3 mr-1">{value}</Text>
      {interactive && <Text className="text-ink4">›</Text>}
    </Pressable>
  );
}
```

Add `SymbolView` to imports:

```tsx
import { SymbolView } from 'expo-symbols';
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard Sync settings list (Detected senders interactive only)"
```

---

## Task 20: Dashboard — error/paused banner

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Render banner above the Sync card when status is non-active**

Inside the connected branch return, immediately before the Sync card section:

```tsx
{(status.status === 'error' || status.status === 'paused') && (
  <View className="px-3 pb-2">
    <View
      className="rounded-xl px-4 py-3"
      style={{
        backgroundColor: status.status === 'error' ? '#FF3B3014' : palette.moneyTint,
        borderWidth: 0.5,
        borderColor: status.status === 'error' ? '#FF3B3033' : palette.money + '33',
      }}
    >
      <Text className="text-callout text-ink">
        {status.status === 'error'
          ? "Couldn't connect to Gmail — your app password may have been revoked."
          : 'Sync paused after repeated failures.'}
      </Text>
      <Pressable
        onPress={() => router.replace('/(tabs)/you/email-sync/connect')}
        className="mt-2"
      >
        <Text className="text-callout" style={{ color: palette.accent, fontWeight: '600' }}>Reconnect</Text>
      </Pressable>
    </View>
  </View>
)}
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard error/paused banner with Reconnect CTA"
```

---

## Task 21: Dashboard — Sync now button + transient feedback chip

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Add Sync-now state + handler**

Add imports:

```tsx
import { useState } from 'react';

import { db } from '@/lib/db/client';
import { syncNow } from '@/lib/sync/syncNow';
import { AuthError } from '@/lib/sync/errors';
```

(Skip duplicates — the `db` import already exists from Task 16; `useState` may already be in. Keep imports tidy.)

Update the existing `useImapStatus()` destructure (added in Task 15) to expose `refetch`. Find the line:

```tsx
const { status, isLoading } = useImapStatus();
```

and change it to:

```tsx
const { status, isLoading, refetch } = useImapStatus();
```

Do **not** call `useImapStatus()` a second time — each call creates its own state.

Add state and handler:

```tsx
const [syncing, setSyncing] = useState(false);
const [chip, setChip] = useState<string | null>(null);

const showChip = (msg: string) => {
  setChip(msg);
  setTimeout(() => setChip(null), 2000);
};

const onSyncNow = async () => {
  if (syncing) return;
  setSyncing(true);
  try {
    const r = await syncNow(db);
    showChip(r.inserted === 0
      ? 'Up to date.'
      : `Synced ${r.inserted} new entr${r.inserted === 1 ? 'y' : 'ies'}.`);
  } catch (e) {
    if (e instanceof AuthError) {
      router.replace('/(tabs)/you/email-sync/intro');
      return;
    }
    showChip('Sync failed — pull to refresh.');
  } finally {
    setSyncing(false);
    void refetch();
  }
};
```

Add a Sync-now button at the bottom of the Sync card (inside the Sync card View, after the existing flex-row block):

```tsx
<View className="flex-row mt-3">
  <Pressable
    onPress={onSyncNow}
    disabled={syncing}
    className="flex-1 rounded-xl py-3 items-center justify-center"
    style={{ backgroundColor: syncing ? palette.fill : palette.ink }}
  >
    <Text className="text-callout" style={{ color: syncing ? palette.ink2 : palette.bg, fontWeight: '600' }}>
      {syncing ? 'Syncing…' : 'Sync now'}
    </Text>
  </Pressable>
</View>
{chip && (
  <View className="mt-2 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: palette.fill }}>
    <Text className="text-caption1 text-ink2">{chip}</Text>
  </View>
)}
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard Sync now button with transient feedback chip"
```

---

## Task 22: Dashboard — Disconnect button with Alert

**Files:**
- Modify: `app/(tabs)/you/email-sync/dashboard.tsx`

- [x] **Step 1: Add Disconnect button**

Add imports:

```tsx
import { Alert } from 'react-native';

import { imapDisconnect } from '@/lib/sync/client';
```

Inside the component:

```tsx
const onDisconnect = () => {
  Alert.alert(
    'Disconnect Gmail?',
    'Synced receipts will stay on your device. You can reconnect anytime.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          try {
            await imapDisconnect();
          } catch (e) {
            // 404/not-connected → treat as success.
            const msg = e instanceof Error ? e.message.toLowerCase() : '';
            if (!msg.includes('not_connected') && !msg.includes('not connected')) {
              showChip("Couldn't disconnect — try again.");
              return;
            }
          }
          router.replace('/(tabs)/you/email-sync/intro');
        },
      },
    ],
    { cancelable: true },
  );
};
```

After the Sync settings list section (or wherever you'd like the action — keep it as the last section before scroll-end):

```tsx
<View className="px-3 pt-2 pb-6">
  <Pressable onPress={onDisconnect} className="items-center py-3">
    <Text className="text-callout" style={{ color: '#FF3B30', fontWeight: '500' }}>Disconnect Gmail</Text>
  </Pressable>
</View>
```

- [x] **Step 2: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/dashboard.tsx
git commit -m "feat(sp5d): Dashboard Disconnect button with Alert confirmation"
```

---

## Task 23: `AllowlistScreen`

**Files:**
- Create: `app/(tabs)/you/email-sync/senders.tsx`

- [x] **Step 1: Build the screen**

Create `app/(tabs)/you/email-sync/senders.tsx`:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { useImapStatus } from '@/lib/sync/useImapStatus';

export default function AllowlistScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { status, isLoading } = useImapStatus();

  const allowlist = status?.connected ? status.senderAllowlist : [];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ Email sync</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-1 pb-2">
          <Text className="text-largeTitle text-ink">Detected senders</Text>
          <Text className="text-subhead text-ink3 mt-1">
            Pal only reads emails from these addresses or domains.
          </Text>
        </View>

        <View className="px-3 pt-2 pb-2">
          <View className="rounded-xl bg-surface overflow-hidden">
            {isLoading ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-callout text-ink3">Loading…</Text>
              </View>
            ) : allowlist.length === 0 ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-callout text-ink3 text-center">No senders configured.</Text>
              </View>
            ) : (
              allowlist.map((sender, i) => (
                <View
                  key={sender}
                  className="px-4 py-3"
                  style={{ borderBottomWidth: i === allowlist.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <Text className="text-callout text-ink">{sender}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View className="px-4 pt-2">
          <Text className="text-caption1 text-ink3" style={{ lineHeight: 18 }}>
            To edit, disconnect and reconnect with a different list.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: clean.

- [x] **Step 3: Commit**

```bash
git add app/(tabs)/you/email-sync/senders.tsx
git commit -m "feat(sp5d): AllowlistScreen (read-only list from imapStatus)"
```

---

## Task 24: `SubscriptionsScreen`

**Files:**
- Create: `app/(tabs)/you/subscriptions.tsx`

- [x] **Step 1: Build the screen**

Create `app/(tabs)/you/subscriptions.tsx`:

```tsx
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { db } from '@/lib/db/client';
import { spendingEntries } from '@/lib/db/schema';
import { subscriptionList, type SubscriptionGroup } from '@/lib/db/queries/syncedEntries';
import { categoryToToken } from '@/lib/sync/categoryColor';
import { syncNow } from '@/lib/sync/syncNow';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(ts: number, now: number): number {
  return Math.max(0, Math.round((ts - now) / MS_PER_DAY));
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const live = useLiveQuery(db.select().from(spendingEntries));
  const [chip, setChip] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Recompute on every change.
  void live.data;
  const groups: SubscriptionGroup[] = subscriptionList(db);
  const monthlyTotalCents = groups.reduce((s, g) => s + g.monthlyAmountCents, 0);
  const yearlyTotalCents = monthlyTotalCents * 12;
  const now = Date.now();
  const nextUp = groups.length > 0 ? groups[0] : null;

  const onScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const r = await syncNow(db);
      setChip(r.inserted === 0 ? 'Up to date.' : `Synced ${r.inserted} new.`);
    } catch {
      setChip('Sync failed — try again.');
    } finally {
      setScanning(false);
      setTimeout(() => setChip(null), 2000);
    }
  };

  const tokenBg = (token: string) => {
    switch (token) {
      case 'rituals': return palette.rituals;
      case 'accent':  return palette.accent;
      case 'move':    return palette.move;
      case 'money':   return palette.money;
      default:        return palette.fill;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ Back</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-1 pb-3">
          <Text className="text-largeTitle text-ink">Subscriptions</Text>
          <Text className="text-subhead text-ink3 mt-1">Auto-detected from your email</Text>
        </View>

        {groups.length === 0 ? (
          <View className="px-6 py-12 items-center">
            <Text className="text-callout text-ink3 text-center">
              Pal will list recurring charges here once it's seen them ≥2× in 60 days.
            </Text>
          </View>
        ) : (
          <>
            <View className="px-3 pb-3">
              <View className="rounded-2xl bg-surface p-4">
                <Text
                  className="text-caption2 uppercase mb-1"
                  style={{ color: palette.money, fontWeight: '700', letterSpacing: 0.5 }}
                >
                  Monthly
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-title1 text-ink" style={{ fontWeight: '700' }}>
                    ${(monthlyTotalCents / 100).toFixed(2)}
                  </Text>
                  <Text className="text-subhead text-ink3 ml-2">
                    · ${Math.round(yearlyTotalCents / 100)}/yr
                  </Text>
                </View>
                <View
                  className="mt-3 h-2 rounded-full overflow-hidden flex-row"
                  style={{ backgroundColor: palette.fill }}
                >
                  {groups.map((g, i) => {
                    const pct = (g.monthlyAmountCents / monthlyTotalCents) * 100;
                    return (
                      <View
                        key={g.merchant}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: tokenBg(categoryToToken(g.category)),
                          borderRightWidth: i === groups.length - 1 ? 0 : 1,
                          borderRightColor: palette.bg,
                        }}
                      />
                    );
                  })}
                </View>
                {nextUp && (
                  <Text className="text-caption1 text-ink2 mt-3">
                    Next up: <Text className="text-ink" style={{ fontWeight: '600' }}>{nextUp.merchant}</Text> in {daysUntil(nextUp.predictedNextChargeAt, now)} days · ${(nextUp.monthlyAmountCents / 100).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            <View className="px-4 pb-2">
              <Text className="text-headline text-ink">Upcoming</Text>
            </View>
            <View className="px-3">
              <View className="rounded-xl bg-surface overflow-hidden">
                {groups.map((g, i) => {
                  const days = daysUntil(g.predictedNextChargeAt, now);
                  const tokenColor = tokenBg(categoryToToken(g.category));
                  return (
                    <View
                      key={g.merchant}
                      className="flex-row items-center px-4 py-3"
                      style={{ borderBottomWidth: i === groups.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                    >
                      <View
                        className="h-9 w-9 rounded-lg mr-3 items-center justify-center"
                        style={{ backgroundColor: tokenColor }}
                      />
                      <View className="flex-1 min-w-0">
                        <Text className="text-callout text-ink" numberOfLines={1}>{g.merchant}</Text>
                        <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                          {(g.category ?? 'Uncategorized')} · in {days} day{days === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-callout text-ink">${(g.monthlyAmountCents / 100).toFixed(2)}</Text>
                        <Text className="text-caption2 text-ink4 uppercase mt-1">/mo</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View className="px-4 pt-3 items-center">
          <Pressable onPress={onScan} disabled={scanning}>
            <Text className="text-callout" style={{ color: palette.accent }}>
              {scanning ? 'Scanning…' : 'Scan email again'}
            </Text>
          </Pressable>
          {chip && <Text className="text-caption1 text-ink3 mt-2">{chip}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
```

- [x] **Step 2: Web smoke**

```bash
npm run web
```

You tab → "Subscriptions" row → empty-state placeholder renders. (No real recurring data exists locally yet.) Stop dev server.

- [x] **Step 3: Verify typecheck + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: clean + green.

- [x] **Step 4: Commit**

```bash
git add app/(tabs)/you/subscriptions.tsx
git commit -m "feat(sp5d): SubscriptionsScreen with stacked-bar + heuristic next-charge"
```

---

## Task 25: Final smoke + status update

**Files:**
- Modify: `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`

- [x] **Step 1: Run the full smoke**

```bash
npm test
npx tsc --noEmit
```

Expected: ~341 tests green; tsc clean. Record the exact test count.

- [x] **Step 2: Web target visual smoke**

```bash
npm run web
```

Open the browser and walk through the full flow:

- [x] You tab → sectioned list renders, all disabled rows visibly muted, no taps respond
- [x] Email sync row shows "Not connected" pill (assuming no IMAP account)
- [x] Tap Email sync → Intro screen renders with title, how-it-works steps, app-password reassurance, "Set up Gmail sync" button
- [x] Tap "Set up Gmail sync" → Connect screen renders with form, advanced disclosure expands/collapses
- [x] Save button disabled when fields empty; enabled when both have ≥4 chars
- [x] Cancel returns to Intro
- [x] Subscriptions row in You tab → opens Subscriptions screen with empty placeholder
- [x] Settings list rows "Coming soon" don't navigate

Stop dev server.

- [x] **Step 3: Update SP5 meta-spec status table**

Edit `docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md`. In §3 "Sub-slice status," replace the line:

```
- **5d** Not started.
```

with:

```
- **5d** ✅ Code complete 2026-04-27 — You-tab settings hub (`app/(tabs)/you/index.tsx`) with sectioned-list landing replaces the SP3b stub; functional Email-sync + Subscriptions rows, 8 disabled scaffolding rows. Three Email Sync screens (Intro, Connect, Dashboard) + AllowlistScreen + SubscriptionsScreen wired to existing SP5c `lib/sync/` client. New: `lib/db/queries/syncedEntries.ts` (`recentSynced` / `syncedStats` / `subscriptionList`), `lib/sync/useImapStatus.ts` (mount + AppState foreground + on-demand), `lib/sync/useRelativeTime.ts`, `lib/sync/categoryColor.ts`. No backend changes; no schema delta. ~16 new query tests on top of SP5c's suite. Live end-to-end smoke + iPhone Expo Go visual verification carry over to the SP5-wide deferred pass — gated on SP5b/SP5c live deploy tasks. Manual web smoke green.
```

- [x] **Step 4: Commit**

```bash
git add docs/superpowers/specs/meta/2026-04-26-sp5-email-review-design.md
git commit -m "docs(sp5d): mark slice code-complete in §3 sub-slice status"
```

---

## Done

At this point:

- 5 new screens (`intro`, `connect`, `dashboard`, `senders`, `subscriptions`) + 1 landing replacement (`you/index.tsx`)
- 1 new query module (`lib/db/queries/syncedEntries.ts`) with 3 functions and ~16 unit tests
- 3 new helpers in `lib/sync/` (`useImapStatus`, `useRelativeTime`, `categoryColor`)
- 0 backend changes
- 0 schema changes
- ~25 commits (one per task)

**Slice-close criteria all met:**

1. ✅ `npm test` green at the new total.
2. ✅ `npx tsc --noEmit` clean.
3. ✅ Web target smoke walks the full nav tree without errors.

**Carries over to the SP5-wide deferred pass (NOT 5d's responsibility):**

- iPhone Expo Go visual verification of all five new screens.
- Live end-to-end smoke (real Gmail → real worker → real iOS render). Gated on SP5b Tasks 14–15 + SP5c Task 22, currently pending per parent meta-spec §3.
