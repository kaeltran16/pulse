import OpenAI from "openai";
import { UpstreamError } from "../middleware/errorHandler.js";

export type Role = "system" | "user" | "assistant";
export type Msg = { role: Role; content: string };

export type Usage = { inputTokens: number; outputTokens: number };

export interface LlmClient {
  chatStream(args: { messages: Msg[]; model: string; signal?: AbortSignal }): AsyncIterable<{ delta: string } | { done: Usage }>;
  chatJson(args: { messages: Msg[]; model: string }): Promise<{ text: string; usage: Usage }>;
}

export function createOpenRouterClient(apiKey: string): LlmClient {
  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  return {
    async *chatStream({ messages, model, signal }) {
      let stream;
      try {
        stream = await client.chat.completions.create(
          { model, messages, stream: true },
          signal ? { signal } : undefined
        );
      } catch (err) {
        throw new UpstreamError(`openrouter create failed: ${(err as Error).message}`);
      }
      let inputTokens = 0;
      let outputTokens = 0;
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta?.content ?? "";
          if (delta) yield { delta };
          const u = (chunk as unknown as { usage?: { prompt_tokens?: number; completion_tokens?: number } }).usage;
          if (u) {
            inputTokens = u.prompt_tokens ?? inputTokens;
            outputTokens = u.completion_tokens ?? outputTokens;
          }
        }
      } catch (err) {
        throw new UpstreamError(`openrouter stream failed: ${(err as Error).message}`);
      }
      yield { done: { inputTokens, outputTokens } };
    },

    async chatJson({ messages, model }) {
      try {
        const resp = await client.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
        });
        const text = resp.choices?.[0]?.message?.content ?? "";
        const usage = {
          inputTokens: resp.usage?.prompt_tokens ?? 0,
          outputTokens: resp.usage?.completion_tokens ?? 0,
        };
        return { text, usage };
      } catch (err) {
        throw new UpstreamError(`openrouter chatJson failed: ${(err as Error).message}`);
      }
    },
  };
}
