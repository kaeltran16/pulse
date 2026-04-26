import type { ErrorRequestHandler, Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import type { ErrorCode, ErrorEnvelope } from "@api-types";
import type { Logger } from "../lib/logger.js";
import { AuthError } from "./auth.js";

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

export class GenerationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationFailedError";
  }
}

type Mapped = { status: number; code: ErrorCode; message: string };

function map(err: unknown): Mapped {
  if (err instanceof AuthError) {
    const status = err.code === "forbidden" ? 403 : 401;
    return { status, code: err.code, message: err.message };
  }
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`).join("; ");
    return { status: 400, code: "validation_failed", message };
  }
  if (err instanceof GenerationFailedError) {
    return { status: 502, code: "generation_failed", message: err.message };
  }
  if (err instanceof UpstreamError) {
    return { status: 502, code: "upstream_error", message: "upstream provider error" };
  }
  return { status: 500, code: "internal", message: "internal server error" };
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
    const m = map(err);
    const requestId = req.id ?? "unknown";
    logger.error({ requestId, code: m.code, status: m.status, err: err instanceof Error ? err.message : String(err) }, "request failed");
    const envelope: ErrorEnvelope = { error: { code: m.code, message: m.message }, requestId };
    res.status(m.status).json(envelope);
  };
}
