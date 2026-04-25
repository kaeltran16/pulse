import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import type { RoutineSummary } from '@/lib/db/queries/routines';

export function RoutineCard({
  routine, onPress, onLongPress,
}: {
  routine: RoutineSummary;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={{
        backgroundColor: palette.surface,
        borderColor: palette.hair, borderWidth: 0.5,
        borderRadius: 12, padding: 14, marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, textTransform: 'uppercase' }}>
        {routine.tag}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginTop: 4 }}>
        {routine.name}
      </Text>
      <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 4 }}>
        {routine.exerciseCount} exercises · ~{routine.estMinutes} min
      </Text>
    </Pressable>
  );
}
