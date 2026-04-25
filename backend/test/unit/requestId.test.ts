import { describe, it, expect, vi } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { requestId } from "../../src/middleware/requestId.js";

function fakeRes() {
  const headers: Record<string, string> = {};
  return {
    setHeader: (k: string, v: string) => {
      headers[k] = v;
    },
    headers,
  } as unknown as Response & { headers: Record<string, string> };
}

describe("requestId", () => {
  it("attaches a uuid to req.id and sets X-Request-Id header", () => {
    const req = {} as Request & { id?: string };
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);

    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
    expect((res as unknown as { headers: Record<string, string> }).headers["X-Request-Id"]).toBe(req.id);
    expect(next).toHaveBeenCalled();
  });

  it("ignores client-supplied X-Request-Id and mints fresh", () => {
    const incoming = "11111111-2222-3333-4444-555555555555";
    const req = { headers: { "x-request-id": incoming } } as unknown as Request & { id?: string };
    const res = fakeRes();
    const next = vi.fn() as unknown as NextFunction;

    requestId(req, res, next);
    expect(req.id).not.toBe(incoming);
    expect(req.id).toMatch(/^[0-9a-f-]{36}$/);
  });
});
