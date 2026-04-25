import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { ParseRequestSchema, ParseResponseSchema } from "../schemas/parse.js";
import { buildParseMessages } from "../lib/prompts/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Logger } from "../lib/logger.js";

export function parseRouter(deps: { llm: LlmClient; modelId: string; logger: Logger }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ParseRequestSchema.parse(req.body);
      const { system, user } = buildParseMessages(body.text, body.hint);
      const { text } = await deps.llm.chatJson({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        model: deps.modelId,
      });
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Spec §5.2: log raw model output, return validation_failed.
        deps.logger.warn({ requestId: req.id, modelOutput: text }, "parse: model did not return JSON");
        return next(new ZodError([{ code: "custom", path: [], message: "model output was not valid JSON" }]));
      }
      if (parsed && typeof parsed === "object") (parsed as { raw?: string }).raw = body.text;
      const validated = ParseResponseSchema.safeParse(parsed);
      if (!validated.success) {
        deps.logger.warn({ requestId: req.id, modelOutput: text }, "parse: model output failed schema");
        return next(validated.error);
      }
      res.status(200).json(validated.data);
    } catch (err) {
      // True upstream/network errors come from chatJson rejecting with UpstreamError.
      if (err instanceof UpstreamError) return next(err);
      next(err);
    }
  });
  return r;
}
