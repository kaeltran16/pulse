import { and, asc, eq, gt, gte, lte } from "drizzle-orm";
import type { Db } from "../client.js";
import { syncedEntries, type SyncedEntry, type NewSyncedEntry } from "../schema.js";

const SIXTY_DAYS_MS = 60 * 86_400_000;

export function insertSyncedEntry(db: Db, input: NewSyncedEntry): { id: number } {
  const [row] = db
    .insert(syncedEntries)
    .values(input)
    .returning({ id: syncedEntries.id })
    .all();
  return { id: row.id };
}

export function listSinceCursor(
  db: Db,
  accountId: number,
  sinceId: number,
  limit: number,
): SyncedEntry[] {
  return db
    .select()
    .from(syncedEntries)
    .where(and(eq(syncedEntries.accountId, accountId), gt(syncedEntries.id, sinceId)))
    .orderBy(asc(syncedEntries.id))
    .limit(limit)
    .all();
}

export function findRecurringCandidates(
  db: Db,
  accountId: number,
  merchant: string,
  occurredAt: number,
): SyncedEntry[] {
  const lowerBound = occurredAt - SIXTY_DAYS_MS;
  return db
    .select()
    .from(syncedEntries)
    .where(
      and(
        eq(syncedEntries.accountId, accountId),
        eq(syncedEntries.merchant, merchant),
        gte(syncedEntries.occurredAt, lowerBound),
        lte(syncedEntries.occurredAt, occurredAt),
      ),
    )
    .all();
}
