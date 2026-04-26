import { Modal, Pressable, Text, View } from 'react-native';

import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function DiscardConfirmModal({
  visible,
  loggedSetCount,
  onCancel,
  onConfirm,
}: {
  visible: boolean;
  loggedSetCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 32,
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: palette.surface,
            borderRadius: 16,
            padding: 22,
            width: '100%',
            maxWidth: 320,
            gap: 6,
          }}
        >
          <Text
            style={{ fontSize: 17, fontWeight: '700', color: palette.ink, textAlign: 'center' }}
          >
            Discard this workout?
          </Text>
          <Text style={{ fontSize: 13, color: palette.ink3, textAlign: 'center' }}>
            {loggedSetCount === 0
              ? 'Nothing logged yet.'
              : `You'll lose ${loggedSetCount} logged set${loggedSetCount === 1 ? '' : 's'}.`}
          </Text>
          <Pressable
            onPress={onConfirm}
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: 12,
              backgroundColor: palette.red,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Discard</Text>
          </Pressable>
          <Pressable onPress={onCancel} style={{ padding: 12, alignItems: 'center' }}>
            <Text style={{ color: palette.accent, fontWeight: '600', fontSize: 15 }}>
              Keep going
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
