import { eq } from 'drizzle-orm';

import { syncCursor, type SyncCursor } from '../schema';
import { type AnyDb } from './onboarding';

export type CursorState = {
  accountId: number | null;
  lastSyncedId: number;
};

export function getCursor(db: AnyDb): CursorState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (db as any).select().from(syncCursor).where(eq(syncCursor.id, 1)).all() as
    | SyncCursor[]
    | undefined;
  const row = rows && rows.length > 0 ? rows[0] : undefined;
  if (!row) return { accountId: null, lastSyncedId: 0 };
  return { accountId: row.accountId, lastSyncedId: row.lastSyncedId };
}

export function setCursor(db: AnyDb, accountId: number, lastSyncedId: number): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (db as any)
    .update(syncCursor)
    .set({ accountId, lastSyncedId, updatedAt: Date.now() })
    .where(eq(syncCursor.id, 1))
    .run();
}
