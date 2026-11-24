# Phase 2: Symbolication proof on staging (D-15 step 1)

Plan 02-09. Staging build check recorded 2026-11-15T02:01Z. Browser step and verdict follow in Task 3.

## Staging build

- P (pinned build): `ca7e661c0176885a797186154f6814e32c1eacb8`. `origin/deploy/staging` compose pins `ghcr.io/elfensky/helldiversbot:sha-<P>`.
- S (strip, plan 02-10, PR #660): `ca7e661c0176885a797186154f6814e32c1eacb8`. P equals S. `git merge-base --is-ancestor S P` exits 0.
- D (staging DSN, plan 02-14, PR #659): `5a9f755966eadb526b9c32053728ba2ea8960d4b`. `git merge-base --is-ancestor D P` exits 0.
- Staging version: `/api/h1/live` `appVersion` = `0.98.1-dev.ca7e661` (V1 = 0.98.1, P7 = `ca7e661`).
- Tunnel probe (empty-body POST to `/api/glitchtip`, cache-busting query): status 400, body size 0. The tunnel relays GlitchTip's answer.
- Browser DSN: repo variable `NEXT_PUBLIC_SENTRY_DSN` is present (presence check only; value not read).
- GlitchTip version: 6.2.6 (`GET /api/settings/`).

## No public map

- Chunk URL taken from the staging HTML: `/_next/static/chunks/1cw_u446k8dbu.js`.
- Plan form `<chunk>.js.map` (`1cw_u446k8dbu.js.map`): status 404. This form returns 404 on every build (plan 02-13 deviation), so it proves nothing alone.
- Derivation from the chunk's own comment: the staging chunks hold no `//# sourceMappingURL=` comment. Across the 19 chunk URLs in the staging home HTML the count of `sourceMappingURL=` lines is 0. The chunk ends with `//# debugId=<uuid>` only (example `04o2_8fpjurm0.js`: `93e59718-113c-1ed1-a3a6-8ae7936f0d65`).
- 404 sample from the v0.98.1 production name pattern: production chunk `04o2_8fpjurm0.js` carries `sourceMappingURL=43shl_15f_d1y.js.map`. The same map URL on production answers 200 (control). On staging, `/_next/static/chunks/43shl_15f_d1y.js.map` answers 404.

## Browser step and event

Task 2 ran on 2026-11-15 as a human-verify checkpoint. The orchestrator drove an isolated chrome-devtools context. Andrei approved sending the event from the investigation thread.

### D-30 exception

No natural error from staging had ever reached GlitchTip. On 2026-11-15 Andrei decided to allow one deliberate real browser error on staging, through the normal SDK path, as a one-time exception to D-30. The error was raised inside the app's own bundle code. It is not a hand-built envelope and not a console throw.

### Browser step result

- Page: `https://staging.helldivers.bot/legal`, with an init script that makes `window.localStorage` return null. The page `/` raises nothing on staging, because RecorderScript needs `UMAMI_SITE_ID`.
- Console: 1 warning, `[useLiveData] poll failed: Cannot read properties of null (reading 'removeItem')` (twice). No console errors.
- Tunnel: 5 `POST /api/glitchtip` requests, all answered 200.

| Time (UTC) | Request | Status |
|---|---|---|
| 03:47:36Z | session | 200 |
| 03:47:36Z | error event | 200 |
| 03:47:36Z | session | 200 |
| 03:47:37Z | spans | 200 |
| 03:47:46Z | spans | 200 |

- Map probe from the same session: `/_next/static/chunks/3kqjs_c4-s7d6.js.map` answers 404.

### Event

The orchestrator re-read the event through the GlitchTip MCP (`get_event`) at 2026-11-15T11:52Z. The issue stays unresolved on purpose.

| Field | Value |
|---|---|
| Issue short id | HELLDIVERSBOT-7D (issue 408, unresolved, count 1) |
| Event id | `4ec0654f36334c9e88a5830f8843ac73` |
| Timestamp | 2026-11-15T03:47:36.020Z |
| Type, level, mechanism | error, warning, generic (handled: true; reported by `tryCatch`'s `reportError`) |
| Release | `0.98.1-dev.acecf2b` (`git merge-base --is-ancestor ca7e661c acecf2b7` exits 0, so S is an ancestor) |
| Environment | staging |
| Raw frame | `/_next/static/chunks/3kqjs_c4-s7d6.js:2:355` (absPath `app:///_next/static/chunks/3kqjs_c4-s7d6.js?dpl=0-98-1-dev-acecf2b`; other raw frames at line 2, columns 299 and 2191) |
| Resolved frame | `src/shared/components/AnalyticsOptOut.jsx:18` (column 58, the anonymous callback) |
| Other resolved frames | `AnalyticsOptOut.jsx:17` (`readOptOut`) and `src/shared/utils/tryCatch.mjs:18` (`tryCatch`) |
| inApp, filename | all three inApp, filename `turbopack:///[project]/src/...` |
| Context line | yes: `Promise.resolve().then(() => Boolean(localStorage.getItem(OPT_OUT_KEY))),` with lines 13 to 23 around it |
| SDK | sentry.javascript.nextjs 11.10.0 |

### Reading of the result

- The event release `0.98.1-dev.acecf2b` is a later staging build than P (`0.98.1-dev.ca7e661`). It has S and D as ancestors, so it is a valid D-15 (1) source, as the plan's coupling note says.
- Staging serves no public browser map (404 above; no `sourceMappingURL` in the staging chunks). The resolved frames can therefore only come from the bundles that the build uploaded to GlitchTip.
- The Task 1 build check (P, S, D) was made against the build current at 2026-11-15T02:01Z. Staging has moved on since (develop reached 3bfe2d03 and staging serves `0.98.1-dev.3bfe2d0`). The later builds keep S and D as ancestors.

Verdict: SYMBOLICATED
