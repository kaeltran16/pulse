import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { ErrorCode } from "@api-types";

export type Scope = "chat" | "parse" | "review" | "generate-routine";

export type AuthClaims = {
  sub: string;
  scope: Scope[];
  iat?: number;
};

export class AuthError extends Error {
  constructor(public code: Extract<ErrorCode, "unauthorized" | "forbidden">, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function verifyToken(token: string, secret: string, requiredScope: Scope): AuthClaims {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  } catch (_err) {
    throw new AuthError("unauthorized", "invalid token");
  }
  if (!decoded || typeof decoded !== "object") {
    throw new AuthError("unauthorized", "malformed claims");
  }
  const claims = decoded as Partial<AuthClaims>;
  if (typeof claims.sub !== "string" || !Array.isArray(claims.scope)) {
    throw new AuthError("unauthorized", "missing required claims");
  }
  if (!claims.scope.includes(requiredScope)) {
    throw new AuthError("forbidden", `token lacks scope '${requiredScope}'`);
  }
  return claims as AuthClaims;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

export function authMiddleware(secret: string, requiredScope: Scope) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (typeof header !== "string" || !header.startsWith("Bearer ")) {
      return next(new AuthError("unauthorized", "missing or malformed Authorization header"));
    }
    const token = header.slice("Bearer ".length).trim();
    if (!token) return next(new AuthError("unauthorized", "empty bearer token"));
    try {
      req.auth = verifyToken(token, secret, requiredScope);
      next();
    } catch (err) {
      next(err);
    }
  };
}
