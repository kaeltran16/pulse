import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers?.["x-request-id"];
  const id = typeof incoming === "string" && UUID_RE.test(incoming) ? incoming : randomUUID();
  req.id = id;
  res.setHeader("X-Request-Id", id);
  next();
}
