import { describe, it, expect, vi } from "vitest";
import { createOpenRouterClient } from "../../src/lib/openrouter.js";

// We can't hit OpenRouter in tests; we vi.mock the OpenAI SDK to capture the
// second-arg options bag passed to chat.completions.create.
const captured: { signal?: AbortSignal }[] = [];

vi.mock("openai", () => {
  return {
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: async (_body: unknown, opts?: { signal?: AbortSignal }) => {
            captured.push(opts ?? {});
            return {
              choices: [{ message: { content: "{\"ok\":true}" } }],
              usage: { prompt_tokens: 1, completion_tokens: 1 },
            };
          },
        },
      };
    },
  };
});

describe("createOpenRouterClient.chatJson", () => {
  it("propagates the AbortSignal to the underlying SDK call", async () => {
    const client = createOpenRouterClient("test-key");
    const ac = new AbortController();
    await client.chatJson({ messages: [{ role: "user", content: "hi" }], model: "m", signal: ac.signal });
    expect(captured.length).toBeGreaterThan(0);
    expect(captured[captured.length - 1].signal).toBe(ac.signal);
  });

  it("omits the options arg entirely when no signal is supplied", async () => {
    const client = createOpenRouterClient("test-key");
    captured.length = 0;
    await client.chatJson({ messages: [{ role: "user", content: "hi" }], model: "m" });
    expect(captured.length).toBe(1);
    expect(captured[0]).toEqual({});
  });
});
