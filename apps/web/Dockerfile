# Web service: Next.js app + internal bot API. Owns the database and ledger
# signing keys — mount a persistent volume at /app/data.
# Build from the repo root:  docker build -f apps/web/Dockerfile .

FROM node:20-slim AS build
WORKDIR /app

# Install with only the manifests first so layer caching survives code changes.
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
RUN npm ci

COPY packages ./packages
COPY apps/web ./apps/web
COPY fixtures ./fixtures
RUN npm run build --workspace @brutality/web

FROM node:20-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./

# SQLite database + ledger signing keys live here; must persist across deploys.
VOLUME /app/data

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "@brutality/web"]
