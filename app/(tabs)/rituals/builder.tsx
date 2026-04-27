import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { asc } from 'drizzle-orm';
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
