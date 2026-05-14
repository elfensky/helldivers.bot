# Stale Version Auto-Reload

## Problem

After a deployment, users with open tabs run stale JavaScript that references old chunk filenames deleted from the container. This causes `ChunkLoadError` crashes, white screens, and silent data staleness. The PWA service worker updates correctly (`skipWaiting` + `clientsClaim`), but the running React app in the tab is a separate lifecycle that doesn't know a new version is available.

Once a dynamic import fails, browsers cache the failure permanently for that page load — retrying the import won't help. The only recovery is a full page reload.

## Industry Context

| App/Framework | Pattern |
|---|---|
| **Next.js (Vercel-hosted)** | Built-in `deploymentId` — hard navigation on version mismatch |
| **Nuxt.js** | `emitRouteChunkError: 'automatic'` — auto-reload on chunk error (default since v3.3) |
| **Angular** | `SwUpdate` service — prompts user, then reload |
| **Vite** | `vite:preloadError` event — no built-in recovery, community uses sessionStorage guard |
| **Twitter/X, Tinder** | Workbox `waiting` event → "Update available" banner → user-initiated reload |

Real-time dashboards favor auto-reload over prompting because stale state is worse than a brief interruption. Content/social apps prompt because they have unsaved state.

## Solution

Three detection layers — no feature flag, always-on.

### Layer 1: `deploymentId` (navigation-based, built into Next.js)

Add `deploymentId` to `next.config.mjs`, set to `NEXT_PUBLIC_APP_VERSION` (already derived from `package.json`). Next.js automatically:
- Appends `?dpl=<id>` to all static asset URLs (JS, CSS, images)
- Sends `x-deployment-id` header on client-side navigation requests
- On mismatch: triggers a hard navigation instead of client-side routing

This is zero runtime code — Next.js handles it internally. Covers the common case: user navigates to a new page after a deployment.

**Limitation:** Only detects mismatch during route navigation. Does not help if a lazy import within the current page fails, or if the user sits on one page (the dashboard).

### Layer 2: Version-in-poll (dashboard users, ~10s detection)

`/api/h1/live` adds `appVersion` (from `NEXT_PUBLIC_APP_VERSION`) to its JSON response. `useLiveData` compares the server's `appVersion` against the build-time `process.env.NEXT_PUBLIC_APP_VERSION` baked into the client bundle. On mismatch → `guardedReload('version')`. On match → `clearReloadGuard()` (resets circuit breaker).

**Edge cases:**
- First load: both sides have the same version — no mismatch, no reload.
- Offline users: `poll()` catch block runs, version check never executes. On reconnect (visibilitychange → immediate poll), the first success detects the mismatch.
- Missing `appVersion` field (partial deploy): treat `undefined` as "skip comparison" — do not reload.
- API error (non-JSON response, 500): falls into catch, no version check.

### Layer 3: Global `ChunkLoadError` handler (safety net)

In `instrumentation-client.js`, add an `unhandledrejection` listener after Sentry init. Match three patterns covering Webpack and native ESM across all major browsers:
- `ChunkLoadError` (Webpack `error.name`)
- `Failed to fetch dynamically imported module` (Chrome/Edge `error.message`)
- `error loading dynamically imported module` (Firefox `error.message`, lowercase)

On match → `guardedReload('chunk')`.

### Shared reload guard

A single utility (`src/shared/utils/reloadGuard.mjs`) prevents infinite loops and coordinates Layer 2 and Layer 3. Layer 1 (`deploymentId`) is handled by Next.js internally and does not use this guard.

**Mechanism:**
- `sessionStorage` key: `hd-reload-guard`
- Value: `{reason}:{timestamp}` (e.g., `version:1715700000000`)
- `guardedReload(reason)`: if key exists and was set <30s ago, skip. Otherwise set key and `window.location.reload()`.
- `clearReloadGuard()`: remove key. Called in `poll()` when server version matches client version, resetting the circuit breaker for future deployments.

**Why sessionStorage:** per-tab (no cross-tab interference), cleared on tab close (no permanent state), survives the reload itself (unlike in-memory flags).

**Why 30s TTL:** if the reload lands on a stale proxy-cached page, we don't loop. We try once, wait, and the next poll cycle (10s) tries again after upstream caches expire.

### Multi-tab behavior

All tabs poll independently and all will detect the mismatch within ~10 seconds. All reload independently. No cross-tab coordination needed (unlike notification leader election) — each tab needs new code.

## Files changed

| File | Change |
|------|--------|
| `next.config.mjs` | Add `deploymentId: APP_VERSION` |
| `src/shared/utils/reloadGuard.mjs` | **New** — `guardedReload()` and `clearReloadGuard()` |
| `src/app/api/h1/live/route.js` | Add `appVersion` to response JSON |
| `src/shared/hooks/useLiveData.mjs` | Compare `appVersion` in `poll()`, call `guardedReload` / `clearReloadGuard` |
| `src/instrumentation-client.js` | Add `unhandledrejection` handler for ChunkLoadError patterns |

## Verification

1. **Build check:** `npm run build` must pass — confirm `?dpl=` appears in generated HTML asset URLs.
2. **Unit tests:** Test `guardedReload` and `clearReloadGuard` with mocked `sessionStorage` and `window.location.reload`. Test the ChunkLoadError pattern matching regex.
3. **Manual smoke test — deploymentId:**
   - Build version A, open the app
   - Build version B, navigate to a different page
   - Confirm full page reload (not client-side navigation) — check Network tab for full document request
4. **Manual smoke test — version-in-poll:**
   - Open the dashboard
   - Change `NEXT_PUBLIC_APP_VERSION` and restart the server (simulating deploy)
   - Confirm the tab hard-reloads within ~10 seconds
   - Confirm no reload loop (check sessionStorage for the guard key)
5. **ChunkLoadError simulation:** In browser devtools console:
   ```js
   window.dispatchEvent(new PromiseRejectionEvent('unhandledrejection', {
     reason: new Error('ChunkLoadError'),
     promise: Promise.resolve()
   }))
   ```
   Confirm reload fires once. Repeat immediately — confirm second attempt is suppressed by the guard.
6. **Offline resilience:** Go offline (DevTools Network tab), confirm no reload attempts. Go back online, confirm reload fires on next successful poll if version mismatches.