import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RenameRoutineSheet({
  visible, initialName, onCancel, onSave,
}: {
  visible: boolean;
  initialName: string;
  onCancel: () => void;
  onSave: (name: string) => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const [name, setName] = useState(initialName);

  useEffect(() => { if (visible) setName(initialName); }, [visible, initialName]);
  const trimmed = name.trim();
  const isValid = trimmed.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable onPress={onCancel} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
        <View style={{ backgroundColor: palette.surface, padding: 16, paddingBottom: 32 }}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: palette.ink, marginBottom: 12 }}>Rename routine</Text>
          <TextInput
            value={name} onChangeText={setName} autoFocus
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
              onPress={() => onSave(trimmed)}
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
