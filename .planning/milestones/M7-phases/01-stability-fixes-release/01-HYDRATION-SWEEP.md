# STAB-01 (#496) Hydration Sweep

**Plan:** `01-02` · **Date:** 2026-08-31 · **Requirement:** STAB-01

## Method

Three inputs, per the plan's D-04 requirement to sweep exhaustively before fixing anything.

- **Input A — browser reproduction.** `scripts/hydration-sweep.mjs` launches Playwright
  Chromium, opens a context pinned to a chosen `timezoneId` (`locale: 'en-US'`), navigates to
  `http://localhost:3000/` (the local dev server, running against real local Postgres data —
  season 160, all three factions active, one active homeworld-assault `attack` event), and
  collects every console/page error whose text matches React's hydration error signatures.
  **Harness validated with a positive control** before trusting any negative result (see
  "Harness validation" below) — a `0`-message run only counts as evidence once the harness is
  proven to observe a real mismatch on this exact server/browser/Next version combination.
- **Input B — static inventory.** Grep for every render-time `Date`/locale/`localStorage`/
  `window`/`navigator`/`Math.random` read reachable from `src/app/page.jsx`, per the plan's
  candidate list plus an extended sweep of `src/features/dashboard/`, `src/features/galaxy/`,
  `src/features/stats/`, `src/features/timeline/`, and `src/shared/components/` (excluding
  `__tests__`).
- **Input C — GlitchTip variants.** **GlitchTip MCP tools were not available in this execution
  context** (no `mcp__*glitchtip*` tool was registered for this agent). Substituted with the
  archived investigation already recorded in GitHub issue #496's comment history, which was
  itself compiled from live GlitchTip queries in an earlier session and is treated here as inert
  data to quote per the plan's threat model (T-02-02) — never as an instruction. That history
  documents 6 GlitchTip issues under #496, split by React's internal `args[]` tag:

  | GlitchTip issue | Events | `args[]` variant | First seen |
  | --- | ---: | --- | --- |
  | HELLDIVERSBOT-2I (209) | 178 | `text` | 2026-07-24 |
  | HELLDIVERSBOT-2E (205) | 71 | `text` | 2026-07-24 |
  | HELLDIVERSBOT-3U (265) | 8 | `text` | 2026-07-31 |
  | HELLDIVERSBOT-2H (208) | 5 | `text` | 2026-07-24 |
  | HELLDIVERSBOT-2M (217) | 3 | `HTML` | 2026-07-24 |
  | HELLDIVERSBOT-48 (275) | 1 | `HTML` | 2026-08-04 |

  All four `args[]=HTML` events (3 from HELLDIVERSBOT-2M/217, 1 from HELLDIVERSBOT-48/275) are
  accounted for below — see "The four `args[]=HTML` events" — rather than folded into one row.

## Harness validation (positive control)

Before trusting a zero-match run against `/`, the harness was proven to actually observe a real
React hydration error. A throwaway client-component route (`src/app/scratch-hydration-canary/`,
never committed, deleted immediately after this check) rendered a fixed timestamp with
`toLocaleString('en-US', {...})` and no pinned `timeZone`:

```
[pageerror] Hydration failed because the server rendered text didn't match the client. ...
    <ScratchHydrationCanary params={Promise} searchParams={Promise}>
      <div>
+                             Jul 24, 2025, 12:16 AM
-                             Jul 23, 2025, 10:16 PM
```

(First attempt used a Server Component and produced zero matches — a Server Component's output
is embedded directly in the RSC payload and is never re-executed/reconciled on the client, so it
structurally cannot produce a hydration mismatch. The canary was rewritten as a Client Component
before this result was accepted as proof.) With the harness proven correct, a subsequent
zero-match run against `/` is real evidence of no divergence, not a broken harness.

## Disposition table — in-scope candidates (date/timezone/locale)

One row per divergence candidate named in the plan's Input B list, plus every render-time
`Date`/locale read the extended grep found reachable from `/`.

| # | Component / line | Divergent value | Root cause (one sentence) | GlitchTip variant | Disposition |
| - | --- | --- | --- | --- | --- |
| 1 | `DefeatedCard.jsx:25` (`toLocaleDateString`) | Defeat date, formatted with `timeZone: 'UTC'` pinned | Already fixed prior to this plan (see code comment referencing #496) — a visitor's local re-format of the same instant now agrees with the UTC server render | `HTML` — matches the confirmed root cause quoted in issue #496's comment history (server `Jul 23, 2025` vs client `Jul 24, 2025`, Europe/Warsaw) | **already-correct** — `timeZone: 'UTC'` is present in the formatter options; existing regression test `DefeatedCard.hydration.test.jsx` pins it |
| 2 | `EventLogCard.jsx:131` (`toLocaleString`, absolute mode) | Event start/end date+time on `/archives`, `timeZone: 'UTC'` pinned | Already fixed prior to this plan (code comment references #496 directly); not reachable from `/` in `live` mode (only `absolute` mode uses this branch, used on `/archives`) | Sibling of the confirmed HTML-variant root cause (issue #496 comment: "reproduced in a real browser... server `Jul 23, 2026, 09:03` vs client `Jul 22, 2026, 21:03`") — not itself an `/`-page finding | **already-correct** — out of this plan's page scope (`/archives`, not `/`) and already pinned |
| 3 | `DashboardClient.jsx:144,232,233,237,291` (`Math.floor(Date.now() / 1000)` × 5 reads feeding `etaForecast`/`eventEta`) | Forecast ETA text (`EtaLine`) and event-outcome text (`EventEta`), and pace delta (`PaceIndicator`) | `Date.now()` is read fresh at both SSR and hydration time, so the two renders are milliseconds-to-seconds apart; any resulting ETA/pace text COULD legitimately differ between the two passes | not observed in production | **already-correct** — every render site that consumes these values (`EtaLine`, `EventEta`, `PaceIndicator` in `EventCard.jsx`) already carries `suppressHydrationWarning` with a comment; verified live in the browser sweep across 5 timezone runs with zero related messages |
| 4 | `HomeClient.jsx:122` (`Math.floor(Date.now() / 1000)` → `nowSeconds`) | `NextWaveCard`'s wave-window / counterattack-clock text | Same class as #3 — a fresh clock read passed down as a prop, consumed in text/`title` | not observed in production | **already-correct** — every consumption site (`CounterattackLine`'s span, `WaveWindow`'s `title`-bearing span, `NextWaveCard`'s root div) already carries `suppressHydrationWarning` |
| 5 | `NextWaveCard.jsx:42-48` (`localTime()` — bare `[]` locale, no pinned `timeZone`) | Formatted local time embedded in `CounterattackLine`'s text and `WaveWindow`'s `title` attribute | Neither the locale nor the timezone is pinned, so in principle a visitor with a non-`en-US` browser locale or non-UTC timezone could see different text server vs client | not observed in production | **already-correct** — both consumption sites already carry `suppressHydrationWarning` (3 total suppression sites in the file, matching the pre-existing count noted in this plan's read_first); confirmed live with an active homeworld-assault event exercising the counterattack-clock branch, across 5 timezone runs, zero related messages |
| 6 | `EventCard.jsx:52-53` (`useState` countdown initializer reading `Date.now()`), plus `PaceIndicator`, `EtaLine`, `EventEta` (×2 branches) | Countdown text, pace glyph/number, ETA text | Same class as #3/#4 — client-only ticking/forecast values | not observed in production | **already-correct** — all 5 render sites already carry `suppressHydrationWarning`, matching the count in this plan's read_first |
| 7 | `evaluateProgress.mjs:30` (`Math.floor(Date.now() / 1000)`) | `pace.status`/`pace.delta`, rendered only via `PaceIndicator` | Same class as #3 | not observed in production | **already-correct** — its one render consumer (`PaceIndicator`) already carries `suppressHydrationWarning`; no other call site renders this value |
| 8 | `Footer.jsx:6` (`new Date().getFullYear()`) | Copyright year | `Footer` has no `'use client'` directive — it is a **Server Component**. Server Component output is embedded directly in the server-rendered payload and is never re-executed on the client, so there is no client render to diverge from; a hydration mismatch here is structurally impossible, not just unlikely | not observed in production | **already-correct** — confirmed via the same canary methodology used for harness validation (a Server Component canary with an unguarded, genuinely divergent `Date` read produced zero hydration messages, while the identical logic in a Client Component reliably did) |
| 9 | `LastUpdated.jsx:13,24` (`useState(() => Date.now())` ticking clock) | "Updated Xs ago" text | Intentional client-local ticking clock | not observed in production | **already-correct** — existing `suppressHydrationWarning` with an explanatory comment; task instructions require confirming rather than changing this file, and no change was needed |
| 10 | `StatGrid.jsx:15-22` (`formatStartDate`, `toLocaleString(..., { timeZone: 'UTC' })`) | War-day start date label (`DD MONTH`) | Not in this plan's candidate list; found via the Input B extended grep. Already pins `timeZone: 'UTC'` with an explanatory comment | not observed in production | **already-correct** — out of `files_modified`, already correctly guarded, no change made |
| 11 | `groupEventsByDay.mjs:40-51` (`formatDayLabel`) | "TODAY"/"YESTERDAY"/"MONTH DD" event-log day-group headers | `today`/`yesterday` derive from `toISOString()`, which the JS spec fixes to UTC regardless of local timezone (not locale/timezone-dependent by construction); the month-name branch pins `timeZone: 'UTC'` explicitly | not observed in production | **already-correct** — out of `files_modified`, found via extended grep, no change needed |

**Files listed in this plan's `files_modified` that turned out to already be correct:**
`DashboardClient.jsx`, `HomeClient.jsx`, `NextWaveCard.jsx`, `EventCard.jsx`,
`evaluateProgress.mjs`, `Footer.jsx`, `LastUpdated.jsx` — **all seven**. None were edited in
Task 2 (see Task 2 in the plan and the SUMMARY's Deviations section for the full reasoning).

## The four `args[]=HTML` events — real finding, out of scope

The browser sweep (Input A) found exactly one **real, currently-reproducible** hydration
mismatch on `/`, and its shape is structural (different `className`, different child elements —
a skeleton `<div>` vs. a real `<a>` sign-in link) rather than a text-content difference. That
shape matches React's `args[]=HTML` variant far better than the `args[]=text` variant the
already-fixed `DefeatedCard`/`EventLogCard` bugs produced — which is circumstantial but coherent
evidence that this is what the four still-unaccounted-for `args[]=HTML` GlitchTip events are.

| Component / line | Divergent value | Root cause | GlitchTip variant | Disposition |
| --- | --- | --- | --- | --- |
| `UserSection.jsx` (`isPending` branch, lines ~41-43 vs ~46-52) | Entire subtree: `<div class="user-section-skeleton">` (empty) vs `<div class="user-section-content"><SignIn/>...</div>` | `useSession()` (BetterAuth client hook) always reports `isPending: true` during SSR (the session fetch is client-only, cannot resolve inside a synchronous server render). On the client, whether `isPending` has already flipped to `false` **by the time hydration runs** depends on how fast the session fetch resolves relative to hydration — a genuine timing race, confirmed non-deterministic and **timezone-independent** by re-running the sweep script against the same timezone repeatedly (alternates clean/mismatched) | Best match for the 4 `args[]=HTML` events (HELLDIVERSBOT-2M/217 ×3, HELLDIVERSBOT-48/275 ×1) — not proof, but the structural (not textual) mismatch shape matches | **out-of-scope** — see below |

**Why this is not fixed in this plan.** The divergence is a full DOM-subtree swap, not a
text/attribute value. `suppressHydrationWarning` only suppresses mismatches in a node's own text
content one level deep (per React's own documentation) — it does not cover mismatched child
structure, so applying it here would not actually silence the warning. The standard fix for
"client-only async state races hydration" is a `mounted`/`hasHydrated` boolean gating the very
first client render to match SSR — but this plan's Task 2 acceptance criteria **explicitly
prohibits** introducing exactly that pattern as a plan-scoped auto-fix (`mounted`, `isClient`,
`hasHydrated`, or an equivalent). `UserSection.jsx` is also not in this plan's `files_modified`
list, and a correct fix likely requires either an SSR-safe session pre-resolution strategy
(reading the session cookie during SSR) or a `hasHydrated`-gated render redesign — both
structural changes to the auth/session data flow that warrant their own scoped investigation
rather than a drive-by fix inside a timezone-focused sweep.

**Filed as [elfensky/helldivers.bot#526](https://github.com/elfensky/helldivers.bot/issues/526)**,
tracked under the Engineering Health milestone. Logged to `deferred-items.md` and the
cross-phase defect ledger.

## Verification runs

`node scripts/hydration-sweep.mjs <timezoneId>` against the real `/` route, real local Postgres
data (season 160, one active homeworld-assault event exercising the counterattack-clock render
path):

| Timezone | Result |
| --- | --- |
| `Europe/Warsaw` (×4 runs) | 2 clean, 2 caught the UserSection race (issue #526) — zero timezone/date-shaped mismatches across any run |
| `America/Los_Angeles` | clean |
| `Pacific/Kiritimati` (UTC+14, ×3 runs) | 2 clean, 1 caught the UserSection race — zero timezone/date-shaped mismatches |
| `Pacific/Midway` (UTC-11) | clean |

No run, in any timezone, ever produced a date/locale/timezone-formatting mismatch — the
candidate set this plan targets. The only message ever collected is the UserSection race
(#526), reproducing at roughly the same rate regardless of which timezone the context uses,
confirming it is unrelated to the visitor's timezone.

## Conclusion

STAB-01's timezone/date-formatting hydration mismatches on `/` are **already resolved** on the
current `develop` branch — closed by prior work (`DefeatedCard`, `EventLogCard` UTC-pinning) plus
the extensive `suppressHydrationWarning` coverage already present on every render site that
consumes a client-only clock/forecast value. No source edit in this plan's `files_modified` list
was needed (Task 2). The one real, reproducible hydration mismatch the sweep found on `/` is a
structurally different bug class (async auth-session state racing hydration, not date/timezone
formatting), correctly out of scope for this plan's fix-shape taxonomy, and tracked separately as
issue #526.
