import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { syncedStats } from '@/lib/db/queries/syncedEntries';
import { spendingEntries } from '@/lib/db/schema';
import { useImapStatus } from '@/lib/sync/useImapStatus';
import { useRelativeTime } from '@/lib/sync/useRelativeTime';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

export default function EmailSyncDashboard() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { status, isLoading } = useImapStatus();
  const lastPolledStr = useRelativeTime(status?.connected ? status.lastPolledAt : null);
  const liveSpending = useLiveQuery(db.select().from(spendingEntries));
  const stats = (() => {
    void liveSpending.data;
    return syncedStats(db);
  })();

  // If status confirms disconnected, bounce to Intro.
  useEffect(() => {
    if (!isLoading && status && !status.connected) {
      router.replace('/(tabs)/you/email-sync/intro');
    }
  }, [isLoading, status, router]);

  if (isLoading || !status || !status.connected) {
    return (
      <SafeAreaView className="flex-1 bg-bg">
        <View className="flex-1 items-center justify-center">
          <Text className="text-callout text-ink3">Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const pillColor =
    status.status === 'active' ? palette.move :
    status.status === 'paused' ? palette.money : '#FF3B30';
  const pillText =
    status.status === 'active' ? 'Connected' :
    status.status === 'paused' ? 'Paused' : 'Error';

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <View className="flex-row items-center px-3 py-3">
          <Text
            className="text-callout"
            style={{ color: palette.accent }}
            onPress={() => router.replace('/(tabs)/you')}
          >
            ‹ You
          </Text>
        </View>

        <View className="px-4 pt-1 pb-2">
          <Text className="text-largeTitle text-ink">Email sync</Text>
        </View>

        <View className="px-3 pb-3">
          <View className="rounded-2xl bg-surface p-4" style={{ borderWidth: 0.5, borderColor: palette.hair }}>
            <View className="flex-row items-center">
              <View className="h-10 w-10 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: palette.accentTint }}>
                <Text className="text-callout">📧</Text>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center">
                  <Text className="text-callout text-ink" numberOfLines={1}>{status.emailAddress}</Text>
                  <View
                    className="rounded-full px-2 py-0.5 ml-2"
                    style={{ backgroundColor: pillColor + '22' }}
                  >
                    <Text className="text-caption2" style={{ color: pillColor, fontWeight: '600' }}>{pillText}</Text>
                  </View>
                </View>
                <Text className="text-caption1 text-ink3 mt-1">
                  {lastPolledStr ? `Last sync ${lastPolledStr}` : 'Waiting for first sync…'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="px-3 pb-3">
          <View
            className="rounded-2xl bg-surface flex-row"
            style={{ borderWidth: 0.5, borderColor: palette.hair, paddingVertical: 16 }}
          >
            {[
              { label: 'This month', value: stats.thisMonth, color: palette.accent },
              { label: 'All time',   value: stats.allTime,   color: palette.money  },
              { label: 'Recurring',  value: stats.recurringMerchants, color: palette.rituals },
            ].map((tile, i, arr) => (
              <View
                key={tile.label}
                className="flex-1 items-center"
                style={{ borderRightWidth: i === arr.length - 1 ? 0 : 0.5, borderRightColor: palette.hair }}
              >
                <Text className="text-title2" style={{ color: tile.color, fontWeight: '700' }}>{tile.value}</Text>
                <Text className="text-caption2 text-ink3 mt-1">{tile.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
