import jwt from "jsonwebtoken";
import type { Scope } from "../../src/middleware/auth.js";

export const TEST_SECRET = "x".repeat(32);

export function signTestToken(opts: { sub?: string; scope?: Scope[]; secret?: string } = {}): string {
  const sub = opts.sub ?? "kael";
  const scope: Scope[] = opts.scope ?? ["chat", "parse", "review", "generate-routine", "sync"];
  const secret = opts.secret ?? TEST_SECRET;
  return jwt.sign({ sub, scope }, secret, { algorithm: "HS256" });
}
