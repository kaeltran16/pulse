import { useMemo } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { asc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import Svg, { Circle } from 'react-native-svg';

import { db } from '@/lib/db/client';
import { goals, rituals, ritualEntries } from '@/lib/db/schema';
import { dayKey, dayKeyForMs } from '@/lib/db/queries/dayKey';
import { toggleRitualToday } from '@/lib/db/queries/rituals';
import { streakForRitual } from '@/lib/db/queries/streaks';
import { cadenceDisplay } from '@/lib/sync/cadenceDisplay';
import { useRitualNudge } from '@/lib/sync/useRitualNudge';
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
  useLiveQuery(db.select().from(goals).where(eq(goals.id, 1)));

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
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
