import { Text, View } from 'react-native';

export function StubTab({ title, comingIn }: { title: string; comingIn: string }) {
  return (
    <View className="flex-1 items-center justify-center bg-bg p-6">
      <Text className="text-title2 text-ink">{title}</Text>
      <Text className="mt-2 text-subhead text-ink3">Coming in {comingIn}</Text>
    </View>
  );
}
