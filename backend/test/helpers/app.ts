import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, type AppDeps } from "../../src/index.js";
import { createLogger } from "../../src/lib/logger.js";
import { createDb } from "../../src/db/client.js";
import { runMigrations } from "../../src/db/migrate.js";
import type { LlmClient, Msg } from "../../src/lib/openrouter.js";
import type { ImapValidator } from "../../src/lib/seedImapAccount.js";
import { TEST_SECRET } from "./jwt.js";
import type { Config } from "../../src/config.js";

const TEST_KEY_HEX = "a".repeat(64);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../../src/db/migrations");

export function buildTestApp(
  overrides: {
    llm?: Partial<LlmClient>;
    config?: Partial<Config>;
    imapValidator?: ImapValidator;
    encryptionKey?: string | null;
  } = {},
) {
  const config: Config = {
    openrouterApiKey: "test",
    jwtSecret: TEST_SECRET,
    port: 0,
    modelId: "anthropic/claude-haiku-4.5",
    rateLimitPerMin: 60,
    logLevel: "fatal",
    nodeEnv: "test",
    promptTimeoutMs: 20_000,
    ...overrides.config,
  };
  const llm: LlmClient = {
    async *chatStream() {
      yield { delta: "ok" };
      yield { done: { inputTokens: 1, outputTokens: 1 } };
    },
    async chatJson(_args: { messages: Msg[]; model: string; signal?: AbortSignal }) {
      return { text: "{}", usage: { inputTokens: 1, outputTokens: 1 } };
    },
    ...overrides.llm,
  };
  const { db } = createDb(":memory:");
  runMigrations(db, migrationsFolder);

  const imapValidator: ImapValidator = overrides.imapValidator ?? (async () => {});
  const encryptionKey =
    overrides.encryptionKey === undefined ? TEST_KEY_HEX : overrides.encryptionKey;

  const deps: AppDeps = {
    config,
    logger: createLogger("fatal"),
    llm,
    db,
    encryptionKey,
    imapValidator,
  };
  return { app: createApp(deps), deps };
}
