import { Router } from "express";

export const VERSION = "0.1.0";

export function healthRouter(): Router {
  const r = Router();
  r.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, version: VERSION });
  });
  return r;
}
