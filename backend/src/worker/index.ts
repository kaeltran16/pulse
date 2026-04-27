import { ImapFlow } from "imapflow";
import { loadWorkerConfig } from "../config.js";
import { createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import * as imapAccountsQ from "../db/queries/imapAccounts.js";
import { createLogger, type Logger } from "../lib/logger.js";
import { createOpenRouterClient } from "../lib/openrouter.js";
import type { LlmClient } from "../lib/openrouter.js";
import type { Db } from "../db/client.js";
import { AccountBackoffState } from "./backoff.js";
import { processAccount, type ImapClientFactory } from "./processAccount.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TICK_MS = 60_000;

export type TickDeps = {
  db: Db;
  backoff: AccountBackoffState;
  logger: Logger;
  llm: LlmClient;
  modelId: string;
  encryptionKey: string;
  imapClientFactory: ImapClientFactory;
  now: number;
};

/**
 * One tick of the worker loop. Extracted from `main()` for testability.
 * Iterates all active accounts whose backoff window has elapsed; processes them sequentially.
 */
export async function runTick(deps: TickDeps): Promise<{ processed: number }> {
  const accounts = imapAccountsQ
    .listImapAccounts(deps.db)
    .filter((a) => a.status === "active")
    .filter((a) => deps.backoff.shouldPollNow(a));

  let processed = 0;
  for (const account of accounts) {
    try {
      await processAccount({
        db: deps.db,
        account,
        backoff: deps.backoff,
        logger: deps.logger,
        llm: deps.llm,
        modelId: deps.modelId,
        encryptionKey: deps.encryptionKey,
        imapClientFactory: deps.imapClientFactory,
        now: deps.now,
      });
      processed++;
    } catch (err) {
      deps.logger.error(
        { accountId: account.id, err: (err as Error).message },
        "processAccount threw uncaught",
      );
    }
  }
  return { processed };
}

const realImapClientFactory: ImapClientFactory = ({ host, port, secure, user, pass, logger }) =>
  new ImapFlow({
    host,
    port,
    secure,
    auth: { user, pass },
    logger: logger as never,
  }) as unknown as ReturnType<ImapClientFactory>;

async function main(): Promise<void> {
  const config = loadWorkerConfig();
  const logger = createLogger(config.logLevel);
  const dbPath = process.env.DB_PATH ?? "/data/pulse.db";
  const { db } = createDb(dbPath);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = path.resolve(__dirname, "../db/migrations");
  runMigrations(db, migrationsFolder);

  const llm = createOpenRouterClient(config.openrouterApiKey);
  const backoff = new AccountBackoffState();
  logger.info({ tickMs: TICK_MS }, "pulse-worker starting");

  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await runTick({
        db,
        backoff,
        logger,
        llm,
        modelId: config.modelId,
        encryptionKey: config.imapEncryptionKey,
        imapClientFactory: realImapClientFactory,
        now: Date.now(),
      });
      if (result.processed > 0) {
        logger.info({ processed: result.processed }, "tick complete");
      }
    } catch (err) {
      logger.error({ err: (err as Error).message }, "tick threw uncaught");
    } finally {
      running = false;
    }
  };

  // Run one tick immediately, then schedule.
  await tick();
  const handle = setInterval(tick, TICK_MS);

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "pulse-worker shutting down");
    clearInterval(handle);
    // Wait for any in-flight tick to settle (best-effort).
    for (let i = 0; i < 30 && running; i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (process.env.NODE_ENV !== "test" && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
