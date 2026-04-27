import { describe, it, expect } from "vitest";
import request from "supertest";
import { sql } from "drizzle-orm";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";
import * as imapUidsQ from "../../src/db/queries/imapUids.js";

async function seedConnected(ctx: ReturnType<typeof buildTestApp>): Promise<number> {
  const token = signTestToken();
  const res = await request(ctx.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "x@gmail.com", appPassword: "p", senderAllowlist: [] });
  return res.body.accountId as number;
}

describe("DELETE /imap/disconnect", () => {
  it("deletes the account, retains synced_entries with NULL account_id, cascades imap_uids", async () => {
    const ctx = buildTestApp();
    const accountId = await seedConnected(ctx);
    const now = Date.now();

    syncedEntriesQ.insertSyncedEntry(ctx.deps.db, {
      accountId,
      imapUid: 1,
      contentHash: "h",
      cents: 100,
      currency: "USD",
      occurredAt: now,
      rawParseResponse: "{}",
      createdAt: now,
    });
    imapUidsQ.markUidSeen(ctx.deps.db, accountId, 1, now);

    const token = signTestToken();
    const res = await request(ctx.app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);

    const accounts = ctx.deps.db.all(
      sql`SELECT COUNT(*) AS n FROM imap_accounts`,
    )[0] as { n: number };
    expect(accounts.n).toBe(0);

    const uids = ctx.deps.db.all(sql`SELECT COUNT(*) AS n FROM imap_uids`)[0] as { n: number };
    expect(uids.n).toBe(0);

    const synced = ctx.deps.db.all(
      sql`SELECT COUNT(*) AS n FROM synced_entries`,
    )[0] as { n: number };
    expect(synced.n).toBe(1);
    const orphan = ctx.deps.db.all(
      sql`SELECT COUNT(*) AS n FROM synced_entries WHERE account_id IS NULL`,
    )[0] as { n: number };
    expect(orphan.n).toBe(1);
  });

  it("returns 204 when no rows exist (idempotent)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .delete("/imap/disconnect")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
