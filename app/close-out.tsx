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
          <View className="px-6 pt-7 pb-4">
            <Text style={{ fontSize: 40, marginBottom: 8 }}>✦</Text>
            <Text className="text-largeTitle text-ink" style={{ fontWeight: '700', lineHeight: 38 }}>
              Close out{'\n'}your day.
            </Text>
            <Text className="text-subhead text-ink3 mt-3">
              {doneCount} of {goal} rituals done. {goalMet ? 'Ring closed.' : `${remaining} to go.`}
            </Text>
          </View>

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
