---
phase: "01"
slug: "stability-fixes-release"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-21"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register authored at plan time (39 threats across plans 01-01 to 01-09). Verified 2026-10-21 by gsd-security-auditor at ASVS L1, block_on high. Paths are repository-relative at the v0.95.2 code plus Phase 01 docs.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Official HD1 API → poller | Key-gated `/api/h1/update` ingests upstream payloads through Zod | Campaign and snapshot rows (public game data) |
| Visitor browser → Next.js server | Public pages, `/opengraph-image`, `/api/notifications/subscribe` | Requests, push subscriptions |
| Server/browser → GlitchTip, Umami | Error events and analytics via DSN and `/api/umami` proxy | Error signatures, outcome events (no visitor identifiers by design) |
| GlitchTip event payloads → this session / GitHub | Client-uploaded text read during the recount and quoted into public issues | Error signatures, counts, sample environment |
| Developer host → repo / GitHub / production | Release record, secrets by name, manual production pull | Names only, never values |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Denial of Service | `getWarOutcome.mjs` victory-signal checks | medium | mitigate | `f?.status` at both `.every` sites (`getWarOutcome.mjs:59,73`); tests `getWarOutcome.test.mjs:154-178` | closed |
| T-01-02 | Tampering | Snapshot rows read outside `getCampaign()` | low | accept | Accepted Risks Log AR-01 | closed |
| T-01-03 | Information Disclosure | TypeError stack to visitor | low | mitigate | Throw removed; `src/app/error.jsx:7-12` renders static `RouteError` copy | closed |
| T-02-01 | Denial of Service | React client tree on `/` | medium | mitigate | Planned per-variant hydration fix made no source change (`01-HYDRATION-SWEEP.md:81-84`); #418 still fires on 0.95.2 (`01-GLITCHTIP-RECOUNT.md`). Tracked in #496 and #526; STAB-01 re-scoped 2026-10-21 | open — below high threshold (non-blocking) |
| T-02-02 | Information Disclosure | GlitchTip #496 payloads read in sweep | low | mitigate | `01-HYDRATION-SWEEP.md:22-27` inert-data handling; tables carry IDs, counts, variants, component paths only | closed |
| T-02-03 | Tampering | `scripts/hydration-sweep.mjs` target URL | low | accept | Accepted Risks Log AR-02 | closed |
| T-02-04 | Repudiation | Suppressed hydration warnings | medium | mitigate | No `suppressHydrationWarning` added in the phase diff; existing sites justified in `01-HYDRATION-SWEEP.md` rows 3-9 | closed |
| T-03-01 | Denial of Service | `/opengraph-image` uncached render path | high | mitigate | `s-maxage=300` on success (`opengraph-image.jsx:39,148`); catch-all header rule excludes the route (`next.config.mjs:187-193`); `01-OG-CACHE-VERIFICATION.md` rows 1,2,5 | closed |
| T-03-02 | Information Disclosure | Fallback file read | medium | mitigate | Constant path `join(process.cwd(),'public','og-fallback.png')` (`opengraph-image.jsx:69,165`); no request input | closed |
| T-03-03 | Denial of Service | Cached poisoned fallback | high | mitigate | `no-store` on fallback (`opengraph-image.jsx:40,178`); recovery shown in `01-OG-CACHE-VERIFICATION.md` rows 3-5 | closed |
| T-03-04 | Information Disclosure | Error reporting on render path | low | mitigate | `reportError` at `opengraph-image.jsx:135-139,168-172,218-222`; bodies are PNG bytes only | closed |
| T-03-05 | Spoofing | Static fallback content | medium | mitigate | `generate-og-fallback.mjs:13-15,91-93` wordmark/tagline/host only; `public/og-fallback.png` carries no war state | closed |
| T-04-01 | Denial of Service | Telemetry on render path | medium | mitigate | `after()` at `opengraph-image.jsx:61-63`; `umami.mjs:23-45` swallows transport failure via `tryCatch` | closed |
| T-04-02 | Information Disclosure | Umami event payload | medium | mitigate | Event data `{}` or `{ stage }` (`opengraph-image.jsx:143,163`); no headers, UA or IP (`umami.mjs:31-40`) | closed |
| T-04-03 | Repudiation | Silent data-fetch failure | high | mitigate | `reportError` with `stage: 'data-fetch'` on rejected/malformed `getCampaign()` (`opengraph-image.jsx:217-223`) | closed |
| T-04-04 | Denial of Service | Analytics volume from crawlers | low | accept | Accepted Risks Log AR-03 (rationale gap noted) | closed |
| T-05-01 | Information Disclosure | Credentials in repro document | high | mitigate | `01-OG-SHARP-REPRO.md:14-23` names only; secret-pattern scan of phase docs negative | closed |
| T-05-02 | Information Disclosure | Container logs in repo | medium | mitigate | `01-OG-SHARP-REPRO.md:21,45` quote boot lines and the sharp error only | closed |
| T-05-03 | Tampering | Local image with production-shaped env | medium | mitigate | `WORKER_ENABLED=false` (`01-OG-SHARP-REPRO.md:19`) | closed |
| T-05-04 | Denial of Service | Investigation stalling the release | medium | mitigate | Three-state stop and `Verdict: NOT REPRODUCED` (`01-OG-SHARP-REPRO.md:43,53`) | closed |
| T-06-01 | Denial of Service | `NotificationToggle` mount effect | medium | mitigate | 5000 ms `Promise.race` + `.catch` → `enterError` (`NotificationToggle.jsx:10,112-137`); cancelled guard `:87-92,148-151`; test `:337-351` | closed |
| T-06-02 | Spoofing | Error-state copy | medium | mitigate | Error branch `NotificationToggle.jsx:178-191`: "Notifications unavailable" + Retry, no browser-settings attribution | closed |
| T-06-03 | Information Disclosure | VAPID public key in bundle | low | accept | Accepted Risks Log AR-04 | closed |
| T-06-04 | Repudiation | Silent VAPID misconfiguration | medium | mitigate | Missing key returns an Error (`NotificationToggle.jsx:39-45`); `reportError` + error state `:199-206` | closed |
| T-06-05 | Tampering | Retry re-invoking subscribe | low | accept | Accepted Risks Log AR-05 (`retry()` only bumps `retryToken`, `:173-176`) | closed |
| T-07-01 | Information Disclosure | Third-party font hosting | low | mitigate | `next/font/google` self-hosts (`layout.jsx:5,38-43`); no `fonts.googleapis`/`gstatic` reference in `src/`, `public/`, `next.config.mjs` | closed |
| T-07-02 | Denial of Service | Build-time font fetch | medium | transfer | Accepted Risks Log AR-06 (transfer to build pipeline) | closed |
| T-07-03 | Tampering | Font asset integrity | low | accept | Accepted Risks Log AR-07 | closed |
| T-07-04 | Denial of Service | Layout overflow from metrics | medium | mitigate | `01-FONT-MEASUREMENTS.md` narrow-width tables at 300px/260px before and after; visual compare passed (L1; weaker at L2, see N5) | closed |
| T-08-01 | Elevation of Privilege | Direct push to `main` | high | mitigate | PR #547 merged to `main` (merge commit `11864900`); `main` protected: PR reviews, strict checks, no force push (`enforce_admins=false`, N6) | closed |
| T-08-02 | Tampering | Tag on wrong commit | high | mitigate | `v0.95.2^{commit}` = `11864900` = `origin/main` tip; `package.json` 0.95.2 at that commit; `01-RELEASE-RECORD.md` "Plan Task 5 automated verify" | closed |
| T-08-03 | Information Disclosure | Sourcemaps to GlitchTip | medium | accept | Accepted Risks Log AR-08 (#502) | closed |
| T-08-04 | Information Disclosure | Secret values in release record | high | mitigate | `gh secret list` output by name and timestamp only; secret-pattern scan negative | closed |
| T-08-05 | Repudiation | Half-completed release | high | mitigate | Remote tag exists, equals version, `merge-base --is-ancestor origin/main origin/develop` exit 0; build run `success` | closed |
| T-08-06 | Denial of Service | Shipping a known-broken build | high | mitigate | ABSENT VAPID verdict stopped the August attempt; fix present `Dockerfile.app:67-68`, `build-release.yml:74`, `build-staging.yml:215`; October check 4 PASS (N7) | closed |
| T-09-01 | Tampering | Instruction-shaped event text | high | mitigate | Inert-data handling `01-GLITCHTIP-RECOUNT.md:18`; no write action from event content; comment/issue texts posted verbatim as developer-approved | closed |
| T-09-02 | Information Disclosure | Event content in public issues | medium | mitigate | Accepted Risks Log AR-09: posts carry parsed browser family/version and timezone of sample visitors beyond "signature, count, window"; no IP, header or payload | closed |
| T-09-03 | Repudiation | Zero count without traffic | medium | mitigate | INCONCLUSIVE path and traffic evidence present (`01-GLITCHTIP-RECOUNT.md:15,54`); Umami cross-check skipped — Accepted Risks Log AR-10 | closed |
| T-09-04 | Spoofing | Counting the wrong deployment | high | mitigate | Deployment id `0-95-2` matches `01-RELEASE-RECORD.md`; filter `release:0.95.2` with reason recorded; no rollback/redeploy confirmed; production-only re-query returns the same set (recount addendum) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-02 | Snapshot rows are written only by the key-gated poller from Zod-validated upstream payloads; no external write path | Plan 01-01 register | 2026-08 |
| AR-02 | T-02-03 | `hydration-sweep.mjs` reads `TEST_SERVER_URL` from the developer's own environment; local diagnostic, never CI or production | Plan 01-02 register | 2026-08 |
| AR-03 | T-04-04 | Success path cached 300 s, bounding events per cache window. Gap: the `no-store` fallback path fires one event and one Satori+sharp attempt per request while #503 persists (every request on 0.95.2, see #503) | Plan 01-04 register; gap noted 2026-10-21 | 2026-08 |
| AR-04 | T-06-03 | The VAPID public key is public by design; documents record name and found/not-found only | Plan 01-06 register | 2026-08 |
| AR-05 | T-06-05 | Retry re-runs the read-only init path; no re-POST of a subscription | Plan 01-06 register | 2026-08 |
| AR-06 | T-07-02 | Transfer: a Google Fonts outage fails the build, which blocks a bad release; the deployed image is unaffected | Plan 01-07 register | 2026-08 |
| AR-07 | T-07-03 | Font fetched once at build time over TLS and baked into the image; accepted at L1 like any build-time dependency | Plan 01-07 register | 2026-08 |
| AR-08 | T-08-03 | Sourcemaps go only to the self-hosted GlitchTip the developer controls; stripping tracked in #502 | Plan 01-08 register | 2026-08 |
| AR-09 | T-09-02 | The approved status comments and issues name the sample visitor's browser family/version and timezone (diagnostic for a timezone-dependent bug); no IP, header, payload or identifier. Residual exposure low; the repo is public | Andrei Lavrenov (approved the texts verbatim) | 2026-10-21 |
| AR-10 | T-09-03 | The Umami `api-og-rendered`/`api-og-fallback` cross-check was skipped (no API access this session); recorded INCONCLUSIVE. No zero count was claimed, so the threat's harm did not occur | Andrei Lavrenov | 2026-10-21 |

---

## Audit Notes

- N1: `release:0.95.2` had no `environment` constraint; staging ran the same build with the same DSN. A production-only re-query returns the same issue set; counts remain lifetime. Can inflate RESIDUAL counts, cannot create a false ZERO.
- N4: `enable()` awaits `navigator.serviceWorker.ready` inside `subscribeToPush` without timeout or catch (outside T-06-01's scope); see review WR-03.
- N5: The visual harness cannot render `next/font`, so the T-07-04 screenshots are identical by construction; the control holds at L1 only.
- N6: `enforce_admins=false` on `main`; the owner can bypass PR-only. Not exercised for this release.
- N7: No direct proof that the VAPID key is in the released 0.95.2 bundle; no "not configured" signature among the 0.95.2 classes.
- N9: `force-dynamic` means the 300 s cache depends on a shared cache honouring `s-maxage`; code at `opengraph-image.jsx:233-281` runs outside `tryCatch` (framework 500 without disclosure).

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-21 | 39 | 38 | 1 (medium, non-blocking) | gsd-security-auditor (opus), orchestrated by Claude Fable 5.1 |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-21
