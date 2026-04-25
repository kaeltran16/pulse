import { describe, it, expect } from "vitest";
import request from "supertest";
import { buildTestApp } from "../helpers/app.js";
import { signTestToken } from "../helpers/jwt.js";

function parseSse(raw: string): Array<{ event: string; data: any }> {
  const events: Array<{ event: string; data: any }> = [];
  for (const block of raw.split("\n\n")) {
    if (!block.trim()) continue;
    const lines = block.split("\n");
    let ev = "message";
    const data: string[] = [];
    for (const l of lines) {
      if (l.startsWith("event: ")) ev = l.slice(7).trim();
      else if (l.startsWith("data: ")) data.push(l.slice(6));
    }
    const joined = data.join("\n");
    events.push({ event: ev, data: joined ? JSON.parse(joined) : null });
  }
  return events;
}

describe("POST /chat", () => {
  it("streams chunks then a done event on success", async () => {
    const { app } = buildTestApp({
      llm: {
        async *chatStream() {
          yield { delta: "Hello" };
          yield { delta: ", world" };
          yield { done: { inputTokens: 3, outputTokens: 4 } };
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);
    const events = parseSse(res.text);
    const chunks = events.filter((e) => e.event === "chunk");
    const dones = events.filter((e) => e.event === "done");
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks.map((e) => e.data.delta).join("")).toBe("Hello, world");
    expect(dones).toHaveLength(1);
    expect(dones[0].data.usage).toEqual({ inputTokens: 3, outputTokens: 4 });
  });

  it("emits an SSE error event when the upstream fails mid-stream", async () => {
    const { app } = buildTestApp({
      llm: {
        async *chatStream() {
          yield { delta: "partial" };
          throw new Error("boom");
        },
      },
    });
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    const events = parseSse(res.text);
    const errs = events.filter((e) => e.event === "error");
    expect(errs).toHaveLength(1);
    expect(errs[0].data.code).toBe("upstream_error");
    expect(errs[0].data.requestId).toBeTruthy();
  });

  it("rejects an empty messages array with 400", async () => {
    const { app } = buildTestApp();
    const token = signTestToken();
    const res = await request(app)
      .post("/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ messages: [] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });
});
