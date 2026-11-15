# Phase 1: Stability Fixes & Release - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-31
**Phase:** 1-Stability Fixes & Release
**Areas discussed:** Release sequencing & 48h window, OG image fallback & cache (#503), Notification error state UX (#485), Space Mono (#476)

---

## Release sequencing & 48h window

| Option | Description | Selected |
|--------|-------------|----------|
| One release after all five fixes | Single develop→main PR + tag; one 48h window on one deployment id | ✓ |
| Baseline release now, fix release later | Tag 0.93.1 today, re-count #496, second release for the rest | |
| Release per fix | Five release cycles, maximum attribution | |

**User's choice:** One release after all five fixes.

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 2 starts immediately; STAB-06 closes async | 48h is calendar time; re-count via GlitchTip MCP later | ✓ |
| Hard block until re-count | Freeze develop for attributable telemetry | |
| Shorter window (24h) | Only #496 needs traffic | |

**User's choice:** Phase 2 starts immediately; STAB-06 closes async.

| Option | Description | Selected |
|--------|-------------|----------|
| Full sweep of / before release | Grep + real-browser non-UTC run + hydration test per divergence, HTML variant included | ✓ |
| Ship the known fix, let the re-count decide | Issue #496's own recommended order | |
| Targeted: text variant only | 262 of 266 events | |

**User's choice:** Full sweep of / before release.

| Option | Description | Selected |
|--------|-------------|----------|
| Fix symbolication before the release | GlitchTip host perm (#497) + SENTRY_PROJECT secret; manual steps, plan gates on them | ✓ |
| Not this phase | Release with minified frames | |
| Fix the secret only | Leave the host upload dir for later | |

**User's choice:** Fix before the release.

---

## OG image fallback & cache (#503)

| Option | Description | Selected |
|--------|-------------|----------|
| Static PNG file committed to the repo | Pre-rendered card, cannot fail in sharp | (folded in) |
| Keep the generated fallback, guard it too | Two sharp passes on a failing box | |
| Fallback to a plain og:image URL swap | Metadata plumbing change | |

**User's choice:** Free text — dynamic PNG stays primary (card must show current game state); fallback only on crash; add Umami/GlitchTip tracking of how often the function (re)runs vs serves cached, rendered vs fallback. Static committed PNG accepted as the crash fallback.

| Option | Description | Selected |
|--------|-------------|----------|
| Fallback never cached; next request re-renders | no-store, bypass ISR on the error path | ✓ |
| Fallback cached with short TTL (~60s) | Fewer re-renders under load | |
| Keep 300s for both | Rely on the root-cause fix | |

**User's choice:** Fallback is never cached.

| Option | Description | Selected |
|--------|-------------|----------|
| Repro in Docker locally, time-boxed | Fix if found; ship fallback+telemetry regardless | ✓ |
| Must find root cause before release | Unbounded time | |
| Skip the repro | Diagnose from prod telemetry later | |

**User's choice:** Repro in Docker locally, time-boxed.

| Option | Description | Selected |
|--------|-------------|----------|
| Unit tests with a real ImageResponse render | Edge-case fixtures through the actual route | ✓ |
| Smoke test against the running server | Covers only live DB state | |
| Both | Unit fixtures + smoke canary | |

**User's choice:** Unit tests with a real ImageResponse render.

| Option | Description | Selected |
|--------|-------------|----------|
| Log it well, don't chase it | getCampaign blip self-heals with no-cache fallback | |
| Investigate both now | Audit getCampaign failure modes before release | ✓ |

**User's choice:** Investigate both now.

| Option | Description | Selected |
|--------|-------------|----------|
| Designed static card | Logo/wordmark, tagline, brand tokens, committed PNG | ✓ |
| Keep the plain branded card | Export current fallbackImage() output | |
| Static galaxy-map card | Generic map screenshot + wordmark | |

**User's choice:** Designed static card.

| Option | Description | Selected |
|--------|-------------|----------|
| Passive: events + 48h re-count | No new alerting infra | ✓ |
| GlitchTip alert rule on the fallback event | Email within hours | |

**User's choice:** Passive.

---

## Notification error state UX (#485)

| Option | Description | Selected |
|--------|-------------|----------|
| Error state with retry button | Explicit 'error' state + Retry re-running init | ✓ |
| Degrade to 'disabled' silently | Errors masquerade as healthy state | |
| Error text only, reload to retry | Smallest surface | |

**User's choice:** Error state with retry button.

| Option | Description | Selected |
|--------|-------------|----------|
| 5 seconds | Tolerates slow first install | ✓ |
| 10 seconds | More forgiving, later error | |
| 2 seconds | Snappy, false-error risk | |

**User's choice:** 5 seconds.

| Option | Description | Selected |
|--------|-------------|----------|
| VAPID check yes, 520 investigation no | subscribeToPush surfaces error; 520 noted on issue | ✓ |
| Both in scope | Chase 520 through proxy logs | |
| Neither — just the state machine | | |

**User's choice:** VAPID check yes, 520 investigation no.

| Option | Description | Selected |
|--------|-------------|----------|
| All three failure paths | Hang→timeout, rejection, retry-to-healthy + VAPID surfacing | ✓ |
| Timeout + rejection only | Retry exercised manually | |
| You decide | Planner picks depth | |

**User's choice:** All three failure paths.

---

## Space Mono (#476)

| Option | Description | Selected |
|--------|-------------|----------|
| Load via next/font + design pass | Fulfills the design system; DevTools verification on affected rows | ✓ |
| Drop Space Mono from the token | Zero visual change, honest about what shipped | |
| Load it, measure, revert if it breaks | Escape hatch to dropping | |

**User's choice:** "keep space mono" — after reviewing a side-by-side visual A/B artifact (https://claude.ai/code/artifact/0686a5de-638c-4739-95e5-6e63c6ed2308) built with the site's tokens, live width measurements, and the 300px/260px wrap stress test.

---

## Claude's Discretion

- Notification error-state copy/placement (within "short copy + visible retry")
- Static OG card visual design (within brand tokens)
- Umami event naming for OG telemetry (category-action convention)
- Mechanical organization of the hydration sweep

## Deferred Ideas

- `/sw.js` intermittent 520 investigation — noted on #485, out of phase scope
- Lease-model docs drift — already Phase 2's scope
