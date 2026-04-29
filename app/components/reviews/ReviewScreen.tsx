import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/provider';
import { colors, type } from '@/lib/theme/tokens';
import { db } from '@/lib/db/client';
import {
  computeReviewAggregates,
  computeReviewSignals,
  isPeriodEmpty,
  lastCompletedPeriodKey,
  periodBounds,
  type ReviewPeriod,
} from '@/lib/db/queries/reviewAggregates';
import { getCachedReview, putCachedReview } from '@/lib/db/queries/generatedReviews';
import { postReview } from '@/lib/sync/reviewClient';
import type { ReviewAggregates, ReviewResponse, ReviewSignals } from '@/lib/api-types';
import { PalComposer } from '@/components/PalComposer';
import { ThreeStatSummary } from './ThreeStatSummary';
import { HeroCard } from './HeroCard';
import { PatternsList } from './PatternsList';
import { OneThingToTry } from './OneThingToTry';
import { ByTheNumbers } from './ByTheNumbers';
import { ReviewEmptyState } from './ReviewEmptyState';
import { ReviewRetryCard } from './ReviewRetryCard';

type Props = {
  period: ReviewPeriod;
  initialKey?: string;
};

const MAX_BACK_OFFSET = -12;

function offsetFromKey(period: ReviewPeriod, key: string): number {
  const today = new Date();
  for (let i = -1; i >= MAX_BACK_OFFSET; i--) {
    if (periodBounds(period, today, i).key === key) return i;
  }
  return -1;
}

function keyAtOffset(period: ReviewPeriod, offset: number): string {
  return periodBounds(period, new Date(), offset).key;
}

function periodLabel(period: ReviewPeriod, key: string): string {
  if (period === 'monthly') {
    const [y, m] = key.split('-').map(Number);
    const monthName = new Date(y, m - 1, 1).toLocaleString(undefined, { month: 'long' });
    return `${monthName} ${y}`;
  }
  const today = new Date();
  for (let i = 0; i >= MAX_BACK_OFFSET; i--) {
    const b = periodBounds('weekly', today, i);
    if (b.key === key) {
      const start = new Date(b.startMs);
      const end = new Date(b.endMs - 1);
      const fmt = (d: Date) => d.toLocaleString(undefined, { month: 'short', day: 'numeric' });
      return `${fmt(start)} – ${fmt(end)}`;
    }
  }
  return key;
}

function emptySignals(): ReviewSignals {
  return { topSpendDay: null, ritualVsNonRitual: null, bestStreak: null, underBudget: null };
}

export function ReviewScreen({ period, initialKey }: Props) {
  const router = useRouter();
  const { resolved } = useTheme();
  const palette = colors[resolved];

  const startKey = initialKey ?? lastCompletedPeriodKey(period, new Date());
  const [offset, setOffset] = useState(offsetFromKey(period, startKey));
  const periodKey = keyAtOffset(period, offset);

  const [aggregates, setAggregates] = useState<ReviewAggregates | null>(null);
  const [signals, setSignals] = useState<ReviewSignals | null>(null);
  const [response, setResponse] = useState<ReviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [palOpen, setPalOpen] = useState(false);
  const [palPrefill, setPalPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setError(null);
      setResponse(null);
      const aggs = await computeReviewAggregates(db, period, periodKey);
      if (cancelled) return;
      setAggregates(aggs);
      if (isPeriodEmpty(aggs)) return;
      const cached = await getCachedReview(db, period, periodKey);
      if (cached) {
        setResponse(cached);
        return;
      }
      const sigs = await computeReviewSignals(db, period, aggs, periodKey);
      if (cancelled) return;
      setSignals(sigs);
      try {
        setBusy(true);
        const resp = await postReview({ period, periodKey, aggregates: aggs, signals: sigs });
        if (cancelled) return;
        await putCachedReview(db, period, periodKey, resp);
        setResponse(resp);
      } catch (e) {
        if (!cancelled) setError((e as Error).name ?? 'Error');
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period, periodKey]);

  const onRegenerate = useCallback(async () => {
    if (!aggregates) return;
    setError(null);
    setBusy(true);
    try {
      const sigs = signals ?? (await computeReviewSignals(db, period, aggregates, periodKey));
      setSignals(sigs);
      const resp = await postReview({ period, periodKey, aggregates, signals: sigs });
      await putCachedReview(db, period, periodKey, resp);
      setResponse(resp);
    } catch (e) {
      setError((e as Error).name ?? 'Error');
    } finally {
      setBusy(false);
    }
  }, [aggregates, signals, period, periodKey]);

  const onAskPal = useCallback((prompt: string) => {
    setPalPrefill(prompt);
    setPalOpen(true);
  }, []);

  if (!aggregates) {
    return <View style={{ flex: 1, backgroundColor: palette.bg }} />;
  }

  const empty = isPeriodEmpty(aggregates);
  const canGoForward = offset < 0;
  const canGoBack = offset > MAX_BACK_OFFSET;

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={() => router.back()}
            style={{ paddingVertical: 6, paddingRight: 6 }}
          >
            <Text style={{ ...type.body, color: palette.accent }}>‹ Back</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            disabled={!canGoBack}
            onPress={() => setOffset((o) => Math.max(MAX_BACK_OFFSET, o - 1))}
            accessibilityLabel="Previous period"
            style={{ opacity: canGoBack ? 1 : 0.3, paddingHorizontal: 8 }}
          >
            <Text style={{ ...type.body, color: palette.accent }}>‹</Text>
          </Pressable>
          <Pressable
            disabled={!canGoForward}
            onPress={() => setOffset((o) => Math.min(0, o + 1))}
            accessibilityLabel="Next period"
            style={{ opacity: canGoForward ? 1 : 0.3, paddingHorizontal: 8 }}
          >
            <Text style={{ ...type.body, color: palette.accent }}>›</Text>
          </Pressable>
        </View>
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '600', color: palette.accent, letterSpacing: 0.3 }}>
            {period === 'weekly' ? 'WEEKLY REVIEW' : 'MONTHLY REVIEW'} · {periodLabel(period, periodKey)}
          </Text>
        </View>

        {empty ? (
          <ReviewEmptyState period={period} />
        ) : (
          <>
            <ThreeStatSummary aggregates={aggregates} />
            {error ? (
              <ReviewRetryCard onRetry={onRegenerate} busy={busy} />
            ) : response ? (
              <>
                <HeroCard hero={response.hero} onRegenerate={onRegenerate} busy={busy} />
                <PatternsList patterns={response.patterns} signals={signals ?? emptySignals()} />
                {period === 'weekly' && response.oneThingToTry && (
                  <OneThingToTry
                    markdown={response.oneThingToTry.markdown}
                    askPalPrompt={response.oneThingToTry.askPalPrompt}
                    onAskPal={onAskPal}
                  />
                )}
                {period === 'monthly' && (
                  <ByTheNumbers
                    aggregates={aggregates}
                    bestStreakDays={aggregates.rituals.bestStreakRitual?.streak ?? null}
                  />
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
      <PalComposer
        visible={palOpen}
        onClose={() => setPalOpen(false)}
        prefill={palPrefill}
      />
    </View>
  );
}
