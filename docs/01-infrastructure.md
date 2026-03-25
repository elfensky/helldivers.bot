# Infrastructure, Deployment, and Initialization

Technical reference for the helldivers.bot infrastructure layer. Audience: project owner and AI assistants.

---

## Section 1: Docker Strategy

The project uses two separate Dockerfiles. Migrations and the application server run in separate containers with a defined startup order.

### Dockerfile.migrate

**Image:** `ghcr.io/elfensky/helldiversbot-migrate:staging`

**Purpose:** Runs `prisma migrate deploy` once and exits. It never stays alive.

**Build process:**

1. Base image: `node:22-alpine`
2. Install `tini` via `apk` (init system for zombie process prevention)
3. Upgrade npm to `11.7.0`
4. `WORKDIR /app`
5. Copy `package.json`, `package-lock.json`, `prisma/`, and `prisma.config.mjs`
6. Extract the Prisma version from `package.json` at build time and install only that version — no full `npm ci`
7. Run `npx prisma generate` to produce the client
8. Entrypoint: `/sbin/tini --`
9. CMD: `npx prisma migrate deploy`

The Prisma version extraction uses a shell one-liner:

```dockerfile
COPY package.json package-lock.json ./
COPY prisma ./prisma/
COPY prisma.config.mjs ./
RUN PRISMA_VERSION=$(node -p "require('./package.json').devDependencies?.prisma || require('./package.json').dependencies?.prisma") && \
    npm install prisma@$PRISMA_VERSION @prisma/client@$PRISMA_VERSION @prisma/adapter-pg dotenv && \
    npx prisma generate
```

Prisma 7 CLI no longer auto-loads `.env` files. The `prisma.config.mjs` file imports `dotenv/config` to handle local env loading; in Docker, `POSTGRES_URL` is injected via `docker-compose`'s `env_file`.

This keeps the migrate image small — it carries only the Prisma CLI, not the entire application dependency tree.

### Dockerfile.app

**Image:** `ghcr.io/elfensky/helldiversbot:staging`

**Purpose:** Runs the Next.js standalone server. This container never touches migrations.

**Build stages:**

| Stage | Base | What it does |
|-------|------|-------------|
| `base` | `node:22-alpine` | Installs `tini` and upgrades npm to `11.7.0` |
| `deps` | `base` | Runs `npm ci` from lockfile; fails explicitly if lockfile is absent |
| `builder` | `base` | Copies `node_modules` from `deps`, copies source, runs `npx prisma generate` then `npm run build` |
| `runner` | `base` | Copies only `.next/standalone`, `.next/static`, and `public`; runs as non-root user |

**Runner stage details:**

- `ARG NODE_ENV=production` — overridable at build time; staging CI passes `NODE_ENV=staging`
- Creates system group `nodejs` (gid 1001) and user `nextjs` (uid 1001)
- All copied files are `--chown=nextjs:nodejs`
- `USER nextjs` is set before the entrypoint
- OCI labels: `org.opencontainers.image.source`, `org.opencontainers.image.licenses`, `org.opencontainers.image.title`, `version`, `description`
- Entrypoint: `/sbin/tini --`
- CMD: `node server.js` (the Next.js standalone output file)
- `EXPOSE 3000`, `ENV PORT=3000`, `ENV HOSTNAME="0.0.0.0"`
- Healthcheck (Dockerfile-level): `curl -f http://0.0.0.0:3000/api/healthcheck` every 30s, timeout 5s, start period 5s, 3 retries

### docker-compose.yml

```
migrate (helldiversbot-migrate:staging)
  env_file: .docker.env
  → runs once and exits

helldiversbot (helldiversbot:staging)
  env_file: .docker.env
  environment: SKIP_MIGRATIONS=true
  ports: 127.0.0.1:58102:3000
  restart: unless-stopped
  depends_on: migrate (condition: service_completed_successfully)
  healthcheck: curl localhost:3000/api/healthcheck every 60s, timeout 10s, 3 retries, 10s start_period
```

The port binding `127.0.0.1:58102:3000` deliberately limits exposure to the host loopback interface. External traffic must arrive through a reverse proxy (e.g., nginx or Caddy) on the host.

The `depends_on: condition: service_completed_successfully` ensures the app container does not start until migrations finish and the migrate container exits with code 0.

`SKIP_MIGRATIONS=true` is passed to the app container environment to signal the initialization code that database setup has already been handled externally.

### Why two containers

Running migrations inside the app container creates a race condition when scaling to multiple replicas — each replica would attempt to apply migrations simultaneously. By delegating migrations to a one-shot container that must complete before the app starts, the compose startup sequence is deterministic and safe.

---

## Section 2: CI/CD Pipelines

### Staging (`staging.docker.yml`)

**Trigger:** Push to `main`, or manual `workflow_dispatch`

**Jobs:** `build-migrate` and `build-app` run in parallel (no dependency between them). A third job `cleanup` runs after both complete.

| Job | Dockerfile | Tag pushed |
|-----|-----------|------------|
| `build-migrate` | `Dockerfile.migrate` | `ghcr.io/elfensky/helldiversbot-migrate:staging` |
| `build-app` | `Dockerfile.app` | `ghcr.io/elfensky/helldiversbot:staging` |

Both jobs pass `NODE_ENV=staging` as a build arg.

**Registry auth:** `secrets.GITHUB_TOKEN` — the default token with `contents: write` and `packages: write` permissions declared at the workflow level.

**Cleanup job:** Uses `snok/container-retention-policy@v3.0.1`. Deletes untagged versions of both `helldiversbot` and `helldiversbot-migrate` packages that are older than 30 minutes. This keeps GHCR from accumulating dangling layers from every push.

### Production (`release.docker.yml`)

**Trigger:** Version tags matching the pattern `*.*.*` (e.g., `1.2.3`)

**Jobs:** Single `build` job — only the app image is built; no migrate image is produced for production.

**Tags pushed:**

```
ghcr.io/elfensky/helldiversbot:{git-tag}
ghcr.io/elfensky/helldiversbot:production
ghcr.io/elfensky/helldiversbot:latest
```

**Version extraction:** The workflow reads the version from `package.json` via `jq -r '.version' package.json` and injects it into the image via the `VERSION` ARG (used by the Dockerfile label `version="${VERSION}"`).

**Registry auth:** `secrets.ACCESS_TOKEN` — a personal access token with elevated permissions. The default `GITHUB_TOKEN` is not used here because the job also creates a GitHub Release, which requires broader write access.

**GitHub Release:** Created by `softprops/action-gh-release@v2`. The release body is sourced from `RELEASE.md` at the repository root.

### Metrics (`metrics.yml`)

**Trigger:** Scheduled (Mondays at 00:00 UTC, Fridays at 06:00 UTC), or manual dispatch.

**Job:** Generates a PageSpeed Insights badge SVG using `lowlighter/metrics@latest` targeting `https://helldivers.bot`. The resulting `metrics.plugin.pagespeed.svg` is committed back to the repository. Requires `secrets.PAGESPEED_TOKEN`.

---

## Section 3: Initialization Flow

**Entry point:** `src/instrumentation.js` — Next.js calls `register()` automatically on server startup via the instrumentation hook.

### Full flow

```
register()   [src/instrumentation.js]
│
├── NEXT_RUNTIME === 'nodejs'
│   └── import sentry.server.config.js     → Sentry.init() for server runtime
│
├── NEXT_RUNTIME === 'edge'
│   └── import sentry.edge.config.js       → Sentry.init() for edge runtime
│
└── NEXT_RUNTIME === 'nodejs'
    └── initializeHelldivers1Api()
        │
        ├── Step 1: initializeEnvironmentVariables()   [src/utils/initialize.env.mjs]
        │   ├── checkDatabase()    → POSTGRES_URL
        │   ├── checkUpdates()     → UPDATE_KEY, UPDATE_INTERVAL (PORT optional, defaults 3000)
        │   ├── checkAnalytics()   → UMAMI_SITE_ID, SENTRY_AUTH_TOKEN
        │   ├── checkAuth()        → AUTH_SECRET, AUTH_TRUST_HOST, AUTH_DISCORD_ID/SECRET, AUTH_GITHUB_ID/SECRET
        │   ├── checkEmail()       → EMAIL_SERVER_USER/PASSWORD/HOST/PORT, EMAIL_FROM
        │   └── Error → process.exit(1)
        │
        ├── Step 2: initializeOpenApiSpec()            [src/utils/initialize.openapi.mjs]
        │   ├── development: generates public/openapi.json from the OpenAPI registry, validates JSON
        │   ├── production:  reads existing public/openapi.json, validates it parses as JSON
        │   ├── staging:     falls through to false (neither branch matches NODE_ENV=staging)
        │   └── false → process.exit(1)
        │
        └── Step 3: initializeWorker()                 [src/utils/initialize.worker.mjs]
            ├── Resolves worker path:
            │   ├── development: relative to __dirname → ../../public/workers/cron.js
            │   └── production:  absolute /app/public/workers/cron.js
            ├── new Worker(workerPath)
            ├── worker.postMessage({ key, interval, port })
            ├── Attaches message/error/exit handlers
            ├── Registers SIGINT/SIGTERM handlers that terminate the worker before exit
            └── false → process.exit(1)
```

### Failure behavior

Every initialization step fails hard: any error or falsy return causes `process.exit(1)`. There is no graceful degradation. The intent is that Docker's `restart: unless-stopped` will restart the container, giving the underlying problem (missing env var, bad database, missing OpenAPI spec) a chance to be resolved.

### onRequestError export

`src/instrumentation.js` also exports:

```js
export const onRequestError = Sentry.captureRequestError;
```

Next.js calls this hook for errors that occur inside Server Components, middleware, and proxied routes — errors that do not surface through the normal React error boundary. This is the server-side equivalent of `global-error.jsx`.

---

## Section 4: Error Tracking (Sentry / Bugsink)

The project uses the Sentry SDK (`@sentry/nextjs` v10) but targets a **self-hosted Bugsink** instance rather than Sentry SaaS. Bugsink is an error aggregator compatible with the Sentry ingest protocol but does not support tracing or session replay.

### Configuration files

| File | Runtime | Role |
|------|---------|------|
| `sentry.server.config.js` | Node.js | `Sentry.init()` called on server startup via `instrumentation.js` |
| `sentry.edge.config.js` | Edge | `Sentry.init()` called for middleware and edge routes |
| `src/instrumentation-client.js` | Browser | `Sentry.init()` called when a page loads in the browser |
| `src/app/global-error.jsx` | Browser | React error boundary; catches render-phase errors |

### Shared SDK settings (all three `Sentry.init()` calls)

```js
{
    dsn: 'https://853ecd1fc1dd47f28d6bb82a270cbbc5@bugsink.lavrenov.cloud/2',
    sendDefaultPii: true,     // safe on a self-hosted instance
    tracesSampleRate: 0,      // Bugsink does not support traces
    debug: false,
}
```

No session replay, feedback widget, or logs integrations are configured. Bugsink only processes error events.

### global-error.jsx

`src/app/global-error.jsx` is a client component (`'use client'`). It wraps the entire React tree. When an unhandled render error occurs:

1. `useEffect` fires and calls `Sentry.captureException(error)`
2. The component renders a minimal HTML page with a "Try again" button that calls `reset()`

This component is only reached for errors that escape all nested error boundaries. It must render its own `<html>` and `<body>` tags because the root layout is unavailable.

### next.config.mjs Sentry settings

The `withSentryConfig` wrapper in `next.config.mjs` controls build-time Sentry behavior:

```js
withSentryConfig(nextConfig, {
    silent: true,                      // suppress Sentry CLI console output
    disableServerWebpackPlugin: true,  // no source map upload (server)
    disableClientWebpackPlugin: true,  // no source map upload (client)
    hideSourceMaps: true,              // strip source maps from client bundles
    webpack: {
        autoInstrumentServerFunctions: true,
        autoInstrumentMiddleware: true,
        autoInstrumentAppDirectory: true,
        treeshake: {
            removeDebugLogging: true,  // tree-shake Sentry debug logs from bundle
        },
    },
})
```

Source map upload is disabled on both server and client webpack plugins. Bugsink handles error symbolication differently from Sentry SaaS.

---

## Section 5: Environment Variables

All required variables are checked at startup by `initializeEnvironmentVariables()` in `src/utils/initialize.env.mjs`. Any missing required variable throws synchronously and causes `process.exit(1)` in `instrumentation.js`.

### Full variable reference

| Variable | Required | Category | Description |
|----------|----------|----------|-------------|
| `POSTGRES_URL` | Yes | Database | PostgreSQL connection string |
| `UPDATE_KEY` | Yes | Updates | Bearer token for `/api/h1/update` — used by the worker to authenticate its polling requests |
| `UPDATE_INTERVAL` | Yes | Updates | Polling interval in seconds (e.g., `"20"`); passed to the worker thread |
| `PORT` | No | Updates | Server port; defaults to `3000`; passed to the worker so it knows which port to poll |
| `UMAMI_SITE_ID` | Yes | Analytics | Umami website tracking ID |
| `UMAMI_SITE_URL` | No* | Analytics | Umami instance URL; used in fetch calls but not validated at startup |
| `SENTRY_AUTH_TOKEN` | Yes | Error tracking | Sentry/Bugsink authentication token |
| `AUTH_SECRET` | Yes | Auth | NextAuth.js session secret; 128+ characters recommended |
| `AUTH_TRUST_HOST` | Yes | Auth | Tells NextAuth.js to trust the `X-Forwarded-Host` header from the reverse proxy |
| `AUTH_DISCORD_ID` | Yes | Auth | Discord OAuth application client ID |
| `AUTH_DISCORD_SECRET` | Yes | Auth | Discord OAuth application client secret |
| `AUTH_GITHUB_ID` | Yes | Auth | GitHub OAuth application client ID |
| `AUTH_GITHUB_SECRET` | Yes | Auth | GitHub OAuth application client secret |
| `EMAIL_SERVER_USER` | Yes | Email | SMTP username |
| `EMAIL_SERVER_PASSWORD` | Yes | Email | SMTP password |
| `EMAIL_SERVER_HOST` | Yes | Email | SMTP server hostname |
| `EMAIL_SERVER_PORT` | Yes | Email | SMTP port (e.g., `587`) |
| `EMAIL_FROM` | Yes | Email | Sender address for magic link emails |
| `SKIP_MIGRATIONS` | No | Docker | Set to `"true"` in the app container; has no effect on initialization logic currently but signals intent |
| `NODE_ENV` | No | App | `development`, `staging`, or `production`; affects OpenAPI spec behavior and worker path resolution |
| `NEXT_RUNTIME` | Internal | Next.js | Set automatically by Next.js; controls which Sentry config and init steps run |

### Connection string formats

Local development connects directly to the host machine:

```
postgresql://user:pass@127.0.0.1:5432/dbname
```

Inside Docker, the app container reaches the host's PostgreSQL via the special Docker DNS name:

```
postgresql://user:pass@host.docker.internal:5432/dbname
```

The `.docker.env` file (not checked into version control) holds the Docker-specific values and is referenced by both services in `docker-compose.yml`.

### Behavior note on `NODE_ENV=staging`

The staging CI workflow passes `NODE_ENV=staging` as a Docker build arg. At runtime this means `initializeOpenApiSpec()` returns `false` immediately (neither the `development` nor `production` branch matches), which triggers `process.exit(1)`. In practice the OpenAPI spec is baked into the image at build time and the staging environment is expected to run with `NODE_ENV=production` at runtime, not at build time. The build arg is used only for labeling purposes.

---

## Cross-references

- See [03-data-flow.md](03-data-flow.md) for the worker thread's role in the continuous update pipeline
- See [02-database-schema.md](02-database-schema.md) for the Prisma schema and migration strategy
