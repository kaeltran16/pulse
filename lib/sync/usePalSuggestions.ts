import { useCallback, useEffect, useState } from 'react';

import { db } from '@/lib/db/client';
import { deleteCacheByPrefix, readCache, writeCache } from '@/lib/db/queries/palCache';
import type { Ritual, RitualEntry } from '@/lib/db/schema';
import { postSuggestRituals } from '@/lib/sync/palClient';
import type { SuggestRitualsResponse } from '@/lib/api-types';

const TTL_MS = 24 * 60 * 60 * 1000;

// Deterministic FNV-1a 32-bit hash → 8 hex chars. Used solely as a cache-key
// suffix; collisions are non-fatal (would mean a stale cache hit, replaced by
// the next fetch).
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function hashActive(active: Ritual[]): string {
  const canonical = active
    .map((r) => [r.id, r.title, r.cadence, r.color])
    .sort((a, b) => Number(a[0]) - Number(b[0]));
  return fnv1a(JSON.stringify(canonical));
}

export type UsePalSuggestionsResult = {
  suggestions: SuggestRitualsResponse['suggestions'];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

export function usePalSuggestions(active: Ritual[], recent: RitualEntry[]): UsePalSuggestionsResult {
  const [suggestions, setSuggestions] = useState<SuggestRitualsResponse['suggestions']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchAndStore = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const titleById = new Map(active.map((r) => [r.id, r.title]));
      const recentForRequest = recent
        .filter((e) => titleById.has(e.ritualId))
        .map((e) => ({ title: titleById.get(e.ritualId) as string, occurredAt: e.occurredAt }));
      const r = await postSuggestRituals({
        active: active.map((a) => ({ title: a.title, cadence: a.cadence, color: a.color })),
        recentRitualEntries: recentForRequest,
      });
      const key = `suggestions:${hashActive(active)}`;
      writeCache(db, key, r);
      setSuggestions(r.suggestions);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [active, recent]);

  const refresh = useCallback(async (): Promise<void> => {
    deleteCacheByPrefix(db, 'suggestions:');
    await fetchAndStore();
  }, [fetchAndStore]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const key = `suggestions:${hashActive(active)}`;
      const cached = readCache<SuggestRitualsResponse>(db, key, TTL_MS);
      if (cancelled) return;
      if (cached) {
        setSuggestions(cached.suggestions);
        return;
      }
      await fetchAndStore();
    })();
    return () => { cancelled = true; };
    // intentionally omit fetchAndStore — depends on active/recent which already trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active.map((a) => a.id).join(','), active.map((a) => a.title).join(','), active.length]);

  return { suggestions, loading, error, refresh };
}
