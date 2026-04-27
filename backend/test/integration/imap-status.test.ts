import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

async function seedConnected(ctx: ReturnType<typeof buildTestApp>) {
  const token = signTestToken();
  await request(ctx.app)
    .post("/imap/connect")
    .set("Authorization", `Bearer ${token}`)
    .send({
      email: "alex@gmail.com",
      appPassword: "abcd efgh ijkl mnop",
      senderAllowlist: ["notify@chase.com"],
    });
}

describe("GET /imap/status", () => {
  it("returns {connected:false} when no rows", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ connected: false });
  });

  it("returns full payload when connected", async () => {
    const ctx = buildTestApp();
    await seedConnected(ctx);
    const token = signTestToken();
    const res = await request(ctx.app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.connected).toBe(true);
    expect(res.body.emailAddress).toBe("alex@gmail.com");
    expect(res.body.status).toBe("active");
    expect(res.body.lastPolledAt).toBeNull();
    expect(res.body.lastError).toBeNull();
    expect(res.body.pollIntervalSeconds).toBe(300);
    expect(res.body.senderAllowlist).toEqual(["notify@chase.com"]);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["parse"] });
    const res = await request(app)
      .get("/imap/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
