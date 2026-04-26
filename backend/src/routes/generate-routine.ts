import { Router, type Request, type Response, type NextFunction } from "express";
import {
  GenerateRoutineRequestSchema,
  GenerateRoutineResponseSchema,
  type GenerateRoutineResponse,
} from "../schemas/generate-routine.js";
import { buildGenerateRoutineMessages } from "../lib/prompts/generate-routine.js";
import { EXERCISE_ID_SET } from "../lib/exercise-catalog.js";
import { GenerationFailedError, UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Logger } from "../lib/logger.js";

function stripCodeFences(text: string): string {
  let s = text.trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
  }
  return s;
}

export function generateRoutineRouter(deps: {
  llm: LlmClient;
  modelId: string;
  logger: Logger;
  promptTimeoutMs: number;
}): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    let body;
    try {
      body = GenerateRoutineRequestSchema.parse(req.body);
    } catch (err) {
      return next(err); // ZodError → 400 via existing errorHandler mapping
    }

    const messages = buildGenerateRoutineMessages(body.goal);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), deps.promptTimeoutMs);

    let raw: string;
    try {
      const { text } = await deps.llm.chatJson({ messages, model: deps.modelId, signal: ac.signal });
      raw = text;
    } catch (err) {
      // Timeout or any other openrouter error → upstream_error.
      return next(err instanceof UpstreamError ? err : new UpstreamError(`generate-routine upstream: ${(err as Error).message}`));
    } finally {
      clearTimeout(timer);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripCodeFences(raw));
    } catch {
      deps.logger.warn({ requestId: req.id, modelOutput: raw }, "generate-routine: model did not return JSON");
      return next(new GenerationFailedError("model output was not valid JSON"));
    }

    const validated = GenerateRoutineResponseSchema.safeParse(parsed);
    if (!validated.success) {
      deps.logger.warn({ requestId: req.id, modelOutput: raw }, "generate-routine: model output failed schema");
      const detail = validated.error.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
      return next(new GenerationFailedError(`schema: ${detail}`));
    }

    const data: GenerateRoutineResponse = validated.data;
    for (const ex of data.exercises) {
      if (!EXERCISE_ID_SET.has(ex.id)) {
        return next(new GenerationFailedError(`unknown exercise id: ${ex.id}`));
      }
    }

    res.status(200).json(data);
  });
  return r;
}
