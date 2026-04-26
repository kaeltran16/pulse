import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

const STRENGTH_OK = {
  tag: "Upper",
  name: "Push Day",
  estMin: 45,
  rationale: "Compound first, then accessories.",
  exercises: [
    { id: "bench", sets: [{ reps: 5, weight: 80 }, { reps: 5, weight: 80 }, { reps: 5, weight: 80 }] },
    { id: "ohp",   sets: [{ reps: 8, weight: 40 }, { reps: 8, weight: 40 }, { reps: 8, weight: 40 }] },
    { id: "tricep-rope", sets: [{ reps: 12, weight: 25 }, { reps: 12, weight: 25 }, { reps: 12, weight: 25 }] },
  ],
};

const CARDIO_OK = {
  tag: "Cardio",
  name: "Easy Run",
  estMin: 20,
  rationale: "Zone 2 base.",
  exercises: [{ id: "treadmill", sets: [{ duration: 20 }] }],
};

describe("POST /generate-routine", () => {
  it("returns 200 on a happy strength path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: JSON.stringify(STRENGTH_OK), usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day for strength" });

    expect(res.status).toBe(200);
    expect(res.body.tag).toBe("Upper");
    expect(res.body.exercises).toHaveLength(3);
  });

  it("returns 200 on a happy cardio path", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: JSON.stringify(CARDIO_OK), usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "easy 20 minute jog" });

    expect(res.status).toBe(200);
    expect(res.body.tag).toBe("Cardio");
  });

  it("returns 400 validation_failed when goal is missing", async () => {
    const { app } = buildTestApp({});
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 400 validation_failed when goal is empty", async () => {
    const { app } = buildTestApp({});
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { app } = buildTestApp({});
    const res = await request(app)
      .post("/generate-routine")
      .send({ goal: "push day" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("returns 403 when token lacks generate-routine scope", async () => {
    const { app } = buildTestApp({});
    const token = signTestToken({ scope: ["chat", "parse", "review"] });
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("returns 502 generation_failed when model emits non-JSON", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: "not json {", usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("generation_failed");
    expect(res.body.error.message).toMatch(/not valid JSON/i);
  });

  it("returns 502 generation_failed when model output fails the response schema", async () => {
    const bad = { ...STRENGTH_OK, exercises: STRENGTH_OK.exercises.slice(0, 2) }; // 2 exercises < min 3
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: JSON.stringify(bad), usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("generation_failed");
  });

  it("returns 502 generation_failed when model uses an unknown exercise id", async () => {
    const bad = { ...STRENGTH_OK, exercises: [{ id: "made-up-exercise", sets: STRENGTH_OK.exercises[0].sets }, ...STRENGTH_OK.exercises.slice(1)] };
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: JSON.stringify(bad), usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("generation_failed");
    expect(res.body.error.message).toContain("made-up-exercise");
  });

  it("strips a leading code fence before parsing", async () => {
    const fenced = "```json\n" + JSON.stringify(STRENGTH_OK) + "\n```";
    const { app } = buildTestApp({
      llm: { chatJson: async () => ({ text: fenced, usage: { inputTokens: 1, outputTokens: 1 } }) },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(200);
    expect(res.body.tag).toBe("Upper");
  });

  it("returns 502 upstream_error when chatJson throws", async () => {
    const { app } = buildTestApp({
      llm: { chatJson: async () => { throw new Error("openrouter blew up"); } },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });

  it("returns 502 upstream_error when the timeout fires", async () => {
    const { app } = buildTestApp({
      llm: {
        chatJson: async ({ signal }: { signal?: AbortSignal }) => {
          // Wait for the timeout, then throw the abort.
          await new Promise<void>((resolve, reject) => {
            if (signal?.aborted) reject(new Error("aborted"));
            signal?.addEventListener("abort", () => reject(new Error("aborted")));
            // Never resolve on its own — must be aborted.
            setTimeout(resolve, 5_000);
          });
          return { text: "{}", usage: { inputTokens: 0, outputTokens: 0 } };
        },
      },
      config: { promptTimeoutMs: 50 } as Partial<{ promptTimeoutMs: number }>,
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/generate-routine")
      .set("Authorization", `Bearer ${token}`)
      .send({ goal: "push day" });
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  }, 8000);
});
