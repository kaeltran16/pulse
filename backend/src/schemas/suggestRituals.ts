import { z } from "zod";

const RitualCadence = z.enum(["morning", "evening", "all_day", "weekdays", "daily"]);
const RitualColor   = z.enum(["rituals", "accent", "move", "money", "cyan"]);

const RITUAL_ICON_SHORTLIST = [
  "book.closed.fill", "tray.fill", "character.book.closed.fill",
  "dumbbell.fill", "books.vertical.fill", "heart.fill",
  "sparkles", "cup.and.saucer.fill", "leaf.fill", "moon.fill",
  "figure.walk", "drop.fill", "fork.knife", "music.note",
  "bed.double.fill", "sun.max.fill",
] as const;
const RitualIcon = z.enum(RITUAL_ICON_SHORTLIST);

export const SuggestRitualsRequestSchema = z.object({
  active: z.array(
    z.object({ title: z.string(), cadence: RitualCadence, color: RitualColor }),
  ).max(50),
  recentRitualEntries: z.array(
    z.object({ title: z.string(), occurredAt: z.number().int() }),
  ).max(500).optional(),
});

export const SuggestRitualsResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      title:   z.string().min(1).max(40),
      reason:  z.string().min(1).max(200),
      icon:    RitualIcon,
      cadence: RitualCadence,
      color:   RitualColor,
    }),
  ).max(2),
});

export type SuggestRitualsRequestParsed = z.infer<typeof SuggestRitualsRequestSchema>;
export type SuggestRitualsResponseParsed = z.infer<typeof SuggestRitualsResponseSchema>;
