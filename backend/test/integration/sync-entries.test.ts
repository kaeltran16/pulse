import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import * as syncedEntriesQ from "../../src/db/queries/syncedEntries.js";

async function seedAccount(ctx: ReturnType<typeof buildTestApp>): Promise<number> {
  const token = signTestToken();
  const res = await request(ctx.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({ email: "x@gmail.com", appPassword: "p" });
  return res.body.accountId as number;
}

function seedEntry(
  ctx: ReturnType<typeof buildTestApp>,
  accountId: number,
  opts: {
    imapUid: number;
    cents: number;
    merchant?: string;
    recurring?: boolean;
  },
): { id: number } {
  const now = Date.now();
  return syncedEntriesQ.insertSyncedEntry(ctx.deps.db, {
    accountId,
    imapUid: opts.imapUid,
    contentHash: `h${opts.imapUid}`,
    cents: opts.cents,
    currency: "USD",
    merchant: opts.merchant ?? "Coffee",
    category: "Food",
    occurredAt: now,
    recurring: opts.recurring ? 1 : 0,
    rawParseResponse: "{}",
    emailSubject: "alert",
    emailFrom: "alerts@bank.com",
    createdAt: now,
  });
}

describe("GET /sync/entries", () => {
  it("empty DB → returns accountId:null, entries:[], hasMore:false", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?since=0&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ accountId: null, entries: [], hasMore: false, cursor: 0 });
  });

  it("connected account with no rows → returns accountId, entries:[]", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/sync/entries?since=0&limit=10")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(accountId);
    expect(res.body.entries).toEqual([]);
    expect(res.body.hasMore).toBe(false);
  });

  it("3 rows, limit=2 → first call returns 2 + hasMore:true; second call returns 1 + hasMore:false", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    seedEntry(ctx, accountId, { imapUid: 1, cents: 100 });
    seedEntry(ctx, accountId, { imapUid: 2, cents: 200 });
    seedEntry(ctx, accountId, { imapUid: 3, cents: 300, recurring: true });
    const token = signTestToken();

    const r1 = await request(ctx.app)
      .get("/sync/entries?since=0&limit=2")
      .set("Authorization", `Bearer ${token}`);
    expect(r1.body.entries).toHaveLength(2);
    expect(r1.body.hasMore).toBe(true);
    const cursor1 = r1.body.cursor;

    const r2 = await request(ctx.app)
      .get(`/sync/entries?since=${cursor1}&limit=2`)
      .set("Authorization", `Bearer ${token}`);
    expect(r2.body.entries).toHaveLength(1);
    expect(r2.body.hasMore).toBe(false);
    expect(r2.body.entries[0].recurring).toBe(true);
    expect(r2.body.entries[0].cents).toBe(300);
    expect(r2.body.entries[0].merchant).toBe("Coffee");
    expect(r2.body.entries[0].emailFrom).toBe("alerts@bank.com");
  });

  it("DTO excludes private fields (rawParseResponse, contentHash, emailSubject)", async () => {
    const ctx = buildTestApp();
    const accountId = await seedAccount(ctx);
    seedEntry(ctx, accountId, { imapUid: 1, cents: 100 });
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/sync/entries")
      .set("Authorization", `Bearer ${token}`);
    expect(res.body.entries[0]).not.toHaveProperty("rawParseResponse");
    expect(res.body.entries[0]).not.toHaveProperty("contentHash");
    expect(res.body.entries[0]).not.toHaveProperty("emailSubject");
  });

  it("limit > 500 → 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?limit=501")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("negative since → 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/sync/entries?since=-1")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .get("/sync/entries")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
