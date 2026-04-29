import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import { sampleAggregates, sampleSignals } from "../fixtures/aggregates.js";

const goodResponse = JSON.stringify({
  period: "weekly",
  hero: "A steady week.",
  patterns: [
    { signal: "topSpendDay", text: "Friday cost 4× any other day this week." },
    { signal: "bestStreak", text: "Meditate held a 7-day streak." },
  ],
  oneThingToTry: {
    markdown: "Plan groceries on **Thursday** — Friday spend usually drops.",
    askPalPrompt: "Tell me more about my Friday spending",
  },
  generatedAt: "2026-04-30T00:00:00Z",
});

describe("POST /review", () => {
  it("returns structured prose for a weekly request", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: goodResponse,
          usage: { inputTokens: 100, outputTokens: 200 },
        }),
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("weekly");
    expect(res.body.patterns).toHaveLength(2);
    expect(res.body.oneThingToTry?.askPalPrompt).toMatch(/Friday/);
  });

  it("returns structured prose for a monthly request", async () => {
    const monthlyResp = JSON.stringify({
      period: "monthly",
      hero: "April was your steadiest month yet. Spending stayed below March, movement held, and rituals took hold.",
      patterns: [{ signal: "topSpendDay", text: "Friday averaged 4× any other day." }],
      oneThingToTry: null,
      generatedAt: "2026-05-01T00:00:00Z",
    });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: monthlyResp, usage: { inputTokens: 100, outputTokens: 200 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "monthly",
        periodKey: "2026-04",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(200);
    expect(res.body.period).toBe("monthly");
    expect(res.body.hero.split(/[.!?]\s/).length).toBeGreaterThanOrEqual(2);
  });

  it("rejects weekly with monthly-shaped key (400)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-04",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("rejects monthly with weekly-shaped key (400)", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "monthly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("rejects byDayOfWeek length != 7 (400)", async () => {
    const bad = { ...sampleAggregates, spend: { ...sampleAggregates.spend, byDayOfWeek: [0, 0, 0] } };
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: bad,
        signals: sampleSignals,
      });
    expect(res.status).toBe(400);
  });

  it("returns 502 when LLM returns invalid JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json at all", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(502);
  });

  it("returns 502 when LLM emits a pattern.signal that wasn't supplied as non-null", async () => {
    const badResp = JSON.stringify({
      period: "weekly",
      hero: "x",
      patterns: [{ signal: "underBudget", text: "made-up" }], // underBudget is null in sampleSignals
      oneThingToTry: null,
      generatedAt: "2026-04-30T00:00:00Z",
    });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: badResp, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({
        period: "weekly",
        periodKey: "2026-W17",
        aggregates: sampleAggregates,
        signals: sampleSignals,
      });
    expect(res.status).toBe(502);
  });

  it("returns 401 with no token", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/review")
      .send({ period: "weekly", periodKey: "2026-W17", aggregates: sampleAggregates, signals: sampleSignals });
    expect(res.status).toBe(401);
  });

  it("returns 403 with token missing 'review' scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["chat", "parse", "sync"] });
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ period: "weekly", periodKey: "2026-W17", aggregates: sampleAggregates, signals: sampleSignals });
    expect(res.status).toBe(403);
  });
});
