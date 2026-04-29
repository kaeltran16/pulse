import { Router, type Request, type Response, type NextFunction } from "express";
import { ReviewRequestSchema, ReviewResponseSchema } from "../schemas/review.js";
import { buildReviewMessages } from "../lib/prompts/review.js";
import { UpstreamError } from "../middleware/errorHandler.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { ReviewSignalKey, ReviewRequest } from "@api-types";

function nonNullSignalKeys(signals: ReviewRequest["signals"]): Set<ReviewSignalKey> {
  const s = new Set<ReviewSignalKey>();
  if (signals.topSpendDay) s.add("topSpendDay");
  if (signals.ritualVsNonRitual) s.add("ritualVsNonRitual");
  if (signals.bestStreak) s.add("bestStreak");
  if (signals.underBudget) s.add("underBudget");
  return s;
}

export function reviewRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = ReviewRequestSchema.parse(req.body);
      const { system, user } = buildReviewMessages(body);
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
        throw new UpstreamError("review output was not valid JSON");
      }
      const validated = ReviewResponseSchema.safeParse(parsed);
      if (!validated.success) {
        throw new UpstreamError(`review output failed schema: ${validated.error.message}`);
      }

      const allowed = nonNullSignalKeys(body.signals);
      const stray = validated.data.patterns.find((p) => !allowed.has(p.signal));
      if (stray) {
        throw new UpstreamError(`review pattern referenced absent signal: ${stray.signal}`);
      }

      if (validated.data.period !== body.period) {
        throw new UpstreamError(`review period mismatch: req=${body.period} resp=${validated.data.period}`);
      }

      res.status(200).json(validated.data);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
