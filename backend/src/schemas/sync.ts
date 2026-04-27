import { z } from "zod";

export const SyncEntriesQuerySchema = z.object({
  since: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type SyncEntriesQuery = z.infer<typeof SyncEntriesQuerySchema>;
