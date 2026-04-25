import { Router, type Request, type Response, type NextFunction } from "express";
import { ParseRequestSchema, ParseResponseSchema } from "../schemas/parse.js";
import { buildParseMessages } from "../lib/prompts/parse.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";

export function parseRouter(deps: { llm: LlmClient; modelId: string }): Router {
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
        throw new UpstreamError("model did not return JSON");
      }
      if (parsed && typeof parsed === "object") (parsed as { raw?: string }).raw = body.text;
      const validated = ParseResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`model output failed schema: ${validated.error.message}`);
      }
      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
