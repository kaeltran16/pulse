import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { type SessionRowData } from '@/lib/db/queries/sessions';
import { formatRelativeDate } from '@/lib/workouts/date-format';
import { formatDuration, formatPace } from '@/lib/workouts/cardio-aggregate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SessionRow({ row, now }: { row: SessionRowData; now: number }) {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const dateLabel = formatRelativeDate(row.finishedAt, now);
  const durationLabel = formatDuration(row.durationSeconds);

  let metaLine: string;
  if (row.mode === 'cardio') {
    const distance = row.distanceKm != null ? `${row.distanceKm.toFixed(1)} km` : '— km';
    const pace =
      row.paceSecondsPerKm != null
        ? `${formatPace(row.paceSecondsPerKm / 60)}/km`
        : '—/km';
    metaLine = `${durationLabel} · ${distance} · ${pace}`;
  } else {
    const volume = `${Math.round(row.totalVolumeKg)} kg`;
    metaLine = `${durationLabel} · ${row.setCount} sets · ${volume}`;
  }

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(tabs)/move/[sessionId]' as never,
          params: { sessionId: String(row.id) },
        })
      }
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 0.5,
        borderColor: palette.hair,
        backgroundColor: palette.surface,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '600', color: palette.ink }}>
          {row.routineNameSnapshot}
        </Text>
        <Text style={{ fontSize: 13, color: palette.ink3 }}>{dateLabel}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 4 }}>
        <Text style={{ flex: 1, fontSize: 13, color: palette.ink3 }}>{metaLine}</Text>
        {row.mode === 'strength' && row.prCount > 0 && (
          <Text style={{ fontSize: 13, color: palette.money }}>★</Text>
        )}
      </View>
    </Pressable>
  );
}
