# Bot service: discord.js gateway client. Stateless — no database access;
# it talks to the web service's internal API (WEB_API_URL + BOT_API_SECRET).
# Build from the repo root:  docker build -f apps/bot/Dockerfile .

FROM node:20-slim
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/web/package.json apps/web/
COPY apps/bot/package.json apps/bot/
RUN npm ci --workspace @brutality/bot --include-workspace-root=false

COPY apps/bot ./apps/bot

CMD ["npm", "run", "start", "--workspace", "@brutality/bot"]
