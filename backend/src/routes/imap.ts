import { Router, type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import type { Db } from "../db/client.js";
import type { ImapValidator } from "../lib/seedImapAccount.js";
import { seedImapAccount } from "../lib/seedImapAccount.js";
import { ConnectRequestSchema } from "../schemas/imap.js";
import { HttpError } from "../middleware/errorHandler.js";
import { getActiveAccount, deleteImapAccount } from "../db/queries/imapAccounts.js";

export type ImapRouterDeps = {
  db: Db;
  encryptionKey: string | null;
  validator: ImapValidator;
  now?: () => number;
};

export function imapRouter(deps: ImapRouterDeps): Router {
  const r = Router();
  const now = deps.now ?? Date.now;

  r.post("/connect", async (req: Request, res: Response, next: NextFunction) => {
    try {
      let body;
      try {
        body = ConnectRequestSchema.parse(req.body);
      } catch (err) {
        if (err instanceof ZodError) {
          return next(
            new HttpError(400, "invalid_request", err.issues.map((i) => i.message).join("; ")),
          );
        }
        throw err;
      }

      if (!deps.encryptionKey) {
        return next(
          new HttpError(503, "server_misconfig", "PULSE_IMAP_ENCRYPTION_KEY is not configured"),
        );
      }

      try {
        const { id } = await seedImapAccount(
          { db: deps.db, encryptionKey: deps.encryptionKey, validator: deps.validator, now },
          {
            email: body.email,
            password: body.appPassword,
            allowlist: body.senderAllowlist ?? [],
          },
        );
        res.status(201).json({
          accountId: id,
          status: "active",
          emailAddress: body.email,
        });
      } catch (err) {
        const msg = (err as Error).message;
        if (/already exists/i.test(msg)) {
          return next(new HttpError(409, "already_connected", msg));
        }
        return next(new HttpError(401, "imap_auth_failed", msg || "IMAP credentials rejected"));
      }
    } catch (err) {
      next(err);
    }
  });

  r.get("/status", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const row = getActiveAccount(deps.db);
      if (!row) {
        res.status(200).json({ connected: false });
        return;
      }
      res.status(200).json({
        connected: true,
        accountId: row.id,
        emailAddress: row.emailAddress,
        status: row.status as "active" | "paused" | "error",
        lastPolledAt: row.lastPolledAt,
        lastError: row.lastError,
        pollIntervalSeconds: row.pollIntervalSeconds,
        senderAllowlist: JSON.parse(row.senderAllowlist) as string[],
      });
    } catch (err) {
      next(err);
    }
  });

  r.delete("/disconnect", (_req: Request, res: Response, next: NextFunction) => {
    try {
      const row = getActiveAccount(deps.db);
      if (row) {
        deleteImapAccount(deps.db, row.id);
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  });

  return r;
}
