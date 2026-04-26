import { Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export type SetCardState =
  | { kind: 'done'; reps: number; weightKg: number; isPr: boolean }
  | { kind: 'active'; targetReps: number | null; targetWeightKg: number | null; reps: number | null; weightKg: number | null }
  | { kind: 'upcoming'; targetReps: number | null; targetWeightKg: number | null };

export function SetCard({
  num,
  state,
  onTapDone,
  onChange,
  onComplete,
}: {
  num: number;
  state: SetCardState;
  onTapDone?: () => void;
  onChange?: (patch: { reps?: number | null; weightKg?: number | null }) => void;
  onComplete?: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  if (state.kind === 'done') {
    const volume = state.weightKg * state.reps;
    return (
      <Pressable
        onPress={onTapDone}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 12,
          backgroundColor: palette.surface,
          borderWidth: 0.5,
          borderColor: state.isPr ? palette.money : palette.hair,
        }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: palette.move,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>✓</Text>
        </View>
        <Text style={{ color: palette.ink3, fontSize: 13, fontWeight: '700' }}>SET {num}</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ color: palette.ink, fontSize: 17, fontWeight: '700' }}>
          {state.weightKg}
          <Text style={{ color: palette.ink3, fontSize: 11 }}> kg </Text>× {state.reps}
        </Text>
        <Text
          style={{
            color: state.isPr ? palette.money : palette.ink3,
            fontSize: 11,
            minWidth: 42,
            textAlign: 'right',
          }}
        >
          {state.isPr ? 'PR' : `${volume} kg`}
        </Text>
      </Pressable>
    );
  }

  if (state.kind === 'active') {
    return (
      <View
        style={{
          padding: 14,
          borderRadius: 14,
          backgroundColor: palette.fill,
          borderWidth: 1.5,
          borderColor: palette.accent,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <View
            style={{
              paddingHorizontal: 10,
              paddingVertical: 3,
              borderRadius: 100,
              backgroundColor: palette.accent,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>SET {num}</Text>
          </View>
          {state.targetReps !== null && state.targetWeightKg !== null && (
            <Text style={{ color: palette.ink3, fontSize: 11 }}>
              Target: {state.targetWeightKg}kg × {state.targetReps}
            </Text>
          )}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              backgroundColor: palette.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.ink3, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }}>
              WEIGHT
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={state.weightKg === null ? '' : String(state.weightKg)}
              onChangeText={(v) => onChange?.({ weightKg: v === '' ? null : Number(v) })}
              style={{ color: palette.ink, fontSize: 28, fontWeight: '700', marginTop: 2 }}
            />
          </View>
          <View
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 10,
              backgroundColor: palette.surface,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: palette.ink3, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 }}>
              REPS
            </Text>
            <TextInput
              keyboardType="number-pad"
              value={state.reps === null ? '' : String(state.reps)}
              onChangeText={(v) => onChange?.({ reps: v === '' ? null : Number(v) })}
              style={{ color: palette.ink, fontSize: 28, fontWeight: '700', marginTop: 2 }}
            />
          </View>
        </View>
        <Pressable
          onPress={onComplete}
          disabled={state.reps === null || state.weightKg === null}
          style={{
            padding: 11,
            borderRadius: 10,
            backgroundColor:
              state.reps !== null && state.weightKg !== null ? palette.accent : palette.hair,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>✓ Complete set</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: palette.fill,
        borderWidth: 0.5,
        borderColor: palette.hair,
        opacity: 0.7,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: palette.ink4,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: palette.ink3, fontSize: 12, fontWeight: '700' }}>{num}</Text>
      </View>
      <Text style={{ color: palette.ink3, fontSize: 13, fontWeight: '700' }}>SET {num}</Text>
      <View style={{ flex: 1 }} />
      <Text style={{ color: palette.ink3, fontSize: 15 }}>
        {state.targetWeightKg ?? '—'}
        <Text style={{ color: palette.ink4, fontSize: 10 }}> kg </Text>× {state.targetReps ?? '—'}
      </Text>
    </View>
  );
}
