import express, { type Express } from "express";
import { loadConfig, type Config } from "./config.js";
import { createLogger, type Logger } from "./lib/logger.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { authMiddleware } from "./middleware/auth.js";
import { createRateLimit } from "./middleware/rateLimit.js";
import { healthRouter } from "./routes/health.js";
import { parseRouter } from "./routes/parse.js";
import { chatRouter } from "./routes/chat.js";
import { reviewRouter } from "./routes/review.js";
import { generateRoutineRouter } from "./routes/generate-routine.js";
import type { LlmClient } from "./lib/openrouter.js";
import { createOpenRouterClient } from "./lib/openrouter.js";

export type AppDeps = {
  config: Config;
  logger: Logger;
  llm: LlmClient;
};

export function createApp(deps: AppDeps): Express {
  const { config, logger } = deps;
  const app = express();
  app.disable("x-powered-by");
  app.use(requestId);
  app.use(express.json({ limit: "256kb" }));

  app.use(healthRouter());

  const rateLimitMw = createRateLimit(config.rateLimitPerMin);
  app.use(
    "/parse",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "parse"),
    parseRouter({ llm: deps.llm, modelId: config.modelId, logger })
  );
  app.use(
    "/chat",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "chat"),
    chatRouter({ llm: deps.llm, modelId: config.modelId })
  );
  app.use(
    "/review",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "review"),
    reviewRouter({ llm: deps.llm, modelId: config.modelId })
  );
  app.use(
    "/generate-routine",
    rateLimitMw,
    authMiddleware(config.jwtSecret, "generate-routine"),
    generateRoutineRouter({ llm: deps.llm, modelId: config.modelId, logger, promptTimeoutMs: config.promptTimeoutMs })
  );

  app.use(errorHandler(logger));
  return app;
}

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const llm = createOpenRouterClient(config.openrouterApiKey);
  const app = createApp({ config, logger, llm });
  app.listen(config.port, () => {
    logger.info({ port: config.port }, "pulse-backend listening");
  });
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
