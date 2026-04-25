import { ActionSheetIOS, Alert, Platform, Pressable, Text } from 'react-native';
import { gte, lt, and } from 'drizzle-orm';

import { db, sqlite } from '@/lib/db/client';
import { rituals, ritualEntries, movementEntries, spendingEntries } from '@/lib/db/schema';
import { localDayBounds } from '@/lib/db/queries/today';

const OPTIONS = ['Seed today (partial)', 'Seed today (full)', 'Clear today', 'Cancel'] as const;

export function DevSeedButton({ topInset = 0 }: { topInset?: number }) {
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
      className="rounded-full bg-fill"
      style={{
        position: 'absolute',
        top: topInset + 8,
        right: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 10,
      }}
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
