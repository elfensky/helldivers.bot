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

Not yet run. Task 2 is a human-verify checkpoint (chrome-devtools by the orchestrator, GlitchTip read).
