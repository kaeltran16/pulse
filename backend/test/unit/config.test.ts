import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadConfig } from "../../src/config.js";

const ORIGINAL = { ...process.env };

beforeEach(() => {
  process.env = { ...ORIGINAL };
});
afterEach(() => {
  process.env = ORIGINAL;
});

describe("loadConfig", () => {
  it("returns parsed config when all required vars are set", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "x".repeat(32);
    process.env.PORT = "3000";
    process.env.MODEL_ID = "anthropic/claude-haiku-4.5";
    process.env.RATE_LIMIT_PER_MIN = "60";
    process.env.LOG_LEVEL = "info";

    const cfg = loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(cfg.rateLimitPerMin).toBe(60);
    expect(cfg.logLevel).toBe("info");
  });

  it("throws when OPENROUTER_API_KEY is missing", () => {
    delete process.env.OPENROUTER_API_KEY;
    process.env.JWT_SECRET = "x".repeat(32);
    expect(() => loadConfig()).toThrow(/OPENROUTER_API_KEY/);
  });

  it("throws when JWT_SECRET is shorter than 32 chars", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "short";
    expect(() => loadConfig()).toThrow(/JWT_SECRET/);
  });

  it("uses defaults for optional vars", () => {
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.JWT_SECRET = "x".repeat(32);
    delete process.env.PORT;
    delete process.env.MODEL_ID;
    delete process.env.RATE_LIMIT_PER_MIN;
    delete process.env.LOG_LEVEL;
    const cfg = loadConfig();
    expect(cfg.port).toBe(3000);
    expect(cfg.modelId).toBe("anthropic/claude-haiku-4.5");
    expect(cfg.rateLimitPerMin).toBe(60);
    expect(cfg.logLevel).toBe("info");
  });
});
