import type { Entry, TodaySummary } from "@api-types";

export const sampleEntries: Entry[] = [
  { id: "e1", kind: "workout", at: "2026-04-25T08:30:00Z", note: "oatmeal" },
  { id: "e2", kind: "spend", at: "2026-04-25T11:00:00Z", note: "coffee" },
];

export const sampleToday: TodaySummary = {
  date: "2026-04-25",
  rings: { move: 320, exercise: 25, stand: 8 },
  totals: { calories: 1450, spendMinor: 1250 },
};
