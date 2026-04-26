import { Text, View } from 'react-native';

import type { WeeklyVolumeBucket } from '@/lib/workouts/post-session-aggregate';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function WeeklyVolumeChart({ series }: { series: WeeklyVolumeBucket[] }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (series.length === 0) return null;

  const max = Math.max(1, ...series.map((b) => b.tonnageKg));
  const last = series[series.length - 1];
  const first4 = series.slice(0, 4);
  const avgFirst4 = first4.reduce((s, b) => s + b.tonnageKg, 0) / first4.length;
  const pctPill =
    avgFirst4 > 0 ? `+${Math.round(((last.tonnageKg - avgFirst4) / avgFirst4) * 100)}% in 4 wks` : null;

  return (
    <View style={{ marginHorizontal: 16, marginTop: 18, padding: 16, borderRadius: 14, backgroundColor: palette.surface, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
        Volume over 8 weeks
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 }}>
        <Text style={{ color: palette.ink, fontSize: 24, fontWeight: '700' }}>
          {(series.reduce((s, b) => s + b.tonnageKg, 0) / 1000).toFixed(1)}
        </Text>
        <Text style={{ color: palette.ink3, fontSize: 13, marginLeft: 4 }}>t total</Text>
        <View style={{ flex: 1 }} />
        {pctPill ? (
          <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: palette.move + '22', borderRadius: 100 }}>
            <Text style={{ color: palette.move, fontSize: 11, fontWeight: '700' }}>{pctPill}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 100 }}>
        {series.map((b, i) => {
          const heightPct = (b.tonnageKg / max) * 100;
          const isLast = i === series.length - 1;
          return (
            <View key={b.weekStart} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
              {isLast && b.tonnageKg > 0 ? (
                <View style={{ paddingHorizontal: 4, paddingVertical: 1, backgroundColor: palette.move + '22', borderRadius: 4 }}>
                  <Text style={{ color: palette.move, fontSize: 10, fontWeight: '700' }}>
                    {(b.tonnageKg / 1000).toFixed(1)}t
                  </Text>
                </View>
              ) : null}
              <View
                style={{
                  width: '100%',
                  height: `${Math.max(heightPct, 4)}%`,
                  backgroundColor: isLast ? palette.move : palette.move + '44',
                  borderTopLeftRadius: 6,
                  borderTopRightRadius: 6,
                }}
              />
              <Text style={{ color: isLast ? palette.move : palette.ink3, fontSize: 9, fontWeight: isLast ? '700' : '500' }}>
                W{i + 1}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
