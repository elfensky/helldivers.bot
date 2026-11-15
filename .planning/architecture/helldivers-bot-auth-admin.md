---
kind: component
title: Auth, account and admin
component: auth-admin
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
---

# Auth, account and admin

[Architecture overview](helldivers-bot-architecture.md)

## What it does

Optional authentication, public API keys, and the admin surface.

### Moving parts

- BetterAuth with database sessions (Prisma adapter), Discord, GitHub and Google OAuth. Tables:
  `Account`, `Session`, `Verification`, `User`, `Settings`.
- Public API keys: `ApiKey` table. `/api/v1/h1/*` routes and `/api/h1/rebroadcast` need a valid API
  key (Bearer). The key is stored as a SHA-256 hash. Rate limiting counts per client IP (per key for
  rebroadcast) in the `api_rate_limit` table.
- Account area: profile with linked providers, API key management, data export and account
  deletion.
- Admin area on `/profile`, shown when `User.role` is `admin`: system overview (all replicas,
  poller highlight), user role and ban management, API key list with last use and revoke, debug
  tools (test toasts, a test push to all subscribers, a test GlitchTip error). An admin-only season
  reseed button is on `/archives`.
- Error tracking: Sentry SDK pointed at self-hosted GlitchTip, client tunnel `/api/glitchtip`;
  route- and component-level error boundaries.
- Analytics: self-hosted Umami, production-only; `data-umami-event` attributes, `useTrack()`
  hook, `umamiTrackEvent()` for server-side routes, `umami.identify()` on login.

## Rules it keeps

- Auth is off by default: when `BETTER_AUTH_SECRET` is absent, `src/auth.js` exports `null`, the
  header shows no sign-in link, `/profile` redirects home, and the auth API answers 503. When auth
  is on, the start-up env check (`checkAuth()` in `src/shared/utils/initializeEnv.mjs`) requires
  all three OAuth providers.

## Code paths

- `src/auth.js`: the BetterAuth server config.
- `src/auth-client.js`: the client utilities.
- `src/app/api/auth/[...all]/route.js`: the catch-all route.
- `src/app/profile/` and `src/app/sign-in/`: the profile and sign-in pages.
- `src/shared/components/Navigation/UserSection.jsx`: the header's user section.
- `src/shared/utils/api/authGuards.mjs`: `requireSession`, `requireUser`, `requireAdmin`.
- `src/shared/enums/roles.mjs`: the roles.
- `src/shared/utils/api/validateApiKey.mjs`, `src/shared/utils/api/requireApiKey.mjs`: the API-key check.
- `src/shared/utils/api/rateLimit.mjs`: the rate limit.
- `src/features/account/`: the account area.
- `src/features/admin/`: the admin area.
- `src/features/archives/RefreshSeasonButton.jsx`, `src/features/archives/reseedSeason.mjs`: the
  admin season reseed.
- `src/app/error.jsx`, `src/app/global-error.jsx` and `src/shared/components/ComponentErrorBoundary.jsx`:
  the error boundaries.
- `src/instrumentation-client.js` and `src/app/api/glitchtip/`: the error tracking.
- `src/shared/utils/umami.mjs` and `src/shared/hooks/useTrack.mjs`: the analytics.

## Sources

- `.planning/codebase/INTEGRATIONS.md`, `STRUCTURE.md` checked against `src/auth.js`,
  `src/features/account/`, `src/features/admin/`, `prisma/schema.prisma` at `1755207f` on
  2026-11-05.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
