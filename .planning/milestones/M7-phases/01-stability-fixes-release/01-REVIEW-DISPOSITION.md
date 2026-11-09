---
phase: 01-stability-fixes-release
review: 01-REVIEW.md
reviewed: 2026-10-21
depth: standard
findings_total: 17
critical: 0
warning: 11
info: 6
---

# Phase 01 — Code Review Disposition

One row per finding in `01-REVIEW.md`. `open` means seen, not yet acted on. The review is advisory: the phase's source shipped in v0.95.2 before this review ran, so every row starts `open` and is triaged in Phase 2 or as a GitHub issue.

| Finding | Severity | File | Disposition | Note |
|---------|----------|------|-------------|------|
| WR-01 | warning | src/app/opengraph-image.jsx:217-224 | open | A fresh or empty database is reported to GlitchTip as an incident |
| WR-02 | warning | src/app/opengraph-image.jsx:234-241, src/app/layout.jsx:81, src/shared/utils/gam | open | The null-slot guard is incomplete; the real `computeLiveMapState` still throws, and the test hides it |
| WR-03 | warning | src/features/notifications/NotificationToggle.jsx:193-224 (and 35-75) | open | enable() and disable() have no failure handling, so the button can stay busy forever |
| WR-04 | warning | src/features/notifications/NotificationToggle.jsx:53-59, 70-74 | open | A non-2xx response from `/api/notifications/subscribe` is treated as success |
| WR-05 | warning | src/features/notifications/NotificationToggle.jsx:113-129 | open | The 5 s `serviceWorker.ready` timeout reports a GlitchTip warning for users who are not broken |
| WR-06 | warning | src/app/layout.css:47-48,99-100, src/app/layout.jsx:24-34 | open | STAB-04 fixed `--font-mono` only; Inter and Space Grotesk are loaded but never applied |
| WR-07 | warning | next.config.mjs:60-74 | open | Unconditional rewrites turn every deployment into an open proxy for a hardcoded Umami host |
| WR-08 | warning | next.config.mjs:167-199, src/app/layout.jsx:87-91,237 | open | Shared-cache headers are set on HTML whose content depends on the session |
| WR-09 | warning | scripts/hydration-sweep.mjs:47-71 | open | hydration-sweep can report a clean sweep when it should not |
| WR-10 | warning | src/shared/utils/game/getWarOutcome.mjs:53-55,68-69,84-86 | open | The getWarOutcome null guard covers only faction `.status`, not events or snapshots; the sort ignores nulls |
| WR-11 | warning | scripts/generate-og-fallback.mjs:19-21,65,75,84,103 | open | generate-og-fallback.mjs claims deterministic output but depends on the machine, and writes to a cwd-relative path |
| IN-01 | info | src/shared/utils/game/getWarOutcome.mjs:1-42 | open | The getWarOutcome JSDoc is attached to the `import`, not to the function |
| IN-02 | info | src/__tests__/unit/features/archives/buildWarNarrative.test.mjs:306-310,424-425 | open | Stale comments in the buildWarNarrative test |
| IN-03 | info | next.config.mjs:1,15 | open | next.config.mjs details |
| IN-04 | info | scripts/hydration-sweep.mjs:32-35 | open | The comment in hydration-sweep mislabels the React error codes |
| IN-05 | info | src/features/notifications/NotificationToggle.jsx:165,180,185,231,242; 94-98 | open | Arbitrary-value classes instead of theme tokens, and a late-failure telemetry gap |
| IN-06 | info | src/app/opengraph-image.jsx:31,39 | open | The OG route no longer has any origin-side cache |
