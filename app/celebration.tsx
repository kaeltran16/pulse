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
