import type {
  RitualCadence,
  RitualColor,
  SuggestRitualsRequest,
} from "@api-types";

// Inlined to avoid @api-types runtime resolution at backend test/build time
// (the type stays imported above for type-safety). Keep in sync with
// `lib/api-types.ts → RITUAL_ICON_SHORTLIST` and the Zod copy in schemas/.
export const RITUAL_ICON_SHORTLIST = [
  "book.closed.fill", "tray.fill", "character.book.closed.fill",
  "dumbbell.fill", "books.vertical.fill", "heart.fill",
  "sparkles", "cup.and.saucer.fill", "leaf.fill", "moon.fill",
  "figure.walk", "drop.fill", "fork.knife", "music.note",
  "bed.double.fill", "sun.max.fill",
] as const;

const ICON_LIST = RITUAL_ICON_SHORTLIST.map((s) => `"${s}"`).join(", ");
const CADENCES: RitualCadence[] = ["morning", "evening", "all_day", "weekdays", "daily"];
const COLORS:   RitualColor[]   = ["rituals", "accent", "move", "money", "cyan"];

export function buildSuggestRitualsPrompt(
  active: SuggestRitualsRequest["active"],
  recent: NonNullable<SuggestRitualsRequest["recentRitualEntries"]>,
): string {
  const activeBullets = active.length > 0
    ? active.map((r) => `- ${r.title} (cadence: ${r.cadence}, color: ${r.color})`).join("\n")
    : "(none yet)";

  const recentCounts = new Map<string, number>();
  for (const e of recent) {
    recentCounts.set(e.title, (recentCounts.get(e.title) ?? 0) + 1);
  }
  const recentBullets = recentCounts.size > 0
    ? [...recentCounts.entries()].map(([t, n]) => `- ${t}: ${n} entries in last 30d`).join("\n")
    : "(no recent activity)";

  return [
    "You are Pal. Suggest at most 2 daily rituals for the user that complement (do not duplicate) their active list. Each suggestion must:",
    `- title: 1–40 chars, action-shaped ("Evening shutdown", not "Be productive")`,
    "- reason: one short sentence grounded in the user's patterns",
    `- icon: pick from this exact list: [${ICON_LIST}]`,
    `- cadence: pick from ${CADENCES.join("|")}`,
    `- color: pick from ${COLORS.join("|")}`,
    "",
    `Return ONLY a JSON object: {"suggestions": [...]}. No prose, no markdown.`,
    "",
    `Active rituals:\n${activeBullets}`,
    "",
    `Recent activity (last 30d):\n${recentBullets}`,
  ].join("\n");
}
