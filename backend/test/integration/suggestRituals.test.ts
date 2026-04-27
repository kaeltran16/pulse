import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

describe("POST /suggest-rituals", () => {
  it("returns 200 with parsed suggestions on valid LLM JSON", async () => {
    const llmText = JSON.stringify({
      suggestions: [
        { title: "Evening shutdown", reason: "Caps your evening pages.", icon: "moon.fill", cadence: "evening", color: "rituals" },
        { title: "Morning walk",     reason: "Pairs with your daily move.", icon: "figure.walk", cadence: "morning", color: "move" },
      ],
    });
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({ text: llmText, usage: { inputTokens: 100, outputTokens: 200 } }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [{ title: "Morning pages", cadence: "morning", color: "accent" }] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(2);
    expect(res.body.suggestions[0].title).toBe("Evening shutdown");
  });

  it("returns 200 with empty suggestions on persistent malformed JSON", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({ text: "not json at all {{{", usage: { inputTokens: 1, outputTokens: 1 } }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [] });

    expect(res.status).toBe(200);
    expect(res.body.suggestions).toEqual([]);
  });

  it("returns 200 with empty suggestions when LLM returns out-of-shortlist icon", async () => {
    const llmText = JSON.stringify({
      suggestions: [
        { title: "Good one", reason: "ok", icon: "made.up.symbol", cadence: "daily", color: "rituals" },
        { title: "Other",    reason: "ok", icon: "leaf.fill",      cadence: "daily", color: "rituals" },
      ],
    });
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({ text: llmText, usage: { inputTokens: 1, outputTokens: 1 } }),
      },
    });
    const token = signTestToken({ scope: ["chat"] });

    const res = await request(app)
      .post("/suggest-rituals")
      .set("Authorization", `Bearer ${token}`)
      .send({ active: [] });

    expect(res.status).toBe(200);
    // Zod parse fails on the bad icon → falls into retry → empty.
    expect(res.body.suggestions).toEqual([]);
  });

  it("rejects requests with no JWT", async () => {
    const { app } = buildTestApp();
    const res = await request(app).post("/suggest-rituals").send({ active: [] });
    expect(res.status).toBe(401);
  });

  it("rejects requests with wrong scope", async () => {
    const { app } = buildTestApp();
    const token = signTestToken({ scope: ["review"] });
    const res = await request(app).post("/suggest-rituals").set("Authorization", `Bearer ${token}`).send({ active: [] });
    expect(res.status).toBe(403);
  });
});
