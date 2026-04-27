import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RitualsTab() {
  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="px-4 py-6">
        <Text className="text-largeTitle text-ink">Rituals</Text>
      </View>
    </SafeAreaView>
  );
}
