import { Text, View } from 'react-native';

import type { ExerciseInSession } from '@/lib/state/activeSessionStore';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function UpNextRow({ exercise }: { exercise: ExerciseInSession }) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const firstSet = exercise.prescribedSets[0];

  return (
    <View
      style={{
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
      <View
        style={{
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 4,
          backgroundColor: palette.fill,
        }}
      >
        <Text style={{ fontSize: 9, fontWeight: '700', color: palette.ink3, letterSpacing: 1 }}>
          NEXT
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: palette.ink }}>
          {exercise.meta.name}
        </Text>
        <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 1 }}>
          {exercise.prescribedSets.length} sets · {firstSet?.weightKg ?? '—'}kg × {firstSet?.reps ?? '—'}
        </Text>
      </View>
    </View>
  );
}
