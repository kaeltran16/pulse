# pulse-backend

Stateless AI proxy for the Pulse iOS app. See `docs/superpowers/specs/2026-04-25-backend-v1-ai-proxy-design.md` for the full design.

## Quick start (local dev on Windows)

```bash
cd backend
cp .env.example .env
# Edit .env: set OPENROUTER_API_KEY, generate JWT_SECRET (openssl rand -hex 32 or equivalent)
npm install
npm run dev
```

Server listens on `http://0.0.0.0:3000`.

Mint a dev token:

```bash
JWT_SECRET=<your-secret> npx tsx scripts/issue-token.ts -- --sub kael --scope chat,parse,review
```

Smoke-test locally:

```bash
BASE_URL=http://localhost:3000 DEV_JWT=<token> ./scripts/smoke.sh
```

## Deploy

One-time droplet bootstrap: `deploy/bootstrap.md`.

After bootstrap:

```bash
DEPLOY_HOST=user@<droplet-host> ./scripts/deploy.sh
```

`deploy.sh` builds, rsyncs, installs prod deps on the droplet, restarts `pulse-backend.service`, and runs `smoke.sh`.

## Rotate the JWT

1. Generate a new secret: `openssl rand -hex 32`
2. Update `/etc/pulse-backend.env` on the droplet, replace `JWT_SECRET`
3. `sudo systemctl restart pulse-backend`
4. Mint a new token (`scripts/issue-token.ts`)
5. Update the iOS app's stored token and your local dev `.env`

## Endpoints

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/health` | — | `{ ok, version }` |
| POST | `/chat` | `ChatRequest` | SSE: `chunk` events, then `done`. `error` on failure. |
| POST | `/parse` | `ParseRequest` | `ParseResponse` |
| POST | `/review` | `ReviewRequest` | `ReviewResponse` |

All non-`/health` routes require `Authorization: Bearer <jwt>`. Types live in `lib/api-types.ts`.

## Tests

```bash
npm test       # vitest run
npm run test:watch
```

No real OpenRouter calls — the SDK is mocked at the module boundary in `test/helpers/app.ts`.
