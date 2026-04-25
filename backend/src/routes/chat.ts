import { Router, type Request, type Response, type NextFunction } from "express";
import { ChatRequestSchema } from "../schemas/chat.js";
import { buildChatSystemPrompt } from "../lib/prompts/chat.js";
import type { LlmClient, Msg } from "../lib/openrouter.js";

function writeEvent(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function chatRouter(deps: { llm: LlmClient; modelId: string }): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    let body;
    try {
      body = ChatRequestSchema.parse(req.body);
    } catch (err) {
      return next(err);
    }

    const system = buildChatSystemPrompt(body.context);
    const messages: Msg[] = [{ role: "system", content: system }, ...body.messages];

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    try {
      for await (const item of deps.llm.chatStream({ messages, model: deps.modelId })) {
        if (aborted) break;
        if ("delta" in item) {
          writeEvent(res, "chunk", { delta: item.delta });
        } else {
          writeEvent(res, "done", { usage: item.done });
        }
      }
    } catch (err) {
      writeEvent(res, "error", {
        code: "upstream_error",
        message: (err as Error).message,
        requestId: req.id,
      });
    } finally {
      res.end();
    }
  });
  return r;
}
