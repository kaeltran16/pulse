import { View, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';

type Props = { period: 'weekly' | 'monthly' };

export function ReviewEmptyState({ period }: Props) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const label = period === 'weekly' ? 'this week' : 'this month';
  return (
    <View
      style={{
        marginHorizontal: 16,
        marginVertical: 20,
        padding: 24,
        borderRadius: 16,
        backgroundColor: palette.surface,
        alignItems: 'center',
      }}
    >
      <Text style={{ ...type.body, color: palette.ink, textAlign: 'center' }}>
        Not enough data for {label}.
      </Text>
      <Text style={{ ...type.caption1, color: palette.ink3, textAlign: 'center', marginTop: 8 }}>
        Log a ritual, a session, or an entry — then come back.
      </Text>
    </View>
  );
}
