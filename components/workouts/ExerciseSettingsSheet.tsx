import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function ExerciseSettingsSheet({
  visible, exerciseName, initialRest, fallbackRest, onCancel, onSave,
}: {
  visible: boolean;
  exerciseName: string;
  initialRest: number | null;
  fallbackRest: number;
  onCancel: () => void;
  onSave: (restSeconds: number | null) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [rest, setRest] = useState(initialRest?.toString() ?? '');

  useEffect(() => { if (visible) setRest(initialRest?.toString() ?? ''); }, [visible, initialRest]);

  const restNum = rest.trim() === '' ? null : parseInt(rest, 10);
  const isValid = restNum === null || (Number.isFinite(restNum) && restNum >= 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink }}>{exerciseName}</Text>
          <Text style={{ fontSize: 12, color: palette.ink3, marginTop: 12, marginBottom: 4 }}>
            Rest seconds (blank = use routine default of {fallbackRest}s)
          </Text>
          <TextInput
            value={rest} onChangeText={setRest} keyboardType="number-pad"
            placeholder={`${fallbackRest}`}
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
              onPress={() => onSave(restNum)}
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
