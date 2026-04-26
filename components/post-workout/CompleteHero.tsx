import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { StatGrid, type StatCell } from './StatGrid';

export function CompleteHero({
  headline,
  subline,
  cells,
}: {
  headline: string;
  subline: string;
  cells: StatCell[];
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <View
      style={{
        paddingTop: 56,
        paddingHorizontal: 20,
        paddingBottom: 24,
        backgroundColor: palette.move,
      }}
    >
      <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' }}>
          ✓ Complete
        </Text>
      </View>
      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '700', marginTop: 10 }}>{headline}</Text>
      {subline ? (
        <Text style={{ color: '#fff', opacity: 0.9, fontSize: 14, marginTop: 4 }}>{subline}</Text>
      ) : null}
      <StatGrid cells={cells} />
    </View>
  );
}
