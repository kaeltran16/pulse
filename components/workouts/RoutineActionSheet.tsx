import { Modal, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export function RoutineActionSheet({
  visible, onClose, onEdit, onDuplicate, onRename, onDelete,
}: {
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const Row = ({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) => (
    <Pressable
      onPress={() => { onPress(); onClose(); }}
      style={{
        padding: 16, alignItems: 'center',
        borderTopColor: palette.hair, borderTopWidth: 0.5,
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '500', color: danger ? palette.red : palette.accent }}>
        {label}
      </Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} />
      <View style={{ backgroundColor: palette.surface }}>
        <Row label="Edit" onPress={onEdit} />
        <Row label="Duplicate" onPress={onDuplicate} />
        <Row label="Rename" onPress={onRename} />
        <Row label="Delete" onPress={onDelete} danger />
        <Row label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
