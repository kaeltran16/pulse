import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const VALID_BODY = {
  date: "2026-04-28",
  done: 2,
  total: 5,
  remaining: [
    { title: "Stretch", streak: 4, cadence: "evening" as const },
  ],
  bestStreak: { title: "8 glasses water", streak: 23 },
};

describe("POST /nudge-today", () => {
  it("returns 200 with sub on valid LLM JSON", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: JSON.stringify({ sub: "Your Stretch is waiting. 23-day water streak 💧" }),
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub).toContain("Stretch");
  });

  it("returns fallback string on persistent malformed JSON", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({ text: "garbage", usage: { inputTokens: 1, outputTokens: 1 } }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub).toContain("Stretch"); // localFallback uses first remaining
  });

  it("truncates sub when LLM exceeds 120 chars", async () => {
    const longSub = "x".repeat(200);
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: JSON.stringify({ sub: longSub }),
          usage: { inputTokens: 1, outputTokens: 1 },
        }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(200);
    expect(res.body.sub.length).toBeLessThanOrEqual(121); // 120 + ellipsis
  });

  it("rejects without JWT", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/nudge-today").send(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("rejects with wrong scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["review"] });
    const res = await request(app).post("/nudge-today")
      .set("Authorization", `Bearer ${token}`).send(VALID_BODY);
    expect(res.status).toBe(403);
  });
});
