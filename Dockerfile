FROM node:22-alpine AS deps

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/core/package.json packages/core/package.json
COPY packages/studio/package.json packages/studio/package.json
COPY packages/cli/package.json packages/cli/package.json
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/studio/node_modules ./packages/studio/node_modules
COPY --from=deps /app/packages/cli/node_modules ./packages/cli/node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app
RUN apk add --no-cache su-exec
RUN corepack enable && corepack prepare pnpm@11.3.0 --activate

ENV NODE_ENV=production
ENV INKOS_STUDIO_PORT=4567
ENV INKOS_DATA_ROOT=/data
ENV INKOS_MULTI_USER=1

COPY --from=builder /app ./
COPY docker/entrypoint.sh /usr/local/bin/inkos-docker-entrypoint
RUN chmod +x /usr/local/bin/inkos-docker-entrypoint \
  && mkdir -p /data \
  && chown -R node:node /data

EXPOSE 4567

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4567/ >/dev/null || exit 1

ENTRYPOINT ["inkos-docker-entrypoint"]
CMD ["node", "packages/studio/dist/api/index.js", "/data"]
