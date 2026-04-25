import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RoutineSummary } from '@/lib/db/queries/routines';

export function CardioRow({ routine, onPress }: { routine: RoutineSummary; onPress: () => void }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 14,
        backgroundColor: palette.surface,
        borderBottomColor: palette.hair, borderBottomWidth: 0.5,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{routine.name}</Text>
        <Text style={{ fontSize: 12, color: palette.ink3 }}>{routine.exerciseCount} · ~{routine.estMinutes} min</Text>
      </View>
    </Pressable>
  );
}
