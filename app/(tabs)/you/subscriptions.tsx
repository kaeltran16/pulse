import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/lib/db/client';
import { spendingEntries } from '@/lib/db/schema';
import { subscriptionList, type SubscriptionGroup } from '@/lib/db/queries/syncedEntries';
import { categoryToToken } from '@/lib/sync/categoryColor';
import { syncNow } from '@/lib/sync/syncNow';
import { useTheme } from '@/lib/theme/provider';
import { colors } from '@/lib/theme/tokens';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysUntil(ts: number, now: number): number {
  return Math.max(0, Math.round((ts - now) / MS_PER_DAY));
}

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];
  const live = useLiveQuery(db.select().from(spendingEntries));
  const [chip, setChip] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  // Recompute on every change.
  void live.data;
  const groups: SubscriptionGroup[] = subscriptionList(db);
  const monthlyTotalCents = groups.reduce((s, g) => s + g.monthlyAmountCents, 0);
  const yearlyTotalCents = monthlyTotalCents * 12;
  const now = Date.now();
  const nextUp = groups.length > 0 ? groups[0] : null;

  const onScan = async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const r = await syncNow(db);
      setChip(r.inserted === 0 ? 'Up to date.' : `Synced ${r.inserted} new.`);
    } catch {
      setChip('Sync failed — try again.');
    } finally {
      setScanning(false);
      setTimeout(() => setChip(null), 2000);
    }
  };

  const tokenBg = (token: string) => {
    switch (token) {
      case 'rituals': return palette.rituals;
      case 'accent':  return palette.accent;
      case 'move':    return palette.move;
      case 'money':   return palette.money;
      default:        return palette.fill;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="flex-row items-center px-3 py-3">
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text className="text-callout" style={{ color: palette.accent }}>‹ Back</Text>
          </Pressable>
        </View>

        <View className="px-4 pt-1 pb-3">
          <Text className="text-largeTitle text-ink">Subscriptions</Text>
          <Text className="text-subhead text-ink3 mt-1">Auto-detected from your email</Text>
        </View>

        {groups.length === 0 ? (
          <View className="px-6 py-12 items-center">
            <Text className="text-callout text-ink3 text-center">
              Pal will list recurring charges here once it's seen them ≥2× in 60 days.
            </Text>
          </View>
        ) : (
          <>
            <View className="px-3 pb-3">
              <View className="rounded-2xl bg-surface p-4">
                <Text
                  className="text-caption2 uppercase mb-1"
                  style={{ color: palette.money, fontWeight: '700', letterSpacing: 0.5 }}
                >
                  Monthly
                </Text>
                <View className="flex-row items-baseline">
                  <Text className="text-title1 text-ink" style={{ fontWeight: '700' }}>
                    ${(monthlyTotalCents / 100).toFixed(2)}
                  </Text>
                  <Text className="text-subhead text-ink3 ml-2">
                    · ${Math.round(yearlyTotalCents / 100)}/yr
                  </Text>
                </View>
                <View
                  className="mt-3 h-2 rounded-full overflow-hidden flex-row"
                  style={{ backgroundColor: palette.fill }}
                >
                  {groups.map((g, i) => {
                    const pct = (g.monthlyAmountCents / monthlyTotalCents) * 100;
                    return (
                      <View
                        key={g.merchant}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: tokenBg(categoryToToken(g.category)),
                          borderRightWidth: i === groups.length - 1 ? 0 : 1,
                          borderRightColor: palette.bg,
                        }}
                      />
                    );
                  })}
                </View>
                {nextUp && (
                  <Text className="text-caption1 text-ink2 mt-3">
                    Next up: <Text className="text-ink" style={{ fontWeight: '600' }}>{nextUp.merchant}</Text> in {daysUntil(nextUp.predictedNextChargeAt, now)} days · ${(nextUp.monthlyAmountCents / 100).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>

            <View className="px-4 pb-2">
              <Text className="text-headline text-ink">Upcoming</Text>
            </View>
            <View className="px-3">
              <View className="rounded-xl bg-surface overflow-hidden">
                {groups.map((g, i) => {
                  const days = daysUntil(g.predictedNextChargeAt, now);
                  const tokenColor = tokenBg(categoryToToken(g.category));
                  return (
                    <View
                      key={g.merchant}
                      className="flex-row items-center px-4 py-3"
                      style={{ borderBottomWidth: i === groups.length - 1 ? 0 : 0.5, borderBottomColor: palette.hair }}
                    >
                      <View
                        className="h-9 w-9 rounded-lg mr-3 items-center justify-center"
                        style={{ backgroundColor: tokenColor }}
                      />
                      <View className="flex-1 min-w-0">
                        <Text className="text-callout text-ink" numberOfLines={1}>{g.merchant}</Text>
                        <Text className="text-caption1 text-ink3 mt-1" numberOfLines={1}>
                          {(g.category ?? 'Uncategorized')} · in {days} day{days === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <View className="items-end">
                        <Text className="text-callout text-ink">${(g.monthlyAmountCents / 100).toFixed(2)}</Text>
                        <Text className="text-caption2 text-ink4 uppercase mt-1">/mo</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}

        <View className="px-4 pt-3 items-center">
          <Pressable onPress={onScan} disabled={scanning}>
            <Text className="text-callout" style={{ color: palette.accent }}>
              {scanning ? 'Scanning…' : 'Scan email again'}
            </Text>
          </Pressable>
          {chip && <Text className="text-caption1 text-ink3 mt-2">{chip}</Text>}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
