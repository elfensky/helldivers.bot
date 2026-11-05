---
kind: component
title: Notifications and PWA
component: notifications-pwa
status: implemented
source_revision: 1755207f68e2d5f4e12e9b999a641e94720e02e4
source_evidence_date: 2026-11-05
publication_status: decided-not-built
---

# Notifications and PWA

[Architecture overview](helldivers-bot-architecture.md)

## Responsibility

Event-transition notifications (Sonner toasts + Web Notifications + web-push), the installable PWA
(Serwist), offline fallback, and stale-version auto-reload.

## Moving parts

- `src/shared/utils/game/detectChanges.mjs` — detects event transitions (started/won/lost) on both
  client (toasts + Web Notifications) and server (`src/update/pushNotifier.mjs` via `web-push`).
  `LiveToasts` also shows catch-up toasts for active events on load; the `<Toaster>` is co-located
  inside `LiveToasts`, not the root layout, so both share one module singleton.
- Push subscriptions live in the `push_subscription` table; one "Enable notifications" button
  enables both web and push.
- PWA: Serwist (`@serwist/next`) generates `public/sw.js` (gitignored build artifact) at build time
  with a content-hash precache manifest; `skipWaiting: true`; custom push handlers in `src/sw.js`;
  last poll payload cached in localStorage for offline fallback. Config: `serwist.config.js`.
- Stale-version reload, three layers, all through `guardedReload()`
  (`src/shared/utils/reloadGuard.mjs`, localStorage circuit breaker, 30 s TTL, max 3 attempts):
  Next.js `deploymentId` mismatch on client-side routing; `appVersion` in `/api/h1/live` compared
  against the build-time version (~10 s detection); global `ChunkLoadError` handler in
  `instrumentation-client.js`.

## Sources

- `AGENTS.md` § Architecture invariants checked against `src/update/pushNotifier.mjs`,
  `src/sw.js`, `serwist.config.js`, `src/shared/utils/reloadGuard.mjs` at `1755207f` on 2026-11-05.
