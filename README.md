# helldivers.bot

## Code

[![CI](https://github.com/elfensky/helldivers.bot/actions/workflows/check-ci.yml/badge.svg?branch=develop)](https://github.com/elfensky/helldivers.bot/actions/workflows/check-ci.yml)
[![CodeQL](https://github.com/elfensky/helldivers.bot/actions/workflows/check-codeql.yml/badge.svg)](https://github.com/elfensky/helldivers.bot/actions/workflows/check-codeql.yml)
[![Staging](https://github.com/elfensky/helldivers.bot/actions/workflows/build-staging.yml/badge.svg)](https://github.com/elfensky/helldivers.bot/actions/workflows/build-staging.yml)
[![Release](https://github.com/elfensky/helldivers.bot/actions/workflows/build-release.yml/badge.svg)](https://github.com/elfensky/helldivers.bot/actions/workflows/build-release.yml)
[![Dependabot Updates](https://github.com/elfensky/helldivers.bot/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/elfensky/helldivers.bot/actions/workflows/dependabot/dependabot-updates)
[![Time](https://wakapi.lav.ren/api/badge/elfensky/interval:any/project:helldivers.bot)](https://wakapi.lav.ren/leaderboard)

## Status

<!-- ![Website](https://img.shields.io/website?url=https%3A%2F%2Fstaging.helldivers.bot&up_message=online&down_message=offline&label=staging)
![Website](https://img.shields.io/website?url=https%3A%2F%2Fhelldivers.bot&up_message=online&down_message=offline&label=production) -->

<!-- ![uptime](https://uptimekuma.lav.ren/api/badge/5/uptime/30d?labelPrefix=production+-+&style=plastic)
![ping](https://uptimekuma.lav.ren/api/badge/5/ping/30d?labelPrefix=production+-+&style=plastic)
![status](https://uptimekuma.lav.ren/api/badge/5/status?style=plastic)<br>
![uptime](https://uptimekuma.lav.ren/api/badge/6/uptime/30d?labelPrefix=staging+-+&style=plastic)
![ping](https://uptimekuma.lav.ren/api/badge/6/ping/30d?labelPrefix=staging+-+&style=plastic)
![status](https://uptimekuma.lav.ren/api/badge/6/status?style=plastic) -->

[![Metrics](https://raw.githubusercontent.com/elfensky/helldivers.bot/metrics/metrics.plugin.pagespeed.svg)](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fhelldivers.bot%2F)

## Info

This is an application that consumes the official Helldivers 1 API,
caches and rebroadcasts it to avoid high load on official servers, and
stores historic data that the official API discards. It also offers
account management and API keys for third parties to access the data
to build their own apps.

The frontend is a live campaign dashboard with an interactive galaxy
map, a scrollytelling event log, and a real-time notification system.
All pages receive live campaign updates via client-side polling
(`useLiveData` hook, `setInterval` + `fetch`, 10s interval, with an
immediate refetch on `visibilitychange` when the tab comes back into
focus). The app runs as an installable Progressive Web App with a
Serwist-backed service worker, supports offline mode via a cached
last-poll payload in `localStorage`, and delivers browser and push
notifications when campaign events transition state.

### Stack at a glance

| Layer         | Technology                                              |
| ------------- | ------------------------------------------------------- |
| Framework     | Next.js 16 (App Router) on Node.js 24, React 19         |
| Styling       | Tailwind CSS v4 (`@theme` in `src/app/layout.css`)      |
| Database      | PostgreSQL via Prisma 7 (`@prisma/adapter-pg`)          |
| Auth          | BetterAuth (Discord + GitHub OAuth, optional)           |
| Real-time     | Client polling + `BroadcastChannel` leader election     |
| Notifications | Sonner toasts + Web Notifications API + `web-push`      |
| PWA           | Serwist (`@serwist/next`) service worker                |
| Observability | Sentry SDK wired to a self-hosted GlitchTip (optional)  |
| Analytics     | Umami v3, self-hosted, cookieless (optional)            |
| Testing       | Vitest (unit + jsdom) + a Vitest HTTP smoke config      |
| Deployment    | Docker images published to `ghcr.io`, deployed on a VPS |

### How it works

The application is made from 2 large sections:

- the api that serves and updates the data
- the frontend that consumes the api and visualises it, alongside some user-facing features.

### Frontend at a glance

Detailed docs: `/docs/frontend-layout` (in-app) — covers the full
state machine, CSS var pipeline, and breakpoint matrix.

- **Interactive galaxy map** — responsive SVG galaxy covering every
  campaign sector, colored by faction and campaign state. Click a
  past event in the log to rewind the map to that historical state
  via `computeMapStateAtEvent`.
- **Scrollytelling event log** — `useScrollEvent` syncs the selected
  event card to the viewport's current scroll position; the map
  reacts in sync.
- **Pinned-map state machine** — mobile/tablet users can pin the map
  to the top of the viewport via a floating action button (FAB). On
  `/archives` the FAB defaults to pinned so the map is at rest when
  the user reaches the event log. A class-layering system (`--sticky`
  for the persistent pinned state, `--pinning` for the 400ms slide
  animation) keeps the entrance animation from re-triggering on
  mount.
- **Scroll-hiding header** — at md+ the fixed header scroll-hides
  itself via `public/scripts/headerGPU.js`. The pinned map tracks
  the header's offset and mirrors its live background via three CSS
  custom properties published on `<html>` (`--header-offset`,
  `--header-bg`, `--header-glass-filter`).
- **Live polling loop** — one `useLiveData` singleton per tab polls
  `/api/h1/live` every 10 seconds, with `BroadcastChannel` leader
  election so only one tab dispatches Web Notifications per session.
- **PWA offline shell** — `src/sw.js` + Serwist precaches the app
  shell, and the last poll payload is cached in `localStorage` for
  offline fallback.

### Initialization

On startup, it runs instrumentation.js (once) which will:

1. check if openapi spec exists (or generate it in dev mode)
2. check if database connection exists and is valid
3. initialize the database:
    1. run migrations.
    2. fetch remote currentStatus + currentSeason
    3. save normalized data in the 5-table h1\_\* schema (`h1_season`, `h1_status`, `h1_statistic`, `h1_event`, `h1_event_progress`). Past seasons referenced by lagged event slots are skipped per `queryUpsertEvent`'s `event.season !== season` guard rather than being seeded as empty rows.

4. start a worker thread that will continiously update the database from the official Helldivers API. It simply queries the /api/h1/update endpoint every `UPDATE_INTERVAL` seconds using the `UPDATE_KEY` token.

### API

Next.js route handlers under `src/app/api/` expose Helldivers data in
several formats. The `GET /api/h1/*` endpoints are the core public
surface; the rest are internal (auth, healthcheck, analytics/error
tunnels).

- `GET /api/h1/update`
    - Triggers a fresh campaign status + snapshot refresh from the
      official Helldivers 1 API and persists the result to the
      normalized `h1_*` tables via the shared bucket-upsert pipeline.
    - Requires a valid `key` query parameter matching the server's
      `UPDATE_KEY` environment variable — this is the same token
      the background worker uses.
- `GET /api/h1/rebroadcast`
    - Mirrors the official Helldivers 1 API behavior byte-for-byte
      by reconstructing the wire format on demand from the
      normalized `h1_*` tables.
    - Request body:
        - `action`: string — one of `get_campaign_status`,
          `get_snapshot`
        - `season`: integer — required when `action` is `get_snapshot`
- `GET /api/h1/campaign`
    - Custom endpoint with an optional `season` query parameter.
    - Returns combined status + snapshot information for a specific
      season in one query, shaped for the frontend.
- `GET /api/h1/live`
    - Current campaign state in a lightweight shape, polled every
      10 seconds by the `useLiveData` client hook. Powers the live
      dashboard, event-transition toasts, and push notifications.
- `GET /api/h1/stats` _(not implemented)_
    - Future endpoint for aggregate game stats (wins/losses/kills/
      etc.) calculated by the worker.

Internal routes not listed above:

- `GET/POST /api/auth/[...all]` — BetterAuth handlers (only when
  `BETTER_AUTH_SECRET` is set; otherwise auth is disabled).
- `GET /api/healthcheck` — used by Docker / upstream monitoring.
- `POST /api/notifications/subscribe` — push notification
  subscription endpoint (only when Web Push keys are configured).
- `POST /api/umami`, `POST /api/glitchtip` — same-origin proxy tunnels
  so self-hosted analytics and error reporting aren't blocked by ad
  blockers (only when the corresponding env vars are set).

### User features (optional — requires `BETTER_AUTH_SECRET`)

All user-facing features below are gated behind BetterAuth. When
`BETTER_AUTH_SECRET` is not set, the sign-in UI is hidden, `/profile`
redirects home, and the auth API returns `503` — the public
dashboard, `/archives`, and the `/api/h1/*` rebroadcast endpoints
all still work without authentication.

- **Authentication** via Discord or GitHub OAuth (powered by
  [BetterAuth](https://www.better-auth.com/))
- **Account management** — login / logout via OAuth, account deletion
- **API keys** — create and revoke API keys for programmatic access
- **Profile** — view connected OAuth providers and Gravatar, GDPR
  data export (JSON download), GDPR account deletion
- **Admin dashboard** (admin role required) — system overview (worker
  health, game data stats, user metrics) and user management (role
  changes, bans, API key oversight)
- **Reviews** — create, delete, edit user-submitted reviews

## Development

The application uses nextjs running on node@24, prisma and postgres. It is deployed on a VPS in a docker container.

### Local

1. provide a `.env.development` file based on .example.env
2. install dependencies with `npm install`
3. run `npm run dev` to start the server locally

## Docker

When using the docker container, the database you are connecting to needs to already exist. It will **not** create it for you.

- docker login ghcr.io
    - username: your-github-username
    - password: classic-key-with-correct-permissions

#### Build locally

```sh
docker build -f ./Dockerfile.migrate -t ghcr.io/elfensky/helldiversbot-migrate:staging .
docker build -f ./Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .
```

- Add `--no-cache --progress=plain` for clean rebuilds
- Use `docker buildx build --platform linux/amd64 -f ./Dockerfile.app -t ghcr.io/elfensky/helldiversbot:staging .` to cross-compile for x86_64
- Use `docker compose up` to run the containers locally

#### Deploy to ghcr.io

- Manually | Use `docker push ghcr.io/elfensky/helldiversbot:staging` to push the image to ghcr.io
- Automatically | On every normal commit, Github Actions will generate a new `:staging` image
- Automatically | On every tagged commit, Github Actions will generate a new `:production` image alongside and create a new Release (using Release.md)

## Prisma

`npx prisma migrate reset`
reset all data in db

`npx prisma generate`
reads your Prisma schema and generates the Prisma Client.

`npx prisma migrate dev`
`npx prisma migrate dev --name init`
Purpose: This command generates and applies a new migration based on your Prisma schema changes. It creates migration files that keep a history of changes.
Use Case: Use this when you want to maintain a record of database changes, which is essential for production environments or when working in teams. It allows for version control of your database schema.
Benefits: This command also includes checks for applying migrations in a controlled manner, ensuring data integrity.

`npx prisma db push`
Purpose: This command is used to push your current Prisma schema to the database directly. It applies any changes you've made to your schema without creating migration files.
Use Case: It’s particularly useful during the development phase when you want to quickly sync your database schema with your Prisma schema without worrying about migration history.
Caution: It can overwrite data if your schema changes affect existing tables or columns, so it’s best for early-stage development or prototyping.

## Security

### SAST, SCA, IAC

cx scan create --project-name "helldivers.bot" --branch "develop" --scan-types "sast, sca, iac-security" -s . --debug

### Containers

cx scan create --project-name "helldivers.bot" --branch "develop" --scan-types "container-security" --containers-local-resolution --container-images "ghcr.io/elfensky/helldiversbot:local" -s . --debug

## Licence

**[AGPL-3.0-only](LICENSE)** — relicensed from MIT on 2026-08-12.

This project is served over a network, which is the case AGPL exists for. Plain GPL's copyleft
triggers on *distribution*: anyone who runs a fork as a hosted API never distributes a copy, so
they would owe nothing. AGPL §13 closes that — if you run a modified version and let people
interact with it over a network, you have to offer them the source.

Everything released up to and including `v0.91.0` remains available under MIT; the change binds
what comes after. MIT grants the right to sublicense, so contributions made under it can be
carried forward — thanks to everyone who has contributed.
