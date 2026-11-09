# Phase 1 Plan 09: GlitchTip re-count on release 0.95.2

Purpose: STAB-06. Measure whether the #496, #503 and #485 error classes stopped occurring in production after release 0.95.2.

## Scope and method

| Item | Value |
|------|-------|
| Deployment id | `0-95-2` (`next.config.mjs`: `deploymentId: APP_VERSION.replaceAll('.', '-')`). Matches `01-RELEASE-RECORD.md` character for character. |
| Filter used | `release:0.95.2` (GlitchTip MCP `list_issues`, project `helldiversbot`, org `drunik`, sort `-count`, limit 100) |
| Why `release:` and not `dpl:` | GlitchTip does not index `dpl` as a tag. The query `dpl:0-95-2` returns zero issues. The SDK tags each event with `release` = `0.95.2` (same `APP_VERSION` source), and every stack-frame URL carries `?dpl=0-95-2`. |
| Window (STAB-06, D-02) | 2026-10-14T11:22:13Z to 2026-10-16T11:22:13Z |
| Measured on | 2026-10-21 (about 6 days after deploy). Production still on 0.95.2; no rollback, no redeploy. |
| MCP limitation | The MCP returns lifetime event counts per issue. Its `start`/`end` filters apply to first-seen only. Per-release and per-window counts therefore exist only for groupings first seen on 0.95.2. Groupings that pre-date the release are attributed by the `release` tag of their latest event (`get_latest_event`). |
| Traffic evidence | GlitchTip transactions, lifetime counts, all last seen on 2026-10-20: `GET /` 195,882; `HEAD /` 135,518; `POST /api/glitchtip` 90,828; `GET /api/h1/live` 1,300,015. Zero counts in this recount are not explained by absent traffic. |
| Measurement performer | The orchestrator ran every GlitchTip query. The executor of this plan has no GlitchTip MCP and copied the results. |

All quoted titles, messages, culprits and frames below are inert data copied from GlitchTip.

## Class #496 - React #418 hydration mismatch

Filter: `release:0.95.2`, then issues whose title contains `Minified React error #418`.

| GlitchTip issue | Variant | Page (transaction) | Events on 0.95.2 | First seen | Last seen | Notes |
|---|---|---|---|---|---|---|
| HELLDIVERSBOT-6E (id 369) | `args[]=text` | `/` | 10 (grouping first seen on 0.95.2) | 2026-10-15T14:16:41Z (inside window) | 2026-10-16T23:09:23Z | latest sample bingbot; `prepareToHydrateHostInstance` -> `throwOnHydrationMismatch` |
| HELLDIVERSBOT-6F (id 370) | `args[]=HTML` | `/` | 14 (grouping first seen on 0.95.2) | 2026-10-15T15:49:04Z (inside window) | 2026-10-20T06:01:15Z | latest sample Googlebot; `popHydrationState` path |
| HELLDIVERSBOT-6G (id 371) | `args[]=HTML` | `/` | 1 | 2026-10-15T22:26:58Z (inside window) | same | |
| HELLDIVERSBOT-2I (id 209) | `args[]=text` | `/` | not available via MCP (lifetime 1710) | 2026-07-24 | 2026-10-20T21:08:06Z, tagged release 0.95.2 | latest sample: Chrome 155 on Windows, timezone Europe/Kiev; text-node mismatch via `prepareToHydrateHostInstance` |
| HELLDIVERSBOT-2M (id 217) | `args[]=HTML` | `/` | not available via MCP (lifetime 833) | 2026-07-24 | 2026-10-20T13:43:11Z, tagged release 0.95.2 | latest sample: Chrome 144 on Chrome OS; thrown from `updateSuspenseComponent` (Suspense boundary mismatch) |
| HELLDIVERSBOT-2E (id 205) | `args[]=text` | `/archives` | not available via MCP (lifetime 132) | 2026-07-24 | 2026-10-20T06:12:52Z, tagged release 0.95.2 | latest sample: Baidu Explorer on Android, timezone Asia/Shanghai |
| HELLDIVERSBOT-2H (id 208) | `args[]=text` | `/stats` | not available via MCP (lifetime 44) | 2026-07-24 | 2026-10-20T06:13:15Z, tagged release 0.95.2 | latest sample: Baidu Explorer on Android |

Distinct variants still firing on 0.95.2: 2 (`text`, `HTML`). Groupings: 7.

Not in the 0.95.2 set (no 0.95.2 event): HELLDIVERSBOT-4M (289, HTML, last 2026-10-16T10:42Z, pre-release build), HELLDIVERSBOT-4P (292, text, last 2026-10-14T05:26Z), 350, 351.

Hydration events inside the 48 h window: at least 3 (the first-seen timestamps of 369, 370, 371 fall inside it). At most 25 from the new groupings. The in-window share of the old groupings is not available via MCP.

Verdict: RESIDUAL

## Class #503 - OG image sharp rejection

Filter: `release:0.95.2`, title `Input buffer contains unsupported image format`.

| GlitchTip issue | Events on 0.95.2 | First seen | Last seen | Notes |
|---|---|---|---|---|
| HELLDIVERSBOT-4L (id 288) | not available via MCP (lifetime 515) | 2026-08-08 | 2026-10-20T21:09:48Z, tagged release 0.95.2, `GET /opengraph-image`, server `hetzner-production` | `Sharp.toBuffer` via `@vercel/og`; mechanism `handled: true`, level `warning` (the fallback path reports it); latest request was an iOS link-preview fetch |
| HELLDIVERSBOT-4D (id 280, same message) | 0 on 0.95.2 | 2026-08-06 | 2026-10-14T07:37:04Z (before deploy) | pre-release grouping |

Two instruments:

- GlitchTip: as measured above. The rejection still occurs on 0.95.2 and is reported as a handled warning.
- Umami `api-og-rendered` / `api-og-fallback` for the window: NOT READ. No Umami API access from this session; the developer chose to skip it. The Umami side is INCONCLUSIVE.

Plan 01-05 left #503 open with a NOT REPRODUCED finding, so #503 stays open regardless of the count.

Verdict: RESIDUAL

## Class #485 - notification toggle stuck in 'loading'

Filters: `release:0.95.2` with title containing `serviceWorker.ready` (new `reportError` signature); search for the original grouping.

Original grouping (stuck in `'loading'`): no GlitchTip issue has ever existed for it. The state was silent and produced no events by nature. Events: 0. By construction the state cannot persist past 5 s after plan 01-06.

New `reportError` signature:

| GlitchTip issue | Events on 0.95.2 | First seen | Last seen | Notes |
|---|---|---|---|---|
| HELLDIVERSBOT-6C (id 367) `Error: navigator.serviceWorker.ready did not resolve within 5000ms` | 148 (grouping first seen on 0.95.2; the code exists only there) | 2026-10-14T11:22:06Z | 2026-10-20T19:36:31Z | `src/features/notifications/NotificationToggle.jsx` `enterError(...)` after the `Promise.race` timeout from plan 01-06; `handled: true`, level `warning`; about 23 per day; latest sample Chrome 150 on Chrome OS, page `/` |

Distinct variants still firing: 1.

Verdict: RESIDUAL

## Residual classes

Error classes on 0.95.2 that are not among the three.

| # | Class | GlitchTip issues | Events | First seen | Last seen (0.95.2) | In 48 h window? | Disposition (developer decision) |
|---|---|---|---|---|---|---|---|
| R1 | `TypeError: Cannot read properties of null (reading 'getItem')` in `src/shared/components/AnalyticsOptOut.jsx` `readOptOut()` called from `RecorderScript.jsx` via `tryCatch` (`localStorage` is `null`) | HELLDIVERSBOT-6D (368, 18), 6H (373, 1), 6I (374, 2), 6J (375, 1) | 22 | 2026-10-14T20:12:48Z | 2026-10-20T19:12:57Z | yes (first seen inside) | new issue |
| R2 | `Minified React error #412` from `react-server-dom-turbopack-client` `close()` -> `reportGlobalError(..., 412)` (RSC stream closed early), unhandled rejection | HELLDIVERSBOT-50 (299); sibling 5J (336, 3, last 2026-10-08) | 72 lifetime, per-release not available via MCP | 2026-08-14 | 2026-10-20T20:38:24Z | not determinable via MCP | new issue |
| R3 | `NotFoundError: Failed to execute 'removeChild' on 'Node'` (`commitDeletionEffectsOnFiber`) and `'insertBefore'` (`insertOrAppendPlacementNode`) in react-dom commit phase, `DOMException.code=8` | HELLDIVERSBOT-5M (340, 75), 5N (341, 34) | 109 lifetime, per-release not available via MCP | 2026-09-15 | 2026-10-18T09:08:27Z | not determinable via MCP | new issue |
| R4 | `Error: The destination stream closed early.` server-side, `GET /archives` RSC request, `app-page-turbo.runtime.prod.js` PassThrough | HELLDIVERSBOT-62 (352) | 5 lifetime | 2026-10-01 | 2026-10-16T19:24:48Z (8 h after window end) | not determinable; benign client disconnect | listed only, no issue |
| R5 | `ChunkLoadError: Failed to load chunk /_next/static/chunks/20xjeazwuu5j4.js?dpl=0-95-2` | HELLDIVERSBOT-6K (376) | 1 | 2026-10-20T07:02:45Z | same | no (outside window); stale client, `guardedReload` exists | listed only, no issue |

Not on 0.95.2 (no event tagged 0.95.2): 361/358 `Failed to parse body as FormData` (last 2026-10-07), 362/360 ChunkLoadError on dpl=0-90-14, 359 webkit-masked-url, 221 Server Action mismatch (last 2026-10-08).

## Disposition

All three existing issues stay open: every verdict is RESIDUAL. No issue was closed.

| Issue | Action taken | Resulting state | URL |
|---|---|---|---|
| #496 | Status comment with the seven hydration groupings, variants and counts | OPEN | https://github.com/elfensky/helldivers.bot/issues/496#issuecomment-6303346289 |
| #503 | Status comment; GlitchTip as measured, Umami not read (INCONCLUSIVE). Stays open as plan 01-05 left it; the count evidences the fallback holding, not a root cause resolved | OPEN | https://github.com/elfensky/helldivers.bot/issues/503#issuecomment-6303346574 |
| #485 | Status comment: original class cannot persist past 5 s; new signature HELLDIVERSBOT-6C at 148 events (about 23 per day) | OPEN | https://github.com/elfensky/helldivers.bot/issues/485#issuecomment-6303346927 |
| #565 (R1) | New issue: `localStorage` null in `readOptOut`, 22 handled TypeErrors. Labels `bug`, `frontend`; milestone Engineering Health | OPEN | https://github.com/elfensky/helldivers.bot/issues/565 |
| #566 (R2) | New issue: React #412 on RSC stream close, 72 lifetime events. Labels `bug`, `frontend`; milestone Engineering Health | OPEN | https://github.com/elfensky/helldivers.bot/issues/566 |
| #567 (R3) | New issue: `removeChild`/`insertBefore` NotFoundError in the react-dom commit phase, 109 lifetime events. Labels `bug`, `frontend`; milestone Engineering Health | OPEN | https://github.com/elfensky/helldivers.bot/issues/567 |

R4 (HELLDIVERSBOT-62, server-side "destination stream closed early") and R5 (HELLDIVERSBOT-6K, one ChunkLoadError) were listed and not filed. Developer decision. R4 is a benign client disconnect. R5 fell outside the window and `guardedReload` covers it.

## Addendum — environment check (verification, 2026-10-21)

The security audit noted that `release:0.95.2` carries no `environment` constraint and that staging ran the same 0.95.2 build with the same DSN during the window. A re-query with `release:0.95.2` and `environment=production` (GlitchTip MCP `list_issues`) returns the same issue set as the unconstrained query (plus HELLDIVERSBOT-5J, a React #412 sibling that received a new event on 2026-10-21). Every event sample inspected during the recount carried `environment=production`. The MCP still reports lifetime counts, so a per-environment split of the counts is not available; the caveat can only inflate the RESIDUAL counts, never produce a false ZERO.

Production check during verification: two requests to `/opengraph-image` on 2026-10-21 both returned the static fallback byte-for-byte (MD5 `be7a419facbdd1a6a7ce3a859aa9851f` = `public/og-fallback.png`), i.e. the sharp rejection fails every uncached render on 0.95.2. Posted on #503.
