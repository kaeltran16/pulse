import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useImapStatus } from '@/lib/sync/useImapStatus';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function AllowlistScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { status, isLoading } = useImapStatus();

  const allowlist = status?.connected ? status.senderAllowlist : [];

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ Email sync</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-1 pb-2">
          <Text className="text-largeTitle text-ink">Detected senders</Text>
          <Text className="text-subhead text-ink3 mt-1">
            Pal only reads emails from these addresses or domains.
          </Text>
        </View>

        <View className="px-3 pt-2 pb-2">
          <View className="rounded-xl bg-surface overflow-hidden">
            {isLoading ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-callout text-ink3">Loading…</Text>
              </View>
            ) : allowlist.length === 0 ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-callout text-ink3 text-center">No senders configured.</Text>
              </View>
            ) : (
              allowlist.map((sender, i) => (
                <View
                  key={sender}
                  className="px-4 py-3"
                  style={{ borderBottomWidth: i === allowlist.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                >
                  <Text className="text-callout text-ink">{sender}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        <View className="px-4 pt-2">
          <Text className="text-caption1 text-ink3" style={{ lineHeight: 18 }}>
            To edit, disconnect and reconnect with a different list.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
