// Run on the droplet (or locally with a known JWT_SECRET) to mint a long-lived token.
// Usage: JWT_SECRET=... npm exec tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review

import jwt from "jsonwebtoken";

function arg(name: string, fallback?: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  return process.argv[idx + 1];
}

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  console.error("JWT_SECRET env var must be set and >= 32 chars");
  process.exit(1);
}
const sub = arg("sub", "kael")!;
const scope = (arg("scope", "chat,parse,review") ?? "").split(",").map((s) => s.trim()).filter(Boolean);

const token = jwt.sign({ sub, scope }, secret, { algorithm: "HS256" });
process.stdout.write(token + "\n");
