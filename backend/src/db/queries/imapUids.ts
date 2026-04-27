import { and, asc, eq, gt } from "drizzle-orm";
import type { Db } from "../client.js";
import { imapUids } from "../schema.js";

export function markUidSeen(
  db: Db,
  accountId: number,
  uid: number,
  firstSeenAt: number,
): void {
  db.insert(imapUids)
    .values({ accountId, uid, firstSeenAt })
    .onConflictDoNothing()
    .run();
}

export function hasSeen(db: Db, accountId: number, uid: number): boolean {
  const row = db
    .select({ uid: imapUids.uid })
    .from(imapUids)
    .where(and(eq(imapUids.accountId, accountId), eq(imapUids.uid, uid)))
    .get();
  return row !== undefined;
}

export function listSeenUidsForAccount(
  db: Db,
  accountId: number,
  sinceUid?: number,
): number[] {
  const where = sinceUid !== undefined
    ? and(eq(imapUids.accountId, accountId), gt(imapUids.uid, sinceUid))
    : eq(imapUids.accountId, accountId);

  const rows = db
    .select({ uid: imapUids.uid })
    .from(imapUids)
    .where(where)
    .orderBy(asc(imapUids.uid))
    .all();

  return rows.map((r) => r.uid);
}
