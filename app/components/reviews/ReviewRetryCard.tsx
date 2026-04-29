import { View, Text, Pressable } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';

type Props = { onRetry: () => void; busy?: boolean };

export function ReviewRetryCard({ onRetry, busy }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 20,
        borderRadius: 16,
        backgroundColor: palette.surface,
        borderWidth: 0.5,
        borderColor: palette.hair,
      }}
    >
      <Text style={{ ...type.body, color: palette.ink }}>
        Couldn't reach Pal. Your stats are still up to date.
      </Text>
      <Pressable
        onPress={onRetry}
        disabled={!!busy}
        accessibilityRole="button"
        accessibilityLabel="Retry generating review"
        style={{
          alignSelf: 'flex-start',
          marginTop: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 999,
          backgroundColor: palette.accent,
          opacity: busy ? 0.5 : 1,
        }}
      >
        <Text style={{ ...type.subhead, color: '#fff', fontWeight: '600' }}>Retry</Text>
      </Pressable>
    </View>
  );
}
