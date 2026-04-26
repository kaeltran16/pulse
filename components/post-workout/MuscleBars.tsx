import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { MuscleDistribution } from '@/lib/workouts/post-session-aggregate';

export function MuscleBars({ distribution }: { distribution: MuscleDistribution[] }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (distribution.length === 0) return null;

  const top = distribution.slice(0, 3);
  const moreCount = Math.max(0, distribution.length - 3);
  const barColors = [palette.move, palette.accent, palette.rituals];

  return (
    <View style={{ marginHorizontal: 16, marginTop: 18, padding: 14, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>
        Muscles worked
      </Text>
      {top.map((m, i) => (
        <View key={m.muscle} style={{ marginBottom: i < top.length - 1 ? 10 : 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 5 }}>
            <Text style={{ flex: 1, color: palette.ink, fontSize: 13, fontWeight: '600' }}>{m.muscle}</Text>
            <Text style={{ color: palette.ink3, fontSize: 12, marginRight: 8 }}>{Math.round(m.tonnageKg)} kg</Text>
            <Text style={{ color: barColors[i], fontSize: 13, fontWeight: '700', minWidth: 32, textAlign: 'right' }}>{m.percentage}%</Text>
          </View>
          <View style={{ height: 8, borderRadius: 100, backgroundColor: palette.fill, overflow: 'hidden' }}>
            <View style={{ width: `${m.percentage}%`, height: '100%', backgroundColor: barColors[i] }} />
          </View>
        </View>
      ))}
      {moreCount > 0 ? (
        <Text style={{ color: palette.ink3, fontSize: 12, marginTop: 10 }}>+ {moreCount} more</Text>
      ) : null}
    </View>
  );
}
