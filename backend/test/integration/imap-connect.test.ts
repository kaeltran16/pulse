import { describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

describe("POST /imap/connect", () => {
  it("happy path: validates, encrypts, inserts, returns 201", async () => {
    const ctx = buildTestApp();
    const token = signTestToken();
    const res = await request(ctx.app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: "alex@gmail.com",
        appPassword: "abcd efgh ijkl mnop",
        senderAllowlist: ["notify@chase.com"],
      });

    expect(res.status).toBe(201);
    expect(res.body.accountId).toEqual(expect.any(Number));
    expect(res.body.status).toBe("active");
    expect(res.body.emailAddress).toBe("alex@gmail.com");

    const all = ctx.deps.db.all(sql`SELECT * FROM imap_accounts`);
    expect(all).toHaveLength(1);
  });

  it("returns 401 imap_auth_failed when validator rejects", async () => {
    const { app } = buildTestApp({
      imapValidator: async () => {
        throw new Error("Invalid credentials");
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "alex@gmail.com", appPassword: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("imap_auth_failed");
  });

  it("returns 409 already_connected on duplicate email", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const body = { email: "alex@gmail.com", appPassword: "abcd efgh ijkl mnop" };
    await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("already_connected");
  });

  it("returns 400 on malformed body (missing email)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ appPassword: "x" });
    expect(res.status).toBe(400);
  });

  it("returns 403 when token lacks 'sync' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["chat", "parse"] });
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "x@gmail.com", appPassword: "x" });
    expect(res.status).toBe(403);
  });

  it("returns 503 server_misconfig when encryptionKey is null", async () => {
    const { app } = buildTestApp({ encryptionKey: null });
    const token = signTestToken();
    const res = await request(app)
      .post("/imap/connect")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "x@gmail.com", appPassword: "y" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("server_misconfig");
  });
});
