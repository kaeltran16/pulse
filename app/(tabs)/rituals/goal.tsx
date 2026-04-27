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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any).update(goals).set({ dailyRitualTarget: n }).where(eq(goals.id, 1)).run();
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
