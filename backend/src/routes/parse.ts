import { Router, type Request, type Response, type NextFunction } from "express";
import { parseEntry, type ParseEntryDeps } from "../lib/parse.js";

export function parseRouter(deps: ParseEntryDeps): Router {
  const r = Router();
  r.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const out = await parseEntry(deps, req.body);
      res.status(200).json(out);
    } catch (err) {
      next(err);
    }
  });
  return r;
}
