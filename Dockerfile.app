# syntax=docker/dockerfile:1
# LOCAL BUILD: docker build -f ./Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .
#
# `# syntax=docker/dockerfile:1` enables BuildKit features used below — most
# importantly `RUN --mount=type=cache,...` for npm + Next.js build caches and
# `RUN --mount=type=secret,...` for Sentry credentials.
# BuildKit is the default builder in Docker Desktop and modern docker engine.
FROM node:24-alpine AS base

#region deps
# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
# RUN apk add --no-cache libc6-compat # disable this, as it prevents Prisma from running https://www.prisma.io/docs/guides/docker
WORKDIR /app
# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
# `--mount=type=cache` keeps the npm download cache outside the image, so
# subsequent rebuilds (locally and in CI) skip the network round-trip for
# packages that haven't changed. `sharing=locked` ensures concurrent builds
# don't corrupt the cache.
#
# After install, strip Sharp's glibc-arm64 and glibc-x64 binaries. Alpine is
# musl, so the linuxmusl variants are the only ones loaded at runtime. The
# glibc variants are pulled in defensively as npm optional deps but never
# `dlopen()`'d on a musl host — saves ~16.6 MB on the final image because
# Next.js's `@vercel/nft` standalone trace would otherwise include them.
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit --no-fund; \
    else echo "Lockfile not found." && exit 1; \
    fi && \
    rm -rf node_modules/@img/sharp-libvips-linux-arm64 \
           node_modules/@img/sharp-libvips-linux-x64 \
           node_modules/@img/sharp-linux-arm64 \
           node_modules/@img/sharp-linux-x64
#endregion

#region builder
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client
RUN POSTGRES_URL=postgresql://dummy npx prisma generate
# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1
#
# Sentry/GlitchTip credentials are passed via `--mount=type=secret`, NOT via
# build args. ARGs leak into the image's BuildKit provenance attestation,
# which is published to GHCR alongside the image — for a public package,
# that means anyone can read `--build-arg SENTRY_AUTH_TOKEN=...` via
# `docker buildx imagetools inspect`. Secrets mounted this way live only in
# the RUN's tmpfs, never touch any layer or cache, never appear in
# provenance. The `env=NAME` form exposes the secret as an env var for the
# duration of the RUN, which is exactly what `withSentryConfig` reads at
# build time. Each secret is optional — if not passed, the env var is
# simply unset and the Sentry plugin skips sourcemap upload gracefully.
#
# `--mount=type=cache` for `/app/.next/cache` lets webpack/turbopack reuse
# compilation artifacts across builds — typically 60–80% faster rebuilds in
# CI once the cache is warm. Cache lives in BuildKit storage, never in the
# image.
RUN --mount=type=cache,target=/app/.next/cache,sharing=locked \
    --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    --mount=type=secret,id=sentry_url,env=SENTRY_URL \
    --mount=type=secret,id=sentry_org,env=SENTRY_ORG \
    --mount=type=secret,id=sentry_project,env=SENTRY_PROJECT \
    if [ -f package-lock.json ]; then npm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi
#endregion

#region runner
# Hardened minimal runtime — Chainguard images are rebuilt daily with patched
# packages and carry near-zero CVEs. The free `:latest` tag tracks current
# stable Node. No shell, no package manager, no wget/curl — only the Node
# runtime. Runs as `nonroot` (uid 65532) by default with ENTRYPOINT ["node"].
FROM cgr.dev/chainguard/node:latest AS runner
WORKDIR /app
# Pass the version from the build step
ARG VERSION
LABEL org.opencontainers.image.source="https://github.com/elfensky/helldivers.bot"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.title="Helldivers Bot"
LABEL version="${VERSION}"
LABEL description="nextjs application that serves as an api rebroadcaster and formatter for Helldivers 1"
# defaults to production, but can be overriden at build time
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nonroot:nonroot /app/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /app/.next/static ./.next/static
COPY --from=builder --chown=nonroot:nonroot /app/public ./public
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
# Image ENTRYPOINT is ["node"], so CMD is just the script path.
CMD ["server.js"]
# Node's built-in fetch (stable since Node 21) replaces wget/curl probes.
# Exec form (JSON array) bypasses /bin/sh, which Chainguard doesn't ship.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
#endregion
