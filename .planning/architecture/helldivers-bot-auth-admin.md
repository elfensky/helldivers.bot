---
kind: component
title: Auth, account and admin
component: auth-admin
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
publication_status: decided-not-built
---

# Auth, account and admin

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

Optional authentication, public API keys, and the admin surface. Auth is off by default: when
`BETTER_AUTH_SECRET` is absent, `src/auth.js` exports `null`, no sign-in UI renders, `/profile`
redirects home, and the auth API answers 503.

## Moving parts

- BetterAuth with database sessions (Prisma adapter), Discord + GitHub OAuth. Server config
  `src/auth.js`; client utilities `src/auth-client.js`; catch-all route
  `src/app/api/auth/[...all]/route.js`. Tables: `Account`, `Session`, `Verification`, `User`,
  `Settings`.
- Public API keys: `ApiKey` table; `/api/v1/h1/*` routes are gated per key with rate limiting
  (`api_rate_limit` table).
- Account area: `src/features/account/` — profile, API key management, settings.
- Admin area: `src/features/admin/` — system overview (all replicas, poller highlight, API key last
  used), season reseed/refresh button, broadcasts.
- Error tracking: Sentry SDK pointed at self-hosted GlitchTip, client tunnel `/api/glitchtip`;
  route- and component-level error boundaries (`src/app/error.jsx`, `ComponentErrorBoundary`).
- Analytics: Umami v3 self-hosted, production-only; `data-umami-event` attributes, `useTrack()`
  hook, `sendUmamiEvent()` for server-side routes, `umami.identify()` on login.

## Sources

- `.planning/codebase/INTEGRATIONS.md`, `STRUCTURE.md` checked against `src/auth.js`,
  `src/features/account/`, `src/features/admin/`, `prisma/schema.prisma` at `1755207f` on
  2026-11-05.
