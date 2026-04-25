import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

describe("rate limit", () => {
  it("returns 429 with rate_limited code after threshold", async () => {
    const { app } = buildTestApp({ config: { rateLimitPerMin: 3 } });
    const token = signTestToken();
    const send = () => request(app).post("/parse").set("Authorization", `Bearer ${token}`).send({ text: "x" });

    const responses = [];
    for (let i = 0; i < 6; i++) {
      const r = await send();
      responses.push(r.status);
    }
    expect(responses).toContain(429);
    const limited = responses.find((s) => s === 429);
    expect(limited).toBe(429);
  });
});
