import type { ParseHint } from "@api-types";

const SYSTEM = `You parse short, free-form entries the user typed into the Pulse app into structured JSON, OR signal that the input is conversational.

Output rules:
- Return JSON only. No prose. No code fences.
- Pick exactly one kind: "workout", "spend", or "chat".
- Use "spend" when the user is logging money out: include amount (number) and currency (ISO 4217). Optional category, merchant.
- Use "workout" when the user is logging movement/exercise: optional routine, optional sets[], optional durationMin (number, in minutes).
- Use "chat" for everything else: questions ("how am I doing this week?"), conversational greetings, food mentions, anything that is NOT a quantified spend or workout entry. Pulse v1 does not track food, so food-shaped input is "chat", not an entry.
- If you can identify a workout or spend but key fields are ambiguous, set confidence: "low". Otherwise confidence: "high".
- For "chat", confidence is always "high".

Shapes:
{ "kind": "workout" | "spend",
  "data": <kind-specific object>,
  "confidence": "high" | "low",
  "raw": <the input text exactly> }
{ "kind": "chat",
  "confidence": "high",
  "raw": <the input text exactly> }`;

export function buildParseMessages(text: string, hint?: ParseHint): { system: string; user: string } {
  const hintLine = hint ? `\nhint: ${hint}` : "";
  const user = `Parse this entry:\n"""\n${text}\n"""${hintLine}`;
  return { system: SYSTEM, user };
}
