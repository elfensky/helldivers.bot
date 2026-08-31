# STAB-04 (#476) — Space Mono Before/After Measurements

Paired computed-style and bounding-box measurements proving `--font-mono` is
unfulfilled before this plan and resolved through a genuinely-loaded Space
Mono after it, per D-17/D-18. Instrument: a real Chromium tab driven by the
project's own `@vitest/browser-playwright` visual-test harness
(`vitest.visual.config.mjs`), which runs inside the actual browser DOM the
same way interactive DevTools would — `getComputedStyle()` and
`getBoundingClientRect()` are called directly in-page, not simulated. Docker
(`scripts/visual-tests.sh`) was used specifically for the pixel-diff
screenshot suite, since baseline PNGs are platform-specific; the numeric
measurements below were captured with a local Playwright Chromium instance,
which is valid for string/number comparisons (not pixel comparisons).

Fixtures: `EventCard` (attack-card scenario: `barLabel="Liberation"`,
`eventEta` verdict `onTrack: true`), `EventCard` (no `barLabel`, so
`PaceIndicator` renders inside `.sector-card-meta` — the row `EventCard.css`
flags as most at risk), `NextWaveCard` (counter `mode: 'clock'`), and
`StatGrid` (`faction="global"`), all seeded from
`src/__tests__/visual/fixtures.mjs`'s literal, non-random data so the same
selectors produce the same text before and after.

## Methodology note — what `getComputedStyle().fontFamily` does and does not prove

`font-family`'s **computed value equals its specified value** per the CSS
Fonts spec — `getComputedStyle(el).fontFamily` always echoes the declared CSS
font stack (`"Space Mono", monospace`) whether or not a font by that name is
actually loaded anywhere. It does **not** tell you which face painted the
glyphs. `document.fonts.check()` was tried as a stronger signal and
rejected: it returned `true` even for a test against a font name that does
not exist anywhere (`document.fonts.check('14px "TotallyBogusFontXYZ123"')`
→ `true`), because a browser's `FontFaceSet.check()` assumes some fallback
will always render *something* and does not fail closed for an unmatched
family. So neither API is direct proof of resolution.

The real evidence is measured **glyph metrics** — `getBoundingClientRect()`
width for the exact same fixture text before and after. This machine's local
font list was checked and confirmed to have no system-installed "Space Mono"
(`system_profiler SPFontsDataType | grep -i "space mono"` → no match), so
today's computed width reflects the browser's generic `monospace` fallback,
not Space Mono glyphs — the width comparison in Task 3 is what actually
proves the swap, not the `font-family` string.

## Before table (pre-fix, this commit)

| Selector | Context | Text | Computed `font-family` | Font size | Width (px) |
|---|---|---|---|---|---|
| `.sector-card-points` | EventCard meta row (points/totals) | `1,800,000 / 5.0M` | `"Space Mono", monospace` | 12.45px | 82.25 |
| `.sector-card-countdown` | EventCard meta row (event countdown) | `18h left` | `"Space Mono", monospace` | 12.45px | 59.78125 |
| `.sector-card-pace` | EventCard bar-label row (pace indicator) | `▲` + animated delta | `"Space Mono", monospace` | 12.45px | 26.46875 |
| `.sector-card-bar-label` | EventCard bar-label row (bar labels) | `Liberation` | `"Space Mono", monospace` | 12.45px | 74.71875 |
| `.sector-card-assault` | EventCard bar-label row (assault ETA) | `~9h` | `"Space Mono", monospace` | 12.45px | 22.4375 |
| `.sector-card-points` (NextWaveCard) | NextWaveCard meta row (`CounterattackLine`) | `assault on pace to succeed · counterattack …` | `"Space Mono", monospace` | 12.45px | 468 |
| `.stat-card-label` | StatGrid (label row, the "StatGrid values" row per D-18 — the only StatGrid element that carries `--font-mono`; `.stat-card-value` uses `--font-display`, out of scope) | `HELLDIVERS_ONLINE` (+5 sibling labels) | `"Space Mono", monospace` | 14px | 174.65625–174.671875 |

**Raw computed `font-family` readings (one per D-18 row, verbatim from `getComputedStyle().fontFamily`):**

1. `.sector-card-points` (EventCard points/totals) — `font-family: "Space Mono", monospace`
2. `.sector-card-countdown` (event countdown) — `font-family: "Space Mono", monospace`
3. `.sector-card-pace` (pace indicator) — `font-family: "Space Mono", monospace`
4. `.sector-card-bar-label` (bar labels) — `font-family: "Space Mono", monospace`
5. `.sector-card-assault` (assault ETA) — `font-family: "Space Mono", monospace`
6. `.sector-card-points` (NextWaveCard meta row) — `font-family: "Space Mono", monospace`
7. `.stat-card-label` (StatGrid values row) — `font-family: "Space Mono", monospace`

**Does the computed family resolve to Space Mono today?** The computed
string reads `"Space Mono", monospace` at every mono row — but per the
methodology note above, that string is the CSS declaration, not proof of
rendering. `src/app/layout.jsx` has zero `Space_Mono` references
(`grep -c 'Space_Mono' src/app/layout.jsx` → `0`) and no `@font-face` rule
for `'Space Mono'` exists anywhere in `layout.css` (only `Insignia` and
`Collective Consciousness` are self-hosted via `@font-face`; `'Space Mono'`
is bare-string). No system-installed "Space Mono" font exists on this
machine either. So the browser has no source from which to paint literal
Space Mono glyphs — every mono row above is silently substituting the
generic `monospace` fallback face, exactly as #476 claims. The Task 3
after-measurement's width deltas on these same selectors are the actual
proof.

**Also confirmed, not previously known:** `--font-display` and `--font-body`
have the identical bug — both are bare family-name strings
(`'Insignia', 'Space Grotesk', 'Impact', sans-serif` and
`'Inter', Arial, Helvetica, sans-serif`) that never reference
`var(--font-space-grotesk)` / `var(--font-inter)`, even though
`src/app/layout.jsx` generates both variables. `Insignia` renders correctly
regardless because it's separately self-hosted via a first-party
`@font-face` rule under the same literal name — that's incidental, not the
token chain working. `Space Grotesk` and `Inter` (as literal system-font
names) are not proven to resolve either; this plan's Task 2 does not touch
`--font-display`/`--font-body` (out of scope per D-17, which is narrowly
about `--font-mono`), but follows the **working next/font-variable pattern**
for `--font-mono` rather than copying the broken bare-string pattern the
other two tokens currently use. Flagged in STATE.md decisions for phase
follow-up.

## `.sector-card-meta` narrow-width measurement (D-18)

Fixture: `EventCard` with no `barLabel` and no `etaForecast`/`eventEta`, so
`PaceIndicator` renders inside `.sector-card-meta` alongside points and the
countdown — the exact "assault-ETA-adjacent, PaceIndicator also in this row"
overflow risk `EventCard.css`'s comment on `.sector-card-meta` documents.

| Card width | `.sector-card-meta` width | Row count | Wraps? |
|---|---|---|---|
| 300px | 268px | 2 | **Yes** |
| 260px | 228px | 2 | **Yes** |

The row already wraps onto two lines at both documented widths *before* any
font change, under today's substituted system-monospace glyphs. `flex-wrap:
wrap` is already doing its job pre-fix; Task 3 re-measures the identical
fixture after Space Mono is genuinely loaded to confirm the wrap verdict
does not regress to overflow (`flex-wrap: wrap` should always prevent
overflow regardless of glyph width, but the *row count* / exact break point
can shift with Space Mono's different character advance widths — that shift
is recorded, not treated as a failure by itself).

## Pre-change visual-regression status

Ran via `sh scripts/visual-tests.sh` (Docker, `mcr.microsoft.com/playwright:v1.62.1-noble`,
real committed baselines) — **green, no code changes**:

```
Test Files  4 passed (4)
     Tests  10 passed (10)
```

All four suites (`StatGrid`, `DashboardClient`, `EventCard` ×2) passed
against their committed baselines. Any diff surfaced by Task 3's post-fix
run is attributable to the font change, not pre-existing drift.

---
*Captured 2026-08-31, plan 01-07, Task 1. Before any edit to `layout.jsx` or `layout.css`.*
