import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import type { ErrorEnvelope } from "@api-types";

export function createRateLimit(perMin: number) {
  return rateLimit({
    windowMs: 60_000,
    limit: perMin,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req: Request, res: Response, _next: NextFunction) => {
      const envelope: ErrorEnvelope = {
        error: { code: "rate_limited", message: "too many requests" },
        requestId: req.id ?? "unknown",
      };
      res.status(429).json(envelope);
    },
  });
}
