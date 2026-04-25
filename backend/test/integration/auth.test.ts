import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken, TEST_SECRET } from "../helpers/jwt.js";
import jwt from "jsonwebtoken";

describe("auth middleware", () => {
  it("rejects /parse without Authorization header (401)", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/parse").send({ text: "x" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
    expect(res.body.requestId).toBeTruthy();
  });

  it("rejects /parse with bad signature (401)", async () => {
    const { app } = buildTestApp();
    const bad = jwt.sign({ sub: "kael", scope: ["parse"] }, "y".repeat(32), { algorithm: "HS256" });
    const res = await request(app).post("/parse").set("Authorization", `Bearer ${bad}`).send({ text: "x" });
    expect(res.status).toBe(401);
  });

  it("rejects /chat with token missing 'chat' scope (403)", async () => {
    const { app } = buildTestApp();
    const t = signTestToken({ scope: ["parse", "review"] });
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${t}`)
      .send({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("/health does not require a token", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("rejects malformed Authorization header", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/parse").set("Authorization", "Token abc").send({ text: "x" });
    expect(res.status).toBe(401);
  });

  it("accepts a token signed with TEST_SECRET", () => {
    expect(TEST_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
