import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError, z } from "zod";
import { errorHandler, UpstreamError } from "../../src/middleware/errorHandler.js";
import { AuthError } from "../../src/middleware/auth.js";
import { createLogger } from "../../src/lib/logger.js";

function fakeRes() {
  const r: any = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return r as Response & { statusCode: number; body: any };
}

const logger = createLogger("fatal");
const handle = errorHandler(logger);
const req = { id: "req-1" } as Request;
const next = vi.fn() as unknown as NextFunction;

describe("errorHandler", () => {
  it("maps AuthError(unauthorized) to 401 envelope", () => {
    const res = fakeRes();
    handle(new AuthError("unauthorized", "no token"), req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: { code: "unauthorized", message: "no token" }, requestId: "req-1" });
  });

  it("maps AuthError(forbidden) to 403", () => {
    const res = fakeRes();
    handle(new AuthError("forbidden", "scope"), req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.error.code).toBe("forbidden");
  });

  it("maps ZodError to 400 validation_failed", () => {
    const res = fakeRes();
    const err = (() => {
      try {
        z.object({ x: z.string() }).parse({});
        return new Error("unreachable");
      } catch (e) {
        return e as ZodError;
      }
    })();
    handle(err, req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });

  it("maps UpstreamError to 502", () => {
    const res = fakeRes();
    handle(new UpstreamError("openrouter 503"), req, res, next);
    expect(res.statusCode).toBe(502);
    expect(res.body.error.code).toBe("upstream_error");
  });

  it("maps unknown errors to 500 internal with generic message", () => {
    const res = fakeRes();
    handle(new Error("boom"), req, res, next);
    expect(res.statusCode).toBe(500);
    expect(res.body.error.code).toBe("internal");
    expect(res.body.error.message).toBe("internal server error");
  });
});
