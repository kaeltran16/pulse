import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const SPEND_JSON = JSON.stringify({
  kind: "spend",
  data: { amount: 5.75, currency: "USD", merchant: "Verve" },
  confidence: "high",
  raw: "verve coffee 5.75",
});

const WORKOUT_LOW_JSON = JSON.stringify({
  kind: "workout",
  data: { routine: "run" },
  confidence: "low",
  raw: "went for a run",
});

const CHAT_JSON = JSON.stringify({
  kind: "chat",
  confidence: "high",
  raw: "how was my week?",
});

describe("POST /parse", () => {
  it("returns parsed spend entry on happy path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: SPEND_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "verve coffee 5.75" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("spend");
    expect(res.body.data.amount).toBe(5.75);
    expect(res.body.confidence).toBe("high");
  });

  it("returns parsed low-confidence workout", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: WORKOUT_LOW_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "went for a run" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("workout");
    expect(res.body.confidence).toBe("low");
  });

  it("routes conversational input to kind:chat", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: CHAT_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "how was my week?" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("chat");
    expect(res.body.confidence).toBe("high");
  });

  it("returns 400 validation_failed when model emits food (kind dropped)", async () => {
    const FOOD = JSON.stringify({ kind: "food", data: { items: [{ name: "eggs" }] }, confidence: "high", raw: "ate eggs" });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: FOOD, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate eggs" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed on empty text", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed when model emits non-JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json at all", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 502 upstream_error when chatJson rejects", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => {
          const { UpstreamError } = await import("../../src/middleware/errorHandler.js");
          throw new UpstreamError("network down");
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate eggs" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });
});
