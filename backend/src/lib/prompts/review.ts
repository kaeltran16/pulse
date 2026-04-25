import type { ReviewRequest } from "@api-types";

const SYSTEM = `You write the user's monthly review for the Pulse app.

Voice:
- Reflective, specific, encouraging without flattery.
- Use the supplied numbers. Do not invent ones not present.

Format:
- Markdown. Headings: ## Wins, ## Patterns, ## To watch, ## Next month.
- Keep it tight: under ~400 words.`;

export function buildReviewMessages(month: string, aggregates: ReviewRequest["aggregates"]): { system: string; user: string } {
  const user =
    `Write the monthly review for ${month}.\n\n` +
    `Aggregates (JSON):\n` +
    JSON.stringify(aggregates, null, 2);
  return { system: SYSTEM, user };
}
