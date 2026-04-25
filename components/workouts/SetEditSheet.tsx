import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function SetEditSheet({
  visible, initialReps, initialWeight, onCancel, onSave,
}: {
  visible: boolean;
  initialReps: number | null;
  initialWeight: number | null;
  onCancel: () => void;
  onSave: (reps: number | null, weightKg: number | null) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [reps, setReps] = useState(initialReps?.toString() ?? '');
  const [weight, setWeight] = useState(initialWeight?.toString() ?? '');

  useEffect(() => {
    if (visible) {
      setReps(initialReps?.toString() ?? '');
      setWeight(initialWeight?.toString() ?? '');
    }
  }, [visible, initialReps, initialWeight]);

  const repsNum = reps.trim() === '' ? null : parseInt(reps, 10);
  const weightNum = weight.trim() === '' ? null : parseFloat(weight);
  const isValid = (repsNum === null || (Number.isFinite(repsNum) && repsNum >= 1))
                && (weightNum === null || (Number.isFinite(weightNum) && weightNum >= 0));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginBottom: 12 }}>Edit set</Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginBottom: 4 }}>Reps</Text>
          <TextInput
            value={reps} onChangeText={setReps} keyboardType="number-pad"
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 12,
            }}
          />
          <Text style={{ fontSize: 12, color: palette.ink3, marginBottom: 4 }}>Weight (kg)</Text>
          <TextInput
            value={weight} onChangeText={setWeight} keyboardType="decimal-pad"
            placeholder="(bodyweight)"
            placeholderTextColor={palette.ink4}
            style={{
              borderWidth: 0.5, borderColor: palette.hair, borderRadius: 8,
              padding: 10, color: palette.ink, marginBottom: 16,
            }}
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={onCancel}
              style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: palette.fill, alignItems: 'center' }}
            >
              <Text style={{ color: palette.ink, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={!isValid}
              onPress={() => onSave(repsNum, weightNum)}
              style={{
                flex: 1, padding: 12, borderRadius: 8, alignItems: 'center',
                backgroundColor: isValid ? palette.accent : palette.fill,
              }}
            >
              <Text style={{ color: isValid ? '#fff' : palette.ink3, fontWeight: '600' }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
