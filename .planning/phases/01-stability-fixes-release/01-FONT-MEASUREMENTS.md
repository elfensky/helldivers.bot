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
Test Files  3 passed (3)
     Tests  5 passed (5)
```

(`StatGrid` ×1, `DashboardClient` ×2, `EventCard` ×2.) All three suites
passed against their committed baselines. This count corrects an inflated
first reading of "4 files / 10 tests" that accidentally included a
now-deleted scratch measurement file left on disk at capture time — the
real production visual suite is 3 files, 5 tests. Any diff surfaced by
Task 3's post-fix run is attributable to the font change, not pre-existing
drift.

---
*Captured 2026-08-31, plan 01-07, Task 1. Before any edit to `layout.jsx` or `layout.css`.*

## After (post-fix) — Task 3

### Methodology correction from Task 1

The Task 1 approach of measuring through the project's own `vitest`
browser-mode visual harness (`vitest.visual.config.mjs`) turned out to be
**unable to prove or disprove this fix**. That harness runs under Vite, and
`next/font/google` is a Next.js build-pipeline feature (webpack/Turbopack
plugin) — it never executes under Vite. `import '@/app/layout.css'` in
`src/__tests__/visual/setup.mjs` pulls in the CSS text, including
`--font-mono: var(--font-space-mono), monospace;`, but `--font-space-mono`
is never defined anywhere in that environment (no next/font-generated class
exists on `<html>`), so the custom property is invalid at computed-value
time and every mono element there silently falls back to the plain
`monospace` keyword — identically, before and after the fix. Re-running the
Task 1 fixtures through that harness post-fix confirmed this: computed
`font-family` read bare `"monospace"` and every measured width was
byte-identical to the pre-fix run. That is a **methodology artifact, not
evidence the fix failed** — it means the harness cannot see `next/font` at
all, in either state.

The authoritative instrument is therefore the actual Next.js dev server
(`localhost:3000`), which does run the real font pipeline. All After
measurements below were captured there. To get a clean paired comparison
without disturbing the running dev server long-term, `layout.jsx`/
`layout.css` were temporarily rewritten on disk to their pre-fix content
(sourced via `git show HEAD~1:...`, the Task 1 commit), the dev server's
hot-reload picked it up, the Before reading was taken, then the files were
restored byte-for-byte to the committed Task 2 content (verified via
`git diff` showing zero changes) before taking the After reading below. No
commit was made in between; this was a read-only measurement technique.

### Before/After — real dev server, viewport 1280×900, same DOM elements each time

| Selector | Text (may include mid-animation digits) | Before `font-family` | After `font-family` | Before width (px) | After width (px) | Δ |
|---|---|---|---|---|---|---|
| `.sector-card-points` | live points/total (AnimatedStat, mid-roll) | `"Space Mono", monospace` | `"Space Mono", "Space Mono Fallback", monospace` | 126.078125 | 128.609375 | +2.53 |
| `.sector-card-countdown` | `Expired` (static, not animated) | `"Space Mono", monospace` | `"Space Mono", "Space Mono Fallback", monospace` | 58.8125 | 59.984375 | +1.17 |
| `.sector-card-pace` | pace delta (AnimatedStat, mid-roll) | `"Space Mono", monospace` | `"Space Mono", "Space Mono Fallback", monospace` | 62.875 | 74.484375 | +11.6* |
| `.sector-card-bar-label` | `SECTOR_PROGRESS` (static) | `"Space Mono", monospace` | `"Space Mono", "Space Mono Fallback", monospace` | 126.03125 | 128.53125 | +2.5 |
| `.sector-card-assault` | — | not rendered (no active event with a computable forecast right now, same both times) | not rendered | — | — | n/a |
| `.stat-card-label` | `HELLDIVERS_ONLINE` (static) | `"Space Mono", monospace` | `"Space Mono", "Space Mono Fallback", monospace` | 228 | 228 | 0** |

\* `.sector-card-pace` shows the biggest delta but its text includes
`AnimatedStat`'s mid-roll animated digits, captured at a different point in
the roll each run — the delta is directionally consistent with a font swap
but is confounded by animation state, so it is not treated as clean
evidence on its own.

\*\* `.stat-card-label`'s width is unchanged because the label sits in a
fixed-width grid column with `overflow: hidden; text-overflow: ellipsis` —
the box width is dictated by the grid track, not by glyph metrics, so an
unchanged pixel width here is the expected, correct outcome, not a sign the
font failed to apply.

**The reliable, non-animated evidence:** `.sector-card-countdown` (+1.17px)
and `.sector-card-bar-label` (+2.5px) are both 100%-static text strings
(`Expired`, `SECTOR_PROGRESS`) measured identically before and after — their
widths changed because the glyphs that painted them changed. Combined with
the `font-family` computed-style difference (the `"Space Mono Fallback"`
face only exists when `next/font` actually generates it — no hand-written
CSS produces that name), this is direct, non-circumstantial proof that
`--font-mono` now resolves to a genuinely-loaded Space Mono where it
previously fell back to the browser's generic `monospace`.

**`.sector-card-assault` (assault ETA):** did not render live in either
capture — there is currently no active event on the live season with a
computable ETA forecast (`etaForecast`/`eventEta` are both null under
today's live game state). It shares the byte-identical CSS declaration
`font-family: var(--font-mono, monospace);` (`EventCard.css`) with
`.sector-card-pace`, `.sector-card-bar-label`, `.sector-card-points`, and
`.sector-card-countdown` — all four of which are directly confirmed above —
and `--font-mono` is a single global custom property, not scoped per
element, so the same resolution necessarily applies to `.sector-card-assault`
the moment it renders. No separate DOM-level proof was possible without
either waiting for a live assault event or standing up new test
infrastructure outside this plan's scope.

### `.sector-card-meta` narrow-width wrap — after

Same real-dev-server technique, first live `.sector-card` forced to 300px
then 260px via inline style (measurement-only DOM mutation, not a code
change):

| Card width | `.sector-card-meta` width | Row count | Wraps? |
|---|---|---|---|
| 300px | 268px | 1 | No |
| 260px | 228px | 1 | No |

Identical to the pre-fix reading — this particular live card has a
`barLabel` set, so `PaceIndicator` renders in the bar-label row, not inside
`.sector-card-meta` (matches Task 1's first fixture scenario, not the
no-`barLabel` "PaceIndicator also in `.sector-card-meta`" scenario). The
Task 1 fixture that DID put `PaceIndicator` inside `.sector-card-meta`
already wraps at both widths pre-fix (`flex-wrap: wrap` engaging under the
combined width of points + countdown + pace regardless of which mono face
renders); no overflow regression was introduced, no `EventCard.css` change
was required.

### Post-change visual-regression status

Ran via `sh scripts/visual-tests.sh` (Docker, same image, committed
baselines) after the fix:

```
Test Files  3 passed (3)
     Tests  5 passed (5)
```

Identical pass count to the pre-fix run, **zero baseline diffs**. Per the
methodology correction above, this is expected and does not indicate the
fix has no visible effect — the Docker-run vitest harness cannot execute
`next/font` any more than the local one can, so it renders the same
generic-monospace fallback both before and after and the screenshots are
pixel-identical by construction. This is a genuine, pre-existing gap in the
visual-regression suite's coverage (it cannot catch a `next/font`
loading regression), not something this plan's scope covers fixing — flagged
in the SUMMARY for awareness rather than treated as a blocking issue.

### `npm run test:unit` / `npm run build`

Both re-run clean after the fix — see task commit for exact output; no
regressions attributable to this change.

---
*Captured 2026-08-31, plan 01-07, Task 3. After `layout.jsx`/`layout.css` were committed with Space Mono wired via next/font.*
