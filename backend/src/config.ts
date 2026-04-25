import { z } from "zod";

const Schema = z.object({
  OPENROUTER_API_KEY: z.string().min(1, "OPENROUTER_API_KEY is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  PORT: z.coerce.number().int().positive().default(3000),
  MODEL_ID: z.string().default("anthropic/claude-haiku-4.5"),
  RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(60),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  NODE_ENV: z.string().default("development"),
});

export type Config = {
  openrouterApiKey: string;
  jwtSecret: string;
  port: number;
  modelId: string;
  rateLimitPerMin: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace";
  nodeEnv: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${msg}`);
  }
  const e = parsed.data;
  return {
    openrouterApiKey: e.OPENROUTER_API_KEY,
    jwtSecret: e.JWT_SECRET,
    port: e.PORT,
    modelId: e.MODEL_ID,
    rateLimitPerMin: e.RATE_LIMIT_PER_MIN,
    logLevel: e.LOG_LEVEL,
    nodeEnv: e.NODE_ENV,
  };
}
