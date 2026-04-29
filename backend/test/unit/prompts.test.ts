import { describe, it, expect } from "vitest";
import { buildChatSystemPrompt } from "../../src/lib/prompts/chat.js";
import { buildParseMessages } from "../../src/lib/prompts/parse.js";
import { sampleEntries, sampleToday } from "../fixtures/entries.js";

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
    const m = buildParseMessages("verve coffee 5.75");
    expect(m.system).toMatch(/JSON/);
    expect(m.user).toContain("verve coffee 5.75");
  });

  it("includes the hint when provided", () => {
    const m = buildParseMessages("hex bar 5x5", "workout");
    expect(m.user).toMatch(/hint.*workout/i);
  });

  it("system prompt covers workout, spend, chat — not food", () => {
    const { system } = buildParseMessages("x");
    expect(system).toContain('"workout"');
    expect(system).toContain('"spend"');
    expect(system).toContain('"chat"');
    expect(system).not.toMatch(/"food"/);
  });
});

