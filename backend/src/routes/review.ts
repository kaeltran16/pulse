import { Router, type Request, type Response, type NextFunction } from "express";
import { ReviewRequestSchema, ReviewResponseSchema } from "../schemas/review.js";
import { buildReviewMessages } from "../lib/prompts/review.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";

export function reviewRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ReviewRequestSchema.parse(req.body);
      const { system, user } = buildReviewMessages(body.month, body.aggregates);
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
        parsed = { markdown: text, generatedAt: new Date().toISOString() };
      }
      const validated = ReviewResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`review output failed schema: ${validated.error.message}`);
      }
      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
