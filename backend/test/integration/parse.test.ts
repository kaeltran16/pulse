import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const FOOD_JSON = JSON.stringify({
  kind: "food",
  data: { items: [{ name: "eggs", qty: "2" }, { name: "toast", qty: "1 slice" }] },
  confidence: "high",
  raw: "ate 2 eggs and toast",
});

describe("POST /parse", () => {
  it("returns parsed food entry on happy path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: FOOD_JSON, usage: { inputTokens: 5, outputTokens: 10 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/parse")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "ate 2 eggs and toast" });

    expect(res.status).toBe(200);
    expect(res.body.kind).toBe("food");
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.confidence).toBe("high");
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
      .send({ text: "ate eggs" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed when model JSON fails the schema", async () => {
    const bad = JSON.stringify({ kind: "food", data: { items: "not-an-array" }, confidence: "high", raw: "x" });
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: bad, usage: { inputTokens: 1, outputTokens: 1 } }) },
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
