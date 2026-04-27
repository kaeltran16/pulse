import { useMemo } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { asc } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import DraggableFlatList from 'react-native-draggable-flatlist';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { db } from '@/lib/db/client';
import { rituals, ritualEntries, type Ritual } from '@/lib/db/schema';
import {
  insertRitual,
  reorderRitualPositions,
  restoreRitual,
  softDeleteRitual,
} from '@/lib/db/queries/rituals';
import { streakForRitual } from '@/lib/db/queries/streaks';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import { usePalSuggestions } from '@/lib/sync/usePalSuggestions';
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
  const inactive = useMemo(
    () => ritualsLive.data.filter((r) => !r.active),
    [ritualsLive.data],
  );

  const onDragEnd = async ({ data }: { data: Ritual[] }) => {
    await reorderRitualPositions(db, data.map((r) => r.id));
  };

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

  const suggestions = usePalSuggestions(active, entriesLive.data);

  const onAddSuggestion = async (s: typeof suggestions.suggestions[number]) => {
    await insertRitual(db, {
      title: s.title,
      icon: s.icon,
      cadence: s.cadence,
      color: s.color,
      active: true,
    });
    await suggestions.refresh();
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

      <ScrollView contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="px-3 pb-2">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Active rituals</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <DraggableFlatList<Ritual>
              data={active}
              keyExtractor={(r) => String(r.id)}
              onDragEnd={onDragEnd}
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

        {(suggestions.loading || suggestions.error || suggestions.suggestions.length > 0) && (
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
              ) : (
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
        )}

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
    </SafeAreaView>
  );
}
