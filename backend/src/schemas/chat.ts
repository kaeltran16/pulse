import { z } from "zod";
import type { ChatRequest } from "@api-types";

const Entry = z.object({ id: z.string(), kind: z.enum(["food", "workout", "spend"]), at: z.string(), note: z.string().optional() });
const TodaySummary = z.object({
  date: z.string(),
  rings: z.object({ move: z.number().optional(), exercise: z.number().optional(), stand: z.number().optional() }).optional(),
  totals: z.object({ calories: z.number().optional(), spendMinor: z.number().optional() }).optional(),
});

export const ChatRequestSchema: z.ZodType<ChatRequest> = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1, "messages must contain at least one message"),
  context: z
    .object({
      recentEntries: z.array(Entry).optional(),
      today: TodaySummary.optional(),
    })
    .optional(),
});
