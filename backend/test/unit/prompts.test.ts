import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../../src/lib/prompts/chat.js";
import { buildParseMessages } from "../../src/lib/prompts/parse.js";
import { buildReviewMessages } from "../../src/lib/prompts/review.js";
import { sampleEntries, sampleToday } from "../fixtures/entries.js";
import { sampleAggregates } from "../fixtures/aggregates.js";

describe("buildChatSystemPrompt", () => {
  it("returns a non-empty string with the persona name", () => {
    const s = buildChatSystemPrompt();
    expect(s.length).toBeGreaterThan(0);
    expect(s).toMatch(/Pal/);
  });

  it("includes today's totals when context is provided", () => {
    const s = buildChatSystemPrompt({ today: sampleToday, recentEntries: sampleEntries });
    expect(s).toContain("2026-04-25");
    expect(s).toContain("1450");
    expect(s).toContain("oatmeal");
  });
});

describe("buildParseMessages", () => {
  it("includes the input text and the parse instruction", () => {
    const m = buildParseMessages("ate 2 eggs and toast");
    expect(m.system).toMatch(/JSON/);
    expect(m.user).toContain("ate 2 eggs and toast");
  });

  it("includes the hint when provided", () => {
    const m = buildParseMessages("hex bar 5x5", "workout");
    expect(m.user).toMatch(/hint.*workout/i);
  });
});

describe("buildReviewMessages", () => {
  it("includes the month and aggregate counts", () => {
    const m = buildReviewMessages("2026-04", sampleAggregates);
    expect(m.user).toContain("2026-04");
    expect(m.user).toContain("12");
    expect(m.user).toContain("USD");
  });
});
