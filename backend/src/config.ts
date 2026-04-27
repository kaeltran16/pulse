import { z } from "zod";

const HTTP_FIELDS = {
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(3000),
  MODEL_ID: z.string().default("anthropic/claude-haiku-4.5"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.string().default("development"),
  PROMPT_TIMEOUT_MS: z.coerce.number().int().positive().default(20_000),
} as const;

const HttpSchema = z.object(HTTP_FIELDS);

const WorkerSchema = z.object({
  OPENROUTER_API_KEY: HTTP_FIELDS.OPENROUTER_API_KEY,
  JWT_SECRET: HTTP_FIELDS.JWT_SECRET,
  MODEL_ID: HTTP_FIELDS.MODEL_ID,
  LOG_LEVEL: HTTP_FIELDS.LOG_LEVEL,
  NODE_ENV: HTTP_FIELDS.NODE_ENV,
  PROMPT_TIMEOUT_MS: HTTP_FIELDS.PROMPT_TIMEOUT_MS,
  PULSE_IMAP_ENCRYPTION_KEY: z
    .string({ required_error: "PULSE_IMAP_ENCRYPTION_KEY is required" })
    .regex(/^[0-9a-fA-F]{64}$/, "PULSE_IMAP_ENCRYPTION_KEY must be 64 hex chars (32 bytes)"),
});

export type Config = {
  openrouterApiKey: string;
  jwtSecret: string;
  port: number;
  modelId: string;
  rateLimitPerMin: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  nodeEnv: string;
  promptTimeoutMs: number;
};

export type WorkerConfig = {
  openrouterApiKey: string;
  jwtSecret: string;
  modelId: string;
  logLevel: Config["logLevel"];
  nodeEnv: string;
  promptTimeoutMs: number;
  imapEncryptionKey: string;
};

function fail(error: z.ZodError): never {
  const msg = error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  throw new Error(`Invalid environment: ${msg}`);
}

export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = HttpSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    port: e.PORT,
    modelId: e.MODEL_ID,
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
    promptTimeoutMs: e.PROMPT_TIMEOUT_MS,
  };
}

export function loadWorkerConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = WorkerSchema.safeParse(env);
  if (!parsed.success) fail(parsed.error);
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    modelId: e.MODEL_ID,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
    promptTimeoutMs: e.PROMPT_TIMEOUT_MS,
    imapEncryptionKey: e.PULSE_IMAP_ENCRYPTION_KEY,
  };
}

/** Backwards-compatible alias for the pre-split callers. */
export const loadConfig = loadHttpConfig;
