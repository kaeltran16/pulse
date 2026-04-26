import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { PrHighlight } from '@/lib/workouts/post-session-aggregate';

export function PrHighlightCard({ pr, moreSuffix }: { pr: PrHighlight; moreSuffix?: string }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 16,
        padding: 14,
        borderRadius: 14,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.hair,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: palette.money, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 22 }}>★</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: palette.money, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 }}>
          Personal record
        </Text>
        <Text style={{ color: palette.ink, fontSize: 16, fontWeight: '700', marginTop: 2 }}>
          {pr.exerciseName} · {pr.newWeightKg}kg × {pr.newReps}
        </Text>
        {moreSuffix ? (
          <Text style={{ color: palette.ink3, fontSize: 12, marginTop: 2 }}>{moreSuffix}</Text>
        ) : null}
      </View>
    </View>
  );
}
