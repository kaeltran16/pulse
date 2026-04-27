import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { SymbolView } from 'expo-symbols';

import { db } from '@/lib/db/client';
import { recentSynced, subscriptionList, syncedStats, type SyncedRow } from '@/lib/db/queries/syncedEntries';
import { spendingEntries } from '@/lib/db/schema';
import { AuthError } from '@/lib/sync/errors';
import { syncNow } from '@/lib/sync/syncNow';
import { useImapStatus } from '@/lib/sync/useImapStatus';
import { useRelativeTime } from '@/lib/sync/useRelativeTime';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

type Palette = typeof colors.light | typeof colors.dark;

function SettingsRow({
  icon, iconBg, title, value, onPress, palette, isLast,
}: {
  icon: string;
  iconBg: string;
  title: string;
  value: string;
  onPress?: () => void;
  palette: Palette;
  isLast: boolean;
}) {
  const interactive = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair }}
    >
      <View className="h-8 w-8 rounded-lg items-center justify-center mr-3" style={{ backgroundColor: iconBg }}>
        <SymbolView name={icon as never} size={14} tintColor="#fff" />
      </View>
      <Text className="flex-1 text-callout text-ink">{title}</Text>
      <Text className="text-callout text-ink3 mr-1">{value}</Text>
      {interactive && <Text className="text-ink4">›</Text>}
    </Pressable>
  );
}

function RecentRow({ row, isLast, palette }: { row: SyncedRow; isLast: boolean; palette: Palette }) {
  const dollars = `−$${(row.cents / 100).toFixed(2)}`;
  return (
    <View
      className="flex-row items-center px-4 py-3"
      style={{ borderBottomWidth: isLast ? 0 : 0.5, borderBottomColor: palette.hair }}
    >
      <View className="flex-1 min-w-0">
        <Text className="text-callout text-ink" numberOfLines={1}>{row.merchant ?? 'Unknown merchant'}</Text>
        <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
          {row.category ?? 'Uncategorized'}
        </Text>
      </View>
      <Text className="text-callout text-ink ml-3">{dollars}</Text>
    </View>
  );
}

export default function EmailSyncDashboard() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const { status, isLoading, refetch } = useImapStatus();
  const lastPolledStr = useRelativeTime(status?.connected ? status.lastPolledAt : null);
  const liveSpending = useLiveQuery(db.select().from(spendingEntries));
  const stats = (() => {
    void liveSpending.data;
    return syncedStats(db);
  })();
  const recent = (() => {
    void liveSpending.data;
    return recentSynced(db, 6);
  })();
  const palCard = (() => {
    void liveSpending.data;
    const groups = subscriptionList(db);
    if (groups.length === 0) return null;
    const total = groups.reduce((s, g) => s + g.monthlyAmountCents, 0);
    return { count: groups.length, totalDollars: Math.round(total / 100) };
  })();

  const [syncing, setSyncing] = useState(false);
  const [chip, setChip] = useState<string | null>(null);

  const showChip = (msg: string) => {
    setChip(msg);
    setTimeout(() => setChip(null), 2000);
  };

  const onSyncNow = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const r = await syncNow(db);
      showChip(r.inserted === 0
        ? 'Up to date.'
        : `Synced ${r.inserted} new entr${r.inserted === 1 ? 'y' : 'ies'}.`);
    } catch (e) {
      if (e instanceof AuthError) {
        router.replace('/(tabs)/you/email-sync/intro');
        return;
      }
      showChip('Sync failed — pull to refresh.');
    } finally {
      setSyncing(false);
      void refetch();
    }
  };

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

        {(status.status === 'error' || status.status === 'paused') && (
          <View className="px-3 pb-2">
            <View
              className="rounded-xl px-4 py-3"
              style={{
                backgroundColor: status.status === 'error' ? '#FF3B3014' : palette.moneyTint,
                borderWidth: 0.5,
                borderColor: status.status === 'error' ? '#FF3B3033' : palette.money + '33',
              }}
            >
              <Text className="text-callout text-ink">
                {status.status === 'error'
                  ? "Couldn't connect to Gmail — your app password may have been revoked."
                  : 'Sync paused after repeated failures.'}
              </Text>
              <Pressable
                onPress={() => router.replace('/(tabs)/you/email-sync/connect')}
                className="mt-2"
              >
                <Text className="text-callout" style={{ color: palette.accent, fontWeight: '600' }}>Reconnect</Text>
              </Pressable>
            </View>
          </View>
        )}

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
            <View className="flex-row mt-3">
              <Pressable
                onPress={onSyncNow}
                disabled={syncing}
                className="flex-1 rounded-xl py-3 items-center justify-center"
                style={{ backgroundColor: syncing ? palette.fill : palette.ink }}
              >
                <Text className="text-callout" style={{ color: syncing ? palette.ink2 : palette.bg, fontWeight: '600' }}>
                  {syncing ? 'Syncing…' : 'Sync now'}
                </Text>
              </Pressable>
            </View>
            {chip && (
              <View className="mt-2 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: palette.fill }}>
                <Text className="text-caption1 text-ink2">{chip}</Text>
              </View>
            )}
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

        {palCard && (
          <View className="px-3 pb-3">
            <View
              className="rounded-2xl p-4"
              style={{ backgroundColor: palette.accentTint, borderWidth: 0.5, borderColor: palette.accent + '22' }}
            >
              <Text className="text-caption2 uppercase mb-1" style={{ color: palette.accent, fontWeight: '700', letterSpacing: 0.5 }}>
                ✨ Pal noticed
              </Text>
              <Text className="text-callout text-ink">
                You have <Text style={{ fontWeight: '700' }}>{palCard.count} recurring subscription{palCard.count === 1 ? '' : 's'}</Text> totaling ${palCard.totalDollars}/mo.
              </Text>
              <Pressable
                className="mt-3 rounded-full self-start px-3 py-1.5"
                style={{ backgroundColor: palette.accent }}
                onPress={() => router.push('/(tabs)/you/subscriptions')}
              >
                <Text className="text-caption1" style={{ color: '#fff', fontWeight: '600' }}>Review subscriptions</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="px-3 pb-3">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Recently synced</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            {recent.length === 0 ? (
              <View className="px-4 py-6 items-center">
                <Text className="text-callout text-ink3 text-center">
                  No receipts yet — most banks send within ~24h.
                </Text>
              </View>
            ) : (
              recent.map((row, i) => (
                <RecentRow key={row.id} row={row} isLast={i === recent.length - 1} palette={palette} />
              ))
            )}
          </View>
        </View>

        <View className="px-3 pb-3">
          <Text className="text-caption1 text-ink3 uppercase mb-1 px-1">Sync settings</Text>
          <View className="rounded-xl bg-surface overflow-hidden">
            <SettingsRow
              icon="arrow.triangle.2.circlepath"
              iconBg={palette.accent}
              title="Background sync"
              value={`Every ${Math.round(status.pollIntervalSeconds / 60)} min`}
              palette={palette}
              isLast={false}
            />
            <SettingsRow
              icon="bell.fill"
              iconBg="#FF9500"
              title="Notify on new detection"
              value="Off"
              palette={palette}
              isLast={false}
            />
            <SettingsRow
              icon="sparkles"
              iconBg={palette.rituals}
              title="Pal auto-categorize"
              value="On"
              palette={palette}
              isLast={false}
            />
            <SettingsRow
              icon="magnifyingglass"
              iconBg={palette.money}
              title="Detected senders"
              value={`${status.senderAllowlist.length}`}
              onPress={() => router.push('/(tabs)/you/email-sync/senders')}
              palette={palette}
              isLast
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
