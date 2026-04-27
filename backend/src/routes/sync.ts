import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import type { Db } from "../db/client.js";
import { listSinceCursor } from "../db/queries/syncedEntries.js";
import { getActiveAccount } from "../db/queries/imapAccounts.js";
import { SyncEntriesQuerySchema } from "../schemas/sync.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { SyncedEntryDTO, SyncEntriesResponse } from "@api-types";

export type SyncRouterDeps = { db: Db };

export function syncRouter(deps: SyncRouterDeps): Router {
  const r = Router();

  r.get("/entries", (req: Request, res: Response, next: NextFunction) => {
    try {
      let q;
      try {
        q = SyncEntriesQuerySchema.parse(req.query);
      } catch (err) {
        if (err instanceof ZodError) {
          return next(
            new HttpError(400, "invalid_request", err.issues.map((i) => i.message).join("; ")),
          );
        }
        throw err;
      }

      const account = getActiveAccount(deps.db);
      if (!account) {
        const empty: SyncEntriesResponse = {
          accountId: null,
          entries: [],
          hasMore: false,
          cursor: q.since,
        };
        res.status(200).json(empty);
        return;
      }

      const rows = listSinceCursor(deps.db, account.id, q.since, q.limit + 1);
      const hasMore = rows.length > q.limit;
      const trimmed = hasMore ? rows.slice(0, q.limit) : rows;
      const entries: SyncedEntryDTO[] = trimmed.map((row) => ({
        id: row.id,
        merchant: row.merchant,
        cents: row.cents,
        currency: row.currency,
        category: row.category,
        occurredAt: row.occurredAt,
        recurring: row.recurring === 1,
        emailFrom: row.emailFrom,
      }));
      const cursor = entries.length > 0 ? entries[entries.length - 1].id : q.since;

      const out: SyncEntriesResponse = {
        accountId: account.id,
        entries,
        hasMore,
        cursor,
      };
      res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  });

  return r;
}
