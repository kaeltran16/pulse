import type { ParseHint } from "@api-types";

const SYSTEM = `You parse short, free-form entries the user typed into the Pulse app into structured JSON.

Output rules:
- Return JSON only. No prose. No code fences.
- Pick exactly one kind: "food", "workout", or "spend".
- For food: items[] with name + optional qty, optional calories, optional meal.
- For workout: optional routine, optional sets[], optional durationMin.
- For spend: amount (number), currency (ISO 4217), optional category, optional merchant.
- If you can't tell with high confidence, set confidence: "low".

Shape:
{ "kind": "food" | "workout" | "spend",
  "data": <kind-specific object>,
  "confidence": "high" | "low",
  "raw": <the input text exactly> }`;

export function buildParseMessages(text: string, hint?: ParseHint): { system: string; user: string } {
  const hintLine = hint ? `\nhint: ${hint}` : "";
  const user = `Parse this entry:\n"""\n${text}\n"""${hintLine}`;
  return { system: SYSTEM, user };
}
