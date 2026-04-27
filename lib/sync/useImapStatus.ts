import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { imapStatus } from './client';
import type { ImapStatusResponse } from './types';

export type UseImapStatusResult = {
  status: ImapStatusResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

/**
 * Fetches /imap/status on mount, on AppState 'active' transitions, and on demand
 * via refetch(). Screens that own a syncNow() trigger should call refetch() after
 * the sync resolves to update server-state surfaces (status pill, lastPolledAt).
 */
export function useImapStatus(): UseImapStatusResult {
  const [status, setStatus] = useState<ImapStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const r = await imapStatus();
      if (mounted.current) setStatus(r);
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mounted.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refetch();
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void refetch();
    });
    return () => {
      mounted.current = false;
      sub.remove();
    };
  }, [refetch]);

  return { status, isLoading, error, refetch };
}
