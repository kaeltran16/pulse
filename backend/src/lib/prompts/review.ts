import type { ReviewRequest, ReviewSignalKey } from "@api-types";

const SYSTEM = `You write the user's review in the Pulse app.

Voice:
- Reflective, specific, encouraging without flattery.
- Use the supplied numbers exactly. Do not invent ones not present.
- Never write a pattern for a signal that wasn't supplied as non-null.

Output format:
- Strict JSON matching the response schema you've been given.
- patterns[] entries each carry a 'signal' key matching one of the non-null signals in the input.
- patterns[] has at most one entry per signal key.
- Each pattern.text is a single sentence, 25 words or fewer.
`;

function nonNullKeys(signals: ReviewRequest["signals"]): ReviewSignalKey[] {
  const out: ReviewSignalKey[] = [];
  if (signals.topSpendDay) out.push("topSpendDay");
  if (signals.ritualVsNonRitual) out.push("ritualVsNonRitual");
  if (signals.bestStreak) out.push("bestStreak");
  if (signals.underBudget) out.push("underBudget");
  return out;
}

function pickNonNullSignals(signals: ReviewRequest["signals"]): Partial<ReviewRequest["signals"]> {
  const out: Partial<ReviewRequest["signals"]> = {};
  if (signals.topSpendDay) out.topSpendDay = signals.topSpendDay;
  if (signals.ritualVsNonRitual) out.ritualVsNonRitual = signals.ritualVsNonRitual;
  if (signals.bestStreak) out.bestStreak = signals.bestStreak;
  if (signals.underBudget) out.underBudget = signals.underBudget;
  return out;
}

export function buildReviewMessages(req: ReviewRequest): { system: string; user: string } {
  const keys = nonNullKeys(req.signals);
  const heroInstruction =
    req.period === "weekly"
      ? "Write the hero as one short sentence (≤ 12 words) capturing the week's character."
      : "Write the hero as a 2-3 sentence narrative paragraph capturing the month's character.";

  const signalsBlock =
    keys.length === 0
      ? "no signals were detected — emit an empty patterns array."
      : `Non-null signal keys you may use in patterns: ${keys.join(", ")}.`;

  const oneThingHint =
    req.period === "weekly"
      ? "If any non-null signal supports a concrete suggestion, emit oneThingToTry as { markdown, askPalPrompt }, where markdown is one short sentence (may use **bold**) and askPalPrompt is a follow-up question Pal could answer. Otherwise emit oneThingToTry: null."
      : "oneThingToTry is optional for monthly. Emit null if nothing concrete fits.";

  const signalsForPrompt = pickNonNullSignals(req.signals);

  const user =
    `Write the ${req.period} review for ${req.periodKey}.\n\n` +
    `${heroInstruction}\n\n` +
    `${signalsBlock}\n\n` +
    `${oneThingHint}\n\n` +
    `Aggregates (use exact numbers in prose):\n` +
    JSON.stringify(req.aggregates, null, 2) +
    `\n\nSignals (only non-null entries are eligible for patterns[]):\n` +
    JSON.stringify(signalsForPrompt, null, 2);

  return { system: SYSTEM, user };
}
