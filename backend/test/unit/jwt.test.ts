import { describe, it, expect } from "vitest";
import jwt from "jsonwebtoken";
import { verifyToken, AuthError, type Scope } from "../../src/middleware/auth.js";

const SECRET = "x".repeat(32);

function sign(payload: object, secret = SECRET): string {
  return jwt.sign(payload, secret, { algorithm: "HS256" });
}

describe("verifyToken", () => {
  it("returns claims for a valid token", () => {
    const token = sign({ sub: "kael", scope: ["chat", "parse", "review"] });
    const claims = verifyToken(token, SECRET, "chat" as Scope);
    expect(claims.sub).toBe("kael");
    expect(claims.scope).toContain("chat");
  });

  it("throws AuthError(unauthorized) on bad signature", () => {
    const token = sign({ sub: "kael", scope: ["chat"] }, "y".repeat(32));
    expect(() => verifyToken(token, SECRET, "chat" as Scope)).toThrowError(AuthError);
    try {
      verifyToken(token, SECRET, "chat" as Scope);
    } catch (e) {
      expect((e as AuthError).code).toBe("unauthorized");
    }
  });

  it("throws AuthError(unauthorized) on malformed token", () => {
    expect(() => verifyToken("not.a.jwt", SECRET, "chat" as Scope)).toThrowError(AuthError);
  });

  it("throws AuthError(forbidden) when scope is missing", () => {
    const token = sign({ sub: "kael", scope: ["parse"] });
    try {
      verifyToken(token, SECRET, "chat" as Scope);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AuthError).code).toBe("forbidden");
    }
  });

  it("throws AuthError(unauthorized) when scope claim is missing entirely", () => {
    const token = sign({ sub: "kael" });
    try {
      verifyToken(token, SECRET, "chat" as Scope);
      throw new Error("should have thrown");
    } catch (e) {
      expect((e as AuthError).code).toBe("unauthorized");
    }
  });
});
