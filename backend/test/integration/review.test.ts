import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";
import { sampleAggregates } from "../fixtures/aggregates.js";

describe("POST /review", () => {
  it("returns markdown on happy path", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async () => ({
          text: JSON.stringify({ markdown: "## Wins\n- 12 sessions\n", generatedAt: "2026-04-30T00:00:00Z" }),
          usage: { inputTokens: 100, outputTokens: 200 },
        }),
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-04", aggregates: sampleAggregates });
    expect(res.status).toBe(200);
    expect(res.body.markdown).toMatch(/Wins/);
    expect(res.body.generatedAt).toBeTruthy();
  });

  it("rejects malformed month with 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/review")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "April", aggregates: sampleAggregates });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });
});
