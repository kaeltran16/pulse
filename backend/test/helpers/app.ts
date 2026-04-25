import { createApp, type AppDeps } from "../../src/index.js";
import { createLogger } from "../../src/lib/logger.js";
import type { LlmClient } from "../../src/lib/openrouter.js";
import { TEST_SECRET } from "./jwt.js";
import type { Config } from "../../src/config.js";

export function buildTestApp(overrides: { llm?: Partial<LlmClient>; config?: Partial<Config> } = {}) {
  const config: Config = {
    openrouterApiKey: "test",
    jwtSecret: TEST_SECRET,
    port: 0,
    modelId: "anthropic/claude-haiku-4.5",
    rateLimitPerMin: 60,
    logLevel: "fatal",
    nodeEnv: "test",
    ...overrides.config,
  };
  const llm: LlmClient = {
    async *chatStream() {
      yield { delta: "ok" };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson() {
      return { text: "{}", usage: { inputTokens: 1, outputTokens: 1 } };
    },
    ...overrides.llm,
  };
  const deps: AppDeps = { config, logger: createLogger("fatal"), llm };
  return { app: createApp(deps), deps };
}
