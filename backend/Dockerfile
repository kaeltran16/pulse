# syntax=docker/dockerfile:1.7
FROM node:22-slim AS builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./backend/
COPY lib/api-types.ts ./lib/api-types.ts
WORKDIR /app/backend
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/scripts ./scripts
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-slim AS runtime
RUN groupadd -g 1500 pulse-backend \
 && useradd -u 1500 -g 1500 -r -s /usr/sbin/nologin pulse-backend
WORKDIR /app
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/node_modules ./node_modules
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/package.json ./
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/dist ./dist
COPY --from=builder --chown=pulse-backend:pulse-backend /app/backend/src/db/migrations ./dist/backend/src/db/migrations
USER pulse-backend
EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]
