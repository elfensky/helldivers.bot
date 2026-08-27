# External Integrations

**Analysis Date:** 2026-08-28

## APIs & External Services

**Official Helldivers 1 API (primary data source):**
- Service: `https://api.helldiversgame.com/1.0/` (constant `HD1_API_URL` in `src/update/fetch.mjs`)
- Client: `axios` (chosen specifically because Node's native `fetch` cannot supply a custom `https.Agent` — required here to disable TLS certificate validation against this API, `rejectUnauthorized: false`)
- Actions consumed: `get_campaign_status` (`fetchStatus()`) — live campaign progress + statistics; `get_snapshots` (`fetchSeason(season)`) — historical season snapshots + events
- Auth: none (public, unauthenticated, form-encoded POST)
- Callers: `src/update/season.mjs` (`updateSeason`), `src/app/api/h1/update/route.js` (worker poll route), `src/features/archives/reseedSeason.mjs` (admin refresh), `src/shared/utils/api/backfillSeason.mjs` (on-demand archive backfill)
- Validation: all responses parsed with Zod schemas in `src/validators/` before touching the database
- Reference docs: `/docs/hd1-api`

## Data Storage

**Databases:**
- PostgreSQL — sole datastore
  - Connection: `POSTGRES_URL` env var (required; format `postgresql://user:pass@host:port/db?schema=public`)
  - Client/ORM: Prisma 7 (`@prisma/client` + `@prisma/adapter-pg` driver adapter), config `prisma.config.mjs`, schema `prisma/schema.prisma`, migrations `prisma/migrations/`
  - Generated client output: `src/generated/prisma/` (gitignored, regenerated per-checkout/worktree via `npx prisma generate`)
  - Schema: normalized 5-table design — `h1_season`, `h1_status`, `h1_statistic`, `h1_event`, `h1_event_progress` (see `/docs/database`)
  - Migration deploy: `Dockerfile.migrate` runs `prisma migrate deploy && node prisma/seed/seed.mjs` as a one-shot init container; `FORCE_SEED` env var forces re-upsert of all season files

**File Storage:**
- Local filesystem only — season seed JSON files under `prisma/seed/`, no external object storage (S3/GCS/etc.) detected

**Caching:**
- No dedicated cache layer (Redis, Memcached) — HTTP-level caching only, via Next.js route `Cache-Control` headers and CDN `s-maxage`/`stale-while-revalidate` rules in `next.config.mjs` (Cloudflare-fronted)

## Authentication & Identity

**Auth Provider:**
- BetterAuth 1.6.25 (`src/auth.js`, `src/auth-client.js`) — optional, entirely gated on `BETTER_AUTH_SECRET` (module exports `null` when absent, disabling all auth UI/routes)
- Database sessions via `prismaAdapter(db, { provider: 'postgresql' })` — sessions persisted in Postgres, no external session store
- Social providers (each independently optional, set-all-or-none per provider):
  - Discord — `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`
  - GitHub — `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
  - Google — `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
  - `accountLinking.trustedProviders: ['discord', 'github', 'google']`, `allowDifferentEmails: true`
- Custom `role` field on `User` model (`src/shared/enums/roles.mjs`), default `ROLE.USER`, `input: false` (not settable via user-facing signup)
- Route handler: `src/app/api/auth/[...all]/route.js`
- Avatar images allowed from `cdn.discordapp.com`, `avatars.githubusercontent.com`, `lh3.googleusercontent.com`, `www.gravatar.com` (`next.config.mjs` `images.remotePatterns`)
- When disabled: no sign-in UI, `/profile` redirects home, auth API returns 503
- Reference docs: `/docs/authentication`

## Monitoring & Observability

**Error Tracking:**
- Sentry SDK (`@sentry/nextjs` 10.68.0) targeting a self-hosted GlitchTip instance
- Config: `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` (build-time sourcemap upload — `withSentryConfig` wraps `next.config.mjs` only when `SENTRY_AUTH_TOKEN` is set)
- Instrumentation entry points: `src/instrumentation.js`, `src/instrumentation.node.js`, `src/instrumentation-client.js`
- Sample rates: `tracesSampleRate` 0.1 in production, 1.0 in dev; no session replays, no Sentry logs
- Client tunnel: `/api/glitchtip` route bypasses ad blockers for client-side event delivery
- CSP violation reporting via `report-uri`
- Environment tagging: `NEXT_PUBLIC_DEPLOY_ENV` (build-time) / `DEPLOY_ENV` (server-only runtime override); CI sets `production` on release builds, `staging` on staging builds
- Node identity: `SENTRY_SERVER_NAME` tags server-side events by machine — falls back to `os.hostname()` (a random container ID inside Docker) when unset; Swarm sets it to `{{.Node.Hostname}}`
- Uptime heartbeat: `GLITCHTIP_HEARTBEAT_URL` — POSTed by the worker at its poll interval
- Route-level (`error.jsx`) and component-level (`ComponentErrorBoundary`) error boundaries for graceful UI degradation
- No `silent: true` on the build plugin — deliberately, per inline comment in `next.config.mjs` referencing issue #496 (suppressing it hid sourcemap-upload failures for two weeks)

**Logs:**
- No centralized log aggregation service detected — console-based logging, captured by Docker/host log drivers

**Analytics:**
- Umami v3 (self-hosted, cookieless) — `UMAMI_SITE_URL`, `UMAMI_SITE_ID`
- Client tracker script proxied same-origin: `/stats.js` rewrite → `https://umami.drunik.be/script.js`, event posts proxied via `/api/send` → `/api/umami` (both to dodge ad blockers)
- Server-side event sender: `sendUmamiEvent()` in `src/shared/utils/umami.mjs` — posts directly server-to-server, production-only (`NODE_ENV === 'production'` gate), used inside `after()` calls in API routes so it never blocks the response
- Client-side dynamic tracking: `useTrack()` hook (`src/shared/hooks/useTrack.mjs`) and direct `window.umami?.track()` calls
- Declarative tracking: `data-umami-event="category-action"` HTML attributes, auto-captured by the tracker script
- User identification: `umami.identify()` called for authenticated users in `UserSection.jsx`
- Categories: `nav`, `auth`, `footer`, `docs`, `diagram`, `faction`, `archive`, `notification`, `push`, `sw`, `toast`, `dashboard`, `api`

## CI/CD & Deployment

**Hosting:**
- Docker images published to GitHub Container Registry: `ghcr.io/elfensky/helldiversbot` and `ghcr.io/elfensky/helldiversbot-migrate`
- Deployment orchestration: Docker Swarm (deploy configs under `deploy/staging/`, `docker-compose.yml` for staging pull-based compose)
- Production runs 3 app replicas behind a service VIP with a Postgres-backed leader-election lease deciding which single instance polls the HD1 API (`WORKER_ENABLED` env var toggles the poller per replica)

**CI Pipeline:**
- GitHub Actions, workflows in `.github/workflows/`:
  - `build-release.yml` — production image build/publish (tags `main`)
  - `build-staging.yml` — staging image build/publish (`develop`)
  - `check-ci.yml` — lint/typecheck/test gate
  - `check-codeql.yml` — CodeQL security scanning
  - `check-dependencies.yml` — dependency checks
  - `check-docker-smoke.yml` — full-stack boot smoke test via `docker-compose.ci.yml` (postgres + migrate + app, local image builds, hits `/api/healthcheck`)
  - `check-version.yml` — version/changelog consistency gate
  - `scheduled-pagespeed.yml` — Lighthouse/PageSpeed metrics, pushed to the standalone `metrics` branch
  - `scheduled-seed-refresh.yml` — periodic season-seed data refresh
- Dependabot (`.github/dependabot.yml`): weekly (Monday 09:00 Europe/Brussels) updates against `develop` for both `npm` and `github-actions` ecosystems; minor/patch grouped into single PRs, max 10 open PRs, labeled `dependencies`+`npm`/`github-actions`, commit prefix `chore(deps)`

## Environment Configuration

**Required env vars:**
- `POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL`

**Optional env vars (grouped, degrade gracefully when absent):**
- Site: `NEXT_PUBLIC_SITE_URL`, `PORT`
- Auth (set all-or-none): `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `AUTH_DISCORD_ID/SECRET`, `AUTH_GITHUB_ID/SECRET`, `AUTH_GOOGLE_ID/SECRET`
- Analytics: `UMAMI_SITE_URL`, `UMAMI_SITE_ID`
- Error tracking: `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`, `GLITCHTIP_HEARTBEAT_URL`, `SENTRY_SERVER_NAME`, `NEXT_PUBLIC_DEPLOY_ENV`, `DEPLOY_ENV`
- Push (set all-or-none): `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- Timeseries: `BUCKET_SIZE` (seconds, default 900)
- Seed control: `FORCE_SEED`
- Auto-generated (do not set manually): `NEXT_PUBLIC_APP_VERSION`

**Secrets location:**
- `.env.development` and `.env` files (gitignored, `*.env*`), loaded by `prisma.config.mjs` via `dotenv` (development file first, then production/Docker fallback); Docker deployments use `env_file:` in compose

## Webhooks & Callbacks

**Incoming:**
- OAuth callback routes for Discord/GitHub/Google under BetterAuth's catch-all route `src/app/api/auth/[...all]/route.js`
- `/api/h1/update` — internal worker poll endpoint, authenticated via `UPDATE_KEY`, invoked by `public/workers/cron.js`

**Outgoing:**
- Web Push notifications via `web-push` (`src/update/pushNotifier.mjs`) to browser push subscriptions stored in the `push_subscription` table (VAPID key pair required)
- GlitchTip heartbeat POST (`GLITCHTIP_HEARTBEAT_URL`) at worker poll interval
- Umami event POSTs (server-side, production-only)

---

*Integration audit: 2026-08-28*
