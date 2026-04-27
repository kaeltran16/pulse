import { useEffect, useMemo, useState } from 'react';

import { db } from '@/lib/db/client';
import { readCache, vacuumStaleNudges, writeCache } from '@/lib/db/queries/palCache';
import type { NudgeTodayRequest, NudgeTodayResponse } from '@/lib/api-types';
import type { Ritual } from '@/lib/db/schema';
import { postNudgeToday } from '@/lib/sync/palClient';

export type UseRitualNudgeInput = {
  done: number;
  total: number;
  rituals: Ritual[];
  doneSet: Set<number>;
  todayKey: string;
  bestStreak?: { title: string; streak: number };
  streakByRitual: Map<number, number>;
};

export type UseRitualNudgeResult = {
  headline: string;
  sub: string;
  loading: boolean;
};

function nudgeHeadline(done: number, total: number): string {
  if (total === 0) return 'Add a ritual to get going.';
  if (done === 0) return "Let's start the day.";
  if (done === total) return 'All done — nice.';
  if (done >= total - 1) return 'One to close the day';
  return `${total - done} to go`;
}

function localFallbackSub(input: UseRitualNudgeInput): string {
  const remaining = input.rituals.filter((r) => !input.doneSet.has(r.id));
  if (remaining.length === 0) return 'All done — nice work today.';
  return `Your ${remaining[0].title} is waiting.`;
}

export function useRitualNudge(input: UseRitualNudgeInput): UseRitualNudgeResult {
  const { done, total, todayKey } = input;
  const [sub, setSub] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const headline = useMemo(() => nudgeHeadline(done, total), [done, total]);

  useEffect(() => {
    vacuumStaleNudges(db, todayKey);
  }, [todayKey]);

  useEffect(() => {
    let cancelled = false;

    if (total === 0) { setSub(''); return; }

    const key = `nudge:${todayKey}:${done}:${total}`;
    const cached = readCache<NudgeTodayResponse>(db, key);
    if (cached) {
      setSub(cached.sub);
      return;
    }

    const remaining: NudgeTodayRequest['remaining'] = input.rituals
      .filter((r) => !input.doneSet.has(r.id))
      .map((r) => ({
        title: r.title,
        streak: input.streakByRitual.get(r.id) ?? 0,
        cadence: r.cadence,
      }));

    setLoading(true);
    postNudgeToday({
      date: todayKey,
      done,
      total,
      remaining,
      bestStreak: input.bestStreak,
    })
      .then((r) => {
        if (cancelled) return;
        writeCache(db, key, r);
        setSub(r.sub);
      })
      .catch(() => {
        if (cancelled) return;
        setSub(localFallbackSub(input));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey, done, total]);

  return { headline, sub: sub ?? '', loading };
}
