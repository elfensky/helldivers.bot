---
kind: component
title: Notifications and PWA
component: notifications-pwa
status: implemented
source_revision: 8f831f68b831926122aec0fefc515bd0def40bb1
source_evidence_date: 2026-11-09
---

# Notifications and PWA

[Architecture overview](helldivers-bot-architecture.md)

## What it does

Event-transition notifications (Sonner toasts + Web Notifications + web-push), the installable PWA
(Serwist), offline fallback, and stale-version auto-reload.

### Moving parts

- `detectChanges` detects event transitions (started/won/lost) on both client (toasts + Web
  Notifications) and server (the push notifier, via `web-push`). `LiveToasts` also shows catch-up
  toasts for active events on load.
- The push notifier runs after each poll (`checkAndNotify`, called by the update route in
  `after()`). It diffs the latest season's `h1_event` rows against the lease-stored `prevEvents`,
  sends web-push to each subscription's push service in batches of 50, and deletes subscriptions
  that answer 404 or 410. Without VAPID keys it does nothing.
- Push subscriptions live in the `push_subscription` table, upserted on a unique `endpoint`; one
  "Enable notifications" button enables both web and push. A push carries the tag `event-<id>`, and
  only the leader tab shows Web Notifications.
- PWA: `serwist build` generates `public/sw.js` (gitignored build artifact) from `src/sw.js` after
  `next build` (config: `serwist.config.js`, via `@serwist/next/config`), with a content-hash
  precache manifest; `skipWaiting: true`; custom push handlers in `src/sw.js`; last poll payload
  cached in localStorage for offline fallback.
- Stale-version reload, three layers. Next.js `deploymentId` mismatch on client-side routing
  (Next.js does the hard navigation itself). `appVersion` in `/api/h1/live` compared against the
  build-time version (~10 s detection). A `ChunkLoadError` handler in `src/instrumentation-client.js`
  (Sentry `beforeSend`, with an `unhandledrejection` fallback). The last two call `guardedReload()`
  (localStorage circuit breaker, 30 s TTL, max 3 attempts).

## Rules it keeps

- The `<Toaster>` is co-located inside `LiveToasts`, not the root layout, so `toast()` and
  `<Toaster>` share one Sonner module instance.
- Every app-initiated reload goes through `guardedReload()`; the only `location.reload()` is in
  `src/shared/utils/reloadGuard.mjs`.

## Code paths

- `src/shared/utils/game/detectChanges.mjs`: the event-transition detection.
- `src/features/notifications/LiveToasts.jsx`: the toasts and Web Notifications.
- `src/features/notifications/NotificationToggle.jsx`: the "Enable notifications" button.
- `src/app/api/notifications/subscribe/route.js`: the subscription store.
- `src/update/pushNotifier.mjs`: the server-side push, via `web-push`.
- `src/sw.js`: the custom push handlers.
- `serwist.config.js`: the Serwist config.
- `public/site.webmanifest`: the installable PWA.
- `src/shared/utils/reloadGuard.mjs`: `guardedReload()`.
- `src/instrumentation-client.js`: the global `ChunkLoadError` handler.
- `src/shared/hooks/useLiveData.mjs`: the version layer and the offline cache (owned by the
  [Dashboard](helldivers-bot-dashboard.md)).

## Sources

- `AGENTS.md` § Architecture invariants checked against `src/update/pushNotifier.mjs`,
  `src/sw.js`, `serwist.config.js`, `src/shared/utils/reloadGuard.mjs` at `baedce55` on 2026-11-09.
- Each claim re-checked against the code at `8f831f68` on 2026-11-09.
