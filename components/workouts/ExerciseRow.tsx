import { Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';
import { SetChip } from './SetChip';

export interface ExerciseRowProps {
  name: string;
  muscle: string;
  sfSymbol: string;
  sets: Array<{ targetReps: number | null; targetWeightKg: number | null }>;
  onTapRow: () => void;
  onTapSet: (index: number) => void;
  onAddSet: () => void;
}

export function ExerciseRow(props: ExerciseRowProps) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  return (
    <View style={{ paddingVertical: 12, paddingHorizontal: 14 }}>
      <Pressable onPress={props.onTapRow} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
          backgroundColor: `${palette.move}22`,
        }}>
          <SymbolView name={props.sfSymbol as never} size={16} tintColor={palette.move} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '500', color: palette.ink }}>{props.name}</Text>
          <Text style={{ fontSize: 12, color: palette.ink3 }}>
            {props.muscle} · {props.sets.length} sets
          </Text>
        </View>
        <SymbolView name={'chevron.right' as never} size={13} tintColor={palette.ink4} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 5, marginTop: 8, marginLeft: 52, flexWrap: 'wrap' }}>
        {props.sets.map((s, i) => (
          <SetChip key={i} reps={s.targetReps} weightKg={s.targetWeightKg} onPress={() => props.onTapSet(i)} />
        ))}
        <Pressable
          onPress={props.onAddSet}
          style={{
            paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6,
            borderWidth: 1, borderColor: palette.hair, borderStyle: 'dashed',
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '500', color: palette.ink3 }}>+ set</Text>
        </Pressable>
      </View>
    </View>
  );
}
