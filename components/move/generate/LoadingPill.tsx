import { ActivityIndicator, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function LoadingPill() {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ alignItems: 'center', paddingTop: 24, paddingHorizontal: 16 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: palette.surface,
          borderRadius: 100,
          borderWidth: 0.5,
          borderColor: palette.hair,
        }}
      >
        <ActivityIndicator size="small" color={palette.move} />
        <Text style={{ fontSize: 13, color: palette.ink2, letterSpacing: -0.1 }}>
          Pal is building your routine…
        </Text>
      </View>
    </View>
  );
}
