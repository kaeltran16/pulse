import { desc, eq } from "drizzle-orm";
import type { Db } from "../client.js";
import { imapAccounts, type ImapAccount, type NewImapAccount } from "../schema.js";

export function createImapAccount(db: Db, input: NewImapAccount): { id: number } {
  const [row] = db
    .insert(imapAccounts)
    .values(input)
    .returning({ id: imapAccounts.id })
    .all();
  return { id: row.id };
}

export function getImapAccount(db: Db, id: number): ImapAccount | undefined {
  return db.select().from(imapAccounts).where(eq(imapAccounts.id, id)).get();
}

export function listImapAccounts(db: Db): ImapAccount[] {
  return db.select().from(imapAccounts).all();
}

export function updateLastPolled(db: Db, id: number, at: number): void {
  db.update(imapAccounts)
    .set({ lastPolledAt: at, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}

export function updateStatus(
  db: Db,
  id: number,
  status: "active" | "paused" | "error",
): void {
  db.update(imapAccounts)
    .set({ status, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}

export function updateError(db: Db, id: number, error: string | null): void {
  db.update(imapAccounts)
    .set({ lastError: error, updatedAt: Date.now() })
    .where(eq(imapAccounts.id, id))
    .run();
}

// Returns the most recently created imap_accounts row, or undefined if none.
// Meta-spec §6 commits to one inbox per Pulse install, so "active" = "most recent".
export function getActiveAccount(db: Db): ImapAccount | undefined {
  return db
    .select()
    .from(imapAccounts)
    .orderBy(desc(imapAccounts.createdAt))
    .limit(1)
    .get();
}

export function deleteImapAccount(db: Db, id: number): void {
  db.delete(imapAccounts).where(eq(imapAccounts.id, id)).run();
}
