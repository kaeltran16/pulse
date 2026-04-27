import { type AnyDb } from '../db/queries/onboarding';
import { insertSyncedBatch } from '../db/queries/insertSyncedEntry';
import { getCursor, setCursor } from '../db/queries/syncCursor';

import { fetchSyncEntries, imapStatus } from './client';
import type { SyncResult } from './types';

let inFlight: Promise<SyncResult> | null = null;

export function __resetInflightForTests(): void {
  inFlight = null;
}

export function syncNow(db: AnyDb): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = doSync(db).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

const PAGE_LIMIT = 200;

async function doSync(db: AnyDb): Promise<SyncResult> {
  const status = await imapStatus();
  if (!status.connected) {
    return { inserted: 0, status: 'disconnected' };
  }

  let cursor = getCursor(db);
  if (cursor.accountId !== status.accountId) {
    cursor = { accountId: status.accountId, lastSyncedId: 0 };
  }

  let inserted = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await fetchSyncEntries({ since: cursor.lastSyncedId, limit: PAGE_LIMIT });
    // Account id may be null (no rows) or a different number than ours.
    if (page.accountId === null || page.accountId !== cursor.accountId) {
      // Disconnected or reconnected mid-loop — bail; next syncNow() resets cleanly.
      break;
    }
    if (page.entries.length > 0) {
      insertSyncedBatch(db, page.entries);
      const newLast = page.entries[page.entries.length - 1].id;
      setCursor(db, page.accountId, newLast);
      cursor = { accountId: page.accountId, lastSyncedId: newLast };
      inserted += page.entries.length;
    }
    if (!page.hasMore) break;
  }

  const finalStatus = status.status === 'error' ? 'error' : 'connected';
  return { inserted, status: finalStatus };
}
