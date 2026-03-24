# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js application that consumes the official Helldivers 1 API, caches and rebroadcasts it to reduce load on official servers. It stores historic game data, provides API access via keys, and includes a frontend with data visualizations and event notifications.

**Tech Stack:** Next.js 15 (App Router), Prisma, PostgreSQL, NextAuth.js v5, Node.js 22, Sentry SDK (Bugsink)

## Development Commands

```bash
npm install              # Install dependencies
npm run dev              # Start dev server with Turbopack
npm run build            # Build for production
npm start                # Start production server (uses standalone output)
npm run format           # Auto-format code with Prettier (watch mode)
```

**No test framework is configured.** There are no test scripts, test dependencies, or test files.

### Prisma

```bash
npx prisma generate                  # Generate Prisma Client (outputs to src/generated/prisma/)
npx prisma migrate dev               # Create and apply migration (development)
npx prisma migrate dev --name init   # Named migration
npx prisma db push                   # Push schema without migration (prototyping only)
npx prisma migrate deploy            # Apply pending migrations (production)
```

### Docker

Two separate Dockerfiles:
- `Dockerfile.app` — Multi-stage build for the Next.js app (standalone output)
- `Dockerfile.migrate` — Runs `npx prisma migrate deploy` only (used in CI before app deployment)

```bash
docker build -f Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .
docker buildx build --platform linux/amd64 -f Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .  # for x86_64
docker compose up
```

**Important:** Database must exist before running — the container will NOT create it.

## Architecture

> For detailed technical reference, see the [docs/](docs/) directory.

### Initialization Flow (`src/instrumentation.js`)

On startup, `register()` orchestrates initialization (nodejs runtime only):

1. **Sentry** — Registers error tracking for server and edge runtimes
2. **Environment Variables** — Validates required `.env` variables
3. **OpenAPI Spec** — Generates or verifies spec existence (dev mode auto-generates)
4. **Worker Thread** — Launches `public/workers/cron.js` which polls `/api/h1/update` every `UPDATE_INTERVAL` seconds using `UPDATE_KEY`

Database migrations run separately via `Dockerfile.migrate` in CI, not during app startup.

### Data Flow: Fetch → Validate → Store

**Two-Table Strategy:**
- **Rebroadcast tables** (`rebroadcast_status`, `rebroadcast_snapshot`) — Raw JSON from official API
- **H1 tables** (`h1_season`, `h1_campaign`, `h1_event`, etc.) — Normalized, historical data

**Update Process (`src/update/status.mjs`):**
1. Fetch from official Helldivers API via Axios (`src/update/fetch.mjs`)
2. Validate with Zod schemas (`src/validators/`)
3. Upsert raw JSON to `rebroadcast_status`
4. Upsert to normalized tables in parallel (`h1_campaign`, `h1_defend_event`, `h1_attack_event`, `h1_statistic`)
5. Confirm success by updating `h1_season.last_updated`

### Database Schema (`prisma/schema.prisma`)

**Season-Centric Model:** All game data links to `h1_season` via the `season` integer field.

**Custom Prisma Client output:** `src/generated/prisma/` (not the default location). Binary targets include `darwin-arm64` and `linux-musl-*` for Docker.

**Auth tables:** NextAuth.js v5 with Prisma adapter (Account, Session, VerificationToken, Authenticator).

**User features:** API key management (`ApiKey` table with MD5 hashing), reviews, JSON settings.

### API Endpoints

- `GET /api/h1/update?key=...` — Internal, triggered by worker to update current campaign
- `POST /api/h1/rebroadcast` — Mirrors official API (actions: `get_campaign_status`, `get_snapshots`)
- `GET /api/h1/campaign?season=N` — Combined status + snapshot in single query
- `GET /api/healthcheck` — Health check (also used by Docker HEALTHCHECK)
- `POST /api/auth/[...nextauth]` — NextAuth.js authentication

### Auth (`src/auth.js`)

NextAuth.js v5 with database session strategy (not JWT). Active providers: Discord OAuth, GitHub OAuth. Nodemailer magic links available but commented out.

## Code Patterns

### Error Handling — `tryCatch` wrapper (`src/utils/tryCatch.mjs`)

Used **instead of try/catch blocks** throughout the codebase. Returns `{ data, error }`:

```js
const { data, error } = await tryCatch(someAsyncOperation());
if (error) { /* handle */ }
```

### API Response Helpers (`src/utils/responses.mjs`)

All API routes use `errorResponse(code, start, error)` and `successResponse(code, start, data)` which include timing, status code, message, and payload.

### Performance Tracking (`src/utils/time.mjs`)

All API routes measure execution time. `roundedPerformanceTime(start)` rounds elapsed time up to nearest 50ms. Used for Umami analytics event tracking.

### Path Aliases

`@/*` maps to `./src/*` (configured in `jsconfig.json`). Import Prisma client as `@/db/db`, validators as `@/validators/...`, etc.

### Worker Thread (`public/workers/cron.js`)

Uses `setTimeout` (not `setInterval`) for self-scheduling to prevent overlapping requests. Communicates via `worker_threads` message passing.

### Other Conventions

- **Server Actions:** Most utilities use `'use server'` directive
- **Validation:** All external data validated with Zod before database operations
- **React Compiler:** Enabled experimentally in `next.config.mjs`
- **Formatting:** Prettier with tailwindcss plugin, no ESLint configured
- **Node Version:** Volta pins node@22.16.0 and npm@11.4.2

## Deployment

**GitHub Actions:**
- Every push to main → builds `:staging` images (both migrate and app)
- Tagged commits (e.g. `v1.0.0`) → builds `:production` + `:latest` images, creates GitHub Release from `RELEASE.md`

**Production:** `node .next/standalone/server.js` with tini init system in Alpine container.

## Error Tracking (Sentry/Bugsink)

Uses Sentry SDK configured for self-hosted Bugsink instance.

**Config files:** `sentry.server.config.js`, `sentry.edge.config.js`, `src/instrumentation-client.js`, `src/app/global-error.jsx`

**Bugsink-specific:** `tracesSampleRate: 0` (unsupported), no session replay/feedback/logs, source map upload disabled, `sendDefaultPii: true` (OK for self-hosted).

## Environment Variables

See `.example.env` for the full list. Key variables:
- `POSTGRES_URL` — PostgreSQL connection string (use `host.docker.internal` in Docker)
- `UPDATE_KEY` / `UPDATE_INTERVAL` — Worker thread authentication and polling interval
- `AUTH_SECRET` — NextAuth.js secret (128+ chars recommended)
- OAuth credentials for Discord (`AUTH_DISCORD_ID/SECRET`) and GitHub (`AUTH_GITHUB_ID/SECRET`)
