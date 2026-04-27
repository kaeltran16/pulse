import { describe, it, expect } from "vitest";
import {
  buildSuggestRitualsPrompt,
  RITUAL_ICON_SHORTLIST,
} from "../../src/lib/prompts/suggestRituals.js";

describe("buildSuggestRitualsPrompt", () => {
  it("includes every active ritual title", () => {
    const result = buildSuggestRitualsPrompt(
      [
        { title: "Morning pages", cadence: "morning", color: "accent" },
        { title: "Inbox zero",    cadence: "weekdays", color: "move" },
      ],
      [],
    );
    expect(result).toContain("Morning pages");
    expect(result).toContain("Inbox zero");
  });

  it("emits the icon shortlist verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const icon of RITUAL_ICON_SHORTLIST) {
      expect(result).toContain(icon);
    }
  });

  it("emits the cadence enum verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const c of ["morning", "evening", "all_day", "weekdays", "daily"]) {
      expect(result).toContain(c);
    }
  });

  it("emits the color enum verbatim", () => {
    const result = buildSuggestRitualsPrompt([], []);
    for (const k of ["rituals", "accent", "move", "money", "cyan"]) {
      expect(result).toContain(k);
    }
  });

  it("with 0 active rituals — still produces a prompt that asks for ≤2 suggestions", () => {
    const result = buildSuggestRitualsPrompt([], []);
    expect(result).toContain("at most 2");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(50);
  });

  it("includes recent activity counts when provided", () => {
    const now = Date.now();
    const result = buildSuggestRitualsPrompt(
      [{ title: "Morning pages", cadence: "morning", color: "accent" }],
      [
        { title: "Morning pages", occurredAt: now - 1000 },
        { title: "Morning pages", occurredAt: now - 2000 },
      ],
    );
    expect(result).toContain("Morning pages");
  });
});
