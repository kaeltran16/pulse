import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';

import { db } from '@/lib/db/client';
import { getTodaySpend, type TodaySpend } from '@/lib/db/queries/todaySpend';

const HHMM = (ms: number) => {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

const fmt$ = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default function SpendingDetail() {
  const router = useRouter();
  const [data, setData] = useState<TodaySpend>({ totalCents: 0, budgetCents: 0, entries: [] });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const r = await getTodaySpend(db, new Date());
      if (live) setData(r);
    })();
    return () => { live = false; };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { syncNow } = await import('@/lib/sync/syncNow');
      await syncNow(db);
      const r = await getTodaySpend(db, new Date());
      setData(r);
    } finally {
      setRefreshing(false);
    }
  };

  const overBudget = data.budgetCents > 0 && data.totalCents > data.budgetCents;
  const pct = data.budgetCents > 0 ? Math.min(1, data.totalCents / data.budgetCents) : 0;

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={() => router.back()} className="h-9 w-9 rounded-full bg-fill items-center justify-center">
          <Text className="text-ink">‹</Text>
        </Pressable>
        <Text className="ml-3 text-headline text-ink">Spending today</Text>
      </View>

      <View className="px-4 py-3">
        <Text className="text-largeTitle text-ink">{fmt$(data.totalCents)}</Text>
        <Text className="text-subhead text-ink3 mt-1">
          of {fmt$(data.budgetCents)} daily budget
        </Text>
        <View className="h-2 mt-3 rounded-full bg-fill overflow-hidden">
          <View
            className={overBudget ? 'h-full bg-money' : 'h-full bg-money'}
            style={{ width: `${Math.round(pct * 100)}%`, opacity: overBudget ? 1 : 0.7 }}
          />
        </View>
        {overBudget && (
          <Text className="text-caption1 text-money mt-2">Over budget by {fmt$(data.totalCents - data.budgetCents)}</Text>
        )}
      </View>

      <ScrollView
        className="flex-1 px-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {data.entries.length === 0 ? (
          <View className="items-center py-12">
            <Text className="text-body text-ink3">No spending logged today.</Text>
          </View>
        ) : (
          data.entries.map((e) => (
            <View key={e.id} className="flex-row items-center py-3 border-b border-hair">
              <Text className="text-callout text-ink3 w-12">{HHMM(e.occurredAt)}</Text>
              <View className="flex-1">
                <Text className="text-callout text-ink">{e.note ?? e.category ?? 'Spending'}</Text>
                {e.category && e.note && <Text className="text-caption1 text-ink3">{e.category}</Text>}
              </View>
              <Text className="text-callout text-ink">−{fmt$(e.cents)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
