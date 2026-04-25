import { Pressable, Text } from 'react-native';

export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Log entry"
      className="rounded-full bg-accent items-center justify-center"
      style={{
        position: 'absolute',
        right: 24,
        bottom: 32,
        width: 56,
        height: 56,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      }}
    >
      <Text className="text-title2 text-white">+</Text>
    </Pressable>
  );
}
