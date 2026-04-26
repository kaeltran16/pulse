import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetEditSheet({
  visible,
  initialReps,
  initialWeightKg,
  onCancel,
  onSave,
  onRemove,
}: {
  visible: boolean;
  initialReps: number;
  initialWeightKg: number;
  onCancel: () => void;
  onSave: (patch: { reps: number; weightKg: number }) => void;
  onRemove: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [reps, setReps] = useState(String(initialReps));
  const [weight, setWeight] = useState(String(initialWeightKg));

  useEffect(() => {
    if (visible) {
      setReps(String(initialReps));
      setWeight(String(initialWeightKg));
    }
  }, [visible, initialReps, initialWeightKg]);

  const repsNum = Number(reps);
  const weightNum = Number(weight);
  const valid = !Number.isNaN(repsNum) && !Number.isNaN(weightNum) && repsNum > 0 && weightNum >= 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: palette.surface, padding: 20, gap: 12 }}>
        <Text style={{ fontSize: 17, fontWeight: '700', color: palette.ink }}>Edit set</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>
              WEIGHT (kg)
            </Text>
            <TextInput
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: palette.ink,
                borderBottomWidth: 1,
                borderBottomColor: palette.hair,
                paddingVertical: 4,
              }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: palette.ink3, letterSpacing: 0.8 }}>
              REPS
            </Text>
            <TextInput
              keyboardType="number-pad"
              value={reps}
              onChangeText={setReps}
              style={{
                fontSize: 22,
                fontWeight: '700',
                color: palette.ink,
                borderBottomWidth: 1,
                borderBottomColor: palette.hair,
                paddingVertical: 4,
              }}
            />
          </View>
        </View>
        <Pressable
          onPress={() => valid && onSave({ reps: repsNum, weightKg: weightNum })}
          disabled={!valid}
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: valid ? palette.accent : palette.hair,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Save</Text>
        </Pressable>
        <Pressable onPress={onRemove} style={{ padding: 14, alignItems: 'center' }}>
          <Text style={{ color: palette.red, fontSize: 15, fontWeight: '600' }}>Remove set</Text>
        </Pressable>
        <Pressable onPress={onCancel} style={{ padding: 10, alignItems: 'center' }}>
          <Text style={{ color: palette.accent, fontSize: 15 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}
