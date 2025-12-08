FROM node:22-alpine AS base
# RUN apk add --no-cache tini

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    if [ -f package-lock.json ]; then npm ci; \
    else echo "Lockfile not found." && exit 1; \
    fi

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN --mount=type=cache,target=/root/.npm \
    if [ -f yarn.lock ]; then yarn run build; \
    elif [ -f package-lock.json ]; then npm run build; \
    elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi

FROM base AS runner
WORKDIR /app
ARG VERSION
LABEL org.opencontainers.image.source="https://github.com/elfensky/helldivers1api"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="Helldivers 1 Api"
LABEL version="${VERSION}"
LABEL description="nextjs application that serves as an api rebroadcaster and formatter for Helldivers 1"
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY ./prisma ./prisma/
RUN --mount=type=cache,target=/root/.npm npm i prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://0.0.0.0:3000/api/healthcheck || exit 1