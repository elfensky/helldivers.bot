---
phase: quick-261013-luq
plan: 01
subsystem: analytics
tags: [umami, privacy, route-handlers, legal]
status: complete
requirements: [WR-01, WR-02, WR-03, WR-04, WR-05, WR-06]
key-files:
    created:
        - src/app/stats.js/route.js
        - src/app/recorder.js/route.js
        - src/shared/components/RecorderScript.jsx
        - src/__tests__/unit/app/stats.js/route.test.mjs
        - src/__tests__/unit/app/recorder.js/route.test.mjs
        - src/__tests__/unit/shared/components/RecorderScript.test.jsx
    modified:
        - src/shared/utils/umami.mjs
        - next.config.mjs
        - src/shared/components/AnalyticsOptOut.jsx
        - src/__tests__/unit/shared/components/AnalyticsOptOut.test.jsx
        - src/app/layout.jsx
        - src/app/legal/page.jsx
        - src/app/docs/infrastructure/page.mdx
        - CHANGELOG.md
actuals:
    tasks: 3
    commits: 5
plan_head_before: 6cac3fec80505dd52838aeb98239d06519befc55
plan_head_after: 91f9d47098effc51cc832f4a62b71ba302aef28e
commits: 5
completed: 2026-10-13
---

# Quick 261013-luq: Fix review findings WR-01..06 Summary

The Umami scripts are now served from route handlers that forward no visitor headers. The recorder skips opted-out browsers. A failed opt-out save shows the blocked-storage message. The /legal text matches shipped behavior.

## Commits

| Commit | Message |
| ------ | ------- |
| eb648817 | fix(analytics): serve Umami scripts without forwarding visitor cookies |
| 8147341d | fix(analytics): tell the visitor when the opt-out cannot be saved |
| cf377450 | fix(analytics): do not load the recorder for opted-out browsers |
| b89a2923 | docs(legal): correct the analytics storage, heatmap and opt-out statements |
| 91f9d470 | docs(analytics): describe the cookie-free script routes and the recorder gate |

## What changed

- WR-01: `/stats.js` and `/recorder.js` are route handlers (`src/app/stats.js/route.js`, `src/app/recorder.js/route.js`) over `proxyUmamiScript` in `src/shared/utils/umami.mjs`. The helper calls `fetch(url)` with no init object. It answers 404 without a host, 502 on fetch error or non-OK status, and `application/javascript` with `public, max-age=3600` on success. The two script rewrites are gone. The three API rewrites stay, with a comment limited to the route-handler reason and `credentials: "omit"`. The soft CDN cache rule in `headers()` excludes both paths.
- WR-02: new client component `RecorderScript` renders the recorder only after mount, only when `readOptOut()` resolves to exactly `false`. `layout.jsx` uses it. The `AnalyticsOptOut` doc names the real mechanism.
- WR-05: `writeOptOut` returns a boolean. A failed save sets the state to `null`, which shows the blocked-storage message. `OPT_OUT_KEY` and `readOptOut` are exported. `readOptOut` treats any non-empty value as opted out, as the tracker does.
- WR-03, WR-04, WR-06: /legal edits as listed in the plan. The infrastructure docs and the CHANGELOG (`### Fixed` under `## Unreleased`) are updated. `package.json` stays at 0.95.0.

## Verification (run in the worktree, Node 24 via mise)

| Gate | Result |
| ---- | ------ |
| `npm run lint` | exit 0, 0 errors, 323 warnings (all existing; strict `--max-warnings 0` on the plan's touched-file list: exit 0) |
| `npm run typecheck` | exit 0 |
| `npm run test:unit` | exit 0, 194 files passed, 2028 tests passed |
| `npm run build` (CI stub env) | exit 0 |
| Build manifests | `/stats.js` and `/recorder.js` are in `app-path-routes-manifest.json`; neither is in `prerender-manifest.json`, so no `force-dynamic` was needed |

The dotted route folders worked through lint, tests and the build. The fallback in Task 1 step 7 was not used.

## Deviations from Plan

None. The plan executed as written. `src/app/docs/infrastructure/page.mdx` is not matched by the ESLint config (eslint prints "File ignored"), so the plan's `--max-warnings 1` check on it is trivially met.

## Not done / notes

- Not verified in a browser or against the live Umami host. The route handlers are covered by unit tests with a mocked `fetch` and by the build manifests only.
- `.planning/codebase/INTEGRATIONS.md:68` and `STACK.md:70` still describe the old `/stats.js` rewrite. The plan leaves them to the orchestrator.
- No version bump and no CHANGELOG move, as instructed.

## Known Stubs

None.

## Threat Flags

None. The new routes expose no new input to the upstream URL: the file name is a literal and the host comes from the env.

## Self-Check: PASSED

All five commits are ancestors of HEAD. All created files exist. The working tree has only the untracked `.planning/quick/261013-luq-*` directory.
