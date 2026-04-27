import type { NudgeTodayRequest } from "@api-types";

export function buildNudgeTodayPrompt(req: NudgeTodayRequest): string {
  const remainingBullets = req.remaining.length > 0
    ? req.remaining.map((r) => `- ${r.title} (cadence: ${r.cadence}, ${r.streak}-day streak)`).join("\n")
    : "(none — user has completed everything today)";

  const bestStreakLine = req.bestStreak
    ? `Best ongoing streak: ${req.bestStreak.title} (${req.bestStreak.streak} days)`
    : "Best ongoing streak: (none yet)";

  return [
    "You are Pal. Write ONE warm, concrete sentence (≤120 chars) about the user's ritual progress today. Reference a specific ritual or streak by name. No filler (\"Great job!\"). No emoji unless one fits the noun (💧 water).",
    "",
    `Return ONLY a JSON object: {"sub": "..."}. No prose, no markdown.`,
    "",
    `Today (${req.date}): ${req.done}/${req.total} done.`,
    `Remaining:\n${remainingBullets}`,
    bestStreakLine,
  ].join("\n");
}
