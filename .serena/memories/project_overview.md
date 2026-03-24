# Project Overview - helldivers.bot

## Purpose
A Next.js application that consumes the official Helldivers 1 API, caches and rebroadcasts it to reduce load on official servers. It stores historic game data, provides API access via keys, and includes a frontend with data visualizations and event notifications.

## Tech Stack
- **Framework:** Next.js 15 (App Router) with Turbopack
- **Database:** PostgreSQL with Prisma ORM
- **Authentication:** NextAuth.js v5 (Discord, GitHub OAuth, magic links)
- **Validation:** Zod schemas
- **Styling:** Tailwind CSS v4
- **Runtime:** Node.js 22
- **Error Tracking:** Sentry SDK with self-hosted Bugsink

## Architecture Highlights

### Application Initialization (`src/instrumentation.js`)
4-step sequence on startup:
1. Environment validation
2. OpenAPI spec generation/verification
3. Database connection + migrations + season pre-population
4. Worker thread launch for API polling

### Data Flow
- **Rebroadcast tables:** Store raw JSON from official API
- **H1 tables:** Normalized, historical data (season-centric model)
- Worker polls `/api/h1/update` every `UPDATE_INTERVAL` seconds

### Key Directories
```
src/
├── app/           # Next.js App Router (pages + API routes)
├── db/            # Prisma client + queries
├── update/        # Official API integration logic
├── validators/    # Zod schemas
├── utils/         # Helpers and initialization modules
├── components/    # React components
└── generated/     # Generated Prisma Client
```

### Core API Endpoints
- `GET /api/h1/update?key=...` - Worker-triggered campaign update
- `POST /api/h1/rebroadcast` - Mirror of official API
- `GET /api/h1/campaign?season=N` - Combined status + snapshot
- `GET /api/healthcheck` - Health check
