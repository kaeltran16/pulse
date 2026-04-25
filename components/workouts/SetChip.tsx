import { Pressable, Text } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetChip({
  reps, weightKg, onPress,
}: {
  reps: number | null;
  weightKg: number | null;
  onPress?: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const label =
    weightKg != null && reps != null ? `${weightKg}×${reps}`
    : reps != null ? `${reps} reps`
    : '—';
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
        backgroundColor: palette.fill,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: palette.ink2, fontVariant: ['tabular-nums'] }}>
        {label}
      </Text>
    </Pressable>
  );
}
