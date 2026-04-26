import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { formatDuration, formatPace, paceMinPerKm } from '@/lib/workouts/cardio-aggregate';

export function CardioRecapCard({
  exerciseName,
  durationSeconds,
  distanceKm,
}: {
  exerciseName: string;
  durationSeconds: number;
  distanceKm: number | null;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const pace = paceMinPerKm(durationSeconds, distanceKm ?? 0);

  return (
    <View style={{ marginHorizontal: 16, marginTop: 16, padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {exerciseName}
      </Text>
      <Text style={{ color: palette.ink, fontSize: 36, fontWeight: '700', marginTop: 4 }}>
        {formatDuration(durationSeconds)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 18, marginTop: 8 }}>
        <View>
          <Text style={{ color: palette.ink3, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>Distance</Text>
          <Text style={{ color: palette.ink, fontSize: 18, fontWeight: '600', marginTop: 2 }}>
            {distanceKm != null ? `${distanceKm.toFixed(1)} km` : '— km'}
          </Text>
        </View>
        <View>
          <Text style={{ color: palette.ink3, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' }}>Pace</Text>
          <Text style={{ color: palette.ink, fontSize: 18, fontWeight: '600', marginTop: 2 }}>
            {formatPace(pace)}/km
          </Text>
        </View>
      </View>
    </View>
  );
}
