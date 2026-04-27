import { describe, it, expect, vi } from "vitest";
import { ZodError } from "zod";
import { parseEntry } from "../../src/lib/parse.js";
import { UpstreamError } from "../../src/middleware/errorHandler.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import { createLogger } from "../../src/lib/logger.js";

const logger = createLogger("fatal");
const modelId = "anthropic/claude-haiku-4.5";

function llmReturning(text: string): LlmClient {
  return {
    async *chatStream() {
      yield { delta: text };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text, usage: { inputTokens: 1, outputTokens: 1 } };
    },
  };
}

describe("parseEntry", () => {
  it("returns ParseResponse on a valid kind:spend reply", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 5.75, currency: "USD", merchant: "Verve" },
        confidence: "high",
        raw: "verve coffee 5.75",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "verve coffee 5.75" });
    expect(out.kind).toBe("spend");
    if (out.kind === "spend") {
      expect(out.data.amount).toBe(5.75);
      expect(out.confidence).toBe("high");
    }
  });

  it("forces `raw` to equal the input text (overriding model output)", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1, currency: "USD" },
        confidence: "high",
        raw: "WRONG",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "actual input" });
    expect(out.raw).toBe("actual input");
  });

  it("returns kind:chat for conversational input", async () => {
    const llm = llmReturning(
      JSON.stringify({ kind: "chat", confidence: "high", raw: "hi" }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "hi" });
    expect(out.kind).toBe("chat");
  });

  it("throws ZodError when the model returns non-JSON", async () => {
    const llm = llmReturning("not json at all");
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
  });

  it("throws ZodError when the model returns a kind we don't accept", async () => {
    const llm = llmReturning(
      JSON.stringify({ kind: "food", data: { items: [] }, confidence: "high", raw: "x" }),
    );
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
  });

  it("propagates UpstreamError when the LLM client rejects", async () => {
    const llm: LlmClient = {
      async *chatStream() {
        yield { delta: "" };
        yield { done: { inputTokens: 0, outputTokens: 0 } };
      },
      async chatJson() {
        throw new UpstreamError("network down");
      },
    };
    await expect(parseEntry({ llm, modelId, logger }, { text: "x" })).rejects.toBeInstanceOf(UpstreamError);
  });

  it("logs raw model output on schema failure", async () => {
    const llm = llmReturning("not json");
    const warn = vi.fn();
    const fakeLogger = { ...logger, warn } as unknown as typeof logger;
    await expect(parseEntry({ llm, modelId, logger: fakeLogger }, { text: "x" })).rejects.toBeInstanceOf(ZodError);
    expect(warn).toHaveBeenCalled();
  });

  it("passes hint through to the prompt builder (smoke check via passing input)", async () => {
    const llm = llmReturning(
      JSON.stringify({
        kind: "spend",
        data: { amount: 1, currency: "USD" },
        confidence: "high",
        raw: "x",
      }),
    );
    const out = await parseEntry({ llm, modelId, logger }, { text: "x", hint: "spend" });
    expect(out.kind).toBe("spend");
  });
});
