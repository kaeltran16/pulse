import { Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function StatTile({
  label,
  value,
  unit,
  tint,
}: {
  label: string;
  value: string;
  unit: string;
  tint: string;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const dim = value === '—';

  return (
    <View style={{ flex: 1, backgroundColor: palette.surface, borderRadius: 14, padding: 13, borderWidth: 0.5, borderColor: palette.hair }}>
      <Text style={{ color: dim ? palette.ink4 : palette.ink3, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 4 }}>
        <Text style={{ color: dim ? palette.ink4 : tint, fontSize: 24, fontWeight: '700' }}>{value}</Text>
        {unit ? <Text style={{ color: palette.ink3, fontSize: 11 }}>{unit}</Text> : null}
      </View>
    </View>
  );
}
