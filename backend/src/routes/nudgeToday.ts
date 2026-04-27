import { Router, type Request, type Response, type NextFunction } from "express";

import type { LlmClient } from "../lib/openrouter.js";
import { buildNudgeTodayPrompt } from "../lib/prompts/nudgeToday.js";
import {
  NudgeTodayRequestSchema,
  NudgeTodayResponseSchema,
  type NudgeTodayRequestParsed,
} from "../schemas/nudgeToday.js";

const STRICTER_RETRY = "\n\nReminder: respond with ONLY a JSON object {\"sub\": \"...\"}. No prose, no markdown.";
const MAX_CHARS = 120;

function truncateToWordBoundary(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + "…";
}

function localFallback(req: NudgeTodayRequestParsed): string {
  if (req.remaining.length === 0) return "All done — nice work today.";
  const first = req.remaining[0];
  return `Your ${first.title} is waiting.`;
}

export function nudgeTodayRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    let body;
    try {
      body = NudgeTodayRequestSchema.parse(req.body);
    } catch (err) {
      return next(err);
    }

    const prompt = buildNudgeTodayPrompt(body);
    const baseMessages = [
      { role: "system" as const, content: prompt },
      { role: "user" as const, content: "Write the sub now." },
    ];

    let sub: string | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const messages = attempt === 0
        ? baseMessages
        : [...baseMessages, { role: "system" as const, content: STRICTER_RETRY }];
      try {
        const { text } = await deps.llm.chatJson({ messages, model: deps.modelId });
        const json = JSON.parse(text);
        const parsed = NudgeTodayResponseSchema.parse(json);
        sub = parsed.sub;
        break;
      } catch {
        // try again
      }
    }
    if (sub === null) sub = localFallback(body);
    sub = truncateToWordBoundary(sub, MAX_CHARS);
    res.json({ sub });
  });
  return r;
}
