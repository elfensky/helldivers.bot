# /docs/predict split — design

**Date:** 2026-07-31
**Issue:** to be filed on implementation (`frontend` + `enhancement`)
**Origin:** owner request — split the 41.5K single page into defend/attack
subpages; rebuild the defend page as TLDR-first, blog-style, with live
DB-backed numbers and an interactive gamma explorer, "so the reader is
engaged and understands how we ended up getting the closest."

## Owner decisions (made in-session)

| Decision      | Choice                                                                    |
| ------------- | ------------------------------------------------------------------------- |
| Hub           | `/docs/predict` stays: shared intro + two TLDR cards linking to subpages. |
| Liveness      | Distribution stats hourly-revalidated from the DB (ISR, `revalidate = 3600`); backtest verdicts stay static with reproduce-script footers. |
| Interactivity | ONE interactive: the gamma-k explorer on the defend page. (Window explorer and skill-race chart considered and not selected.) |

## Routes & structure

- `/docs/predict` (`page.mdx`, slimmed): what the report is, event counts
  (live), two TLDR cards — defend (shipped likelihood window, ±8h honest
  error, link) and attack (deterministic trigger, ETA passes the gate,
  link). Canonical stays; no redirects needed.
- `/docs/predict/defend` (`page.mdx`, new): see § Defend page.
- `/docs/predict/attack` (`page.mdx`, new): existing attack content moved
  and re-ordered TLDR-first — TLDR (trigger is `points == points_max`,
  `eta = remaining / rate`, gate table, what a player sees) → explainer
  (the trigger-band correction story, anchoring bug, rate window,
  day-of-week, caveats). Content is current (v0.74.x); this is a move +
  reshape, not a rewrite.
- `DefendRegularityChart` / `LullByTrainLengthChart` (+ loaders) move to
  `src/app/docs/predict/defend/`; imports updated.
- `DocsSidebar`: sub-entries for Defend and Attack under the predict item.
- The dashboard card's ⓘ link retargets `/docs/predict/defend`.
- Existing `data-umami-event="docs-*"` conventions apply to all new links;
  the gamma slider gets a `useTrack`-based `docs-gamma-explore` event
  (fired once per session on first drag, not per tick).

## Defend page

**Top — "How we predict it (TLDR)":**

1. The recipe in five short lines: watch three observable things (attack
   running? max sectors captured? hours since last wave) → look up what
   history says the remaining wait was in that exact situation
   (Kaplan-Meier over ~20k historical moments) → show the 50% band and
   within-24h/48h probabilities → verified calibrated walk-forward
   (±0.05 at every quartile) → never a countdown (typical miss ±8h on a
   ~44h cycle; the pre-registered ship bar for a countdown was missed and
   respected).
2. **Live "right now" chip** (ISR, same `waveModel` the card uses):
   current state label, hours since last wave, tonight's window — so the
   TLDR demonstrates itself with today's numbers.

**Then the narrative — "How we got here", sections in order:**

1. *The rules of the game* — the five confirmed mechanics + the mermaid
   train diagram (moved as-is) + the counterattack rule (§ New analysis).
2. *Attempt 1: we measured the wrong thing* — pooled-gaps mis-specification,
   the chain mechanic (97.1% / 0.1%), `DefendRegularityChart`.
3. *Attempt 2: the honest baseline* — corrected target, residual-life
   0.753 [0.732, 0.773], calibration PASS / sharpness FAIL,
   `LullByTrainLengthChart`, why "previous train tells you nothing".
4. *Attempt 3: teaching it to read the map* — the placebo machinery
   (within-season + phase-stratified permutation, and why four false
   positives made it mandatory), the null table, the three survivors
   (maxSC==9 +20.3h / attack-active −11.5h / prevRegion==10 +10.1h),
   the SC9-vs-SC10 confound kill, the state-conditional KM model, the
   gate table (best 0.648 [0.622, 0.674] — two legs pass, skill leg
   missed), and why a calibrated *band* shipped anyway.
5. *Reverse-engineering the scheduler* — the game-dev hypothesis table
   (memoryless / cooldown+roll / coarse tick / accumulator / per-faction
   timers / schedule table) with each kill, ending on the punchline:
   gamma(k≈4.4) fits with KS 0.073 vs exponential 0.314 — **the
   GammaExplorer sits here** (§ Interactive).
6. *Which faction gets hit* — the counterattack rule (assault fails →
   that faction, 179/179 across 95 seasons), assault-window targeting
   (58%), succeeded-assault exclusion (0/27), and the honest remainder:
   ~random among living factions; per-faction recency/liberation/sectors
   all null (the scheduler is one global clock; faction is drawn at
   spawn).
7. *What ships and why you can trust it* — card anatomy, honesty rules
   (always "likely", band never countdown, reliability-gated artifact),
   link to attack page.
8. *What's next* — S157+ high-res accumulation (the only path to attempt
   4), the forecast log (planned).

## Interactive: GammaExplorer (client component)

- Server wrapper fetches lull data from the DB (hourly ISR): histogram
  bins (2h width, 0–120h) + n + mean; passes plain props to the client
  component.
- Client: Recharts bar chart of the real histogram with a gamma PDF
  overlay. One slider: **k** (0.5–12, step 0.1, default the committed
  fit ≈4.4), θ locked to `mean / k` so the curve always matches the
  observed mean. Live readouts: k, θ (hours per "stage"), KS distance
  (computed client-side against the empirical CDF). Preset buttons:
  k=1 ("memoryless dice"), k≈4.4 ("best fit"), k=50 ("fixed timer") —
  each with one line of game-dev interpretation.
- Copy frames it: "if the scheduler were a coin flip every tick, the
  curve would look like k=1 — drag it and watch it miss."
- Deterministic math (lnGamma via Lanczos, gamma PDF/CDF in plain JS,
  no new dependencies). Follows the existing Loader pattern (dynamic
  import, no SSR).

## Live data plumbing

- `src/app/docs/predict/defend/liveStats.mjs` (server-only): one cached
  query function returning `{ counts, lullQuantiles, histogramBins, mean,
  currentState, elapsedHours, window }` — computed with the SAME
  derivations as `waveForecast.mjs` (train-start chain rule) against
  `h1_event`/`h1_status` via the existing `db` client. Pages export
  `revalidate = 3600`.
- Hub page reuses a lighter slice (event counts only).
- Every DB-derived figure renders with a small "live · refreshes hourly"
  affordance; every static backtest figure keeps the "reproduce:
  script NN" footer. The two must not be visually confusable.

## New analysis scripts (required by the reproducibility standard)

Published figures must come from committed scripts. Two exist only as
session probes today and their content is on this page:

- `scripts/analysis/12-faction-choice.mjs` — the faction question with
  the placebo treatment: counterattack rule (attack-fail → attacked
  faction next; report the exact count), succeeded-assault exclusion,
  SC9-faction targeting (with within-season permutation p), the residual
  rules (own-recency / own-liberation / own-sectors / majority-among-
  active) with accuracies, and the transition matrix. Self-checks +
  seeded permutations per house style.
- `scripts/analysis/13-scheduler-shape.mjs` — distribution forensics:
  moments (mean/CV/skew), KS vs exponential / gamma(method-of-moments) /
  shifted-uniform, wall-clock and relative-tick comb tests (with the
  caveat that only ticks ≪ spread are testable), per-faction vs pooled
  CV (the global-clock discrimination), lull-vs-train-duration anchor
  check, CV-by-wave-index stationarity. Self-checks (lnGamma/gammaCdf
  against known values; comb test detects a planted tick; determinism).
- Findings doc gains § Faction choice and § Scheduler shape;
  `scripts/README.md` documents both.

## Testing

- Mirror-tree tests for every new component (`GammaExplorer` math:
  gamma PDF/CDF fixtures, KS computation, slider render/preset behavior;
  hub/defend/attack pages are MDX — no component tests, but the moved
  charts keep theirs at the new mirrored paths).
- `liveStats.mjs` unit-tested with an injected fake db/query result
  (train-start derivation reuses `deriveTrainStarts` from
  `waveForecast.mjs` — imported, not duplicated).
- Full verification chain + DevTools pass on all three pages (layout,
  slider interaction, dark theme, mobile overflow).

## Honesty constraints (carried forward)

Unchanged and binding: "likely" never "will"; no countdown; every number
either live-derived (labeled), reproducible-static (script footer), or
absent. The attack page keeps its self-correction section — the project
publishes its mistakes.
