# OG Cache Split — Production Build Verification (STAB-02, #503)

**Purpose:** Task 2's unit tests assert `Cache-Control` header values against mocks. The
header only matters if the framework actually honours it — and that behaviour differs
between `next dev` and a production `output: 'standalone'` build. This document records
evidence gathered against a real standalone server, per Task 3 of `01-03-PLAN.md`.

**Method:** `npm run build` (production build), then the standalone server was started
manually (mirroring `scripts/start-standalone.sh`'s asset-copy steps but without its
`/api/healthcheck` gate, since the healthcheck itself depends on the database and the
failure-path server was deliberately started against an unreachable one) on port 3200 —
the dev server on :3000 was left untouched.

## Finding: a real production-build bug was caught and fixed

The first pass of this verification (against the code as committed in Task 2) found that
`next.config.mjs`'s catch-all `headers()` rule —
`/((?!api/|_next/|profile|favicons/|fonts/|icons/|images/|svgs/|sw\.js|workers/).*)`,
`Cache-Control: public, s-maxage=30, stale-while-revalidate=60` — matches `/opengraph-image`
and **overrides the route's own `Cache-Control` header**, in both directions: the success
response's `s-maxage=300` was silently replaced with the config's `s-maxage=30`, and
critically, **the fallback response's `no-store` was also silently replaced with
`public, s-maxage=30, stale-while-revalidate=60`** — the exact "frozen fallback" failure
mode STAB-02 exists to fix (D-08, T-03-03), reproduced against a real build even though
the unit tests (which never touch `next.config.mjs`) passed unaware of it.

**Fix (Rule 1 — bug, applied inline):** excluded `/opengraph-image` from the catch-all
`source` regex in `next.config.mjs`, the same way `/api/*` is already excluded with the
same rationale ("route handlers set their own Cache-Control"). Re-verified below against
the rebuilt app — all five requests now show the route's own header, not the config's.

## Evidence (post-fix)

Standalone server on `http://127.0.0.1:3200`, `next.config.mjs` fix applied, rebuilt via
`npm run build` before this table was captured.

| # | State | Status | content-type | content-length | Cache-Control | x-nextjs-cache |
|---|-------|--------|--------------|-----------------|----------------|-----------------|
| 1 | Healthy DB (1st req) | 200 | image/png | 144104 | `public, s-maxage=300, stale-while-revalidate=60` | (not present) |
| 2 | Healthy DB (2nd req) | 200 | image/png | 144104 | `public, s-maxage=300, stale-while-revalidate=60` | (not present) |
| 3 | Unreachable DB (1st req) | 200 | image/png | 21337 | `no-store` | (not present) |
| 4 | Unreachable DB (2nd req) | 200 | image/png | 21337 | `no-store` | (not present) |
| 5 | DB restored, server restarted | 200 | image/png | 144104 | `public, s-maxage=300, stale-while-revalidate=60` | (not present) |

Notes:
- `x-nextjs-cache` was not emitted by the standalone server for this route in any request —
  the route handler builds its own `Response` (not a static/ISR page render), so Next's
  page-cache instrumentation header does not apply here. Absence is expected, not a gap.
- Requests 3 and 4's body (21337 bytes) is byte-identical to the committed
  `public/og-fallback.png` (`diff` confirmed no difference) — the fallback branch serves
  the real static asset, not a stand-in.
- Requests 1, 2, and 5's body (144104 bytes) is identical to each other and differs from
  the fallback PNG — the live map+stats card, not the fallback.

## Recovery — the actual acceptance test for D-08

**Request 5 returned the live card, not the cached fallback.** After the two failure
requests (3, 4) served the static fallback with `no-store`, the database connection was
restored and the server was restarted; the first subsequent request served the real,
current live card (`Cache-Control: public, s-maxage=300, ...`), matching request 1's body
exactly and differing from the fallback PNG. A single transient failure did not pin a
permanent degraded card in front of subsequent callers — the behaviour STAB-02 set out to
fix is confirmed against a production build, not only against unit-test mocks.

## Cleanup

The standalone server processes started for this verification (PIDs from both the
healthy-DB and broken-DB runs) were stopped after the final request; `ps aux | grep
standalone/server.js` confirmed no server was left running. Synced build assets
(`.next/standalone/.next/static`, `.next/standalone/public`) were removed after
verification — they are build artifacts, not committed.
