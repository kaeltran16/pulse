import { Router, type Request, type Response, type NextFunction } from "express";

import type { LlmClient } from "../lib/openrouter.js";
import { buildSuggestRitualsPrompt } from "../lib/prompts/suggestRituals.js";
import {
  SuggestRitualsRequestSchema,
  SuggestRitualsResponseSchema,
} from "../schemas/suggestRituals.js";

const STRICTER_RETRY = "\n\nReminder: respond with ONLY a JSON object. No prose, no markdown, no leading text.";

export function suggestRitualsRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    let body;
    try {
      body = SuggestRitualsRequestSchema.parse(req.body);
    } catch (err) {
      return next(err);
    }

    const prompt = buildSuggestRitualsPrompt(body.active, body.recentRitualEntries ?? []);
    const baseMessages = [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: "Suggest now." },
    ];

    let parsed: ReturnType<typeof SuggestRitualsResponseSchema.parse> | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages = attempt === 0
        ? baseMessages
        : [...baseMessages, { role: "system" as const, content: STRICTER_RETRY }];
      try {
        const { text } = await deps.llm.chatJson({ messages, model: deps.modelId });
        const json = JSON.parse(text);
        parsed = SuggestRitualsResponseSchema.parse(json);
        break;
      } catch {
        // try again with the stricter retry
      }
    }
    if (parsed === null) {
      // Graceful empty state on persistent LLM failure
      res.json({ suggestions: [] });
      return;
    }
    res.json(parsed);
  });
  return r;
}
