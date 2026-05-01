import { Router, type Request, type Response, type NextFunction } from "express";
import { ReviewRequestSchema, ReviewModelOutputSchema } from "../schemas/review.js";
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
      const parsedObj =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? { ...(parsed as Record<string, unknown>) }
          : parsed;
      if (parsedObj && typeof parsedObj === "object") {
        delete (parsedObj as Record<string, unknown>).period;
        delete (parsedObj as Record<string, unknown>).generatedAt;
      }
      const validated = ReviewModelOutputSchema.safeParse(parsedObj);
      if (!validated.success) {
        throw new UpstreamError(`review output failed schema: ${validated.error.message}`);
      }

      const allowed = nonNullSignalKeys(body.signals);
      const stray = validated.data.patterns.find((p) => !allowed.has(p.signal));
      if (stray) {
        throw new UpstreamError(`review pattern referenced absent signal: ${stray.signal}`);
      }

      res.status(200).json({
        ...validated.data,
        period: body.period,
        generatedAt: new Date().toISOString(),
      });
    } catch (err) {
      next(err);
    }
  });
  return r;
}
