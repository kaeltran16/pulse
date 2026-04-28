import { eq } from 'drizzle-orm';

import { dismissedCloseOuts } from '../schema';
import { type AnyDb } from './onboarding';

export async function isDismissedToday(db: AnyDb, dateKey: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  const rows = dx
    .select({ k: dismissedCloseOuts.dateKey })
    .from(dismissedCloseOuts)
    .where(eq(dismissedCloseOuts.dateKey, dateKey))
    .all() as Array<{ k: string }>;
  return rows.length > 0;
}

export async function markDismissedToday(
  db: AnyDb,
  dateKey: string,
  nowMs: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dx = db as any;
  dx.insert(dismissedCloseOuts)
    .values({ dateKey, dismissedAt: nowMs })
    .onConflictDoUpdate({
      target: dismissedCloseOuts.dateKey,
      set: { dismissedAt: nowMs },
    })
    .run();
}
