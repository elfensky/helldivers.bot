# syntax=docker/dockerfile:1
# LOCAL BUILD: docker build -f ./Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .
#
# `# syntax=docker/dockerfile:1` enables BuildKit features used below — most
# importantly `RUN --mount=type=cache,...` for npm + Next.js build caches and
# `RUN --mount=type=secret,...` for Sentry credentials.
# BuildKit is the default builder in Docker Desktop and modern docker engine.
FROM node:24 AS base

#region deps
# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
# Install dependencies based on the preferred package manager
COPY package.json package-lock.json ./
# `--mount=type=cache` keeps the npm download cache outside the image, so
# subsequent rebuilds (locally and in CI) skip the network round-trip for
# packages that haven't changed. `sharing=locked` ensures concurrent builds
# don't corrupt the cache.
#
# Build on glibc (node:24 is Debian, NOT Alpine/musl) so Sharp's prebuilt
# glibc binary (@img/sharp-linux-x64) is installed and traced into the
# standalone output. The runtime image (node:24-slim, Debian) is ALSO
# glibc, so the binary loads. Do NOT strip @img/sharp-* — building on
# musl while shipping to a glibc runtime makes Sharp fail at runtime with
# "Could not load the 'sharp' module using the linux-x64 runtime" (the image
# optimizer then 500s on every avatar/icon).
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    if [ -f package-lock.json ]; then npm ci --prefer-offline --no-audit --no-fund; \
    else echo "Lockfile not found." && exit 1; \
    fi
#endregion

#region builder
# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client
RUN POSTGRES_URL=postgresql://dummy npx prisma generate
# NEXT_PUBLIC_DEPLOY_ENV must be present as an env var BEFORE `npm run build`
# below: Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build
# time, so this is what tags client-side Sentry events with the right
# environment (staging vs production). Empty string is fine — the SDK's
# fallback chain in instrumentation-client.js drops down to DEPLOY_ENV / NODE_ENV.
ARG NEXT_PUBLIC_DEPLOY_ENV
ENV NEXT_PUBLIC_DEPLOY_ENV=$NEXT_PUBLIC_DEPLOY_ENV
# NEXT_PUBLIC_SENTRY_DSN is the browser-side GlitchTip DSN. Like DEPLOY_ENV
# it is inlined into the client bundle at build time, so it MUST be set here as
# a build arg — setting it only at runtime leaves the browser SDK inert (no
# client-side error/trace reporting). It is a public value (it ships to every
# browser by design), so a plain build arg is correct; unlike SENTRY_AUTH_TOKEN
# it needs no secret mount. Empty is fine — the client SDK no-ops without it.
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
# NEXT_PUBLIC_VAPID_PUBLIC_KEY is the public half of the Web Push VAPID
# keypair. Like DEPLOY_ENV and SENTRY_DSN it is inlined into the client
# bundle at build time (Next.js NEXT_PUBLIC_* rule), so it MUST be set here
# as a build arg — a value present only at runtime never reaches the shipped
# JS and NotificationToggle's Enable flow surfaces the new 'error' state for
# every push-capable visitor instead of subscribing them (#485/STAB-03).
# It is a public value by design (VAPID public keys are meant to ship to
# every browser), so a plain build arg is correct; unlike the private key it
# needs no secret mount. Empty is fine — the client SDK's missing-key branch
# already renders the error state deliberately.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY
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
    if [ -f package-lock.json ]; then POSTGRES_URL=postgresql://dummy UPDATE_KEY=dummy UPDATE_INTERVAL=20 npm run build; \
    else echo "Lockfile not found." && exit 1; \
    fi
#endregion

#region runner
# Minimal Debian runtime on glibc, so Sharp's prebuilt binaries load. Until
# 2026-10-23 this was gcr.io/distroless/nodejs24-debian12:nonroot; distroless
# was still shipping Node 24.14.0 two days after Node2Shell (CVE-2026-111497)
# was fixed in 24.22.1, while node:24-slim carried the fix within hours. The
# slim image has a shell and apt, so it is a larger surface than distroless;
# the app still runs as uid 65532 and nothing here calls a shell.
FROM node:24-slim AS runner
WORKDIR /app
# shortcut: the hand-maintained production compose healthcheck calls
# /nodejs/bin/node by full path (the distroless location). Keep that path
# resolving until that compose calls plain `node`; then delete this line.
RUN mkdir -p /nodejs/bin && ln -s /usr/local/bin/node /nodejs/bin/node
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
# Server-side Sentry config reads this at runtime. The builder stage above
# also bakes it into the client bundle at build time.
ARG NEXT_PUBLIC_DEPLOY_ENV
ENV NEXT_PUBLIC_DEPLOY_ENV=$NEXT_PUBLIC_DEPLOY_ENV
# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
#
# Chown by NUMERIC uid:gid (65532 = the runtime user). Numeric IDs need no
# /etc/passwd lookup, so the runtime user owns the tree regardless of how the
# base image names that uid. This keeps /app/.next writable so the Next.js
# image optimizer's runtime `mkdir('.next/cache/images')` doesn't fail with
# EACCES — which previously flooded logs with unhandledRejection on every
# remote-avatar (Discord/GitHub/Google/Gravatar) optimization.
COPY --from=builder --chown=65532:65532 /app/.next/standalone ./
COPY --from=builder --chown=65532:65532 /app/.next/static ./.next/static
COPY --from=builder --chown=65532:65532 /app/public ./public
USER 65532:65532
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
# node:24-slim's ENTRYPOINT is docker-entrypoint.sh, which execs the command.
CMD ["node", "server.js"]
# Node's built-in fetch (stable since Node 21) replaces wget/curl probes.
# Exec form (JSON array) so no shell is involved.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/healthcheck').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
#endregion
