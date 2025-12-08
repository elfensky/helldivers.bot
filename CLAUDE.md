# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Next.js application that consumes the official Helldivers 1 API, caches and rebroadcasts it to reduce load on official servers. It stores historic game data, provides API access via keys, and includes a frontend with data visualizations and event notifications.

**Tech Stack:** Next.js 15 (App Router), Prisma, PostgreSQL, NextAuth.js v5, Node.js 22

## Development Commands

### Local Development
```bash
npm install              # Install dependencies
npm run dev             # Start dev server with Turbopack
npm run build           # Build for production
npm start               # Start production server (uses standalone output)
npm run format          # Auto-format code with Prettier (watch mode)
```

### Docker
```bash
# Build locally (native architecture)
docker build -t ghcr.io/elfensky/helldivers1api:staging .

# Build for x86_64/amd64 (production deployment)
docker buildx build --platform linux/amd64 -t ghcr.io/elfensky/helldivers1api:staging .

# Run locally
docker compose up

# Push to registry
docker push ghcr.io/elfensky/helldivers1api:staging
```

**Important:** Database must exist before running the Docker container - it will NOT create it.

### Prisma
```bash
npx prisma generate          # Generate Prisma Client from schema
npx prisma migrate dev       # Create and apply migration (recommended for development)
npx prisma migrate dev --name init  # Named migration
npx prisma db push           # Push schema without migration (prototyping only)
npx prisma migrate reset     # Reset database (destructive)
npx prisma migrate deploy    # Apply pending migrations (production)
```

**Prisma Client Location:** Generated at `src/generated/prisma/` (custom output path)

## Architecture

### Application Initialization Flow

On startup, `src/instrumentation.js` orchestrates a 4-step initialization sequence:

1. **Environment Variables** - Validates required `.env` variables (see `.example.env`)
2. **OpenAPI Spec** - Generates or verifies spec existence (dev mode generates automatically)
3. **Database** - Connects, runs migrations, pre-populates seasons in `h1_season` table
4. **Worker Thread** - Launches background worker that polls `/api/h1/update` every `UPDATE_INTERVAL` seconds

The worker (`public/workers/cron.js`) continuously fetches current campaign data using the `UPDATE_KEY` token.

### Data Flow: Fetch → Validate → Store

**Two-Table Strategy:**
- **Rebroadcast tables** (`rebroadcast_status`, `rebroadcast_snapshot`) - Store raw JSON from official API
- **H1 tables** (`h1_season`, `h1_campaign`, `h1_event`, etc.) - Normalized, historical data

**Update Process (src/update/status.mjs):**
1. Fetch from official Helldivers API
2. Validate with Zod schemas (`src/validators/`)
3. Extract season number
4. Upsert to `rebroadcast_status` (raw JSON)
5. Upsert to normalized tables:
   - `h1_season` (create if missing, `last_updated` initially null)
   - `h1_campaign`, `h1_defend_event`, `h1_attack_event`, `h1_statistic` (parallel upserts)
6. Confirm success by updating `h1_season.last_updated`

**Season Snapshots (src/update/season.mjs):** Similar flow for historical season data.

### Database Schema Highlights

**Season-Centric Model:** All game data links to `h1_season` via the `season` integer field.

**Key Relationships:**
- `h1_season` has one-to-one: `h1_introduction_order`, `h1_points_max`
- `h1_season` has one-to-many: `h1_campaign`, `h1_snapshot`, `h1_defend_event`, `h1_attack_event`, `h1_event`, `h1_statistic`

**Authentication:** Uses NextAuth.js v5 with Prisma adapter. Supports Discord, GitHub OAuth, and Nodemailer magic links.

**User Features:** API key management (`ApiKey` table with MD5 hashing), reviews, custom settings stored as JSON.

### API Endpoints

**Core Endpoints:**
- `GET /api/h1/update?key=...` - Internal endpoint triggered by worker to update current campaign
- `POST /api/h1/rebroadcast` - Mirrors official API (actions: `get_campaign_status`, `get_snapshots`)
- `GET /api/h1/campaign?season=N` - Custom endpoint combining status + snapshot in single query
- `GET /api/healthcheck` - Health check
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication

**Authentication Endpoints:** Handled by NextAuth.js at `/api/auth/[...nextauth]`

### File Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── h1/           # Helldivers endpoints
│   │   └── auth/         # NextAuth routes
│   ├── dashboard/         # User dashboard
│   └── [pages].jsx        # Frontend pages
├── db/                    # Database layer
│   ├── db.js             # Prisma client singleton
│   ├── queries/          # Database operations
│   └── sample/           # Sample data
├── update/               # Official API integration
│   ├── fetch.mjs         # Axios fetchers
│   ├── status.mjs        # Status update logic
│   └── season.mjs        # Season snapshot logic
├── validators/           # Zod schemas
├── utils/               # Utilities
│   ├── initialize.*.mjs  # Startup modules
│   └── [helpers].mjs
├── generated/prisma/     # Generated Prisma Client
└── instrumentation.js    # Application bootstrap
```

**Worker Thread:** `public/workers/cron.js` - Background process for continuous API polling

### Environment Variables

Required variables (see `.example.env`):
- `POSTGRES_URL` - PostgreSQL connection string
- `UPDATE_KEY` - Secret key for `/api/h1/update` endpoint
- `UPDATE_INTERVAL` - Polling interval in seconds (e.g., "20")
- `AUTH_SECRET` - NextAuth.js secret (128+ chars recommended)
- `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET` - Discord OAuth
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google OAuth (optional)
- `EMAIL_SERVER_*` - SMTP settings for magic links
- `UMAMI_*` - Analytics (optional)

**Connection String Differences:**
- Local: `postgresql://user:pass@127.0.0.1:5432/dbname`
- Docker: `postgresql://user:pass@host.docker.internal:5432/dbname`

## Deployment

**GitHub Actions:**
- Every commit → builds `:staging` image
- Tagged commits → builds `:production` + creates GitHub Release

**Production Container:** Uses standalone Next.js output (`node .next/standalone/server.js`)

## Code Patterns

**Error Handling:** Uses custom `tryCatch` wrapper (returns `{ data, error }`) throughout codebase instead of try/catch blocks.

**Performance Tracking:** All API routes measure execution time using `perf_hooks` and return via `roundedPerformanceTime`.

**Validation:** All external data validated with Zod schemas before database operations.

**Server Actions:** Most utilities marked with `'use server'` directive for server-side execution.

**Node Version:** Uses Volta to pin node@22.16.0 and npm@11.4.2.
