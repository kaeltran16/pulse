import { ZodError } from "zod";
import type { ParseRequest, ParseResponse } from "@api-types";
import { ParseRequestSchema, ParseResponseSchema } from "../schemas/parse.js";
import { buildParseMessages } from "./prompts/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "./openrouter.js";
import type { Logger } from "./logger.js";

export type ParseEntryDeps = {
  llm: LlmClient;
  modelId: string;
  logger: Logger;
};

/**
 * Pure function over the parse contract. Used by:
 *   - the HTTP route `POST /parse` (thin wrapper)
 *   - the SP5b worker (in-process call from processAccount)
 *
 * Throws:
 *   - ZodError if input fails validation OR if model output isn't JSON OR fails schema
 *   - UpstreamError on LLM client failure (network / upstream provider)
 */
export async function parseEntry(
  deps: ParseEntryDeps,
  input: ParseRequest,
): Promise<ParseResponse> {
  const validated = ParseRequestSchema.parse(input);
  const { system, user } = buildParseMessages(validated.text, validated.hint);

  let text: string;
  try {
    const result = await deps.llm.chatJson({
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      model: deps.modelId,
    });
    text = result.text;
  } catch (err) {
    if (err instanceof UpstreamError) throw err;
    throw new UpstreamError(`parseEntry chatJson failed: ${(err as Error).message}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    deps.logger.warn({ modelOutput: text }, "parse: model did not return JSON");
    throw new ZodError([{ code: "custom", path: [], message: "model output was not valid JSON" }]);
  }

  if (parsed && typeof parsed === "object") {
    (parsed as { raw?: string }).raw = validated.text;
  }

  const out = ParseResponseSchema.safeParse(parsed);
  if (!out.success) {
    deps.logger.warn({ modelOutput: text }, "parse: model output failed schema");
    throw out.error;
  }
  return out.data;
}
