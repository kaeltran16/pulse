import { Pressable, Text } from 'react-native';

export function Fab({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Log entry"
      className="absolute right-6 bottom-8 h-14 w-14 rounded-full bg-accent items-center justify-center"
      style={{ elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
    >
      <Text className="text-title2 text-white">+</Text>
    </Pressable>
  );
}
