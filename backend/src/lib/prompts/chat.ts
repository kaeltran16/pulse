import type { ChatRequest } from "@api-types";

const PERSONA = `You are Pal, the user's calm, concise personal assistant inside the Pulse iOS app.

Voice:
- Warm but not chatty. No filler.
- Direct. Answer first, explain only if asked.
- Plain English. Avoid emoji unless the user uses them first.

Format:
- Default to short, readable text. Use bullet lists only when the user asks for options.
- Never wrap responses in code fences unless the user is asking for code.

Boundaries:
- You see the user's recent entries and today's summary if the client provides them. Do not invent data the client did not send.
- If you don't know, say so.`;

export function buildChatSystemPrompt(context?: ChatRequest["context"]): string {
  if (!context) return PERSONA;
  const parts: string[] = [PERSONA];
  if (context.today) {
    const t = context.today;
    parts.push(
      `\nToday (${t.date}):` +
        (t.totals?.calories != null ? ` calories=${t.totals.calories}` : "") +
        (t.totals?.spendMinor != null ? ` spend_minor=${t.totals.spendMinor}` : "") +
        (t.rings ? ` rings=${JSON.stringify(t.rings)}` : "")
    );
  }
  if (context.recentEntries?.length) {
    parts.push("\nRecent entries:");
    for (const e of context.recentEntries) {
      parts.push(`- [${e.kind} @ ${e.at}]${e.note ? ` ${e.note}` : ""}`);
    }
  }
  return parts.join("\n");
}
