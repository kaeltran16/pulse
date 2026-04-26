import { Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export interface HydratedExercise {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  sf: string;
  sets: Array<{
    weight?: number;
    reps?: number;
    duration?: number;
    distance?: number;
    pace?: string;
  }>;
}

export interface ResultExerciseListProps {
  exercises: HydratedExercise[];
}

function formatSet(s: HydratedExercise['sets'][number]): string {
  if (s.weight !== undefined && s.weight > 0 && s.reps !== undefined) {
    return `${s.weight}×${s.reps}`;
  }
  if (s.duration !== undefined) {
    return `${s.duration}min`;
  }
  if (s.reps !== undefined) {
    return `${s.reps} reps`;
  }
  return '—';
}

export function ResultExerciseList({ exercises }: ResultExerciseListProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View
      style={{
        backgroundColor: palette.surface,
        borderRadius: 14,
        borderWidth: 0.5,
        borderColor: palette.hair,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          paddingHorizontal: 14,
          paddingTop: 12,
          paddingBottom: 8,
        }}
      >
        <Text
          style={{
            fontSize: 12,
            fontWeight: '700',
            color: palette.ink3,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
          }}
        >
          Exercises
        </Text>
      </View>
      {exercises.map((ex, i) => (
        <View
          key={`${ex.id}-${i}`}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 12,
            borderTopWidth: 0.5,
            borderTopColor: palette.hair,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                backgroundColor: palette.move + '22',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SymbolView name={(ex.sf || 'dumbbell.fill') as never} size={16} tintColor={palette.move} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: palette.ink,
                  letterSpacing: -0.24,
                }}
              >
                {ex.name}
              </Text>
              <Text style={{ fontSize: 12, color: palette.ink3, letterSpacing: -0.08 }}>
                {ex.muscle} · {ex.equipment}
              </Text>
            </View>
          </View>
          <View
            style={{ flexDirection: 'row', gap: 5, marginLeft: 42, flexWrap: 'wrap' }}
          >
            {ex.sets.map((s, j) => (
              <View
                key={j}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: palette.fill,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '600',
                    color: palette.ink2,
                    letterSpacing: -0.08,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {formatSet(s)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
