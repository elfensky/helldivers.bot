# Changelog

## 0.82.0

### Added

- **View-dependent frontier ETA** (#483): in sector view the card's ETA targets
  the next sector boundary (`ETA ~40m`, median-only — the measured range
  follows via #484 once enough high-res seasons exist for script 13's gate);
  campaign view keeps the calibrated assault ETA (`ETA ~11h (9h-16h)`).
- **Event pace verdicts**: active defend/attack/Super Earth cards replace the
  points-delta pace arrow with a time verdict — `▲ on track · done ~3h` /
  `▼ behind · done ~5h` / `▼ behind · stalled` — from `eventForecast`
  (average pace since event start vs deadline, anti-flicker margin 0.2
  measured by `scripts/analysis/14-event-verdict-margin.mjs` on 125 events).
- **Analysis**: script 13 (sector-crossing backtest — gate honestly
  unevaluable at 4 high-res seasons, committed as the future grading tool),
  script 14 (verdict margin), `loadDataset({eventProgress})` option.

### Changed

- **ETA line formatting**: sub-hour values render as minutes (`~40m`,
  fixing the `~0h` edge); range bounds carry their own unit (`(4h-16h)`).
  `EventCard`'s `assaultForecast` prop renamed to `etaForecast`.

## 0.81.0

### Added

- **Counterattack clock on the next-wave card (#482):** while a homeworld
  assault is active, the dashboard's Predicted Wave card shows a second meta
  line — "if the assault fails · counterattack ⟨time⟩ (in ~Xh)" — computed
  as the earliest active assault's start + 48h (`counterattackAt` in
  `waveForecast.mjs`). A deterministic mechanic from #480 (median backtest
  error 0.0h vs the KM band's 9.2h during assaults), not a model: the KM
  likelihood band stays primary, the clock line is conditional on the
  assault failing (~59% base rate), and it reads "imminent" once the
  timeout has passed. Mechanic explainer rides the hover title;
  `/docs/predict/defend` § What ships updated to match.

## 0.80.0

### Added

- **"Why the window is lopsided" on `/docs/predict/attack`**: explains the
  `arrival = work ÷ pace` skew (division table + surge-capped/stall-unbounded
  supply argument) and why the dashboard shows `~median (range)` rather than a
  symmetric `±`. Includes `EtaSkewExplainer` — an interactive Recharts
  hyperbola with a draggable pace multiplier and half/double presets
  (lazy-loaded, `docs-eta-skew-explore` umami event).

### Changed

- **`/docs/predict/attack` reworded to facts-and-doubt voice**: findings and
  their uncertainty stated directly (trigger-is-a-point sensor evidence,
  staleness anchoring, adjustments that carry no signal, per-faction player
  telemetry as promising-but-unproven), dropping the past-correction
  narrative framing.


## 0.79.0

### Added

- **Counterattack timing investigation (#480):** the defend train that follows
  a failed homeworld assault is mechanically scheduled — fail-resolved
  assaults are exact 48.0h timeouts (544/544) and the counterattack train
  starts within 10 minutes of the timeout when the defend slot is free
  (467/474, p05–p95 = 0.0h; queued cases fire late and are measured
  separately). The defend hazard is fully gated during assaults (all 178
  train starts during an assault are counterattacks; 0 free waves in
  24,651h of assault-active lull time), and counterattacks land on region 9
  (97.8%). New scripts: `14-counterattack-delta.mjs` (slot-aware delta +
  concurrency census + Steam-guide checks), `15-counterattack-target.mjs`
  (third target correction — 487 counterattack starts excluded, gate re-run:
  STATE-KM 0.625 [0.599–0.664], calibration + sharpness FAIL, verdict
  INCONCLUSIVE unchanged; scheduler refit on free lulls net of gated time:
  gamma(k≈8.8, θ≈3.6h), CV 0.336), `16-counterattack-pipeline.mjs`
  (pre-registered composite: during an assault, "next wave = assault start
  + 48h" beats the shipped KM table 0.0h vs 9.2h median error; from the SC9
  window it does not). `lib/dataset.mjs` now labels `isCounterattack` on
  defend train starts (labelling only, chain rule untouched).

### Changed

- `/docs/predict/defend` rewritten in part: rules 7–8 (immediate
  counterattack, assault-gated clock), the decontaminated scheduler
  reconstruction, and a new "counterattack clock" section with the
  corrected-target gate table. Findings doc gains § Counterattack timing.

## 0.78.3

### Changed

- **Assault line shortened**: `ETA ~9h (4-16h)` instead of
  `Assault in ~9h (4-16h)`; "Assault ETA" context moved into the title
  tooltip.

## 0.78.2

### Changed

- **Assault ETA line is median-first**: `Assault in ~9h (4-16h)` instead of
  `Assault in 4-16h` — the median moves from the title attribute into the
  visible line, with the 25th–75th percentile range in parens. Deliberately
  not a symmetric `±` form: the window is asymmetric near campaign completion
  (p75 up to 2× the median), and `±` would understate the late side.


## 0.78.1

### Added

- **Faction-players attack-ETA experiment (attempt 4)** (#479):
  `scripts/analysis/12-faction-players-eta.mjs` compares the shipped dow model
  against per-faction player-telemetry rate variants (crude ratio control,
  points-per-player^α-hour, hour-of-week player pattern) walk-forward on
  S157–160, paired on identical moments. Verdict: the documented-harmful crude
  ratio reproduces as worse (+2.4h pooled); the best variant (pph α=0.7) is
  directionally better (−1.0h pooled, wins both Cyborg seasons) but at
  effN 2–3 per faction the shipped model is kept. Reruns unchanged as each new
  war adds a telemetry season. Supporting lib changes:
  `loadDataset({statistics})` + `playersAt`/`statisticSeries`/`statSeasons`
  accessors, walkForward `allowNoPriorEvent` flag and per-record `t` for
  paired cross-variant scoring. (Analysis commits landed inside the 0.77.1 and
  0.78.0 merges from a parallel session; recorded here.)
- **Attempt-4 verdict on `/docs/predict/attack`**: "Revisited with faction
  telemetry" block after the what-did-not-help table, plus the script-12
  reproduce line.

## 0.78.0

### Added

- **Live concurrency census on `/docs/predict/defend`** (`LiveConcurrency` +
  `computeConcurrencyStats`): every same-season event pair in the database, recomputed
  hourly — defend↔defend (never observed, 0 overlaps), same-faction defend↔attack (never),
  cross-faction defend↔attack and attack↔attack (common), and the max-simultaneity record
  (3 events: both triple-assault and 2-attacks+1-defend compositions, with first seasons).
  Citable live proof for research instead of frozen claims.

### Changed

- **Counterattack-lull handoff v3**: adds the community Steam guide as cross-checked prior
  art — four claims confirmed by our measurements, three promoted to test targets (defend
  hazard gated during assaults; fixed 2.5h/48h event durations; counterattack lands at
  sector 9 "automatically").

## 0.77.1

### Changed

- **Counterattack-lull handoff v2** (Discord follow-ups): the delta measurement is now
  slot-aware (the one-defend-at-a-time rule means queued counterattacks would smear a
  mechanical delay when pooled — measure slot-free and slot-occupied subsets
  separately), adds verification of attack-attack overlaps and the max-simultaneous-events
  question (owner recalls 2 attacks + 1 defend at once), and a new queueing-confound trap.

## 0.77.0

### Added

- **`/docs/predict` split into a hub plus two subpages** (`/docs/predict/attack`,
  `/docs/predict/defend`), per [#478](https://github.com/elfensky/helldivers.bot/issues/478).
  The combined report had grown past the point a single page could serve both a skimmer and
  a reader who wants the full derivation, so the hub is now a two-card summary — attacks
  "solved", defends "partially, honestly" — each linking out to its own page, with matching
  entries added to the docs sidebar and the dashboard `NextWaveCard`'s ⓘ link retargeted from
  `/docs/predict` to `/docs/predict/defend`.
- **Defend explainer rewritten TLDR-first, blog style**
  (`src/app/docs/predict/defend/page.mdx`), leading with the six mechanics found across the
  investigation — including a newly documented sixth: **a failed homeworld assault is always
  answered** (179/179 recorded lulls that began with a still-running, ultimately-failed
  homeworld assault saw the next wave hit the assaulted faction; the mirror case, a
  *succeeded* assault, is 0/27 by definition since the faction is removed from the game).
  When no assault is in play, the SC9-window rule calls the target 61.4% of the time (189/308,
  within-season permutation placebo, p = 0.0005). The page's live-numbers footer (lull count,
  train starts, seasons) now refreshes hourly straight from the database instead of quoting
  the static counts frozen at analysis time.
- **`GammaExplorer`** (`src/app/docs/predict/defend/GammaExplorer.jsx` +
  `GammaExplorerSection.jsx`): an interactive fit of the reverse-engineered lull scheduler
  against the live lull-length histogram. A slider drags the shape parameter k with preset
  jump buttons, live-updating a KS-distance readout against the real distribution pulled via
  `computeDefendStats` (`src/app/docs/predict/defend/liveStats.mjs`). Demonstrates the
  finding underneath it: one global, end-anchored gamma(k≈4.4, θ≈8.9h) delay timer beats
  every rival shape (KS 0.073, three times closer than the next-best candidate), and the
  k→∞ fixed-timer corner the page calls out is visibly wrong against the real data.
- **Two new analysis scripts** backing the above figures, listed in `scripts/README.md`:
  `12-faction-choice.mjs` (the counterattack rule, SC9-window targeting, and the honest
  near-random remainder once both are excluded) and `13-scheduler-shape.mjs` (distribution
  forensics discriminating six candidate scheduler shapes — KS vs. exponential/gamma/uniform,
  tick combs, per-faction-vs-pooled CV, wave-index stationarity — landing on the single
  global gamma-delay clock with faction drawn at spawn).
- **Counterattack-lull handoff spec**
  (`docs/superpowers/specs/2026-07-31-counterattack-lull-handoff.md`): frames Discord
  feedback (a failed homeworld assault auto-triggering a counterattack train) as a
  potential fourth defend-prediction attempt — the attack-fail→train delta, a
  pre-registered mechanical criterion, a corrected-target gate re-run, and the
  SC9→assault→counterattack pipeline model — for whenever that thread gets picked back up.

## 0.76.0

### Changed

- **Assault line moved to the subtitle row and reworded.** Now reads
  `SECTOR_PROGRESS · Assault in 14-25h` on the bar-label row rather than sitting in the meta
  row below, and "ETA" became "in". The label and forecast are grouped so the row's
  `space-between` still pushes the pace indicator to the right edge.

## 0.75.0

### Changed

- **Assault ETA window widened to 48 hours.** The line renders when the median estimate
  falls under 48h rather than 24h. Moving it out improved every measure at once, which is
  the campaign-state resolution showing through — `h1_status` runs at ~1 bucket/day for most
  of the record, so a 24-hour display window is exactly where the input is least able to
  support an estimate. Coverage 91.5–95.2% → **93.6–96.0%**, false-alarm rate 86.1–94.4% →
  **91.4–97.1%**, and the median hit rate when showing 0.456–0.526 → **0.496–0.535** against
  a nominal 0.500. Both analysis scripts, the emitted model and `/docs/predict` move
  together, so the published numbers describe the shipped configuration.

### Fixed

- **Wave-card icon rendered at the wrong aspect ratio.** `superearth.webp` is 1000×1142 but
  `NextWaveCard` asked for a square 16×16, so the browser preserved the source ratio and
  drew it 16×18.5 — the `next/image` "width or height modified, but not the other" warning
  that fired on every render. Now 14×16, matching the source ratio and the 16px height of
  the square faction icons beside it.

## 0.74.2

### Changed

- **Roadmap:** added S3a for [#476](https://github.com/elfensky/helldivers.bot/issues/476)
  (Space Mono never loads), flagged as a site-wide typography decision rather than a
  one-line import.

## 0.74.1

### Fixed

- **Crossed-swords glyph dropped from the assault ETA line.** At 14px U+2694 renders as a
  faint × rather than legible crossed swords, so it conveyed nothing. The label is
  self-describing without it.

### Known issues

- **`--font-mono` never loads** ([#476](https://github.com/elfensky/helldivers.bot/issues/476)). `layout.css` declares `'Space Mono', monospace` but
  `layout.jsx` only imports `Space_Grotesk` and `Inter` from `next/font/google`, so every
  mono element on the site — card points, countdowns, pace indicators, bar labels — falls
  back to the browser's default monospace (8.43px advance rather than Space Mono's metrics).
  Pre-existing and unrelated to this release; noted here because it was found while
  verifying the assault line.

## 0.74.0

### Added

- **Assault ETA on the faction cards.** Attacks are now forecastable, and the faction card's
  meta row carries a `Assault ETA 4-16h` line when one is expected within a day. A range,
  never a countdown — the measured window is ~21h wide a day out and ~5h wide inside four
  hours, so a single ticking number would claim precision the model does not have. The
  median sits in the `title`. Backed by a committed calibration table
  (`11-emit-attack-model.mjs` → `attackModel.mjs`) and a total pure `attackForecast()` that
  degrades to `{ mode: 'hidden' }` on stalled fronts, running assaults, or missing data.

### Changed

- **`/docs/predict` § Attacks rewritten — a published finding was wrong.** The report
  claimed attacks fire at ~90–98% liberation, with a p25/p50/p75 "trigger band". That was an
  artifact of this project's own sampling rate: `h1_status` runs at ~1 bucket/day for 156 of
  160 seasons, and a hard threshold read through a lagging sensor smears downward into
  exactly that spread. **Attacks fire within minutes of `points == points_max`, exactly.**
  Median liberation at attack start by age of the reading: 94.28% (<24h) → 100.00% (<15min).
  Corrected explicitly rather than silently replaced, including the page's own "not 'all ten
  captured and then it starts'" claim, which was backwards.
- **Defend figures refreshed** after a harness fix (below). Headline baseline 0.753 → 0.789,
  state-conditional 0.644 → 0.675, KM-corrected 0.648 → 0.679, season-pace 0.787 → 0.825. No
  verdict changed; the season-pace row's verdict is corrected to NOT USEFULLY PREDICTABLE,
  which is what its interval now says.
- **`.sector-card-meta` wraps.** The assault span needs `white-space: nowrap`, which makes it
  incompressible; measured against the running app, with a pace indicator also in the row it
  overflowed by 25px at a 300px card and 65px at 260px.

### Fixed

- **`forwardRecurrenceMedian` ignored `momentFilter`.** The constant baseline was fit over
  the unfiltered season span while the model was scored on filtered moments, so every
  `momentFilter` configuration's skill ratio was partly measuring the filter rather than the
  model.
- **Backtest reliability gaps.** The gate's calibration leg pools every moment, so a model
  can pass it while being miscalibrated in every stratum with the errors cancelling. Added a
  by-decile reliability table (which immediately caught an anchoring bug in the attack ETA),
  horizon-clamp rates (a sharpness PASS can otherwise be an artifact of quantiles truncating
  at the horizon), and per-moment records so callers can compute alert-quality metrics.

## 0.73.1

### Changed

- **Next-wave card redesigned and relocated** (follow-up to 0.73.0, per owner review): now
  rendered in the same `sector-card` skeleton as the faction cards (Super Earth icon +
  "Predicted Wave" header, `LIKELIHOOD_WINDOW` label row with RUNNING LONG / IMMINENT state,
  band bar with the window range in the stat slot, within-24h/48h sureties as the meta row,
  ⓘ docs link) and moved out of the Season section into the **top of the event log under a
  "FUTURE" day-group** — the log now reads future → today → history. `EventLog` gains an
  optional `futureSlot` prop (homepage-only; archives unchanged); placement follows the sort
  order (top when newest-first, bottom when oldest-first).

## 0.73.0

### Added

- **Next-wave likelihood card on the dashboard** (`NextWaveCard`): a faction-neutral
  band-not-countdown forecast for the next defend wave — "likely in 14–32h · 63%
  within 24h" — computed from a committed state×elapsed quantile table
  (`scripts/analysis/08-emit-wave-model.mjs`, the #472 attempt-3 STATE-KM model fit on
  full history, with a reliability self-check that refuses to emit miscalibrated
  probabilities). Hidden while a wave runs; IMMINENT badge at ≥51% within 24h;
  RUNNING LONG badge + explainer during the homeworld-assault window (maxSC==9).
  Updates on the existing 10s live poll; no API or DB changes.

## 0.72.0

### Added

- **Third defend-prediction attempt: the homeworld-assault window** (#472). A second covariate
  sweep (`scripts/analysis/06-train-covariates.mjs`) tests eight pre-declared covariates against
  train-start lulls with the same-season placebo machinery the handoff called for — every test is
  a within-season label permutation plus a phase-stratified variant, with a degenerate-control
  guard. Clock features on train starts, previous-train faction, and prevRegion==9 are null; no
  hard cooldown floor exists. Three observable covariates survive at p=0.0005: `maxSC==9` at lull
  start (+20.3h — some faction one sector from the homeworld assault; lulls run ~55h vs ~35h),
  attack active (−11.5h), and prevRegion==10 (+10.1h). A designated SC9-vs-SC10 check rules out a
  season-phase confound (SC10 is later yet reverts to baseline).
- **State-conditional train-start model** (`scripts/analysis/07-train-state-model.mjs`): kNN on
  elapsed within the observable moment state (ATTACK > SC9 > SC10 > NORMAL) through the existing
  `walkForward` harness, with a declared Kaplan-Meier censoring fix (v1 kept in the output). Best
  configuration: skill 0.648 [0.622, 0.674] vs the previous best 0.753 [0.732, 0.773], calibration
  PASS, sharpness PASS (20.4h band vs 22.4h marginal — the first model to pass that leg). The
  pre-registered ship bar (skill CI upper bound ≤ 0.6) is still missed: **verdict INCONCLUSIVE,
  no countdown ships.** Typical error 7.8h on a ~44h cycle.

### Changed

- **`/docs/predict` updated with the third attempt**: the assault-window finding surfaced as the
  one map-visible conditioning fact, the second covariate sweep table (same-season placebos built
  in), the state-model gate table, and the "no automated same-season placebo" caveat rewritten —
  that gap is closed for the new sweep, remaining only for the historical 01/05 scripts. Findings
  doc gains § Attempt 3; `scripts/README.md` documents 05–07 (05 was previously missing).

## 0.71.2

### Added

- **Handoff prompt for further defend-prediction attempts**
  (`docs/superpowers/specs/2026-07-28-defend-prediction-handoff.md`). Self-contained brief for a
  fresh session: the established rules, every variable already rejected, the pre-registered bar,
  and the five control-design traps. Front-loads the traps because all four false positives this
  investigation produced came from control construction rather than modelling. Names the most
  obvious untried angle: hour-of-day and weekend effects were measured on all 5,091 defends, 61%
  of which are mechanical follow-ups inheriting their start time — never on train starts alone.

## 0.71.1

### Changed

- **`/docs/predict` restructured around the two event types** — "Can we predict events?", then
  Attacks, then Defends, with the statistics moved into collapsed in-depth sections. All measured
  numbers preserved and re-run against fresh data (5,091 defends).

    Two claims were corrected against measurement rather than published as stated: attacks fire at
    **90–100% liberation** (sectors 1–9 captured, 10 in progress — 89.3% at ≥90%), not once all ten
    are captured; and a defend train ending because the war ended is the **minority** case — the last
    defend of a season was a failure in only 49 of 160 seasons (30.6%). The new
    different-faction overlap count (955 defend×attack pairs) confirms the no-concurrent-attack rule
    is per-faction, not global.

    The attack-forecasting question is answered as sound-but-unmeasured: the trigger is a known
    threshold and liberation rate is computable for ~99.6% of moments, so extrapolation is the right
    approach — but no forecast was built and no accuracy figure exists.

## 0.71.0

### Added

- **`/docs/predict` — full defend-predictability report.** Publishes the #472
  next-event-timing investigation as a docs page: an ELI14 explainer (trains vs.
  a timetable, the Seattle/Cairo control-group analogy), the mechanics
  discovered (97.1%/0.1% train continuation, zero overlapping same-faction
  defends, zero same-faction defend/attack overlap, attacks gated on a 9-of-10
  sector threshold), the full regularity/prediction-accuracy numbers (headline:
  9.1h median error vs. a 12.1h constant baseline on a ~44h cycle, skill ratio
  0.753 [0.732, 0.773], calibration PASS, sharpness FAIL — verdict
  INCONCLUSIVE, no countdown ships), and every tested-and-rejected variable
  from both the trigger hunt and the covariate sweep. Two Recharts
  visualizations (`DefendRegularityChart`, `LullByTrainLengthChart`) carry
  hardcoded, script-sourced quartile data. All figures re-verified against a
  fresh run of `01-trigger-hunt.mjs`, `02-baseline.mjs`, `04-train-baseline.mjs`,
  and `05-defend-covariates.mjs` at time of writing, plus two ad-hoc queries
  (not committed) confirming the zero-overlap invariants and the exact
  train-continuation counts. Documents the `libVelocity1d`/`libVelocity3d`
  rejection as a cross-season control-design artifact — caught only when a
  reviewer re-ran the test by hand with same-season controls, not by the
  committed scripts.

## 0.70.1

### Changed

- **Defend train labelling is now scoped per `(season, enemy)`** and a covariate sweep was
  added (`scripts/analysis/05-defend-covariates.mjs`). A defend continues its train only if
  the preceding defend _of the same faction_ ended within 600s. 1,976 → 1,977 train starts
  (one cross-faction pair); continuation-after-failure 96.9% → 97.1%. The `04-train-baseline`
  headline figures are unchanged (skill 0.753 [0.732, 0.773], 9.1h, calibration PASS).

    The sweep tested seven previously-untested covariates. **Adversarial review rejected all
    four apparent positives**, and the raw effect sizes must not be quoted without their
    decomposition — see the review notes before citing any of it. Two genuinely mechanical
    facts did fall out: across all 5,088 defends, two defends _never_ run concurrently
    (0 overlapping pairs), and a defend never runs while its own faction has an attack up.

## 0.70.0

### Added

- **Defend train-start analysis, correcting the v0.69.0 defend verdict ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  v0.69.0's defend predictor was measured against a mis-specified target:
  all 4,928 defend-to-defend gaps, a bimodal series dominated by ~2.5h
  mechanical chain gaps. Measured directly this time: a defend train
  continues iff the previous defend in it was FAILED (96.9% vs 0.1% after a
  success) — a game mechanic, not a statistical tendency — so 61.2% of
  defend events are mechanical follow-ups and only the 1,976 train starts
  are forecasting targets (train-start gaps CV 0.45 vs the pooled series'
  1.32).

    Retrained and re-evaluated on the corrected target: skill ratio 0.753
    (95% CI [0.732, 0.773], effective N 1461), median absolute error 9.1h
    vs a constant baseline's 12.1h. Calibration now PASSES (it FAILED
    against the old target); sharpness (23.1h) is still not narrower than
    the train-start gap IQR (22.4h). Verdict unchanged: **INCONCLUSIVE** —
    clears neither the 0.6 ship bar nor the 0.8 dead bar. The trigger hunt
    was re-run restricted to train starts only to rule out dilution
    masking a trigger in the pooled run; it found none (all four
    campaign-state variables still land at "no rule").

    A follow-up test for whether the previous train's length/failure count
    predicts the length of the following lull found no relationship by the
    script's own magnitude threshold (|r| < 0.1, explicitly not a formal
    significance test; lull medians flat at 35.5h-37.9h across every
    `prevTrainLength` stratum, Pearson r = -0.036) — though the
    `prevTrainFailures` stratification has one off-trend point worth noting
    (p50 31.9h at failures=1 vs 38.5h at failures=0). Replaces an earlier
    version of that same test that a reviewer proved was invariant to the
    data (shuffling the input reproduced identical output) and was deleted
    rather than patched.

    Recommendation unchanged: do not ship a countdown. The descriptive
    surface remains "trains continue while you keep losing; once you hold,
    the next wave is usually 28–46h out" — the v0.69.0 lull figures behind
    that band turn out to already be the train-start lull (same n=1,816,
    bit-identical to the corrected measurement), so this correction
    corroborates the band rather than changing it. Full write-up at
    `docs/superpowers/findings/2026-07-27-next-event-timing.md`; the new
    script is `scripts/analysis/04-train-baseline.mjs`, documented in
    `scripts/README.md` under `## analysis/`.

## 0.69.0

### Added

- **Next-event timing forecast investigation, findings recorded ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  The question split into two halves with opposite answers. Attacks are
  mechanically triggered, not a forecasting problem: all 925 target the enemy
  homeworld, 83.6% fire at exactly 9 of 10 sectors captured, and liberation at
  attack start has an IQR of 0.051 against a phase-matched control IQR of
  0.378 (permutation p=0.0005, Bonferroni alpha 0.01 across five variables).
  "When is the next attack" reduces to "when will players capture 9 sectors"
  — a campaign-progress readout, already derivable, not a forecast.

    Defends have no deterministic trigger and campaign state does not drive
    them (all four campaign-state variables land at "no rule", p=1.0000). The
    only variable carrying signal is time since the previous event. 63.1% of
    defends chain within 10 minutes of the previous one ending; given no
    chain, the lull runs p25 27.8h / p50 36.8h / p75 46.4h. A features-free
    empirical residual-life model scores a skill ratio of 0.628–0.770
    depending on configuration — better than a constant baseline, but the
    project's pre-registered decision gate (calibration within ±0.05 at each
    quartile, skill-ratio CI upper bound <= 0.6) is not cleared by either.
    Adding evidence-backed features (cyclic hour-of-day, weekend, capped
    elapsed time) in a logistic hazard model made it worse, not better —
    skill ratios of 1.057–1.464, confirmed genuine rather than a bug by a
    dedicated review that cleared five artifact hypotheses and re-implemented
    the fitter independently.

    Recommendation: do not ship a countdown or an ETA. The honest surface, if
    any, is a progress readout on the attack side ("N of 10 sectors captured")
    and a descriptive band on the defend side ("defends typically chain; when
    they don't, the next one is usually 28–46h out") — explicitly not a
    prediction. Full write-up at
    `docs/superpowers/findings/2026-07-27-next-event-timing.md`; the five
    analysis scripts behind the numbers are documented in `scripts/README.md`
    under `## analysis/`.

## 0.68.0

### Added

- **Staging deploy pipeline to the Raspberry Pi Docker Swarm ([#474](https://github.com/elfensky/helldivers.bot/issues/474)).**
  A `deploy-staging` job (self-hosted runner), a Swarm stack manifest (`deploy/stack.staging.yml`),
  and an Uptime Kuma maintenance-banner script (`.github/scripts/kuma-maintenance.mjs`). The job is
  **dormant** until the repo variable `STAGING_DEPLOY_ENABLED=true`, so it merges safely before the
  cluster exists (it skips instead of hanging for a missing runner). Scaffold is DRAFT/untested until
  a real run — open TODOs in `deploy/README.md`.
- **`*_FILE` environment convention (`hydrateFileSecrets`).** Populates `<KEY>` from a `<KEY>_FILE`
  path before validation, so Docker/Swarm secrets reach the app as files under `/run/secrets/*`
  rather than plaintext env vars (which leak into `docker inspect`, logs, and error reports). A
  directly-set `<KEY>` still wins, so local `.env` is untouched. Unit-tested.

## 0.67.6

### Added

- Roadmap **Track G** ([#474](https://github.com/elfensky/helldivers.bot/issues/474)): staging
  deploy of the app to the homelab Raspberry Pi Docker Swarm, gated on the cluster + a
  self-hosted runner being up. The pipeline scaffold and the `*_FILE` Swarm-secrets bridge
  live on `feature/deploy-rpi-staging`.

## 0.67.5

### Changed

- **Docker images are now built multi-arch (`linux/amd64` + `linux/arm64`).**
  Both the staging (`develop`) and release (tag) workflows set up QEMU and build
  the app and migrate images for arm64 as well, so they run on the Raspberry Pi
  swarm nodes and not just amd64 hosts. arm64 is cross-built under emulation; if
  the `next build` step proves too slow, the follow-up is native arm64 runners
  (`ubuntu-24.04-arm`, free for this public repo).

## 0.67.4

### Changed

- **Design-debate corrections to the #472 plan ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  A blinded four-model review endorsed the approach and rejected the
  instrumentation. Seven corrections, all load-bearing:

    The one that mattered most — `playerPercentileInSeason` ranked each event
    against its **whole** season including future events, then fed that to the
    model. The walk-forward leakage assert only compares season numbers, so the
    leak passed it cleanly and would have made Phase 3 "beat" Phase 2 on
    information it could never have at prediction time. It now uses an expanding
    within-season window, with a self-check that recomputes causally and fails on
    mismatch.

    Also: censored moments are scored one-sided rather than dropped (dropping
    removed 14.9% of attack moments and 8.5% of defend — structurally the longest
    waits); the constant baseline is the median forward-recurrence wait rather
    than the median gap (54.5h vs 46.8h, ~12% skill inflation); `effectiveN` and a
    season block-bootstrap CI are reported, since 18,810 moments come from only
    774 real intervals; the Phase 1 gate gained a permutation test with Bonferroni
    across five variables, because one uncorrected fluke would have halted the
    whole investigation; gaps are scoped by `(type, enemy)`; and the defend
    estimand splits into P(chain) and conditional lull length.

    Both self-checks were assembled from the plan and executed before merging.
    Doing so caught a vacuous assertion: every synthetic timestamp in the harness
    fixture is even, so a `t % 2` moment filter excluded nothing and the test
    passed while proving nothing.

## 0.67.3

### Added

- **Implementation plan for the next-event timing forecast ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  `docs/superpowers/plans/2026-07-27-next-event-timing-forecast.md` — seven tasks
  with runnable code for a shared loader, a walk-forward backtest harness, the
  trigger hunt, the renewal baseline, and the feature hazard model.

    Task 3 is a decision gate rather than code: if the trigger hunt shows attacks
    fire on a campaign-state rule, the modelling tasks are never written. The
    harness carries one assert that matters more than the rest — no training row
    may come from a season at or after the test season, since leakage there
    produces beautiful, wrong numbers.

## 0.67.2

### Added

- **Design spec for the next-event timing forecast ([#472](https://github.com/elfensky/helldivers.bot/issues/472)).**
  `docs/superpowers/specs/2026-07-27-next-event-timing-forecast-design.md` records
  what the event log can actually support before any modelling starts: 6,013 events
  across all 160 seasons, but `h1_status` runs at ~1 bucket/day for 156 of them, so
  only 11 of 925 attacks have more than one status reading in the preceding 24h. A
  fine-grained "faction progress speed" feature therefore does not exist historically.

    The plan leads with a trigger hunt rather than a model — if HD1 fires attacks at a
    liberation threshold, it is a rule and there is nothing to forecast. A
    renewal-hazard baseline follows as the yardstick, and features only if the cheap
    rungs measurably miss. The decision gate (calibration, sharpness, skill ratio) is
    written down before the numbers exist, so "not usefully predictable" stays an
    acceptable outcome.

- `docs/roadmap.md` entry tracking [#471](https://github.com/elfensky/helldivers.bot/issues/471)
  under Track E. (Merged in `8c63b02`, which named v0.67.2 in its message without
  bumping the version — recorded here under the number it claimed.)

## 0.67.1

### Added

- **`docs/roadmap.md` — execution order for the 43 open issues.** Issues already
  said _what_; nothing said _when_, or how to slice a milestone into sessions
  that fit one context window. Each entry now carries a prep level (none → plan
  → brainstorm → spec refresh), a branch strategy, and its blockers, so a fresh
  session can pick up the next item without re-deriving the ordering. CLAUDE.md
  § Task Tracking points at it.

    Writing it surfaced three things worth recording: `develop` is several versions
    ahead of the last tag on `main`, so finished work isn't deployed; the Archive
    Analytics Phase B/C/D issues are specced against `h1_live_snapshot` /
    `h1_snapshot` / `h1_event_snapshot`, tables dropped in the schema
    normalization, making every field mapping in them wrong; and two issues look
    already-implemented (#274 war narrative, #157 intro-order — the event-log half)
    while #269 and #462 overlap.

## 0.67.0

### Fixed

- **Four real bugs could ship without failing a single test.** Mutation testing
  the suite — injecting realistic bugs and checking whether anything went red —
  found four that survived all 1,619 tests: `computeLiveMap` computing the map
  from unfiltered events (the drift CLAUDE.md marks Critical), every sector
  path geometry replaced by a stub, the attack percentage losing its `* 100`,
  and the `ProgressExplainer` buffer moving from 0.1 to 0.5. The root causes
  were a self-referential assertion (`expect(mapState).toEqual(computeMapState(...))`,
  where the expected value is produced by the code under test), a fixture whose
  event ordering made the leak a no-op, sliders that were rendered but never
  moved, and geometry assertions satisfied by `"M0 0"`. All four now fail on
  injection; the suite is re-verified at **17 mutations, 17 killed**.
- **The smoke suite reported success when it tested nothing.** `describe.runIf`
  meant an unreachable server produced 12 skipped tests and exit code 0 — and
  no workflow invoked it in the first place. It now fails loudly by default,
  with `SMOKE_ALLOW_SKIP=1` as an explicit local opt-out.

### Added

- **Handler tests for the entire public v1 API**, which previously had none —
  only its pure projections were covered. The auth gate, rate-limit group
  selection, parameter validation, backfill-and-retry, ETag/304 and cache tiers
  across `/status`, `/stats`, `/map` and `/season` are now pinned, along with
  `authGuards` (`requireAdmin` was mocked by all three of its consumers and
  tested by none) and the previously untested `cursor` codec.
- **A composed ingest test** (`ingestInvariants.test.mjs`) that mocks only the
  fetch layer and the database, leaving the season resolver, both cross-season
  guards and the bucket arithmetic real — so the invariants are verified as a
  chain rather than as five sealed units.
- **Schema-scoped HD1 wire fixtures** (`@test-utils/hd1.mjs`). Deliberately not
  unified: the two endpoints' event schemas differ in opposite directions
  (`region` required in one, forbidden on attack in the other), and a superset
  factory was measured to let a real schema regression through, because Zod
  strips unknown keys.
- **A test pinning `role: { input: false }`** in `src/auth.js` — the single line
  preventing a client from submitting `role: 'admin'` at sign-up — plus the
  `BETTER_AUTH_SECRET`-absent branch and the trusted-provider list, so adding an
  unverified provider trips a test rather than shipping silently.

### Changed

- **CI boots the app on every PR, instead of only proving it compiles.** `ci.yml`
  gained a Postgres service, migrate + offline seed, and a standalone boot of the
  build it already produced — then runs the smoke suite against it. Roughly +2
  minutes, because it reuses that build rather than rebuilding container images.
  `main-pr-docker-smoke.yml` stays as a separate release gate answering a
  different question: whether the _shipping artifact_ works. One caveat found
  while verifying: the cron worker polls the HD1 API immediately on boot and
  writes live rows, which would drift the seeded database mid-run, so CI pins the
  HD1 host to `0.0.0.0` — the gate asserts nothing about upstream reachability.
- **The smoke suite covers the public v1 API** (12 → 22 tests), asserting the
  differentiated cache tiers, per-group rate-limit headers, and the ETag/304
  round-trip — regressions that are invisible to unit tests because a wrong
  `Cache-Control` breaks nothing, it just serves stale war data. Gated on a
  deterministic key seeded from its sha-256 digest, present only when `SEED_TEST_API_KEY_HASH` is set;
  these assertions skip cleanly without it.
- **The suite is order-independent.** It passed in file order but failed under
  `--sequence.shuffle` — and `shuffle` reorders tests _within_ a file, which is
  where all the rot was. Three leaks: the global `beforeEach` used
  `vi.clearAllMocks()`, which wipes call history but leaves implementations set
  by `mockResolvedValue` in place, so the documented "logged-out by default"
  session mock only held until the first test logged a user in (both
  `returns auth error when no session` tests passed purely on file order); a
  `document.hidden` override shadowed the prototype getter and was never removed,
  leaving every later test in that file believing the tab was hidden; and a
  `next/dynamic` chart was asserted synchronously, passing only when an earlier
  test had already warmed React's lazy cache. Now green across seeds 42, 7, 11,
  777, 2024 and 31337, and under unseeded shuffle.
- **The unit test tree mirrors the source tree again**, so "does X have a test?"
  is answerable by path. It had drifted into three homes for `src/app/api/`, two
  for `src/db/queries/`, two for `src/shared/utils/format/`, a stale `unit/utils/`
  prefix, two misnamed worker tests, and four tests filed under the wrong feature
  entirely. 57 renames put every test next to the module it covers, and
  `unit/_meta/mirrorTree.test.mjs` now enforces it — a filesystem rule needing no
  import parsing and **no allowlist**, with three name-based escape hatches
  (`_meta/`, `.contract.`, `.integration.`) documented in CLAUDE.md. The drift was
  not cosmetic: `shared/utils/utils.test.mjs` existed because someone checked the
  obvious path, found nothing, and wrote a second formatNumber suite — its unique
  BigInt/NaN/Infinity/0 cases are folded into the real one rather than dropped.

- **Coverage stops flattering itself.** The exclude list waived ~4,000 LOC on the
  grounds that it was "tested via e2e/smoke" — a suite that never ran in CI and
  that, having no coverage instrumentation, could not have produced coverage
  data in any case. Four entries named files deleted long ago, and two excluded
  files were already tested at 100%, so their earned coverage was being
  discarded. The list is now generated code and tests only.
- **The main-PR smoke job runs the smoke suite** instead of a single
  `curl | grep` health check, reusing the compose stack it already builds.
- **Route modules import cache helpers from `config/policy.mjs`** (env-free)
  rather than `config/server.mjs`, which validates environment at import time.
  Behaviourally identical — `server.mjs` was a bare re-export — and it removes a
  class of import-time friction. One convention across all five routes.
- **One db-mocking convention.** Six local `vi.mock('@/db/db')` blocks that
  shadowed the global mock with strict subsets are gone, `api_rate_limit` was
  added to the global mock, and the dead `createMockModel`/`createMockSession`
  helpers (a byte-identical copy of a private setup helper, and an unused one)
  are deleted.
- Corrected `CLAUDE.md` and `README.md`, which both described Playwright smoke
  tests that do not exist, and `CLAUDE.md`'s `bucketing.mjs` path and
  `BUCKET_SIZE` default (900s, not one hour).

## 0.66.2

### Fixed

- **The v1 pagination contract no longer contradicts itself.**
  `/api/v1/h1/status?mode=latest` accepted `limit`, never applied it, and echoed
  it back — so `?limit=1` returned `page.limit: 1` alongside three items.
  `cursor`, `order`, `from` and `to` are likewise parsed then unused in that
  mode. Corrected in the **documentation, not the response**: both code fixes
  would be breaking (slicing silently drops factions for `limit < 3`; removing
  the echo deletes a required field), and `/docs/api` promises field names and
  semantics never change within v1. `limit`/`cursor`/`order` now state they are
  paginated-mode concepts, matching how `from`/`to` were already qualified.
  **Zero response bytes change.**

### Added

- **A v1 contract test** covering what the per-endpoint projection tests
  structurally cannot: the behavioural invariant `items.length <= page.limit` on
  the genuinely paginated projections (the offending response validates fine
  against the shape schema, which is why nothing caught this), and that the
  published OpenAPI document still describes the fields the projections emit.
  Verified to have teeth — renaming `updatedAt` to `updated_at` fails the suite.

### Changed

- The map `fronts` object uses per-front `.optional()` instead of `.partial()`.
  `.partial()` made all four optional at once, so no contract test could
  distinguish "narrowed by `?enemy=`" from "dropped by a regression".

### Notes

- Left for a future v2: `?mode=latest&cursor=garbage` returns `200` while the
  same token returns `400` under `mode=history`. Correcting it would break
  requests that succeed today.

## 0.66.1

### Fixed

- **A partially imported season is no longer served as if complete.**
  `updateSeason` creates the `h1_season` row unstamped and only sets
  `last_updated` once every write has landed, but only the "current season" read
  gated on that stamp — explicit-season reads used a bare `where: { season }`. So
  when an import died partway through, the triggering request got one 500 and
  every request afterwards received a silently events-incomplete archive with no
  signal. `/api/v1/h1/status?mode=history` also carries a 1h/24h cache policy, so
  a partial result was cacheable downstream. All four readers
  (`getCampaign`, `reconstructSnapshots`, `getStatusHistory`, `getStats`) now
  gate both branches; an unstamped season reads as a miss so `getCampaignOrSeed`
  re-seeds and surfaces the real error. Healthy seasons are unaffected —
  `upsertSeason` only writes `last_updated` when `confirm` is true, so
  re-imports never clear an existing stamp.
- **Non-fatal ingest warnings now reach GlitchTip.** A throw on the update path
  reaches four channels (GlitchTip, the `worker_heartbeat` error the admin
  dashboard renders, a 500 that reddens the uptime monitor, `console.error`); a
  warning reached only `console.warn`, and the response body carrying warnings is
  `postMessage`'d into the void by the cron worker. Every warning the ingest
  layer already emitted was therefore invisible, so a degrading import stayed
  silent until it became a failing one.

### Notes

- Deliberately **not** the inverse fix: softening `season.mjs`'s event-loop
  throws into warnings would have removed three alerting channels rather than
  adding any. The throw is correct; the reads were the problem.

## 0.66.0

### Fixed

- **Every season's archive narrative was missing a faction-arrival beat.** HD1's
  `introduction_order` is a **0-based** reveal rank indexed by enemy id (`0` =
  the faction the war started against, `1`/`2` = mid-war arrivals, `255` = never
  introduced). `buildWarNarrative` was written under a 1-based assumption, so its
  two guards compounded — `<= 0` correctly dropped rank 0, then
  `firstIntroducedEnemy` dropped rank 1 as well, silently removing a faction that
  genuinely arrived mid-war. Measured across all 160 seasons: 160/160 narratives
  gain exactly one beat, none lose any (Cyborgs 59, Bugs 58, Illuminate 43).
  This **completes** the fix landed for `buildIntroMarkers` in v0.65.4 — that
  release corrected one reader of the encoding; this is the other.
- **Arrival beats are now clamped to the end of the chronicle.** They were
  anchored at the raw `first_seen` while the highlight beats have been clamped
  since v0.65.2, so a faction appearing after the last resolved event sorted
  _after_ the closing outcome beat and rendered as the final line of the page.
  Season 124 already showed this; the current war (160) would have. Both are
  corrected and the 160-season diff shows no other beat reordered.

### Changed

- **`introduction_order` is now documented and validated.** The encoding lived
  nowhere authoritative, which is how it came to be misread twice in three days.
  `prisma/schema.prisma` documents it on the column; `/docs/database` no longer
  describes it as "planet introduction positions"; and both Zod validators are
  tightened from a permissive `z.array(z.number())` to
  `z.array(z.number().int().min(0).max(255)).length(3)`, matching the
  `.length(3)` convention already used for `campaign_status` and `statistics`.
  Verified against all 156 seed payloads — 156/156 validate, and the only shapes
  present are the six permutations of `{0,1,2}`.

### Notes

- Five test fixtures encoded the wrong convention (`[1,0,2]`, `[1,2,3]`,
  `[1,0,0]`) — none is a valid permutation of `{0,1,2}` and no such row exists in
  the database, which is why the suite stayed green through the bug. Corrected,
  plus two new tests covering the late-arrival clamp.

## 0.65.8

### Fixed

- **Event reads are now explicitly ordered.** Five `h1_event` queries had no
  `ORDER BY`, so Postgres made no ordering promise while ~10 consumers read the
  resulting arrays positionally. Visible consequences: the OG image's status
  line could flip between renders when two fronts were live, and the public
  `/api/v1/h1/map` shipped `activeEvents[]` in undefined order despite
  `/docs/api` promising a stable v1 contract. `getCampaign`, `rebroadcast` (×2),
  `getCrossSeasonStats` and `pushNotifier` now order by
  `start_time asc, event_id asc`.

### Changed

- **`findAllCascades` sorts on a total order.** `end_time` alone is partial; on
  a tie, cascade membership depended on the caller's array order, so `/stats`
  and `/archives` could compute different cascade sets and silently break the
  deep link between them. Adds an `event_id` tiebreak — safe because the list is
  pre-filtered to `defend` and `event_id` is unique per type. Hardening only:
  real data has 0 ties across 3,224 failed defends, and the tiebreak changes 0
  cascades across all 160 seasons.
- **`getWarOutcome.mjs` moved to `src/shared/utils/game/`.**
  `db/queries/getCrossSeasonStats.mjs` imported it from `features/` — the only
  `db/ → features/` import in the repo. `getCascadeLeaderboard` already
  establishes `db/ → shared/` as the sanctioned direction. Test file relocated
  to match, and the already-stale doc path corrected.
- `update/season.mjs` passes the snapshot item straight to `upsertStatus`
  (which plucks the three fields explicitly and never spreads), matching how
  `update/status.mjs` already calls it.

### Notes

- Removed a dead `getWarOutcome` mock from `ArchivesClient.test.jsx`:
  `ArchivesClient` no longer imports it and `ArchiveStats` is stubbed, so the
  `mockReturnValue` calls falsely implied the war outcome affected that render.

## 0.65.7

### Security

- **`npm audit` now reports 0 vulnerabilities.** Migrating to ESLint 10
  (below) lets `brace-expansion` move to the patched `5.0.8`, clearing the
  last 6 dev-only advisory hits from the ESLint tool chain.

### Changed

- **Replaced `eslint-plugin-react` with `@eslint-react/eslint-plugin`** and
  bumped ESLint to 10. `eslint-plugin-react` had no ESLint 10 support;
  `@eslint-react` is actively maintained and framework-agnostic. `react-hooks`,
  `react-compiler`, and `@next/eslint-plugin-next` are unchanged.
- Fixed 2 dead-assignment bugs surfaced by ESLint 10's `no-useless-assignment`
  (unused `check` initializer in the rebroadcast route, trailing `seq++` in
  `buildWarNarrative`).

### Notes

- `@eslint-react` leaves 31 non-blocking warnings (new lint opinions —
  `no-context-provider`, `no-array-index-key`, React-19 context idioms, etc.).
  These don't fail lint and are left for incremental triage. The four
  `web-api-no-leaked-interval` and two `exhaustive-deps` warnings were
  investigated and disabled as false positives / duplicates of
  `react-hooks/exhaustive-deps`.

## 0.65.6

### Changed

- Pinned `@types/node` back to `^24` to match the active-LTS runtime
  (mise pins `node@24`); the previous `26` bump was ahead of the runtime.

## 0.65.5

### Security

- **Resolved all shipped-code vulnerabilities** flagged by Dependabot/`npm audit`:
  Next.js 16.2.9→16.2.11 (middleware bypass, Server Action SSRF/DoS, cache
  confusion, image-optimization DoS, internal endpoint disclosure), plus
  overrides forcing patched `postcss` (path traversal), `sharp` (libvips CVEs),
  `valibot`, `find-my-way` (HTTP/2 DoS), and `brace-expansion` (DoS).
- `npm audit` still reports 6 highs in the **dev-only ESLint tool chain**
  (`brace-expansion`/`minimatch` under `eslint`). These are not shipped to
  production, and the installed `brace-expansion@2.1.2` already contains the
  DoS fix — npm's over-broad `<=5.0.7` advisory range flags it anyway. The
  clean resolution is ESLint 10, held back below.

### Changed

- **Dependency updates** to latest in-range: `@prisma/*` 7.8→7.9,
  `@sentry/nextjs` 10.60→10.68, `react`/`react-dom` 19.2.7→19.2.8,
  `better-auth` 1.6.20→1.6.25, `tailwindcss` 4.3.1→4.3.3, `recharts` 3.9→3.10,
  `mermaid`, `vitest`, `prettier`, `serwist`, and others.
- **Major bumps:** `@types/node` 24→26, `@testing-library/jest-dom` 6→7,
  `@asteasolutions/zod-to-openapi` 8→9.
- `jsconfig.json` `lib` es2022→es2024 — the codebase uses `Map.groupBy`
  (Node 24 supports it); the ambient types shifted in the update, so the lib
  is now declared directly.

### Held back

- **TypeScript 6→7**: surfaced 214 new type errors across 35 files (loose
  `object` JSDoc property access under stricter TS 7 inference). Incompatible
  with the codebase's intentional `noImplicitAny: false` style; pinned at ^6.
- **ESLint 9→10**: `eslint-plugin-react@7.37.5` (latest) peers only up to
  eslint `^9.7`; pinned at ^9 until the plugin supports 10.

## 0.65.4

### Fixed

- **Missing "Day 1" marker in the event log.** HD1's `introduction_order` is
  0-based — `0` is the faction the war _started_ against, `255` means "not yet
  introduced" — but `buildIntroMarkers` filtered `<= 0`, dropping exactly the
  war-start faction. The archives showed "Day 2 … enters the war" / "Day 3 …"
  with no Day 1. The guard now includes order `0` and excludes the `255`
  sentinel (absent factions stay filtered by their null `first_seen`).

### Changed

- The war-start faction now reads **"{faction} declare war"** (Day 1) to
  distinguish it from the later arrivals' "{faction} enter the war".
- The homepage event log now shows the faction intro markers too — previously
  they were archives-only. `buildIntroMarkers` moved to `features/timeline`
  since both callers share it.

## 0.65.3

### Fixed

- **React hydration mismatch (#418) for non-en-US visitors**. `formatNumber`
  grouped thousands with a bare `toLocaleString()`, so values in the 1K–999K
  range rendered per the _runtime_ locale: the server emitted `"3,522"` while a
  ru-RU client re-rendered `"3 522"`. The differing text tripped React error
  #418 on every affected page load (14 events on 0.65.2 in a single day, all
  from non-en-US locales), forcing React to discard and re-render the
  server-rendered tree on the client. The locale is now pinned to `en-US`,
  matching every other formatter in the codebase and the server default.

- **Post-deploy chunk auto-reload never fired.** Two independent faults, both
  surfaced by ChunkLoadErrors on 0.65.2 from real users on `/archives` and
  `/sign-in`:
    - The detection predicate tested `err.message || err.name`, but a real
      `ChunkLoadError` carries the identifying token in `name` while `message`
      is `"Failed to load chunk X from module Y"`. The non-empty message
      short-circuited away the only field that matched, so nothing was ever
      recognized as a chunk error. Detection now tests name and message
      together, and the Turbopack message wording is matched explicitly.
    - The only trigger was an `unhandledrejection` listener, but Next/React
      catch these internally and report them as _handled_ exceptions — every
      observed production ChunkLoadError arrived that way. A Sentry
      `beforeSend` hook now covers every reporting path; the listener is kept
      as the fallback for when no DSN is configured.
      Detection is extracted to `src/shared/utils/isChunkError.mjs` with unit
      coverage pinned to the verbatim production error shape.

## 0.65.2

### Fixed

- **Browser-side GlitchTip reporting in Docker deploys**. `NEXT_PUBLIC_SENTRY_DSN`
  is inlined into the client bundle at build time, but the Docker build never
  received it, so shipped images ran `Sentry.init({ dsn: undefined })` on the
  client — no browser error or trace capture (server-side capture via
  `SENTRY_DSN` was unaffected). Now passed as a build arg in the Dockerfile and
  both release/staging workflows. The DSN is public (it ships to browsers), so
  it is a plain GitHub Actions variable, not a secret. Requires adding the
  `NEXT_PUBLIC_SENTRY_DSN` repo variable in CI.

## 0.65.1

### Changed

- **Archives architecture deepening** (2026-07-23 review):
    - New `warClock` module (`src/shared/utils/game/warClock.mjs`) — single home for war-start-relative day math (`dayOf`, `dayFraction`, `resolveWarStart`, `warDaySpan`); six duplicated formulas across the archives builders/charts/queries now share it.
    - War Narrative beat generators (`conquestBeats`, `playerBeats`, `numbersBeat`) folded into `buildWarNarrative` as internal implementation; highlight-beat behavior now tested through the public interface, including the previously untested lastTime clamp.
    - New `getCampaignOrSeed` resolver deduplicates the season read-or-seed dance shared by `/archives` and `/api/h1/campaign` (previously two drifting hand-written copies; the page's copy was untested).

### Fixed

- Late highlight beats (telemetry buckets past the final event) now clamp their **day label** to the last war day, not just their sort position.
- `EventLog`'s `selectedEventKey` prop is correctly typed `string | null` (drops a caller-side cast workaround).
- Removed stale doc references to the deleted `buildEngagementSeries` module; corrected the snapshot-shape doc on the conquest beats (no null holes through `getCampaign`).
- Local unit-test runs no longer fail with "localStorage is undefined" under Node 22+ — vitest setup replaces Node's experimental Web Storage stub with a working in-memory Storage for jsdom-environment tests.

## 0.65.0

### Features

- **War Narrative enrichment on `/archives`**. The Ministry chronicle now varies
  its phrasing per season (deterministic, SSR-stable), and gains player
  surge/collapse beats, offensive conquest milestones (a faction driven to its
  homeworld's gates / the first homeworld to fall), and a "war by the numbers"
  telemetry beat. Computed server-side, so `getCampaign` and the rest of the app
  are untouched; telemetry-backed beats appear only for seasons with telemetry.

## 0.64.1

### Changed

- **War Narrative toggle** on `/archives` now uses the shared primary `Button`
  (yellow border, square) reading **SHOW** when collapsed / **HIDE** when
  expanded, replacing the chevron `<details>` affordance. The Ministry subtitle
  stays visible in both states; only the beats list toggles.

## 0.64.0

### Features

- **Faction introduction markers in the `/archives` Event Log** (#157).
  Synthetic "a faction enters the war" dividers (`buildIntroMarkers`) are
  interleaved chronologically among the event rows, faction-colored via the
  `--color-faction-*` tokens. Archives-only and opt-in: `EventLog` takes a new
  `introMarkers` prop defaulting to `[]`, so the homepage's output is unchanged.

## 0.63.0

### Features

- **Players Over Time on `/archives`** replaces the Player Engagement scatter.
  A single per-war line plots player count over time, driven by the existing
  faction toggle: `global` shows the total-players line and dots for every
  event; a faction shows that faction's line and only its events. Event dots sit
  on the line at each event's start day with a `type · region · faction ·
outcome` tooltip. `getCampaign` gains an additive `playerTimeseries` field
  (per-bucket player counts from `h1_statistic`); the section hides for
  historical seasons that predate telemetry. Chart math lives in the
  unit-tested pure helper `buildPlayerLine`.

## 0.62.0

### Features

- **War Narrative on `/archives`** (#274). A collapsible, in-world chronicle of
  each season's campaign — generated chronologically from event data in the
  Ministry of Truth's propaganda voice. Native `<details>`/`<summary>` (no JS
  toggle state, keyboard-accessible), reusing the `.event-log-section` visual
  language, and hidden when there is no narrative to tell.

## 0.61.0

### Features

- **Cascade deep-linking on `/archives`**. Clicking a cascade card now scrolls
  the event log to that cascade and pins a persistent faction-tinted highlight
  across every one of its events, clearing when you scroll away or pick another
  cascade. The view is shareable via a URL hash (`/archives?season=N#<event>`):
  the highlight rehydrates on direct load and browser back/forward. Scroll
  targeting reads live DOM order, so it stays correct under either log sort.

## 0.60.0

### Features

- **Combat Telemetry on `/stats`** (#178). Three telemetry vizzes fed by the
  sums already carried through `getCrossSeasonStats`: a reusable `RatioTrendChart`
  drives **Friendly Fire Index** (accidentals/kills) and **Accuracy Trend**
  (hits/shots) as cross-season `%` line charts, plus a **Shots per Planet** "big
  number" StatCard. `computeTelemetryStats` filters to telemetry-bearing seasons
  (live-polled wars; historical seasons predate collection) and narrows BigInt
  sums to Number so the result is safe across the server→client boundary. The
  section and each viz hide when no telemetry exists, so it grows as the worker
  records more wars.
- **Player Engagement chart on `/archives`** (#275). A new lazy-loaded
  per-faction scatter of `players_at_start` vs. day-into-war, showing whether the
  community rallied, declined, or surged for the final battles. Hidden when a
  season has no event player data.
- **Closest Calls on `/archives`** (#273). The global archives stats now surface
  the top-3 defend events that came nearest to holding (`points/points_max`
  closest to 1.0 but short), each a danger-accented StatCard with region ·
  faction · % held. Restricted to defend fails — the only events with a clean
  margin signal — and hidden when a war had no genuine nail-biters.

### Fixed

- **Lockfile synced to `0.60.0`** — `package-lock.json` still carried `0.59.1`.
- **`/stats` Combat Telemetry charts deferred via `next/dynamic`** — added
  `RatioTrendChartLoader` so the Recharts bundle stays out of the initial page
  JS, matching the `/archives` chart loaders.
- **`metrics.yml` pinned back to `lowlighter/metrics@v3.34`** — a CI group bump
  had silently moved it to the unreleased `@v4` dev branch (not a release tag).
- **`buildEngagementSeries` hardened and unit-tested** — extracted to its own
  module; the anchor fallback uses `reduce` instead of `Math.min(...spread)` (no
  `RangeError` on large event arrays), and the telemetry ratios guard missing
  BigInt fields with `?? 0n`.

## 0.59.2

### Changed

- **`/sign-in` now has its own page title** (`Sign In | Helldivers Bot`) via a
  `sign-in/layout.jsx`, instead of inheriting the generic site-wide default.
- **Removed the post-login `/dashboard → /profile` redirect hop.** OAuth
  `callbackURL`s now point straight at `/profile`, and the redirect-only
  `/dashboard` route (plus its `robots.txt` disallow) is deleted.

## 0.59.1

### Changed

- **recharts upgraded 3.8.1 → 3.9.0.** 3.9.0 removed the `<Area baseLine>` prop,
  which `ProgressExplainer`'s on-track buffer band used. Reworked the band to
  recharts 3.9's ranged-area form (a `[expected, bufferCeiling]` tuple dataKey)
  plus a separate dashed `<Line>` for the +10% ceiling edge — visual unchanged.

## 0.59.0

### Features

- **OpenAPI coverage for the `/v1` endpoints** (#438). `GET /api/v1/h1/{status,
stats,season,map}` are now registered in the OpenAPI spec with query params,
  typed response schemas, the `{time,code,message,data}` envelope, and the
  401/404/429 + 304 responses — so `/docs/api` documents the real public API.
- **Rebroadcast action reconciliation** (#438). The spec now declares all five
  HD1-API actions; `get_available_entitlements`, `get_leaderboards`, and
  `get_usernames` return an explicit **501 Not Implemented** (Demand-Driven
  Compatibility) instead of a silent 404. Adds `501` to the error envelope.

### Changed

- **Public/internal API boundary.** `/docs/api` (and the OpenAPI spec) now
  document the **public surface only** — the versioned `/api/v1/h1/*` reads,
  `/api/h1/rebroadcast`, and the now-**deprecated** `/api/h1/campaign`. Internal
  plumbing (`/api/h1/live`, `/api/h1/update`, `/api/notifications/subscribe`) is
  excluded from the spec and noted as internal in prose. Deprecated endpoints
  render a badge.
- **Cascade Failures leaderboard requires length ≥4.** `findAllCascades` now
  defaults `minLength` to 4 (was 3) — length-3 runs are too common to be
  noteworthy and made the board noisy. `getCascadeLeaderboard` drops its explicit
  override and uses the new default.

## 0.58.0

### Features

- **Postgres-backed fixed-window rate limiter** (#435). New `api_rate_limit`
  table (migration `add_api_rate_limit`) + `src/shared/utils/api/rateLimit.mjs`:
  one atomic `INSERT … ON CONFLICT DO UPDATE count = count + 1 RETURNING count`
  per limited request, so limits survive restarts and span multiple Node
  processes (no Redis). Config-driven groups (`config/policy.mjs`): `public_read`
  120/min·IP (status latest, map, season), `history_read` 30/min·IP (status
  history, stats), `rebroadcast` 60/min·API-key, `backfill_trigger` 5/min·IP,
  `push` 20/min·IP. Emits `RateLimit-Limit/Remaining/Reset` + `Retry-After`
  (429), reusing the standard error envelope. Fails **open** if the store is
  unreachable. The in-memory limiter on `/api/notifications/subscribe` is
  replaced by this one; the worker purges expired windows hourly.
- **Backfill-on-demand for `/v1` reads.** A missing explicit season on
  `status`/`stats`/`season`/`map` now triggers `updateSeason()` (gated by the
  `backfill_trigger` group) and re-serves, instead of a flat 404 — mirroring
  `/api/h1/campaign` and `/rebroadcast`. The seed carries every season, so this
  is a fallback that rarely fires. `season=current` is never backfilled.

### Refactor

- Pure API-policy lookups (cache tiers + rate-limit groups) moved to
  `src/config/policy.mjs` so they can be imported without tripping
  `config/server.mjs`'s eager env validation; `server.mjs` re-exports them.

## 0.57.1

### Refactor

- **Unify the live map computation** (#437). Add `computeLiveMap(data)` as the
  single source of the "only active events" rule — it returns
  `{ activeEvents, mapState }`. `/api/v1/h1/map` now calls it instead of
  re-implementing the active-events filter inline, so the public map and the
  dashboard map (`/api/h1/live`, via the now-thin `computeLiveMapState` wrapper)
  can no longer drift. `/api/h1/live` also sources its `no-store` header from
  `getCacheControl('live')` for consistency with the other read tiers. No
  response-shape changes; `/live` stays the dashboard's rich internal feed.

## 0.57.0

### Features

- **Tiered `Cache-Control` + ETag** (#436) — `/v1` read endpoints now send cache
  headers from the typed config: `latest` (status `mode=latest`, map),
  `current-season` (`season=current` history/stats/season metadata), and
  `closed-season` (explicit past seasons). History reads (status `mode=history`,
  stats) also carry a strong `ETag` and answer `If-None-Match` with `304`.
  Request `season=current` for live freshness — an explicit current-season
  _number_ is cached as a closed season.

### Changed

- **`/v1` map fronts are now arrays.** Each front (`bugs`/`cyborgs`/`illuminate`/
  `superEarth`) is an `id`-sorted array of region objects
  (`{ id, region, capital, points, pointsMax, percent, status, event }`) instead
  of a region-number-keyed object, so consumers can iterate without depending on
  key order. `id` is the region number (0 for Super Earth's homeworld).
- **`/v1` status `progress` → `percent`.** The status item field is renamed and
  rescaled from a 0–1 ratio to a 0–100 percent, matching the map/dashboard
  convention.
- **`/v1` stats drops `season=all`.** Cross-season totals are served by the
  frontend directly (`getCrossSeasonStats`); `season=all` is now ordinary invalid
  input (400). A dedicated totals endpoint can be added if a real consumer needs
  one.

## 0.56.0

### Features

- **`GET /api/v1/h1/season`** (#31) — key-gated season metadata as an array;
  supports multiple `?season=` params (defaults to `current`). Each entry:
  `{ season, isCurrent, lastUpdated, introductionOrder, pointsMax, seasonDuration }`
  (introduction order as faction slugs, points_max slug-keyed).
- **`GET /api/v1/h1/map`** (#33) — key-gated render-ready galaxy geometry via
  `computeMapState`: `{ season, bucket, events, fronts, activeEvents }` where
  `fronts` is the per-faction map (`bugs`/`cyborgs`/`illuminate`/`superEarth`),
  each with regions 1–10 + homeworld and full render state (name, capital, points,
  percent, status). Params: `season`, `at=latest` (historical `at=<datetime>`
  deferred), `enemy` filter, `events=active|none`. Returns the actual 3-front data
  model rather than the spec's flat `sectors[]`/`homeworld` shape.

## 0.55.0

### Features

- **`GET /api/v1/h1/stats`** — the second public `/v1` endpoint (#30). Key-gated,
  cursor-paginated statistics timeseries over `h1_statistic`, projected to
  `{ bucket, enemy, enemyId, season, missionsWon, missionsLost, kills, deaths,
shots, hits, players }` (BigInt counts → JSON-safe numbers; `bucketSize` sourced
  from the typed config — its first runtime consumer). `season=current|number`;
  `season=all` is deferred (returns a clear 400 until cross-season pagination is
  needed).

### Refactor

- Extract the keyset pagination cursor into `src/shared/utils/api/cursor.mjs`,
  shared by the `/v1` history endpoints (status now re-exports from it).

## 0.54.0

### Features

- **`GET /api/v1/h1/status`** — the first public `/v1` endpoint (#29). Key-gated
  (Bearer API key) human-readable campaign status with two modes: `mode=latest`
  (default) returns the current bucket per faction projected to
  `{ enemy, enemyId, points, pointsMax, progress, players, updatedAt }` (reusing
  the cached `getCampaign` query); `mode=history` returns a cursor-paginated
  timeseries (keyset on `bucket`+`enemy`, opaque base64url cursor) with `limit`
  (default 100, max 500), `order`, `from`/`to`, and `enemy` filters. Zod query
  validation, `{time,code,message,data}` envelope.
- Shared `requireApiKey` guard and `FACTION_SLUG_BY_ID` map underpin the `/v1`
  surface (reused by the remaining `/v1/h1/*` endpoints). Cache headers (#436) and
  rate-limiting (#435) layer on later.

## 0.53.1

### Documentation

- Document the public-API versioning policy and endpoint personalities in
  `/docs/api` (#434): human-readable endpoints live under `/api/v1/h1/*` (the
  version is in the path; the `/v1` contract is additive-only, breaking changes go
  to `/v2`, no header negotiation). Each path's role is spelled out — `/v1/*`
  (key-gated), `/api/h1/rebroadcast` (unversioned, stable HD1 drop-in that sits a
  level above `/v1`), `/api/h1/live` (public BFF over status), `/api/h1/campaign`
  (deprecated), `/api/h1/update` (internal). Authentication blurb updated for `/v1`
  key-gating.

## 0.53.0

### Features

- **Typed server config module** (`src/config/server.mjs`) — the config half of the
  Public API milestone (#204). One Zod schema parses `process.env` once into a frozen,
  typed `config` object: required vars (`POSTGRES_URL`, `UPDATE_KEY`, `UPDATE_INTERVAL`)
  fail fast at boot with a readable message; optional features self-disable via
  presence-as-config. Co-locates the canonical cache tiers and rate-limit groups with
  `getCacheControl(tier)` / `getRateLimitConfig(group)` helpers (consumed by the upcoming
  cache-headers and rate-limiter work).
- **Configurable site origin** — `src/config/site.mjs` exposes `SITE_URL`
  (`NEXT_PUBLIC_SITE_URL` || `https://helldivers.bot`). All hardcoded site-origin
  references (SEO metadata, JSON-LD, sitemap, OG-image branding, Umami hostname) now route
  through it, so self-hosters can deploy under their own domain. Documented in
  `.example.env` and the infrastructure env reference.

### Notes

- `bucketing.mjs` and `initializeEnv.mjs` intentionally keep their existing env reads for
  now (hot-path / boot-critical, well-tested); `config` is the canonical typed source and
  remaining `process.env` reads can migrate incrementally.

## 0.52.9

### Fixes

- **Make the typecheck gate real.** The `jsconfig.json` `include` glob used brace
  expansion (`src/**/*.{js,jsx,mjs}`), which TypeScript's `tsc` silently ignores —
  so `npm run typecheck` was checking almost nothing under `src/` and passed
  trivially in both local and CI. Fixing the glob to explicit patterns makes
  `checkJs` actually cover the codebase, which surfaced 1023 latent errors.

### Changes

- Adopt a pragmatic checkJs policy: `noImplicitAny: false` while keeping
  `strict`/`strictNullChecks`. Typecheck still catches real null bugs and
  type mismatches, but doesn't demand an explicit annotation on every prop/param.
  This narrowed the surfaced set to 249, all of which are now fixed across ~65
  files (JSDoc annotations, null-narrowing, correct object shapes) with no runtime
  behavior change. Notable: `Object.freeze(EVENT_TYPE)` to narrow the
  `'defend'`/`'attack'` literals, `Button` typed for `...rest` DOM passthrough.
- Harden engineering health: `initializeEnv` now requires `AUTH_GOOGLE_ID/SECRET`
  when auth is enabled; `db.js` fails fast on a missing `POSTGRES_URL`;
  `isValidStatus` requires exactly 3 factions; `.example.env` drops the unused
  `POSTGRES_SSL` toggle and documents `PORT`/`DEPLOY_ENV`; `test:e2e` added as a
  smoke-suite alias. New tests cover the db singleton, package scripts,
  `.example.env`, and the typecheck include scope.

## 0.52.8

### Changes

- Drop the GitHub project board from the tracking convention — work is now tracked with
  issues + milestones + labels only (`CLAUDE.md` Task Tracking). The board was unused and
  has been deleted.

## 0.52.7

### Fixes

- Fix the staging GHCR image-cleanup job that failed on every `develop` push:
  `snok/container-retention-policy@v3` rejects the default `GITHUB_TOKEN` and can't
  delete user-account packages, so it now authenticates with a classic-PAT secret
  `GHCR_CLEANUP_TOKEN` (`delete:packages`). Also corrected the stale infrastructure
  docs that claimed production used a (now-removed) `ACCESS_TOKEN`; production uses
  `GITHUB_TOKEN` with `contents: write`.

## 0.52.6

### Security

- Resolve five transitive-dependency advisories via `npm audit fix` (semver-compatible,
  lockfile-only — `package.json` unchanged): `undici` (high, multiple CVEs), `form-data`
  (high, CRLF injection), `dompurify` (moderate, XSS bypasses), `js-yaml` (moderate, DoS),
  and `@babel/core` (low, arbitrary file read). `npm audit` now reports 0 vulnerabilities.

## 0.52.5

### Changes

- Remove dead code surfaced by an over-engineering audit: four uncalled `time.mjs`
  helpers (`formatDate`, `elapsedSeconds`, `elapsedMilliseconds`, `elapsedSeasonTime`)
  and their tests, and unused `451`/`501`/`203` cases in the API response builder.
- Replace the hand-rolled `JSON.parse(JSON.stringify(...))` deep clone in
  `computeMapState` with native `structuredClone`.
- Merge the mirror-image `EventLogSortToggle` and `CascadeLogSortToggle` into a
  single `SortToggle` component.
- Remove five more dead exports surfaced by the over-engineering audit and their
  tests: `addOrdinalSuffix`, `getActiveEvents`, `isDismissedAtStatus`, the registry
  `size()` method, and the `adminGetUserApiKeys` server action. (#427)
- Collapse the `errorResponse`/`successResponse` status `switch` blocks into
  `ERROR_MESSAGES`/`SUCCESS_MESSAGES` lookup maps. (#429)
- Replace the hand-rolled grouping loops in `groupEventsByDay` and
  `groupCascadesBySeason` with native `Map.groupBy`. (#428)
- Dedup `useEventLogSort` and `useCascadeLogSort` onto one generic `useToggleSort`
  hook. (#430)
- Inline `usePreferenceSnapshot` into its only consumer, `PreferenceTracker`. (#431)
- Clear one of two React Compiler skip warnings in `Hijackable` by destructuring the
  cycle hook so `exhaustive-deps` passes; the remaining disable is documented as an
  intentional run-once registration. (#413)
- Add unit tests for three previously-untested pure-logic modules: `computePulseDelays`,
  the `sortOrder` validators, and the `getKillsTrend` DB query. (#404)

## 0.52.4

### Changes

- Bump `eslint-plugin-jsdoc` from 62.9.0 to 63.0.2.
- Bump `hono` from 4.12.18 to 4.12.25.

## 0.52.3

### Changes

- Move the All-Time Records section above Cascade Failures on the stats page.

## 0.52.2

### Fixes

- **Fix image-optimizer 500s (broken avatars/icons; 502s at the edge) caused by Sharp's native binary not loading on the Chainguard runtime.** A latent bug unmasked by the 0.52.1 `.next/cache` permission fix: with the cache now writable, the Next.js image optimizer finally runs far enough to load **Sharp** — and fails. `Dockerfile.app` built on `node:24-alpine` (musl) and stripped Sharp's glibc binaries, but the runtime image `cgr.dev/chainguard/node` is **glibc** (Wolfi), so only `@img/sharp-linuxmusl-x64` shipped into a glibc runtime → `Could not load the "sharp" module using the linux-x64 runtime` → every `/_next/image` request 500s. Fixed by building on a glibc base (`node:24` Debian) and removing the musl-only strip, so Sharp's glibc binary (`@img/sharp-linux-x64`) is installed, traced into the standalone output, and loads at runtime. Verified by building the production `linux/amd64` image and confirming Sharp both loads and encodes a WebP. (Prisma was unaffected because it uses the `@prisma/adapter-pg` JS driver, not a native query engine.)

## 0.52.1

### Fixes

- **Fix the `EACCES: permission denied, mkdir '/app/.next/cache'` flood in the production container by chowning the runtime image by numeric uid instead of the unresolvable name `nonroot`.** Root cause: the Chainguard runtime (`cgr.dev/chainguard/node:latest`) has **no `nonroot` entry in `/etc/passwd`** — uid 65532 is named `node` — so the runner-stage `COPY --from=builder --chown=nonroot:nonroot …` lines silently fell back to root (`0:0`). That left `/app/.next` root-owned (mode 755), and since the container runs as uid 65532, the Next.js image optimizer's first remote-avatar optimization (`mkdir('.next/cache/images', { recursive: true })` in `next/dist/server/lib/disk-lru-cache.external.js`, triggered by Discord/GitHub/Google/Gravatar avatars) failed with `EACCES` and rejected on every subsequent cacheable image request. `Dockerfile.app` now uses `--chown=65532:65532` (numeric IDs need no passwd lookup) on all three runner COPY lines, so the runtime user owns the standalone tree as intended and creates `.next/cache` on demand. Verified by reproducing the exact production state (`/app/.next` `uid=0`, `mkdir FAILED:EACCES`) and confirming the numeric-chown image yields `uid=65532` and a successful write. No application code or schema change; the image cache is ephemeral (Postgres holds all persistence). Requires a rebuilt image to deploy — production was on `v0.47.7`, which carries the same defect.

## 0.52.0

### Features

- **Floating admin-only "Trigger Ministry" widget on every page so the Ministry Interference easter egg can be reproduced on demand instead of waiting on the 2–5 min random scheduler.** Sits bottom-right (above the mobile BottomNav), mounts only when `session.user.role === 'admin'` (server-resolved in `src/app/layout.jsx` via the BetterAuth session lookup; auth-disabled deploys correctly render no widget because `auth` is `null`). Clicking the button calls the new `MinistryContext.forceHijack()` method, which picks the first eligible Hijackable on the current page, fires its `onHijack` cycle with a propaganda string from the existing content pools, and resets idle state after `CYCLE_MS` — same code path the random scheduler uses. Sonner toasts report the outcome: success ("Hijack triggered"), no eligible elements ("No eligible Hijackable on this page"), or disabled state ("Ministry disabled — no war tone resolved"). Admin can stand on any page and reproduce the effect without tab juggling or devtools.

### Changes

- **Promote `forceHijack` from the dead `window.__ministry_test__` debug hook to a first-class `MinistryContext` method.** The dev-only `useEffect` that exposed `forceHijack(predicate)` on `window` was orphaned after the Playwright spec it served was replaced with Vitest smoke tests in commit `4ef57c3c`. Repurposed the existing logic into a `useCallback` on the `MinistryContext` value (memoized against `warTone`), updated the context JSDoc to document the new method, and deleted the dead window hook entirely. Public consumer is the new admin-trigger widget; the underlying behavior — pick the first eligible registered descriptor matching the predicate, fire `onHijack(altText)`, reset idle after `CYCLE_MS` — is unchanged. Five new tests in `MinistryProvider.test.jsx` cover the success path, predicate filtering, no-match, `warTone: null`, and scope rejection.

## 0.51.7

### Changes

- **15 bugs fixed across the `db/queries/` split surface (PRs #411 + #412) from a max-effort code review — one production-broken feature, three concurrency races, one mis-mapped HTTP status, four UI error-handling gaps, plus six smaller correctness fixes.** Patch release. No new behavior; only edge cases get better. Files touched: `src/features/account/actions.mjs`, `src/features/admin/actions.mjs`, `src/features/admin/AdminApiKeys.jsx`, `src/features/account/AccountActions.jsx`, `src/features/account/ApiDashboard.jsx`, `src/shared/utils/api/{authGuards,validateApiKey}.mjs`, `src/app/api/h1/rebroadcast/route.js`, and `src/app/docs/data-flow/page.mdx`, plus matching test updates.

    - **Admin Revoke API key button was completely broken in production.** `<form action={adminRevokeApiKey}>` in `AdminApiKeys.jsx:58` is a bare form action (no `useActionState` wrapper), so Next.js invokes the action with one argument (the FormData). The action's signature was `(_, formData)` — FormData landed in `_` and the named `formData` parameter was `undefined`, throwing `TypeError: Cannot read properties of undefined (reading 'get')` on every click. Fixed by dropping the unused first arg, matching the actual call convention. Tests updated accordingly.

    - **Three TOCTOU races wrapped in `db.$transaction` with `Serializable` isolation.** (1) `updateUserRole` read `db.user.count({ where: { role: ADMIN } })` then `db.user.update` without a transaction — two concurrent admin demotions could both pass the last-admin guard with count=2 and both succeed, leaving zero admins and locking the role out of the admin panel. (2) `toggleUserBan` had the identical count-then-update pattern when banning an admin. (3) `generateApiKey` similarly read `db.ApiKey.count` then called `db.ApiKey.create` non-transactionally, so parallel calls could bypass the 5-key cap. All three now use `db.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })` so the read-then-conditional-write is atomic and concurrent transactions either serialize or one retries.

    - **`validateApiKey` DB outages no longer surface as 401 Unauthorized.** The function previously collapsed Prisma errors and missing-keys into the same `INVALID` code (`if (dbError || !row) return code: INVALID`), so a database outage on `/api/h1/rebroadcast` made operators see a flood of "bad API key" 401s instead of the actual infrastructure failure. Added `API_KEY_ERROR.DB_ERROR` and split the collapse; the route now returns 503 "database unreachable" on DB errors (matching `/api/healthcheck`'s 503 wording) and keeps 401/403 for missing/disabled keys. Pre-existing regression carried verbatim from the old `db/queries/validateApiKey.mjs`.

    - **`deleteUserAccount` Zod-validates input, reorders revoke/delete, fires `revalidatePath`.** (1) The function's JSDoc claimed "Requires email confirmation" / "Must contain userId and confirmEmail fields" but no validation existed and the client never sent `confirmEmail`. Added a Zod schema validating `userId` (matching the sibling `deleteApiKey` pattern) and dropped the false `confirmEmail` claim from the docstring — the existing `window.confirm` dialog remains as the user-facing safeguard (adding an email-confirmation input is a UX decision deferred). (2) Reversed `revokeSessions → delete` order to `delete → revoke` so a transient delete failure leaves the user logged in to retry instead of locked out of a still-existing account. (3) Added the missing `revalidatePath('/profile', 'layout')` that every sibling action already calls, so admin views (UserTable) refresh after a user self-deletes.

    - **Four UI consumers now handle the `result.errors` envelope explicitly.** `ApiDashboard.jsx` rendered "No API keys yet" silently when `getApiKeysByUserId` returned `{ errors: { auth: ... } }` from a mid-render session lapse — now shows a danger-styled "Could not load API keys" message. `AccountActions.jsx::handleExport` produced no toast and no console output when `exportUserData` returned an errors envelope — now fires a Sonner `toast.error`. `AccountActions.jsx::handleDelete` redirected to `/` on _any_ falsy `result?.errors`, including `undefined` (a future regression dropping `return { data: { deleted: true } }` would silently lie about deletion success) — now checks `result?.data?.deleted` explicitly and toasts on every non-success path. Two new test cases pin both `AccountActions.jsx` branches.

    - **`authGuards.mjs` `'use server'` directive removed.** The directive made `requireSession` / `requireUser` / `requireAdmin` callable as RPC server actions even though every importer (`features/admin/actions.mjs`, `features/account/actions.mjs`, `features/archives/reseedSeason.mjs`) is itself a `'use server'` module — they are never reached from `'use client'` code. The directive was carried over verbatim from the old `src/db/queries/_authGuards.mjs` (which had it as an R100 byte-identical rename predecessor). Removing it closes the unintended whoami-probe RPC surface and aligns the file with its `src/shared/utils/api/` siblings (`responses.mjs`, `methodNotAllowed.mjs`, `validateApiKey.mjs`), none of which has the directive.

    - **Six smaller correctness fixes.** (1) `generateApiKey` returned the Prisma model instance after mutating it (`newApiKey['key'] = key`); now returns `{ ...newApiKey, key }` as a fresh DTO to keep the RSC serialization boundary clean. (2) `getSystemStats` did `currentSeason ? <SQL> : Promise.resolve(0)` — falsy-zero would skip the active-factions count when season 0 (a valid early-war value referenced by `sendTestNotification`) was current; fixed to `currentSeason !== null ?`. (3-5) Three server actions (`updateUserRole`, `adminGetUserApiKeys`, `deleteApiKey`) used raw `formValues.*` for DB queries and ownership checks instead of the validated `check.data.*`; switched to `check.data.*` everywhere to match the `toggleUserBan` / `generateApiKey` convention and pre-empt fragility if a future `.trim()` or `.transform()` is ever added to any of those schemas. (6) `src/app/docs/data-flow/page.mdx` code samples called `isValidStatus(fetchedData)` and `isValidSeason(fetchedData)` as if the validators were callable functions; both are `z.object({...})` instances — switched the doc to `.safeParse(...)` so a reader copy-pasting the example doesn't immediately hit `TypeError: isValidStatus is not a function`.

## 0.51.6

### Changes

- **Drop the redundant `rootSchema` intermediate from `isValidStatus.mjs` and `isValidSeason.mjs` — all 5 Zod validators now export their schema directly.** Three of the five `src/validators/isValid*.mjs` files (`isValidContentType`, `isValidNumber`, `isValidFormData`) wrote `export const isValidX = z.<schema>(...)` directly. The other two bound the root schema to a local `const rootSchema = ...` first and re-exported it on the next line — an unused indirection (the name was never referenced elsewhere in the file). Converged on the direct-export form. The `@typedef {z.infer<typeof isValidStatus>} StatusPayload` / `@typedef {z.infer<typeof isValidSeason>} SeasonPayload` annotations continue to work unchanged because they reference the exported name. Pure refactor — no runtime behavior change. Closes the `validator-protocol-unification` cluster and 3 `contract_coherence` findings from /desloppify (issue #406).

## 0.51.5

### Changes

- **Split `src/db/queries/` by responsibility — pure data-access stays, server actions and boundary helpers move out.** The `src/db/queries/` directory had drifted into a misleading mix of pure DB queries (`get*` / `upsert*`), auth-gated server actions (`admin.mjs`, `api.mjs`, `account.mjs`), and HTTP-boundary helpers (`validateApiKey.mjs`, `_authGuards.mjs`) — all behind a "queries" label. Now reorganized so each layer lives next to its consumer: the seven admin server actions (`getAllUsers`, `updateUserRole`, `toggleUserBan`, `adminGetUserApiKeys`, `adminRevokeApiKey`, `getSystemStats`, `getAllApiKeys`) merge into the existing `src/features/admin/actions.mjs` (next to its UI), the three API-key actions (`getApiKeysByUserId`, `generateApiKey`, `deleteApiKey`) plus the two account lifecycle actions (`exportUserData`, `deleteUserAccount`) consolidate into a new `src/features/account/actions.mjs` (next to `ApiForm.jsx` / `AccountActions.jsx`), the three auth guard helpers (`requireSession` / `requireUser` / `requireAdmin`) move to `src/shared/utils/api/authGuards.mjs` next to `responses.mjs` and `methodNotAllowed.mjs`, and the API-key request validator (`validateApiKey`) moves to `src/shared/utils/api/validateApiKey.mjs` alongside it. After the relocation `src/db/queries/` contains only the pure data-access set (`getCampaign`, `getCascadeLeaderboard`, `getCrossSeasonStats`, `getKillsTrend`, `getPlayersAvg24h`, `rebroadcast`, `upsertEvent*` / `upsertSeason` / `upsertStatistic` / `upsertStatus`). Pure relocation — no behavior changes; imports updated across 9 source files, 7 test files, and 2 docs MDX pages. Closes `db-queries-actions-split` cluster + `db_queri` + `admin_ac` design_coherence findings from /desloppify (issue #406).

## 0.51.4

### Changes

- **Desloppify mechanical cleanup** — closes three filed issues in one PR. (1) Adds JSDoc `@param` descriptions to `CascadeLog.jsx` (`props`) and `seasonAnalytics.mjs` (`opts`), clearing the two `jsdoc/require-param-description` lint warnings (#400). (2) Renames the cross-file `makeFactionMap` test helpers — `EventCard.test.jsx` uses `makeSectorMap` (it builds a per-faction sectors map for one event card) and `DashboardClient.test.jsx` uses `makeDashboardMap` (it builds the full mapState shape including region 0/11) — each helper is a genuinely different shape (regions 1-11 vs 1-10 vs 0-11 with different field sets), so renaming is more honest than extracting a fake shared abstraction; the third occurrence in `computeFrontier.test.mjs` is already scoped inside a `describe()` block (#401). (3) Annotates the two intentional empty-`catch` swallows in `MinistryProvider.jsx` (flicker scheduler) and `useLiveData.mjs` (`saveCachedState`) — both now capture `err` and `console.debug` it so the swallow is visible during diagnosis, with the existing rationale promoted from inline comment to a fuller multi-line explanation of why each path is non-critical (#399). No runtime behavior change.

## 0.51.3

### Changes

- **`/api/h1/rebroadcast` reconstruction logic extracted to `src/db/queries/rebroadcast.mjs`; `SEASON_NOT_FOUND` sentinel becomes a named export; rebroadcast snapshots path returns `404` for missing seasons instead of `500`.** The rebroadcast route inlined ~130 LOC of `reconstructCampaignStatus` + `reconstructSnapshots` alongside the POST handler — the same DISTINCT-ON + bucket-merge logic already encapsulated in `db/queries/`, just producing a different wire shape. Moves both functions out into `src/db/queries/rebroadcast.mjs` so the route file becomes pure orchestration (147 LOC → 152 LOC handler kept; ~140 LOC of data-access removed from route layer). The `SEASON_NOT_FOUND` magic string used as `Error.cause` in `src/update/season.mjs` was previously a hand-typed literal duplicated across the throw site and the campaign-route consumer (`fetchError.cause === 'SEASON_NOT_FOUND'`); now exported as a named constant from `src/update/season.mjs` and imported by both campaign and rebroadcast routes — typos fail at `tsc --noEmit` time. **Behavior change:** the rebroadcast `get_snapshots` backfill path previously returned `500` when the requested season didn't exist on the HD1 API; now correctly returns `404`, matching the campaign route's existing behavior. Closes the `rebroadcast-getcampaign-consolidation` cluster + `rebroadcast-churn-hotspot-decoupling` strategic issue from /desloppify (issue #406).

## 0.51.2

### Changes

- **Type-safety: Zod-inferred validator types + shared enum literal typedefs + tightened JSDoc across the event pipeline.** Adds `@typedef {z.infer<typeof Schema>} TypeName` exports to `isValidStatus.mjs` (`StatusPayload`), `isValidSeason.mjs` (`SeasonPayload`), and `isValidFormData.mjs` (`FormDataPayload`) so downstream consumers can reference the real wire-format shape instead of typing as `object`. Adds five literal-union typedefs (`EventType`, `EventStatus`, `CampaignStatus`, `MapStatus`) plus a shared `Event` shape and `EventChangeKind` union (`'event_started'|'event_won'|'event_lost'|'catch_up'`) to `src/shared/enums/events.mjs`. Tightens previously widened JSDoc on `detectChanges.mjs` (return shape now refers to the shared `Event` type instead of `event: object`), `EventToast.jsx` (both `toastLabel` and `showEventToast` now consume `Event` + `EventChangeKind`), and consolidates the duplicate `LiveStatus` typedef declaration between `useLiveData.mjs` and `LiveDataContext.mjs` — the hook is now the single source of truth and the context imports via `@typedef {import('...').LiveStatus} LiveStatus`. Pure refactor — no runtime behavior change; protects momentum on the only improving high-weight desloppify dimension (type_safety 55 → 68 → 71).

## 0.51.1

### Changes

- **Shared auth-guard helpers (`requireSession` / `requireUser` / `requireAdmin`) replace 5+ inlined session+ownership patterns across `src/db/queries/` and `src/features/`.** The auth-guard pattern (`if (!auth) → session lookup → optional ownership/role check → return uniform error envelope`) was duplicated 5 times in `api.mjs` (`getApiKeysByUserId`, `generateApiKey`, `deleteApiKey`), 2 times in `account.mjs` (`exportUserData`, `deleteUserAccount`), and reimplemented inline in `features/archives/reseedSeason.mjs` and `features/admin/actions.mjs` (`sendTestNotification`) — each with a slightly different error string for the same auth-failure condition (`'No session found'`, `'User does not match'`, `"You must be signed in to generate an API key"`, `"You don't have permission to delete this API key"`, `'Unauthorized'`, `'Forbidden'`). Extracted to a new `src/db/queries/_authGuards.mjs` module returning a `{ user, error }` discriminated-union with both keys always present (one nullable) — matching how callers were already destructuring the previous `requireAdmin` and fixing a long-standing JSDoc lie. Error strings standardize to `'Auth not configured'` / `'Not authenticated'` / `'Not authorized'` / `'Forbidden'`, which also distinguishes "no session at all" from "wrong user" in places (e.g. `deleteApiKey`) that previously collapsed both into one generic "permission" message. Closes the auth_consistency 87.5 → 80.0 strict-score regression flagged by `/desloppify`. Affected tests updated to assert the new uniform strings.

## 0.51.0

### Features

- **Cross-season Cascade Failures section on `/stats` plus a per-season cascade log on `/archives` (#272).** A "cascade" is a sequence of failed defends for one faction with strictly decreasing region numbers and no more than a 1-hour gap between consecutive events — the back-to-back collapses that mark a war's worst moments (e.g. season 155's Illuminate push from region 8 all the way to the homeworld). New `findAllCascades` algorithm in `seasonAnalytics.mjs` returns every qualifying cascade with min length 3, sorted by length DESC then speed (regions/hour) DESC then `endTime` DESC. A new `getCascadeLeaderboard()` cached server query pulls all failed defends in one indexed Prisma read and groups by season. On `/stats` a new `<CascadeLog>` section renders between **War Outcomes & Streaks** and **All-Time Records**, mirroring the existing `EventLog` layout (`event-log-section` → header + sort toggle → day-grouped grid) but grouped by season instead of by day. A persisted cookie (`cascade-log-sort`) tracks the user's choice between "worst first" (default) and "recent first"; an auto-generated lede sentence summarizes the dataset (`"N cascades across M wars. Worst: season X, where the FACTION pushed all the way home / swept N regions in DURATION."`). Each cascade card shows faction icon + title (`Defend cascade · N regions`), a duration pill, the start/end timestamp line, and the faction-colored region chain (`8 → 7 → 6 → … → 0`); clicking it deep-links to `/archives?season=N#cascade`. On `/archives` the same component renders below the `StatGrid`, filtered to the current season via `findAllCascades(events)` — same visual grammar, no `lede` prop. The cascade chain is the only genuinely new visual element; the existing `EventLog.css` provides the section layout via three additive classes (`.event-log-card-chain`, `.event-log-card--cascade`, `.event-log-lede`). Per-season outcome strings in group headers (`"1 cascade · Defeat"`) are deferred to a follow-up.

### Changes

- **`findWorstCascade` and the `WORST_CASCADE` stat card on `/archives` are removed.** The legacy detection helper had no time-gap awareness and accepted length-2 sequences with arbitrary spacing, so it could surface stale streaks weeks apart as "cascades". Replaced by the stricter `findAllCascades` algorithm above, with the dedicated `<CascadeLog>` panel taking over the storytelling that the lone stat card used to gesture at. The archives extras grid keeps OUTCOME, DEFENSE_RATE, ATTACK_RATE, and AVG_DIFFICULTY; the cascade story moves into its own section directly below.

## 0.50.0

### Features

- **Sitewide "Ministry Interference" easter egg replaces the archives-only Cyberstan effect.** A single root-level `<MinistryProvider>` (mounted inside the existing `<LiveDataProvider>` in `layout.jsx`) drives two `setTimeout`-based schedulers across the whole app: a **rare hijack** every 2-5 minutes picks one opt-in `<Hijackable>` element at random and runs a 2.6-second `takeover → hold → restore` glitch cycle on it; a separate **ambient micro-flicker** every 15-30 seconds swaps one random character of one random element to a Cyberstan glyph for 150-300ms. Both schedulers honor `prefers-reduced-motion: reduce` (no manual toggle survives — the old `EffectsToggle` ⚡ button is gone). Tone is computed server-side from humanity's all-time war record via the existing `getCrossSeasonStats()` (React-`cache()`d, no extra DB hit): `'winning'` (≥50% completed wars won) → sardonic Resistance hackers mock the regime's victory framing; `'losing'` → an Underground pirate-radio broadcast cuts in with surveillance-state imagery aimed at the regime. On DB errors or zero completed wars `getWarTone()` returns `null` and the effect disables entirely rather than forcing a tone. Accessibility-first: during a hijack the wrapper element keeps an `sr-only` truth sibling so assistive tech always reads the real text, while the propaganda is rendered in an `aria-hidden` overlay (no visible/accessible-name divergence, no WCAG 2.5.3 risk). Banned categories (`nav`, `button`, `link`) throw in dev mode. **96 propaganda strings** across 8 pools (4 categories × 2 tones), 12-entry minimum enforced via a Vitest assertion. **v1 wrapping scope** is intentionally narrow — h1/h2 headings on the dashboard, archives header (h1 + body), archives OUTCOME card, `/stats`, `/legal`, `/docs/brandkit`, `/sign-in` — with nav/buttons/footer/stat-values deferred until layout-shift is measured. The existing `GlitchText.jsx` rendering machinery is reused unchanged; the old `useGlitchCycle`, `useCyberstanEffects`, `resistanceMessages`, `CyberstanInterference.css`, and `EffectsToggle` are deleted. The full design went through a 3-round adversarial AI debate before implementation; spec and plan archived under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## 0.49.0

### Features

- **New `/stats` page surfaces cross-season analytics across every Helldivers war (#394).** The other half of the Phase A split (Part 2 = #391, shipped in 0.48.0). A new top-level route reads the full 157-season history via a single `getCrossSeasonStats()` query — SQL `GROUP BY` aggregates over `h1_event` / `h1_status` / `h1_season` / `h1_statistic`, plus a per-season war-outcome derivation that reuses `getWarOutcome`'s algorithm on a slim per-season slice (final faction states + relevant events + a synthetic any-all-3-defeated snapshot flag). Three components ship: **Faction Threat Ranking** — per-faction overall HD win rates as a faction-colored horizontal bar chart, sorted ascending so the most-threatening enemy reads first; **War Outcomes & Streaks** — total wars, victories, defeats, win rate, longest win/loss streaks with season ranges, plus a wrapping per-season outcome timeline; **All-Time Records** — longest war, most events, longest avg battle, most defends/attacks won, each card attributed to the season that owns the extremum. The three telemetry charts originally listed in #178 (Friendly Fire Index, Accuracy Trend, Shots per Planet) are deferred until telemetry accumulates beyond season 157 — the query already returns telemetry fields so the charts drop in cleanly later. `HeaderNav` and `BottomNav` gain a `Stats` entry.

### Changes

- **Archives extras grid now matches the homepage hero's auto-fit layout.** `ArchiveStats` (the per-faction / per-war extras grid on `/archives`) was hard-capped at `lg:grid-cols-3`, so its 4th and subsequent cards wrapped to a new row below the hero's wider auto-fit grid — visually inconsistent with the 6-across `StatGrid` directly above it. Switched to the same `.stat-grid` class (`repeat(auto-fit, minmax(11rem, 1fr))`), and made the previously-implicit CSS dependency on `StatGrid.css` explicit. Both grids now breathe with the viewport identically; at typical desktop widths every extras card sits on one row.

## 0.48.0

### Features

- **`/archives` statistics now reuse the homepage `StatGrid`, with a Ministry of Truth redaction for pre-telemetry seasons (#391).** The archives page carried its own `ArchiveStats` (global) and `FactionStats` (per-faction) components — a parallel, partly-duplicated reimplementation of the homepage hero's per-faction `StatGrid` that had drifted from it. The archives stats section now renders the shared `StatGrid` itself for the six core cards (`HELLDIVERS_ONLINE`, `ENEMIES_KILLED`, `HELLDIVERS_LOST`, `MISSIONS_WON`, `EVENTS`, `WAR_DURATION`) — one source of truth, no drift — above a slim archives-only extras grid (`OUTCOME`, `DEFENSE_RATE`, `ATTACK_RATE`, `AVG_DIFFICULTY`, `WORST_CASCADE`; plus `HOTSPOT`, `CONQUEST`, `AVG_BATTLE` on a faction tab). `ArchiveStats` and `FactionStats` collapse into one component and the duplicated cards (`DURATION`, `KILLS`, `BATTLES`, `K/D`) are dropped. `StatGrid` gains an additive `archived` prop (default off, so the homepage is byte-for-byte unchanged): on seasons that predate combat-stat collection, the four telemetry cards render a censored `DATA REDACTED — MINISTRY OF TRUTH` treatment instead of misleading zeros. A new shared `formatRatio` formatter was extracted; built test-first throughout.

## 0.47.17

### Fixes

- **Pagespeed workflow pins `lowlighter/metrics` to the `v3.34` release tag.** The workflow used `lowlighter/metrics@v4`, which has no matching release tag — `@v4` silently resolved to the action's long-running `v4` rewrite _branch_. A push to that branch removed the root `action.yml`, so runs began failing with `Can't find 'action.yml', 'action.yaml' or 'Dockerfile'`. Pinned to `@v3.34`, the latest stable release, restoring reproducible runs.

## 0.47.16

### Features

- **Hovering a faction's map territory highlights its dashboard card(s) (#390).** Completes the bidirectional hover link from #185, which shipped the card → map direction only. Hovering anywhere in a faction's galaxy-map territory now firms up that faction's sidebar card border — `var(--color-ghost)` → `rgba(255,255,255,0.55)`, the mirror of the dim → bright lift the card → map direction gives the map's lost sectors. A faction's frontier and homeworld cards both highlight; during a Super Earth defense the attacking faction's card (filed under Super Earth) carries a `data-attacker-index` so hovering the attacker's own territory highlights it too. Implemented by extending `sectorLink.mjs` with `highlightCard`/`clearCardHighlight` — DOM class toggling on the card `<li>`s, no React state, zero re-renders — and `onMouseEnter`/`onMouseLeave` on the map's faction `<g>` groups. TDD: 6 new `cardLink` tests.

## 0.47.15

### Changes

- **Region card → map hover highlight is additive instead of dimming (#185).** Hovering a dashboard region card previously dimmed the whole galaxy map to `opacity: 0.25` and spared the hovered area — a three-tier _subtractive_ focus. It now leaves every sector at full opacity and instead firms up the hovered faction's see-through `.lost` sectors — their translucent ghost stroke and near-invisible fill gain opacity so the faction's full reach reads at a glance. Gold (`.captured`/`.in_progress`) strokes are left untouched so they stay gold, and the one active sector takes a heavier 3px outline. Nothing on the map dims. The highlight changes only stroke and fill — never `filter` — and its lost-sector rule never matches an active sector, so it composes cleanly with the red pulse animation. Purely a `Map.css` restyle; the `sectorLink.mjs` class-toggling logic and its 5 tests are unchanged.

## 0.47.14

### Features

- **`ENEMIES_KILLED` subtitle compares the last 24h of kills against the 24h before it.** The card's `Last 24h` subtitle previously showed only the raw kill volume with a permanently green arrow — a count, not a verdict (a cumulative counter only ever grows). It now derives two consecutive 24h volumes (`last24h = current − kills(24h ago)`, `prev24h = kills(24h ago) − kills(48h ago)`) and shows the last-24h volume with a ▲/▼/▪ arrow marking whether the killing pace rose, fell, or held versus the previous 24h — a genuine better/worse signal, matching how `HELLDIVERS_ONLINE` already reads against its rolling-average baseline. `getKills24hAgo` was renamed to `getKillsTrend` and now fetches two point-in-time snapshots (~24h and ~48h ago) instead of one; the prop is threaded through as `killsTrend`. For a season 24–48h old there is no 48h baseline to compare against, so the arrow falls back to a neutral ▪. The ▲/▼/▪ arrow rendering shared by both delta subtitles was extracted into a `deltaArrow` helper.

### Changes

- **`formatNumber` applies the `M` suffix from 1M, not 10M.** A 7-digit locale-grouped number (`3,522,088`) overflowed the dashboard stat-card subtitles; numbers ≥ 1M now collapse to `X.XM` (`3.5M`). Since this is the shared number formatter, 1M–10M values also compact on the archive stat cards, the admin overview, and event-card point totals. Numbers below 1M are unchanged (still locale-grouped).

## 0.47.13

### Features

- **Region cards highlight their location on the galaxy map on hover (#185).** Hovering a dashboard region card now lights up the matching area of the map — the hovered faction's whole territory faintly, its one active sector strongly, the rest of the map receding (a three-tier opacity focus). Implemented by toggling CSS classes directly on the map's SVG nodes (`sectorLink.mjs`) rather than through React state, so a hover costs no re-render of the card grid or the ~33 map paths. This ships the card → map direction; the reverse (map sector → card) can be layered on later by calling the same helper from the map's own hover handlers — the cards already carry `data-faction-index`/`data-sector` for it.

### Changes

- **War-duration card shows a start date.** The `WAR_DURATION` stat card's subtitle now shows the date the span began — war start on the global tab, faction introduction date on a faction tab (`DD MONTH`, UTC) — rather than a repeated humanised duration, so the value and subtitle read as a coherent pair.
- **`HELLDIVERS_LOST` teamkill subtitle relabelled "Martyrs".** The accidental-death subtitle showed the count plus its rate as a percentage of total deaths; it now shows the count with a `Martyrs` label and drops the percentage.

## 0.47.12

### Features

- **War-duration stat card on the dashboard (#386).** A 6th `WAR_DURATION` card joins the `StatGrid`: on the **global** tab it shows how long the current war has been running (`season_duration`); on a **faction** tab it shows how long that faction has been deployed — total war duration minus the span it spent `hidden` before introduction. `getCampaign` now derives a per-faction `first_seen` (the earliest non-`hidden` `h1_status` bucket) and a top-level `war_start`. The non-`hidden` filter is essential: `updateStatus` writes an `h1_status` row for all 3 factions every poll, so a pre-introduction faction carries `hidden` rows from war start — a plain `min(time)` would report day 0 for everyone. Mirrors the archives `DURATION` card; the `auto-fit` stat grid absorbs the 6th card with no layout change.

## 0.47.11

### Bug Fixes

- **Stats faction-tab switch no longer blocks the interaction frame (#388).** Switching the `FactionTabs` selection fans a re-render across ~10 `react-slot-counter` instances in `StatGrid` at once; a DevTools profile measured a ~41ms synchronous block (72ms INP) — a visible hitch. `setFaction` is now wrapped in React's `startTransition`, marking the re-render non-urgent so React can yield through it rather than blocking the frame. Measured INP for a Global→Bugs switch dropped 72ms → 39ms. The odometer roll itself is unchanged. (The obvious `key`-remount approach was profiled and rejected — it was 10× worse, 722ms, from layout thrashing as ~10 slot counters re-measured glyph width on mount.)

## 0.47.10

### Bug Fixes

- **Empty "Today" section no longer renders in the event log (#385).** `groupEventsByDay` injected a synthetic empty `{ label: 'TODAY', events: [] }` group whenever the homepage event log had no events for the current day — it rendered as a bare "TODAY" header with no cards beneath it. Removed the mechanism outright: the `includeToday` option (archives already passed `false`, and the homepage relied on the `true` default), the injection block, the `.event-log-day--no-events` className branch in `EventLog` (only ever reachable via the injected group), and its two CSS rules. A real event starting today is unaffected — it is still grouped and labelled "TODAY" by `formatDayLabel`, which is wholly independent of the removed injection (covered by a new regression test).

## 0.47.9

### Documentation

- **`timeago.js` adoption rationale documented in code (#360).** Added a comment to `formatTimeAgo.mjs` explaining that `timeago.js` is a deliberate dependency — it replaced a hand-rolled `Intl.RelativeTimeFormat` helper that lacked edge-case handling — and why a prior "save ~4.2KB by reverting to native `Intl.RelativeTimeFormat`" suggestion was rejected, so a future desloppify pass does not re-flag it. The optional dynamic-import sub-task was not pursued: `formatTimeAgo` is a synchronous helper used by two components, and making it async to defer a ~4.2KB import would ripple through callers for a marginal gain.

## 0.47.8

### Performance

- **Rebroadcast route DB queries parallelized (#351).** `reconstructCampaignStatus` ran its three season-keyed queries (`latestStatus`, `latestStats`, `activeEvents`) sequentially, and `reconstructSnapshots` ran `allStatus` + `allEvents` sequentially — all mutually independent. Wrapped each set in `Promise.all`, collapsing ~3 round-trips into 1 for the campaign path and ~2 into 1 for the snapshots path. Query invocation order is preserved, so the route's `$queryRaw` DISTINCT-ON results still map identically.
- **`FactionHealthChart` is now lazy-loaded (#352).** The archives conquest-progress chart statically imported 10 recharts components (~50 KB gzipped) into the `/archives` initial bundle, even though it only renders once a season has snapshot data. New `FactionHealthChartLoader.jsx` wraps it in `next/dynamic` (`ssr: false`) — mirroring the existing `ProgressExplainerLoader` pattern — and `ArchivesClient` imports the loader. recharts now ships in an on-demand chunk.
- **Update route push-notify uses `after()` (#353).** The `/api/h1/update` route fired `checkAndNotify()` as a `.catch()`-guarded fire-and-forget — the one API route not already using `after()`. Switched to `after()` plus the `tryCatch` wrapper so the event-transition check and push delivery are tied to the request lifecycle (proper resource cleanup and error reporting), consistent with `/api/h1/campaign` and `/api/h1/rebroadcast`.
- **Live-data localStorage cache key is versioned (#354).** `useLiveData`'s cache key `hd1-live-cache` had no version suffix, so a future change to the `/api/h1/live` payload shape could let a stale cached entry seed the UI on first paint before the first poll. Renamed to `hd1-live-cache-v1`; bump the suffix on any payload-shape change and old entries are abandoned untouched. Cross-references in the legal page's localStorage table and the notifications flow diagram were updated to match.
- **Event-log day groups skip off-screen layout (#355).** Added `content-visibility: auto` + `contain-intrinsic-size: auto 320px` to `.event-log-day`, so day groups below the fold skip layout/paint until scrolled near — a long season can render 30+ groups. Deliberately scoped to the default `grid` layout via `:not(.event-log-days--stack)` and excluded from the archives `--stack` layout: `useScrollEvent` reads every card's `getBoundingClientRect` and early-breaks on DOM order, and `content-visibility` would collapse off-screen cards to zero-rects and break that scan.
- **Sentry transaction sampling reduced in production (#356).** `tracesSampleRate` was a flat `1.0` (100% of transactions traced). It is now `0.1` in production / `1.0` in dev & preview — trimming per-navigation and per-request SDK overhead for real users while keeping full local traces.
- **`loading.jsx` skeletons added to high-traffic routes (#358).** No route had a `loading.jsx`, so client-side navigation showed a frozen page while the server component streamed. Added a shared `PageSkeleton` component and `loading.jsx` for `/` (campaign + 24h aggregations), `/archives` (campaign + on-demand season backfill) and `/profile` (auth + DB queries). Next.js wraps each in a `<Suspense>` boundary, giving instant navigation feedback and enabling streaming.
- **Static asset cache headers bumped to 1-year immutable (#359).** `/icons`, `/images` and `/svgs` served `Cache-Control: public, max-age=604800` (7 days). These files never change without a redeploy, so they now use `max-age=31536000, immutable` — matching `/fonts` — eliminating repeat downloads on return visits.

## 0.47.7

### Bug Fixes

- **Pace indicator adopts the ▲/▼/▪ glyph pattern (#357).** The event pace label ("175,259 behind") routed a single mixed number-plus-word string through `AnimatedStat` → `react-slot-counter`, which slots every character individually and visually compressed the space between the number and the status word into "175,259behind". `evaluateProgress` no longer returns a presentation `label` string — it returns pure data (`status`, `delta`, rates), and a new `PaceIndicator` component in `EventCard` renders a colour-coded ▲ (ahead, green) / ▼ (behind, red) / ▪ (on_track) glyph as a separate inline-flex sibling of the slotted number. Because the glyph and the digits are now distinct flex children, the slot counter only ever animates digits and the gap can no longer collapse. This also aligns the pace display with the existing `StatGrid` delta-subtitle pattern. The `label` field was consumed only by `EventCard`; the OpenGraph image route reads `pace.status`, which is unchanged.
- **Progress bars now expose an accessible name (#361).** A Lighthouse accessibility audit flagged the `role="progressbar"` bars in `EventCard` and `DefeatedCard` for having no accessible name, leaving screen-reader users with an unlabelled control. Added `aria-label` to both — `"{region} {action} progress"` (e.g. "Super Earth defending progress") for `EventCard` and `"{faction} defeat progress"` for `DefeatedCard` — alongside the existing `aria-valuenow`/`aria-valuemin`/`aria-valuemax`.

## 0.47.6

### Chores

- **TypeScript strict mode enabled, plus two JSDoc lint rules turned on.** Flipped `jsconfig.json` from `"strict": false` (with an explicit `"noImplicitAny": false`) to `"strict": true`. Because `npm run typecheck` has long been a mandatory merge gate running with `checkJs: true`, the codebase was already strict-clean — `tsc --noEmit` reports zero errors under all seven strict sub-flags (verified with both `strictNullChecks` alone and full `strict` via `--showConfig`). No type-checker fixes were needed; this just stops leaving `strictNullChecks` and friends switched off. Separately enabled `jsdoc/require-param-description` and `jsdoc/reject-any-type` in `eslint.config.mjs` (both previously explicitly `off`). The first surfaced 30 `@param` tags that had a type but no prose description across 21 files — all filled in. The second surfaced 5 `@param {*}` (`any`) annotations in `src/db/queries/account.mjs`, `src/db/queries/api.mjs`, and `src/shared/utils/api/responses.mjs`; each was a genuine "could be anything" boundary (an unused server-action `prevState` arg, the `error`/`data` response payloads) and was retyped `{unknown}` — type-safe, forces narrowing at any use site, and needed no `eslint-disable`. `npm run lint` remains at zero warnings.

## 0.47.5

### Chores

- **CLAUDE.md milestone-status note de-staled.** The Task Tracking section claimed "Phases 4, 7, and 11 are closed" and capped the phase range at 11 — all three points were stale: Phase 11 is open with 10 issues, milestones now run to Phase 13, and every phase 0–8 is closed. Replaced the enumerated, snapshot-style claim with a range note that points readers at the GitHub milestones list as the source of truth, so it stops rotting on every milestone change. Docs-only; no code or behavior change.

## 0.47.4

### Chores

- **`postcss` pinned to `^8.5.10` via `package.json#overrides`** to remediate the GHSA-qx2v-qp2m-jg93 / CVE-2026-41305 advisory (PostCSS XSS via unescaped `</style>` in stringified CSS output, < 8.5.10). The vulnerable copy came in transitively via `next@16.2.6 → postcss@8.4.31`; Tailwind 4's own `@tailwindcss/postcss` dependency already pulled `postcss@8.5.14`, proving the 8.5.x line works in our build pipeline. Real-world exploit risk for this app is essentially zero (the vuln requires processing **user-submitted CSS** through PostCSS's stringifier and embedding the output in an HTML `<style>` tag — we author all our own CSS via Tailwind utilities and design tokens), but the override is a one-line hygiene fix that drops us from 1 moderate dependabot alert to 0. After install all three postcss consumers (Tailwind, Next, Vite) dedupe onto `8.5.15`. Verified end-to-end with the local `docker compose -f docker-compose.ci.yml up --build` stack.

## 0.47.3

### Bug fixes

- **Second migrate-container crash from the v0.46.4 validator-protocol cleanup.** The v0.46.4 "Validator protocol unified to raw-schema exports" change turned `isValidSeason` from `(data) => rootSchema.safeParse(data)` (callable wrapper) into a raw Zod schema (`export const isValidSeason = rootSchema`). The CHANGELOG noted that callers in `src/update/season.mjs` and `src/update/status.mjs` plus tests were updated — but the `prisma/seed/seed.mjs:51` caller was missed. With v0.47.0 in production, the migrate container ran the seed and crashed with `TypeError: isValidSeason is not a function`. v0.47.1 fixed the prior `@/shared` import error in the same file but only verified the file LOADED under raw Node, not that downstream callers EXECUTED — so this latent bug surfaced only on the next docker-compose-up. Fix: changed the single seed call to `isValidSeason.safeParse(seasonData)` to match every other caller in the codebase. Verified end-to-end with a full local `docker compose -f docker-compose.ci.yml up --build` run that brought the stack to healthy (the exact verification step the v0.47.1 hotfix should have done).

## 0.47.2

### Chores

- **Docker smoke CI for main PRs.** New `.github/workflows/main-pr-docker-smoke.yml` (scoped to `pull_request: branches: [main]` only) brings up the full production-shaped stack — postgres + migrate + helldiversbot, all built from the working-tree Dockerfiles — and asserts both that migrate exits 0 and that the app's `/api/healthcheck` returns a sensible payload. Backed by a new `docker-compose.ci.yml` (standalone, not an override) that swaps `image: ghcr.io/...` for `build:` and replaces `env_file: .env.development` with inline `environment:` blocks so CI can inject stub credentials. Closes the gap exposed by the v0.47.1 hotfix, where `npm run lint`/`typecheck`/`test:unit`/`build` all passed locally while the production migrate container crashed on a jsconfig-alias import (`@/shared/...`) that only fails under raw Node. The compose file is also usable locally — `docker compose -f docker-compose.ci.yml up --build` reproduces the exact CI check before pushing. Cold-cache cost is ~7 minutes per main PR; no GHA build cache configured yet (revisit if it becomes painful).

## 0.47.1

### Bug fixes

- **Migrate container crashed at seed step on `@/shared` import.** The v0.46.x "enum migration" replaced inline string enums in `src/validators/isValidSeason.mjs` and `isValidStatus.mjs` with `import { CAMPAIGN_STATUS, EVENT_STATUS } from '@/shared/enums/events.mjs'`. The `@/*` alias is a `jsconfig.json` construct honored by Next.js and Vitest but not by raw Node — so `npm run build` and `npm run test:unit` passed locally while the production migrate container (which runs `node --experimental-strip-types prisma/seed/seed.mjs` after `prisma migrate deploy`) crashed with `ERR_MODULE_NOT_FOUND: Cannot find package '@/shared' imported from /app/src/validators/isValidSeason.mjs`. Fix: switched both validator imports to relative paths (`../shared/enums/events.mjs`), added a clarifying comment on the seed-loaded file documenting the constraint, and updated `Dockerfile.migrate` to also `COPY src/shared/enums/events.mjs` alongside the validator (the enums module has no further imports, so the copy chain terminates there).

## 0.47.0

### Features

- **GlitchTip / Sentry observability wired up across the app.** The Sentry SDK was initialised but most error sources never reached GlitchTip in practice: every `errorResponse(5xx, ...)` was a `console.error` followed by a generic 500, error boundaries discarded the error param while telling users _"this incident has been logged"_, server-side init was gated to `NODE_ENV === 'production'` so localhost was dark, staging and production both tagged as `environment: 'production'`, and `GLITCHTIP_HEARTBEAT_URL` was documented but never read. Fixed end-to-end:
    - New `src/shared/utils/observability.mjs` `reportError(error, context)` helper, no-op-safe on falsy errors, accepts `{ level, ...extra }` so the closing-pass non-fatal error path lands at warning level.
    - Wired at every API-route 5xx path with `{ route, stage }` context — `/api/h1/update` (status / season / closing-pass / push-notify), `/api/h1/live`, `/api/h1/campaign`, `/api/h1/rebroadcast`, `/api/notifications/subscribe`, `/api/healthcheck`, `/api/umami`. Explicit skips: `/api/glitchtip` (would self-loop when GlitchTip is the failing upstream) and `/api/auth/[...all]` (BetterAuth owns its own errors).
    - Wired at every React error boundary (`error.jsx`, `global-error.jsx`, `archives/error.jsx`, `ComponentErrorBoundary`) with a `boundary` tag — the class component also passes React's `componentStack` for attribution.
    - Server-side Sentry init switched from `NODE_ENV === 'production'` to `SENTRY_DSN`-presence gating, so localhost reports too when `SENTRY_DSN` is set in `.env.development`.
    - `environment` tag now derived from `NEXT_PUBLIC_DEPLOY_ENV` → `DEPLOY_ENV` → `NODE_ENV`. CI passes `staging` and `production` as Docker build-args (`staging.docker.yml`, `release.docker.yml`); both the builder and runner stages of `Dockerfile.app` plumb it through so the value is inlined into the client bundle _and_ available to the server process at runtime. GlitchTip now distinguishes all three environments.
    - Worker `public/workers/cronLogic.js` POSTs to `GLITCHTIP_HEARTBEAT_URL` after each `response.ok` poll — fire-and-forget, swallows failures, gives GlitchTip's uptime monitor a signal that flips red on sustained 5xx, DB outage, or worker crash. 4 new tests under `cron.test.mjs`.
    - `docs/infrastructure/page.mdx` Section 4 brought into agreement with the code: removed the false claim that error boundaries auto-capture (they didn't, until this change), removed the CSP `report-uri` paragraph (`src/proxy.js` doesn't exist), removed the misleading _"Behavior note on `NODE_ENV=staging`"_ subsection (CI never actually passed `NODE_ENV=staging`), added the new environment-tag derivation chain and worker heartbeat docs.

    Refs [#373](https://github.com/elfensky/helldivers.bot/issues/373).

- **`tryCatch` wrapper auto-captures caught errors at warning level.** Builds on the `reportError` helper from the prior entry: every Promise rejection routed through `src/shared/utils/tryCatch.mjs` — the project's canonical error-handling pattern, used at ~30+ call sites — is now reported to GlitchTip with `source: 'tryCatch'` and `level: 'warning'`. Severity tagging is load-bearing: Sentry's stack-trace fingerprint groups these with the explicit `reportError(...)` calls at 5xx sites into one issue per error, but the warning level keeps caught-and-recovered errors visually distinct from user-visible failures in the GlitchTip inbox. 4 new tests under `tryCatch.test.mjs` mock the helper and assert the call shape, the no-call-on-resolve invariant, and that the return-tuple semantics are unchanged. Closes [#372](https://github.com/elfensky/helldivers.bot/issues/372).

- **Service worker push and notificationclick handlers report errors via a client bridge.** The SW context can't import the Sentry browser SDK (separate worker context, no DOM), so failures inside `src/sw.js` previously surfaced only in `chrome://serviceworker-internals`. Both handlers are now wrapped: synchronous throws and promise rejections from `showNotification` / `clients.matchAll` postMessage a structured `{ type: 'sw-error', error: { message, name, stack }, context }` payload to all controlled clients. A new `src/shared/utils/swErrorBridge.mjs` (`handleSwErrorMessage` + `registerSwErrorBridge`) listens on `navigator.serviceWorker` from `instrumentation-client.js`, reconstructs the Error, and calls `reportError(err, { source: 'sw', ...context })`. When no client is open (push received with all tabs closed), the SW falls back to `console.error` — the only path left, since there's no SDK to invoke. Original handler behavior preserved: errors are re-thrown after the postMessage, so the SW event loop still sees the rejection. 5 new tests under `swErrorBridge.test.mjs` cover the message reconstruction, type guard, malformed-event tolerance, and the missing-fields fallback. Closes [#371](https://github.com/elfensky/helldivers.bot/issues/371).

## 0.46.4

### Chores

- **Uniform `warnings[]` return shape on the update orchestrators.** `updateStatus` previously `console.error`'d non-fatal `upsertEventProgress` failures and `updateSeason` did the same for per-snapshot `upsertStatus` failures — silent for the caller. Both now collect non-fatal errors into a `warnings: [{ stage, message }]` array on the return value. `/api/h1/update/route.js` logs them with a `[update] warning:` prefix for operator visibility and returns them in the response body so clients have signal too. The `update/season.test` "logs but does not throw" test updated to assert on `result.warnings[]`.

- **`/api/notifications/subscribe` enforces same-origin + per-IP rate limit.** The POST and DELETE handlers previously accepted any caller — no auth, no rate limit, no ownership binding. Added a same-origin Origin/Host header check (rejects with 403 when the Origin header is missing or points anywhere except the app's own host) and a per-IP token bucket (20 requests per 60s, rejects with 429 thereafter). The IP comes from `X-Forwarded-For` or `X-Real-IP` (Cloudflare/proxy) with an `anonymous` fallback. Full session binding still pending — needs a `push_subscription.user_id` schema migration; deferred to a follow-up.

- **`validateApiKey` no longer collides with the `tryCatch` tuple shape.** `validateApiKey()` returned `{ data, error: string }` where every other helper in the codebase returns `{ data, error: Error | null }`. A destructuring caller using the project's `tryCatch` convention would silently treat the `API_KEY_ERROR` enum string as a thrown error. Renamed the field to `code` so the type difference is explicit; updated `src/app/api/h1/rebroadcast/route.js` to destructure `{ code: keyCode }` and the unit + route tests to match. Added a JSDoc note on the helper documenting why the shape differs.

- **Small-mechanical-wins bundle.** Eight low-risk cleanups grouped into one diff to amortise PR cost:
    - **CLAUDE.md path drift fixed.** The four `src/utils/{tryCatch,responses,time,computeMapState}.mjs` citations now point at the real `src/shared/utils/...` locations; the map-state line also mentions the new `computeLiveMapState` helper.
    - **`diagram.mjs` moved next to its consumers.** The flow/diagram helper had 10/10 importers in `src/app/docs/*` but lived under `src/shared/utils/`. Moved to `src/app/docs/_diagram.mjs` (underscore prefix matches the docs subdir convention for non-route files) and updated all 10 importers + the unit test. The empty `src/shared/utils/diagram.mjs` is gone.
    - **`umami.mjs` uses `tryCatch` and a clear log.** The `sendUmamiEvent` helper previously chained `.then().catch()` and logged `Error:` with no context. Now uses `tryCatch` and logs `[umami] sendUmamiEvent failed: <message>`. Inlined the production hostname (`helldivers.bot`) and removed the dead `getHostname()` switch — the function early-returns in non-production, so the dev/staging branches were never reachable.
    - **`reloadGuard.mjs` flattened.** The two stacked conditionals around localStorage parsing collapsed into a single `prevAttempts` decision: parse → bail-if-too-many → write fresh state → reload. Semantics unchanged; one fewer write site to reason about.
    - **`responses.mjs` numeric range check.** Replaced `String(code).startsWith('1' | '2' | '3')` with `code < 400 || code > 599` (and the success equivalent). Reads as the actual intent.
    - **Scaffolding comments removed.** Dropped the `//0. initialize`, `//1. validate`, ... step-prefix comments from `/api/h1/campaign` and `/api/h1/rebroadcast` — they were a bullet-pointed outline of code that no longer needed it.
    - **`seed.mjs` indirection dropped.** `let files; ...; files = data;` collapsed into a single destructure `const { data: files, error } = ...`.
    - **`initializeEnvironmentVariables` kept `async` deliberately.** Observed as `async-without-await`, but dropping it would convert internal sync throws into unhandled exceptions at the call site, forcing a raw try/catch (banned by CLAUDE.md). Added a comment documenting why the keyword is load-bearing for error semantics.

- **`computeLiveMapState` helper protects the active-events invariant.** The pattern `events.filter(status === ACTIVE) → computeMapState(status, ...)` was duplicated across `src/app/layout.jsx`, `src/app/api/h1/live/route.js`, and `src/app/opengraph-image.jsx`. Encapsulated into `computeLiveMapState(data)` in `src/shared/utils/game/computeMapState.mjs` — call sites can no longer accidentally pass completed events. The existing JSDoc warning on `computeMapState` about live-view filtering is now load-bearing in only one place.
- **`X-Worker-Startup` header is a named constant.** Both ends of the worker → `/api/h1/update` contract previously used a magic string. Now `public/workers/cronLogic.js` exports `WORKER_STARTUP_HEADER` and `src/app/api/h1/update/route.js` exports the same name; a new cross-module test (`src/__tests__/unit/workers/cron.test.mjs`) asserts the two stay in sync case-insensitively.

- **`/api/h1/live` returns the standard success envelope.** Previously the live polling route bypassed `successResponse` and returned a bare `{ data, mapState, appVersion }` body with raw `Cache-Control: no-store`. Now wraps the payload in the standard `{ time, code, message, data }` envelope and passes `Cache-Control: no-store` through a new `headers` option on `successResponse`. `useLiveData` reads from `envelope.data` instead of the top level. The OpenAPI schema for the route was updated to document the wrapped shape. The five ad-hoc `{ time, error_code, error_message }` schemas in the rebroadcast registry entry were replaced with the shared `ErrorResponseSchema`.

- **`db/queries/` upsert exports normalised.** Dropped the redundant `query` prefix on the 5 upsert exports — the directory name already says "queries", so `queryUpsertSeason` / `Status` / `Statistic` / `Event` / `EventProgress` are now `upsertSeason` / `upsertStatus` / etc. All ~15 import sites and 5 test files updated. Tied into the same edit: `upsertEventProgress` now takes `(season, type, event, pollTime)` matching the sibling `upsertEvent(season, type, event)` shape, and the cross-season `if (event.season !== season) return { skipped }` guard moved into the function (out of the call sites in `update/status.mjs`) so all event upserts share one guard pattern.

- **Type-safety JSDoc tightening.** Replaced `string` widenings with literal-union typedefs across the live-data and event surfaces. `useLiveData` and `useLiveDataContext` now expose a `LiveStatus = 'polling'|'live'|'offline'` typedef instead of a bare string, and the `data`/`mapState`/`prevData` return fields are explicitly `object | null`. `detectChanges` returns `kind: 'event_started'|'event_won'|'event_lost'` instead of `kind: string`, and `prevEvents` is documented as nullable. `upsertEventProgress` and `upsertEvent` now type their `type` parameter as `'attack' | 'defend'`. `EventToast`'s `event` typedef was corrected from `id: string|number` to `event_id: number` to match what `showEventToast` and `toastLabel` actually read.

- **Validator protocol unified to raw-schema exports.** `src/validators/isValidStatus.mjs` and `src/validators/isValidSeason.mjs` previously exported `(data) => rootSchema.safeParse(data)` wrapper functions while the other three validators (`isValidContentType.mjs`, `isValidFormData.mjs`, `isValidNumber.mjs`) exported raw Zod schemas. Both wrappers replaced with raw-schema exports so all five validators share one invocation convention: `schema.safeParse(data)`. Callers in `src/update/status.mjs` and `src/update/season.mjs` plus the corresponding unit tests and mocks updated to call `.safeParse()` explicitly.

- **Legacy-wording cleanup.** Replaced "legacy" wording that actually described the public HD1 wire format / public getCampaign shape. `src/db/queries/getCampaign.mjs` JSDoc now says "public getCampaign shape" instead of "legacy getCampaign output"; `src/app/api/h1/rebroadcast/route.js` calls the format "HD1 wire format" not "legacy wire format"; `src/features/admin/actions.mjs` reworded the random-id fallback comment to describe the actual default behavior. Matching test comments in `src/__tests__/unit/queries/getCampaign.test.mjs` updated to "public-shape". Genuine deprecated-format usages (Prisma client migration, Playwright output dir, dismissedEvents storage migrators) left untouched.

### Bug fixes

- **`LiveToasts` catch-up branch was unreachable.** `getDismissedEvents()` returns `Record<string, {status, ts}>` but the catch-up loop was comparing that whole object to `event.status` (and to `EVENT_STATUS.ACTIVE`), so both branches always evaluated `false` — fully-suppressed events and the "dismissed at active → now transitioned" path never fired. The unit test masked it by mocking the legacy string shape (`{1: 'active'}`) that production never produces. Fixed by reading `dismissed[id]?.status` once per iteration and comparing the string against the string. Test mocks updated to `{status, ts}` so future regressions surface.

## 0.46.3

### Chores

- **Soft CDN cache header on HTML page routes** — `next.config.mjs` now emits `Cache-Control: public, s-maxage=30, stale-while-revalidate=60` for all non-API, non-asset paths so a shared cache (e.g. Cloudflare) can collapse concurrent visitors into one origin render per 30s window, and serve the stale copy for another 60s while it refetches. `s-maxage` targets shared caches only, so browsers still revalidate normally and `useLiveData` keeps polling `/api/h1/live` for fresh game state. The source pattern uses a negative lookahead to exclude `/api/*` (preserves `no-store` on live data), `/_next/*` (content-hashed), the asset directories that already have `immutable` long-TTL headers, `/sw.js`, `/workers/*`, and `/profile/*` (per-user content that must not be shared). Note: Cloudflare ignores `s-maxage` on HTML by default — a Cache Rule with "Respect existing headers" is required for this to take effect at the edge.

## 0.46.2

### Chores

- **GitHub Actions pin format switched from SHA → semver tag** across all six workflows (`ci.yml`, `codeql.yml`, `dependency-review.yml`, `metrics.yml`, `release.docker.yml`, `staging.docker.yml`). Bumped each action to its latest released tag at the same time: `actions/checkout@v6.0.2`, `actions/setup-node@v6.4.0`, `github/codeql-action/*@v4.35.5`, `docker/setup-buildx-action@v4.0.0`, `docker/login-action@v4.1.0`, `docker/build-push-action@v7.1.0`, `dorny/paths-filter@v4.0.1`, `lowlighter/metrics@v3.34`. `actions/dependency-review-action@v5.0.0` and `snok/container-retention-policy@v3.0.1` were already current — only the pin format changed. Dependabot's `github-actions` ecosystem will now bump these in-place without needing SHA resolution.

## 0.46.1

### Chores

- **desloppify cleanup pass** — knocked out 9 trivial review issues across the codebase:
    - `getCampaign.mjs` JSDoc now documents `season_duration` in the return shape.
    - `eventFilters.mjs` JSDoc trimmed: removed English description lines that just restated the function names, kept `@param`/`@returns` for type info.
    - `glitchtip/route.js`: `SENTRY_DSN` is read inside the `POST` handler (was module-scope const), `parseDsn()` no longer wrapped in `Promise.resolve().then()` (uses local try/catch since the project `tryCatch` is async-only), `OPTIONS` handler added to match the `methodNotAllowed` convention used by all sibling routes.
    - `season.mjs`: raw `ZodError` throw wrapped in `Error` with `cause` to match `status.mjs` pattern; `getSeasonFromSnapshot()` no longer wrapped in `Promise.resolve()` (uses local try/catch since the function is synchronous-throwing); `updateSeason` return shape now includes `time` to match `updateStatus`.
    - Validators (`isValidStatus.mjs`, `isValidSeason.mjs`): `z.enum` derived from `CAMPAIGN_STATUS` and `EVENT_STATUS` constants instead of inline string arrays.
    - `admin.mjs` Zod schema: `newRole` now uses `z.enum(Object.values(ROLE))`.
    - `auth.js`: BetterAuth `role` field `defaultValue` now uses `ROLE.USER`.
    - `getEventRegionLabel.mjs`, `computeMapState.mjs`, `FactionHealthChart.jsx`: raw `'defend'` / `''` / `'hidden'` / `'defeated'` strings replaced with `EVENT_TYPE.DEFEND` / `MAP_STATUS.IDLE` / `CAMPAIGN_STATUS.*` constants.

- **Deleted single-consumer `formdata.mjs` wrapper** — `formDataToObject` was a one-liner used by exactly one caller. Inlined `Object.fromEntries(formData.entries())` at the call site (`rebroadcast/route.js`) and removed the module + test + docs entries.

- **Moved vestigial `features/docs/` module** — `overviewConfig.mjs` and `overviewDefinition.mjs` relocated to `src/app/docs/` next to their only consumer (`page.mdx`); imports rewritten to relative paths; empty `features/docs/` directory removed.

- **Added `computeMapStateAtEvent` test coverage** — 7 cases covering hidden-state fallback for empty/null inputs, nearest-snapshot selection by time delta, snapshot fallback when none precedes the event, gap-event replay between snapshot and selected time, active-event overlay, and the `campaign.points_max` fallback path.

## 0.46.0

### Features

- **Stale version auto-reload** — three-layer detection prevents `ChunkLoadError` crashes after deployments: (1) Next.js `deploymentId` triggers hard navigation on version skew, (2) `appVersion` field in `/api/h1/live` enables poll-based detection within ~10s, (3) global `unhandledrejection` handler catches chunk/module load failures across all browsers including Safari. Shared `guardedReload()` utility uses localStorage circuit breaker (30s TTL, max 3 attempts) to prevent infinite reload loops.

### Fixes

- **`ApiForm.jsx` Rules of Hooks violation** — `useActionState`/`useState` were called after an early `return` on `!userId` in `GenerateApiKeyForm` and `DeleteApiKeyForm`. Moved hooks above the guard so React's hook call order stays consistent across renders.
- **`UserSection.jsx` exhaustive-deps** — `useEffect` accessed `session.user.image`/`.email` directly while depending on optional-chained property paths; extracted `const user = session?.user` and depend on the whole user object.
- **`DebugTools.jsx` exhaustive-deps** — `handleTestPush` `useCallback` referenced `buildOrUpdatePushEvent` but had `[]` deps; added the dependency (the callee itself has stable `[]` deps so no re-render cascade).

### Chores

- **ESLint v9 flat config + tsc checkJs** — `npm run lint` now gates Prettier formatting, JSDoc validity, React Hooks rules, React Compiler hints, and Next.js core-web-vitals rules through a single command. `npm run typecheck` runs `tsc --noEmit` against an expanded `jsconfig.json` with `checkJs: true`, validating JSDoc annotations across the project without converting any files to TypeScript. CI runs both before tests/build. CLAUDE.md verification rule updated to require all four (`lint`, `typecheck`, `test:unit`, `build`).
- **`<img>` → `next/image`** in 6 spots (faction icons in `DefeatedCard`, `EventCard`, `EventToast`, `EventLogCard`, `FactionTabs`; backstab icon in `StatGrid`). All had explicit width/height; converted to satisfy `@next/next/no-img-element`.
- **`console.log` → `console.info`** in worker lifecycle (`initializeWorker.mjs`), season-transition closing pass (`/api/h1/update`), and push-notification cleanup messages.
- **Dead `start = performance.now()` declarations** removed from `getCampaign.mjs` and `initializeWorker.mjs` (leftover timing scaffold with no `performanceTime(start)` callers).
- **Unused destructures** in `admin.mjs` simplified — `{ user, error: authError } = await requireAdmin()` shortened to `{ error: authError }` in paths where `user` was never read.

## 0.45.2

### Chores

- **Test script reorganization** — `test:e2e` renamed to `test:smoke` for accuracy; `test` now runs unit tests only; added `test:all` for running both unit and smoke tests.
- **Agent skills reference docs** — added `.agents/skills/` reference documentation for React, Next.js, Prisma, Vitest, Zod, Tailwind, and more.
- **Desloppify skill** — added `.opencode/skills/desloppify/SKILL.md` codebase health scanner definition.
- **`formatTimeAgo` simplification** — removed try/catch fallback wrapper; `timeago.js` `format()` is called directly.

### Tests

- **ArchiveComponentsIntegration tests** — added integration tests for archive page components.
- **Async test stabilization** — inlined archive seed data, fixed `act()` usage and suppressed spurious log noise.
- **LastUpdated test timing fix** — adjusted test timing to account for `timeago.js` formatting behavior.

## 0.45.1

### Features

- **Healthcheck probes database** — `/api/healthcheck` now runs `SELECT 1` via Prisma and returns 503 when the database is unreachable, instead of a hardcoded `{ alive: true }`.

### Fixes

- **Dependency security** — bumped hono override to >=4.12.18 (5 CVEs).
- **Docker migrate image** — added missing `zod` + `isValidSeason.mjs` deps for seed script validation; switched CMD to JSON exec form for proper signal handling.
- **`useLiveData` dead code removal** — removed `navigator.onLine` check in `connect()` that was immediately overwritten by `poll()`.
- **`useTrack` partial-umami guard** — guard now checks `typeof window.umami?.track === 'function'` so ad-blocker stubs (`window.umami = {}`) no-op instead of throwing.
- **`vitest.setup.mjs` `after()` mock** — stopped auto-invoking callbacks synchronously. Now records calls without executing, exposing response-timing bugs that were previously hidden.
- **Dismissed-toast-events garbage collection** — entries now carry timestamps and are capped at 200. Oldest entries are pruned on write. Migrates legacy formats (arrays, plain strings) on read.

### Chores

- **Hardened app runtime** — production runner stage switched from `node:24-alpine` to `cgr.dev/chainguard/node:latest` (Chainguard Wolfi-based, near-zero CVEs). Build stages remain Alpine. Removed tini (Next.js standalone handles SIGTERM natively). Healthcheck switched from wget to Node.js `fetch()` for shell-less compatibility.
- **CI deduplication** — added concurrency groups to prevent redundant CI and CodeQL workflow runs; renamed Build Staging workflow to Build Develop.

## 0.45.0

### Features

- **Global MISSIONS_WON card** — the global stats view now shows a `MISSIONS_WON` card (sum of `successful_missions` across factions), matching the per-faction view. Both global and per-faction cards display a "N TOTAL" subtitle showing total missions attempted.
- **Event total subtitle** — the `EVENTS` W : L scoreline card now shows a "N TOTAL" subtitle with the combined win + loss count, in both global and per-faction views.
- **Animated stat counter** — live stat values on the homepage use a slot-counter animation (`AnimatedStat` component via `react-slot-counter`) that rolls digits when values change. Sandbox page at `/sandbox/slot-counter` for development.

### Fixes

- **formatNumber M threshold raised to 10M** — compact "M" suffix now kicks in at 10,000,000 instead of 1,000,000. Values between 1M and 9.99M display with full locale grouping (e.g. `5,000,000`) so users see precise numbers in the range most relevant to Helldivers stats.

### Chores

- **Supply chain quarantine** — new `npm run update:safe` script uses `npx npm-check-updates --cooldown 7d` to only bump to package versions published at least 7 days ago, giving the community time to detect compromised releases.
- **Dependency bumps** — all npm dependencies updated to latest versions.

## 0.44.1

### CI & dev tooling

- **CodeQL now runs on pull requests** — `Analyze (javascript-typescript)` is a required status check on `main`'s branch protection, but the workflow only triggered on `push` to `main`/`develop`. PRs that needed it to merge were permanently `BLOCKED`. Added `pull_request: { branches: [main, develop] }` to `.github/workflows/codeql.yml` so the required check actually fires on PR heads.
- **GitGuardian secret scanning excludes test fixtures** — synthetic VAPID-shaped keys, push subscription endpoints, and JWT-shaped tokens in `src/__tests__/**`, `**/*.test.{js,jsx,mjs,ts,tsx}`, `**/*.spec.{js,jsx,mjs,ts,tsx}`, `**/__fixtures__/**`, and `**/__mocks__/**` are now excluded from secret scanning via `.gitguardian.yaml`. These fixtures are designed to look real so the code-under-test exercises the same validation paths it would in production, but they're random/hand-crafted and not valid anywhere.
- **VAPID test fixtures use obvious placeholder strings** — `notifications-subscribe.test.mjs` previously used an 87-char base64url-shaped `p256dh` that was indistinguishable in shape from a real VAPID public key (GitGuardian flagged it). Replaced both keys with `TEST_*_PLACEHOLDER` strings that still satisfy the Zod regex + length constraints. Suite still 1244/1244.

## 0.44.0

### Features

- **Cookie-backed user preferences** — faction selector, regions view toggle, and event log sort now persist via cookies instead of localStorage. Server components read them via `next/headers.cookies()` and pre-render the correct initial state, eliminating the brief post-hydration flash where the UI switched from default to stored value. New `src/shared/preferences/*.mjs` modules hold each preference's key + default + validator; `usePersistedState(key, initial)` is now a thin wrapper over `useState` + cookie write; the old mount-effect reads are gone. Cookies use `path=/`, `max-age=1yr`, `SameSite=Lax`, `Secure` on HTTPS; classified as "strictly functional" so they sit under the GDPR consent exemption.
- **Preference analytics** — fires a `preference-snapshot` Umami event once per session reporting the user's current faction / regions_view / sort_order. Complements the existing per-toggle click events: clicks capture churn ("how often do users flip?"); the snapshot captures distribution ("what % prefer X?", including default-stickers who never interact). Session-scoped via `sessionStorage` so SPA navigation doesn't double-count.
- **24h player-count delta** — the `HELLDIVERS_ONLINE` / `ONLINE` stat card now shows a signed delta below the number comparing current concurrent players to the 24h rolling average baseline. `getPlayersAvg24h(season)` query returns `{ global, bugs, cyborgs, illuminate }`: per-faction averages come from `AVG(players) GROUP BY enemy` over buckets in the last 24h window, and `global` is the average of per-bucket SUMs (disjoint per-front counts) — more robust to sparse buckets than a single-point "24h ago" snapshot would be. Arrow (▲/▼) carries the success/danger colour, number + `LAST 24H` caption render in uppercase ghost text to match the card label. Hidden on new seasons (no baseline) or when delta is zero.

### Test suite quality (Phase 12)

Suite went from **882 → 1244 tests** (+362 high-signal). Coverage moved from **63.5% → 81.8% statements** / 58.3% → 73.7% branches. Five multi-LLM code review rounds (Codex + OpenCode) applied across the work; every must-fix finding addressed.

- **Theater removal** — rewrote 5 highest-theater test files (`healthcheck`, `useTrack`, `ArchiveMap`, `Header`, `Navigation`) to verify real behaviour instead of stub-rendering. Stopped globally mocking `console.error/warn/log/info` in `vitest.setup.mjs` so React `act()` warnings and source error logs are audible.
- **API route coverage** — 0% → comprehensive for `/api/notifications/subscribe` (Zod validation + Prisma upsert/delete contract + 410-graceful + 500-with-DB-call-asserted), `/api/glitchtip` (DSN parsing, ingest URL forwarding, 502 upstream failure), `/api/auth/[...all]` (auth-disabled 503 vs configured delegate to BetterAuth). Added `expectSuccessEnvelope` / `expectErrorEnvelope` helpers in `@test-utils` and retrofitted `live` + `update` route tests to use them.
- **Hook coverage** — `useLiveData` (was 0% / 284 L): 23 tests covering polling cadence, status state machine, visibility-change handler, singleton-with-multiple-consumers, localStorage cache hydration + write, and BroadcastChannel leader election. `usePersistedState` (foundation hook): 16 tests covering value hydration, validator gating, key changes, and storage failure modes. `useTrack`, `useHeaderGlassFilter`, `useScrollEvent`, `useCyberstanEffects`, `useGlitchCycle` — all now have meaningful coverage with cleanup discipline.
- **Component coverage** — `UserSection`, galaxy `Map`, `eventToast`, `NotificationToggle`, `LiveToasts`, `FactionHealthChart`, `HomeClient`, `ArchivesClient`. Used a capture-style child-mock pattern (`testid` with JSON-encoded prop data) to verify orchestrator wiring without rendering real children.
- **Worker coverage** — `public/workers/cron.js` split into a thin entry shell + `cronLogic.js`. The shell is tested via `Module._load` monkey-patching; the logic via direct unit tests covering setTimeout-not-setInterval non-overlap, X-Worker-Startup first-poll header, error recovery without crashing the loop, and config wiring.

### Fixes

- **Per-faction stats missed ENEMIES_KILLED** — the per-faction view on the homepage never rendered `stats.kills` even though the data was present on each `h1_statistic` row. The global view already summed it. Added as position 2 in the per-faction grid (matching global's ordering).
- **`/api/h1/update` worker thread was broken in production** — `public/workers/cron.js` uses CommonJS `require('worker_threads')`, but the project's root `"type": "module"` made Node load it as ESM, crashing on every spawn. Fixed by adding `public/workers/package.json` with `{"type": "commonjs"}` to scope just the worker directory to CJS. Worker now stays online; worker-heartbeat data should resume in production.
- **`sendWithConcurrencyLimit` reported failed sends as "sent"** — the function returned `sent: subscriptions.length - staleEndpoints.length`, which counted 5xx and network errors as if they had succeeded. Now counts only `Promise.allSettled` results with status `'fulfilled'`. The admin `sendTestNotification` UI is the only consumer; its `{ sent, stale }` display is now truthful.
- **`formatCompactDuration` produced "1h, 30m" instead of "1h30m"** — set `delimiter: ''` alongside the existing `spacer: ''` to match the function's compact-output intent. Consumers (`FactionStats` avg duration, `RefreshSeasonButton` countdown, `EventLogCard` duration) all benefit from the tighter formatting.

### Refactors

- **Homepage layout consolidation** — merged the previously-separate `.home-hero-sidebar` and `.home-scrolly-log` into a single `.home-sidebar` flex column so the dashboard blocks (hero intro, season heading, region cards, stats) flow naturally into the event log below. Desktop grid drops from a 2-row-spanning-map to a straightforward 2-column layout: sidebar on the left, sticky galaxy map on the right. `DashboardClient` returns a Fragment instead of wrapping in `.dashboard-sidebar` so its sections sit directly as flex items of the sidebar, and the sidebar's `gap` provides uniform spacing across all boundaries. `ArchivesClient` and `src/app/archives/page.jsx` got the mirror cleanup (Fragment + Tailwind flex classes on the page wrapper).
- **Homepage region heading** — the `<h2>Regions</h2>` becomes `<h2>Season N</h2>` (reads the active season from live data).

### Documentation

- `/docs/frontend-layout` updated to describe the simplified 2-column grid (no more `grid-template-areas` with `hero-sidebar` / `scrolly-log`).

### Follow-ups filed during the campaign

- `#319` `/api/healthcheck` should probe DB on health check (currently returns a hardcoded `{ alive: true }`)
- `#320` `useLiveData` `navigator.onLine` check is dead code (overwritten by `poll()`)
- `#321` `useTrack` partial-umami guard (throws when `window.umami` exists but `track` is missing)
- `#322` `vitest.setup.mjs` `after()` mock auto-invokes synchronously (hides response-timing bugs)
- `#323` `public/workers/*` needed local `package.json` with `type: commonjs` (fixed in this release)

## 0.43.1

### Chores

- **Dependency bumps (npm minor/patch group)** — `next` & `@next/mdx` 16.2.4 → 16.2.6 (multiple HIGH-severity security advisories: SSRF via WebSocket upgrades, middleware/proxy bypasses, RSC DoS, RSC cache poisoning), `@prisma/client` & `@prisma/adapter-pg` & `prisma` 7.7.0 → 7.8.0, `@sentry/nextjs` 10.49.0 → 10.52.0, `@serwist/next` 9.5.7 → 9.5.11, `better-auth` 1.6.5 → 1.6.10, `axios` 1.15.0 → 1.16.0 (resolves `follow-redirects` 1.15.11 → 1.16.0 transitively), `react` & `react-dom` 19.2.5 → 19.2.6, `@tailwindcss/postcss` 4.2.2 → 4.3.0, `@vitest/coverage-v8` 4.1.4 → 4.1.5, `jsdom` 29.0.2 → 29.1.1, `prettier-plugin-tailwindcss` 0.7.2 → 0.8.0.
- **GitHub Actions bumps (actions group)** — `actions/setup-node` 6.3.0 → 6.4.0, `github/codeql-action` 3.30.6 → 3.30.8, `actions/dependency-review-action` 4.8.0 → 4.8.2, `docker/build-push-action` 6.21.1 → 6.22.0.

## 0.43.0

### Features

- **Regions campaign bar** — new `Sector / Campaign` toggle above the Regions cards on the homepage. Campaign view renders an 11-segment continuous progress bar per faction (sectors 1–10 driven by campaign points, segment 11 by the homeworld attack event). User preference persists in `localStorage`. In campaign view the dedicated homeworld-assault card is absorbed into segment 11 of the main card.
- **Live "Updated Xs ago" counter** — extracted `LastUpdated` into a shared component (`src/shared/components/LastUpdated.jsx`) and moved it from a static footer under the StatGrid to the hero sidebar, on the same row as the notifications toggle. Ticks every second (was 5s and effectively frozen under `reactCompiler: true`) and resets when the next poll arrives. Pass `now` as state so the compiler can't elide re-renders on the hidden `Date.now()` dependency.
- **Faction preference persistence** — homepage and archives both persist the selected faction (Global / Bugs / Cyborgs / Illuminate) to localStorage under `hd1-faction` and share the value across pages. Backed by a new generic `usePersistedState(key, default, isValid)` hook with domain wrappers (`useFactionPreference`, `useEventLogSort`).

### Fixes

- **Archives page flash** — `GlitchText` no longer uses `next/dynamic` with `ssr: false`. The h1 title and body text now ship in the initial HTML on defeat-season views instead of popping in after hydration. The glitch animation still plays as progressive enhancement post-hydration.
- **Footer alignment** — the "Not affiliated…" disclaimer is now top-aligned with the "Humblebee UAV Drone Mk. IV" line on the bottom separator row (was centered between the two lines of the Humblebee stack).

### Refactors

- **Shared `<Button>` primitive** — consolidated all bordered-button patterns across the app (stats faction toggles, regions view toggle, event log sort, archives effects toggle, admin buttons, error pages, account actions, API form buttons) into one `src/shared/components/Button/Button.jsx` with variants (`primary` / `danger` / `success` / `ghost` + three `faction-*`) and sizes (`icon` / `sm` / `md` / `lg`). Replaces ~15 inline Tailwind button signatures with a single primitive. Touch targets improve on mobile: icon mode is 40×40 below the `md:` breakpoint and 30×30 above. Dropped the now-obsolete `FactionTabs.css` file.
- **Homepage stats faction selector** — replaced the horizontal `FactionTabs` tab-bar with 4 faction-colored icon buttons rendered inline with the h2, matching the existing `RegionsViewToggle` convention. Static h2 reads "Stats" (was "Stats — {FactionName}").
- **Archives stats header** — moved `FactionTabs` inline with the "Statistics" h2 (previously a full-width row below), and reordered the right-side control cluster to place `SeasonSelector` before `EffectsToggle`.
- **`usePersistedState` hook** — extracted the scattered localStorage-backed preference logic (regions view, event log sort, faction) behind a single generic hook. Domain-named wrappers where de-duplication pays off; inline calls otherwise.

### Audit / correctness

- **StatGrid**: `ACCIDENTALS` replaced with `ACCIDENTAL_RATE` (accidentals/deaths as %) on global and per-faction views, with the absolute counts as hover title. Per-faction `MISSIONS` relabelled to `MISSIONS_WON` since the field is `successful_missions`. Added a clarifying comment noting why per-faction `players` sum is correct (disjoint populations) and that `total_unique_players` must never be summed (globally replicated field).
- **`evaluateProgress`** JSDoc now documents the linear-rate model and its known bias in early/late-season reads.
- **`countOutcomes`** locked in with a unit test asserting strict `status ∈ {'success','fail'}` matching (no case-folding, no loose match on `'won'`/`'lost'`).

## 0.42.0

### Features

- **Google OAuth** — added Google as a third sign-in provider alongside Discord and GitHub via BetterAuth. Includes official Google branding button on the sign-in page and profile account linking (supports different emails).

### Fixes

- **Worker bucket collision** — `updateSeason` no longer overwrites live `h1_status` buckets when reseeding historical data. Prevents stale snapshot data from clobbering active campaign progress.

### Chores

- Added `@references/` to `.gitignore` to prevent accidental commit of local SQL dumps containing secrets.
- Removed implemented `h1-tables-cleanup` design spec.

## 0.41.1

### Fixes

- **Galaxy map** — fixed false active-event indicator when the event timeline was off-screen. `useScrollEvent` now checks actual viewport visibility instead of pixel distance, preventing completed events from being shown as active on the map.
- **Service worker caching** — added `Cache-Control: no-cache` header on `/sw.js` so browsers always check for updates on navigation, preventing stale app code after deploys.

## 0.41.0

### Database

- **Schema consolidation** — 10 h1\_\*/rebroadcast tables → 5 normalized tables (`h1_season`, `h1_status`, `h1_statistic`, `h1_event`, `h1_event_progress`). Dropped `h1_live`, `h1_live_snapshot`, `h1_snapshot`, `h1_introduction_order`, `h1_points_max`, `h1_event_snapshot`, `rebroadcast_status`, `rebroadcast_snapshot`, `App`, `Review`.
- **Bucket-upsert pattern** — all timeseries tables use tumbling-window UPSERTs keyed on `(entity, bucket)` where `bucket = floor(poll_time / BUCKET_SIZE) * BUCKET_SIZE`. Sub-15s homepage freshness with ~120 MB bounded storage. `BUCKET_SIZE` is env-configurable (default 900 = 15 min).
- **`h1_season` inlining** — `introduction_order Int[]`, `points_max Int[]`, and `season_duration Int` are now direct columns on `h1_season` (previously in separate 1:1 tables).
- **`h1_snapshot.data` normalized** — stringified JSON-in-JSON column replaced by typed columns on `h1_status`. Consumers no longer need defensive `typeof === 'string' ? JSON.parse : data` parsing.
- **`h1_live.map` dropped** — precomputed galaxy map column was never read; `computeMapState` already rebuilds at request time.

### Worker

- **`snapshotTimers.mjs` deleted** — 91 lines of stateful in-memory throttle tracking replaced by 5-line deterministic `src/update/bucketing.mjs` helper. The DB uniqueness constraint IS the throttle.
- **`computeFactionMap` deleted** — precomputation removed; `computeMapState` rebuilds at request time.
- **`data.live` → `data.status`** — cascade rename across all consumers to match the `h1_live` → `h1_status` table rename. `/api/h1/live` URL and `useLiveData` hook stay.

### API

- **Rebroadcast endpoint** — reconstructs HD1 wire format from normalized tables on demand (no raw cache dependency). 4 event-count stats fields (`defend_events`, `successful_defend_events`, `attack_events`, `successful_attack_events`) omitted from statistics[] (derivable from `h1_event`).
- **`h1_event.players_at_start` null-protection** — update path only sets the field when a non-null value is present, preventing `get_snapshots` reseeds from clobbering live-captured values.

### Tooling

- **`scripts/backfill-h1-tables.mjs`** — offline reseed tool for production migration. Reads from pg_dump restore, writes to new schema via Prisma. Per-season transactional, resumable, `--force` flag.

### Documentation

- Updated DataFlowDiagram component, CLAUDE.md architecture section, and `/docs` pages (database, data-flow, utilities) for the new 5-table schema.

## 0.40.7

### Documentation

- **`CLAUDE.md`** — replaced stale `fetchAndSeedSeason` reference on
  the "On-demand season fetching" bullet. That function was deleted in
  0.40.5 during the backfill consolidation; the bullet now correctly
  names `updateSeason` (`src/update/season.mjs`) and enumerates which
  tables it writes plus the `last_updated` stamping behavior.
- **`prisma/seed/readme.md`** — expanded from a 4-line placeholder to
  a full workflow guide. Covers the layout of the seed directory, when
  and how to refresh the JSON files via `fetch-seasons.mjs` (including
  the post-0.40.6 "never active season" guarantee), how `seed.mjs`
  loads them via `prisma db seed`, the `FORCE_SEED=true` override for
  re-seeding when the DB already has parity, and how the three
  backfill paths (seed, fetch-seasons, runtime `updateSeason`) relate
  without conflict.
- **`src/app/docs/infrastructure/page.mdx`** — added a paragraph to
  the `Dockerfile.migrate` section explaining where the
  `seasons/*.json` files come from (`fetch-seasons.mjs`), why the
  active season is never captured, and pointing readers to
  `prisma/seed/readme.md` for the full workflow. Also noted the
  `seed.mjs` short-circuit behavior (`dbCount === jsonFiles.length`)
  and the `FORCE_SEED=true` override.

## 0.40.6

### Changed

- **`prisma/seed/fetch-seasons.mjs` no longer fetches the currently-active
  season.** The script's `--to` default used to resolve to the
  auto-detected current season from `get_campaign_status`, which meant
  every run captured the active season's partial mid-war state to disk.
  That partial file would then reseed incomplete data on every fresh
  deploy until the next manual refresh — exactly the failure pattern
  that caused season 156 to have only 17 snapshots on disk when its
  final state was 37. Now:
    - `--to` defaults to `currentSeason - 1` (the last completed season).
    - An explicit `--to=<current-or-higher>` is clamped to
      `currentSeason - 1` with a warning, so users cannot accidentally
      capture the active war.
    - A new guard exits early with an informative message if
      `--from > --to` after clamping (e.g. `--from=157 --to=157` when
      season 157 is active).

### Data

- **Refreshed all 156 completed-season seed files in
  `prisma/seed/seasons/`.** Running the updated script against the live
  API brought disk data to parity for 9 seasons with real drift:
    - Seasons 148-152: each was missing exactly one snapshot + one event
      (the closing frame pattern the 0.40.5 worker fix now prevents going
      forward).
    - Season 153: missing 21 snapshots + 39 defend events + 3 attack
      events (unusual drift — suggests an earlier run captured 153
      mid-war; 0.40.5 + the script guard would have prevented this).
    - Season 156: missing 20 snapshots + 33 defend events + 1 attack
      event (the known Apr 4 mid-season fetch, now complete).
    - Seasons 1-147, 154, 155 had no data changes; only the top-level
      `time` field (fetch timestamp) was refreshed. The `time` field is
      kept intentionally — it serves as a provenance marker for when each
      seed file was last validated against the live API.

    Fresh deploys using `prisma db seed` now get complete historical data
    for all 156 completed seasons instead of the partial Apr 4 snapshot.

## 0.40.5

### Fixed

- **Worker now captures the closing snapshot of an outgoing season during
  transitions.** When the HD1 API transitions from one season to the next,
  it writes one final "closing" snapshot to the old season's history a few
  minutes after the transition point. Previously,
  `src/app/api/h1/update/route.js` called `updateSeason(currentSeason)`
  only — once `getSeasonFromStatus` flipped to the new season, the worker
  abandoned the old one and never fetched that closing frame. Verified on
  season 156: DB had 36 snapshots, live API had 37 (the missing one at unix
  time `1776189902`, 4 minutes after our DB's `last_updated`). Fix:
  module-level `lastSeasonObserved` state in the route handler; if the
  current poll's season is higher, run `updateSeason(previousSeason)` once
  before processing the current season. Non-fatal on error — the current
  season's update still proceeds. Three new unit tests in
  `update.test.mjs` cover transition detection, no-op when season stays
  the same, and closing-pass failure isolation.
- **Season 156 missing closing snapshot.** One-time recovery: click the
  admin "Refresh" button on `/archives?season=156` after deploy to
  backfill the missing frame. The transition fix above prevents this
  recurring on future transitions.

### Changed

- **Consolidated `updateSeason` and `fetchAndSeedSeason` into one helper.**
  `src/db/queries/fetchAndSeedSeason.mjs` was a near-duplicate of
  `src/update/season.mjs` (`updateSeason`) — both did "fetch
  `get_snapshots`, validate, upsert into normalized tables."
  `updateSeason` does strictly more (also writes to `rebroadcast_season`
  and stamps `h1_season.last_updated` via `queryUpsertSeason(season, true)`).
    - Deleted `src/db/queries/fetchAndSeedSeason.mjs` and
      `src/__tests__/unit/queries/fetchAndSeedSeason.test.mjs`.
    - Migrated `src/app/archives/page.jsx` to call `updateSeason(season)`.
    - Migrated `src/features/archives/reseedSeason.mjs` to call
      `updateSeason(season)` and removed the now-redundant manual
      `db.h1_season.update({ last_updated: new Date() })` block
      (`updateSeason` stamps it internally). Updated
      `reseedSeason.test.mjs` accordingly.
    - Net effect: one backfill helper instead of two, no behavioral
      regression. The `/archives` on-demand path now also writes to
      `rebroadcast_season` — a pure addition; nothing previously depended
      on the absence of that write.

### Documentation

- **`CLAUDE.md`** updated the data-source separation rule to refer to
  `updateSeason` (post-consolidation) and added a new bullet documenting
  the season transition closing pass pattern.
- **`src/app/docs/utilities/page.mdx`** — section 13 rewritten from
  "On-Demand Season Fetching — `fetchAndSeedSeason`" to
  "On-Demand Season Fetching — `updateSeason`" with the three caller
  paths enumerated (worker poll, `/archives` on-demand, admin refresh).
- **`src/app/docs/data-flow/page.mdx`** — frontend on-demand fetching
  section updated to reference `updateSeason`; new "Season transition
  closing pass" subsection added.

## 0.40.4

### Fixed

- **Worker no longer spams `Multiple seasons present in status data`
  on every poll.** `getSeasonFromStatus` was aggregating the season
  field from `defend_event` into the current-season resolver, but the
  HD1 API's `defend_event` slot is a "most recent event" slot that
  persists across season transitions until replaced by a new defend
  event — exactly the same reason `attack_events` was already
  excluded with a `//can be from old season` comment. After the
  156→157 transition, `defend_event.season: 156` stuck around while
  `campaign_status` and `statistics` were all on 157, and the
  resolver's dedup log warned on every 10s poll. The algorithm's
  output was still accidentally correct (because `campaign_status`
  came first in the aggregation and `Set` iteration preserved
  insertion order, so `uniqueSeasons[0]` = 157), but the signal was
  fragile and the noise floor was unacceptable. Fix: exclude
  `defend_event` from `getSeasonFromStatus` entirely. The existing
  cross-season safety guard in `queryUpsertEvent`
  (`if (event.season !== season) skip`) already prevents lagged
  events from leaking into the wrong season bucket, so no new guards
  are needed downstream.

### Changed

- **`isValidStatus` now requires at least one entry in both
  `campaign_status` and `statistics`.** Previously the Zod schema
  accepted empty arrays, which would have crashed
  `getSeasonFromStatus` with `No seasons found in status data`. The
  real HD1 API always returns 3 entries each, so this `.min(1)`
  tightening codifies an assumption the resolver already made;
  malformed responses now fail at the input validator boundary
  instead of deeper in the worker pipeline. Replaced the old
  "accepts empty arrays" test with three separate cases covering
  the new contract.

### Documentation

- **`CLAUDE.md` now documents the data-source separation rule and
  the lagged event slots.** Added two bullets under
  **Architecture — Stack**:
    - `get_campaign_status` → `h1_live` (homepage live section) +
      `h1_event` (new events); `get_snapshots` → `h1_snapshot` +
      `h1_event` (historical); the two pipelines must not interact in
      backfill paths, and `fetchAndSeedSeason` must never touch
      `h1_live`. `h1_live_snapshot` is currently write-only — no
      consumers except `snapshotTimers.mjs`' throttle bootstrap.
    - `defend_event` and `attack_events` in `get_campaign_status` are
      "most recent event" slots that persist across transitions;
      `getSeasonFromStatus` must not use their `.season` as a
      current-season signal, and `queryUpsertEvent` has the skip guard
      as a safety net.

## 0.40.3

### Fixed

- **`/archives?season=N` no longer crashes with `TypeError: Cannot mix
BigInt and other types` for seasons that have both events and
  `h1_live` rows** (i.e. any season the worker was polling during).
  `ArchiveStats.sumBigInt` seeded its accumulator with `0n` and added
  `(f[field] ?? 0n)`, but only 5 of the 16 numeric fields in `h1_live`
  are actually `BigInt` in the Prisma schema (`kills`, `deaths`,
  `shots`, `hits`, `accidentals`); the others (`missions`,
  `successful_missions`, `total_unique_players`, `players`, ...) are
  `Int` and come back from Prisma as plain JS `Number`. Mixing them
  with a BigInt accumulator threw. Fix: coerce to BigInt explicitly
  with `BigInt(f[field] ?? 0)`, which is idempotent on BigInt input
  and safely converts integer Numbers. Added a JSDoc warning on
  `sumBigInt` listing the BigInt-vs-Int column split and the
  per-season fields that must never be summed.
- **`TOTAL_DIVERS` on `/archives` no longer triple-counts.**
  `ArchiveStats.jsx:160` was calling `sumBigInt(live, 'total_unique_players')`,
  but that field is documented in `/docs/database` and `/docs/hd1-api`
  as "Unique players across the season" — a global per-season value
  that the API repeats verbatim across all three faction rows. Summing
  turned a real `983` into `2,949`. Fixed by reading from a single row
  (`live[0]?.total_unique_players`). This was a latent bug masked by
  the BigInt crash; fixing the crash alone would have shipped wrong
  numbers publicly, so both fixes land together. Caught during a
  4-way adversarial design review (Gemini flagged it first).
- **Test fixtures now mirror real Prisma return types.** The existing
  `mockLive` in `ArchiveStats.test.jsx` used BigInt literals for every
  field including `missions`, `successful_missions`,
  `total_unique_players`, and `players` — fields that Prisma actually
  returns as JS `Number`. The test never reproduced the production
  bug. Rewrote the fixture so Int columns use `Number` and only the
  five actual BigInt columns use BigInt literals. Added a correctness
  assertion verifying `total_unique_players` is read from a single
  row (`100,000`), not summed across all three (`300,000`), so the
  triple-count regression cannot sneak back in.
- **Defensive zero-check in `formatPercent`/`formatRatio`.** Changed
  `denominator === 0n` → `!denominator`, which works for both BigInt
  `0n` and plain `0`. Safe today because denominators come from
  `sumBigInt` and are always BigInt, but the strict-equality check was
  brittle against any future caller passing a plain Number.

## 0.40.2

### Documentation

- **Release process in `CLAUDE.md` now documents the merge-back step.**
  After tagging `vX.Y.Z` on `main`, `main` must be merged back into
  `develop` (`git checkout develop && git merge origin/main && git push`)
  so that the PR merge commit GitHub creates on `main` lands on
  `develop` too. Without this, every release PR eventually fails the
  "head branch not up to date with base" protection check, because
  `main` accumulates merge commits `develop` has never seen — even
  though no actual code diverges. Discovered while releasing v0.40.1:
  three prior release merge commits (#276, #263, #237) had to be
  back-merged in one lump before the release PR could be merged.
  Going forward, doing the merge-back after every release keeps the
  topology clean.

## 0.40.1

### Changed

- **Archives `Statistics` and `Faction Analysis` sections merged into
  one.** The `Global` tab in `FactionTabs` previously rendered nothing
  (since `FactionStats` only maps Bugs/Cyborgs/Illuminate to enemy
  indices); it now renders the whole-war `<ArchiveStats>` overview
  instead. Bugs/Cyborgs/Illuminate tabs continue to render
  `<FactionStats>` per-faction. `/archives` now defaults to the
  `Global` tab on first load so visitors land on the overview before
  drilling into factions. The standalone `Faction Analysis` H2 is
  gone; all stat cards live under the single `Statistics` heading now.
  Composition change only — `ArchiveStats`, `FactionStats`, and
  `FactionTabs` internals are unchanged.

## 0.40.0

### Fixed

- **Pinned map gets symmetric 1rem top padding** to match the existing
  bottom padding, so the galaxy SVG no longer sits flush against the
  header's bottom edge. Applied to both `.home-map--sticky` and
  `.archives-map-col--sticky`, with matching `padding-top: 0` resets
  in the lg+ grid-cell overrides.
- **Pinned map backdrop no longer flickers transparent on scroll-down
  or when the header hides.** `public/scripts/headerGPU.js` was
  publishing `--header-bg` and `--header-glass-filter` via the same
  `setHeaderBg` function that mutated the `<header>` element's own
  `backgroundColor`. The header's direction-aware logic (paint
  transparent on scroll-down, glass on scroll-up) was correct for the
  header element itself but wrong for the pinned map, which is
  on-screen continuously and should not flicker. Split into
  `setHeaderElementBg` (direction-aware, header DOM only) and a new
  `publishMapBackdrop(scrollTop)` (direction-agnostic, CSS vars only).
  Map backdrop now follows a pure function of `scrollTop`: 0 alpha in
  the top zone (≤80px), linearly interpolated 0→0.85 through 80–240 px,
  full `rgba(19,19,19,0.85)` + `blur(8.8px)` past 240 px, regardless
  of scroll direction or whether the header element is currently
  visible. Mobile (<md) is unaffected — it already uses a solid
  `--color-surface-1` background and does not consume `--header-bg`.
  Also updates `src/app/docs/frontend-layout/page.mdx` to document
  the new direction-agnostic contract.

### Added

- **Admin-only "Refresh" button next to the season selector on
  `/archives`** — force re-fetches the currently-viewed season from the
  official HD1 API via `fetchAndSeedSeason()` and revalidates the page.
  Motivation: found an ingestion gap on season 153 where a failed
  region-0 defend (event_id 4774, Bugs attacker) was present in the
  raw rebroadcast snapshot but missing from the normalized `h1_event`
  table — likely because it was still `active` at the last poll
  before the worker rolled over to season 154, tripping the
  `isValidSeason.mjs` "no active defends" refinement and dropping the
  whole batch. New server action `src/features/archives/reseedSeason.mjs`
  wraps `fetchAndSeedSeason` with a BetterAuth admin check, stamps
  `h1_season.last_updated = now`, and calls `revalidatePath('/archives')`.
  Client button `src/features/archives/RefreshSeasonButton.jsx` uses
  `useTransition` for a pending state and calls `router.refresh()` on
  success. Disabled for 24 hours after the most recent refresh
  (driven by `data.last_updated` read from `getCampaign()`) to prevent
  API hammering — during cooldown the button label changes to
  `Next refresh in Nh` (via `formatCompactDuration`) so the reason is
  visible without hovering. The cooldown check runs in a `useEffect`
  so SSR always emits the static `Refresh` label and hydration stays
  clean. Hidden entirely for non-admin users. No UI change for regular
  visitors.

### Changed

- **Archives Statistics section: `WIN_RATE` split into `DEFENSE_RATE` +
  `ATTACK_RATE`; `NARROWEST_WIN` / `NARROWEST_LOSS` cards removed.**
  The old global `WIN_RATE` lumped defends and attacks together, which
  was dominated by defend counts (~77 defends vs ~3 attacks per season)
  and didn't correlate with the actual war outcome. It's now two
  independent cards: `DEFENSE_RATE` (`successfulDefends / defends`) and
  `ATTACK_RATE` (`successfulAttacks / attacks`), each with
  `N / total` subtitles and the same `>50% → success, ≤50% → danger`
  accent flip. `NARROWEST_WIN` / `NARROWEST_LOSS` were per-event cards
  with inverted mental models ("WIN" = defensive hold, "LOSS" = failed
  offensive) and vanished on blowout seasons due to a `> 0.5` gate —
  removed entirely. `WORST_CASCADE` retained since it tells a clear
  narrative ("N regions lost in a row to faction X"). The now-dead
  `findClosestCalls` function in `src/shared/utils/game/seasonAnalytics.mjs`
  and its unit tests have been deleted.
- **Archives stats flattened under single `Statistics` heading** — removed
  the internal `War Summary`, `Notable Moments`, and `Combat Record`
  sub-headings from `ArchiveStats.jsx`. All stat cards (outcome, duration,
  win rate, close calls, cascade, combat record) now flow as a single grid
  under the existing `<h2>Statistics</h2>` in `ArchivesClient.jsx`. Dropped
  the now-unused `sectionHeading` constant and `hasNotableMoments` gate.
- **Archives `DURATION` now derived from `h1_snapshot` poll span** —
  `ArchiveStats.jsx` reads `data.snapshots` (already selected by
  `getCampaign()`, ordered by `time: 'asc'`) and uses `last.time −
first.time`. Event span remains as a fallback for archives with fewer
  than two snapshots. Rendered in whole days as the main value
  (e.g. `52 days`, `1 day`) with a humanized breakdown as the
  subtitle (`humanize-duration` with `{ largest: 2, round: true }` —
  e.g. `8 weeks, 3 days`). The day-only headline makes season-to-season
  comparison easy; the humanized subtitle surfaces the shape of the
  war without forcing a mental conversion from raw minutes. Reason:
  archive analytics must derive from snapshot data, not `h1_live`
  (homepage-only).
- **Archives `OUTCOME` card now shows the attributed faction as a
  subtitle** — `getWarOutcome.mjs` returns a new `faction` field
  (number 0–2 or null). Victory: enemy id of the latest successful
  attack event ("who did the Helldivers defeat last"). Defeat: enemy id
  of the latest failed region-0 defend event ("who were the Helldivers
  defeated by"). `null` when no such event exists — no fallback
  guessing from other signals. `ArchiveStats.jsx` renders the faction
  name from `src/shared/enums/factions.mjs` as the card subtitle, or
  hides it when faction cannot be attributed.

## 0.39.15

### Documentation

- **New `/docs/frontend-layout` page** covering the pinned-map state
  machine end-to-end: class layering (`--sticky` vs `--pinning`), the
  slide-in-from-behind-header animation, the scroll-hiding header
  integration via `--header-offset`, the tablet background mirror
  (`--header-bg`), the Lightning CSS backdrop-filter workaround and
  the `useHeaderGlassFilter` hook, desktop `lg+` grid cell layout,
  and a full reference of source files and changelog entries that
  led to the current implementation. Added to the `DocsSidebar` under
  the `Architecture` section.
- **Expanded top-of-file JSDoc** in the critical files that
  participate in the pinned-map pipeline: `HomeClient.jsx`,
  `ArchivesClient.jsx`, `HomeClient.css`, `ArchivesLayout.css`,
  `public/scripts/headerGPU.js`, `Header.jsx`, `Map.jsx`. Each file
  now carries a brief narrative of what it does, how it relates to
  the three CSS custom properties published by `headerGPU.js`, and
  why specific values (`z-40` / `z-50`, `top: 49/79px`,
  `preserveAspectRatio="xMaxYMid meet"`) were chosen.
- **`README.md` refresh** to reflect the current app state:
  corrected the outdated "Server-Sent Events (SSE)" reference to
  match the actual polling-based live data loop (`useLiveData` hook
    - `BroadcastChannel` leader election); added a "Stack at a glance"
      table covering framework, database, auth, PWA, observability,
      analytics, and testing; added a "Frontend at a glance" section
      summarizing the interactive galaxy map, scrollytelling event log,
      pinned-map state machine, and live polling loop; updated the API
      section with `/api/h1/live` and the internal routes
      (`/api/healthcheck`, `/api/notifications/subscribe`,
      `/api/auth/[...all]`, `/api/umami`, `/api/glitchtip`); and noted
      that all user features are gated behind `BETTER_AUTH_SECRET` so
      auth is optional.

## 0.39.14

### Bug Fixes

- **Max-height cap now only applies when the map is pinned**, not in its natural flow position. v0.39.12 applied `max-height: 55dvh` + aspect-width cap + `margin-inline: auto` centering to `.home-map #map > svg` / `.archives-map-col #map > svg` regardless of pin state. Moved the rule to `.home-map--sticky #map > svg` / `.archives-map-col--sticky #map > svg`. On homepage, an unpinned galaxy renders at its full natural size; after FAB click, the cap kicks in. (Archives defaults to `--sticky` on from mount — see below — so the cap is still active from first paint on that page; the user accepted the trade-off.)
- **Replaced the clip-path pin-in animation with a slide-in-from-behind-header keyframe.** v0.39.10's `clip-path: inset(0 0 100% 0) → inset(0 0 0 0)` unfurled the map top-down at its sticky position — subjectively felt more like "drawn in place" than "slid in." New keyframe uses `transform: translateY(calc(var(--header-offset, 0px) - 100% - 80px))` → `translateY(var(--header-offset, 0px))` so the map starts fully above the viewport (shifted by its own height + an 80px header-height buffer) and slides down to its resting position. During the slide, a transient `.home-map--pinning` / `.archives-map-col--pinning` class drops the map's `z-index` from `50` to `10`, which puts it below the header's `z-40` — the header literally occludes the map while it slides, so it emerges from behind the header rather than sliding on top. After 400ms JS removes the transient class, `z-index` snaps back to `50`, and the 1px border-overlap trick works again. Composes cleanly with the live `--header-offset` tracking via the same transform property.
- **Pinned-map styles are now split between two classes** so the slide animation only plays on explicit pin transitions. Previously `.home-map--sticky` carried both the pinned visuals (`position: sticky`, `top`, `z-index`, `background`, etc.) AND the `animation` property, which meant the animation re-triggered on every mount — fine for the homepage (default unpinned → FAB click adds class) but wrong for archives default-pinned (class applied from first paint would auto-play the animation). New split: `--sticky` owns the persistent pinned styles only; `--pinning` is a transient class added for exactly 400ms by `togglePin`'s `setTimeout` when the React state flips from unpinned → pinned, and it owns `z-index: 10 + animation`. On mount (including archives default true), `isAnimating` starts `false`, no `--pinning` class, no animation.
- **Pinned map background on tablet+ now mirrors the header's live state via CSS vars + a React hook.** Mobile (<md) keeps its solid `var(--color-surface-1)` + ghost border. At md+ (≥768px) where the header is transparent by default and gains `rgba(19, 19, 19, 0.85)` + `backdrop-filter: blur(8.8px)` when scroll-revealed mid-page, the map now reads `background: var(--header-bg, transparent)` directly from CSS via a custom property published on `<html>` by `headerGPU.js`'s new `setHeaderBg()` helper. The map's background tracks the header 1:1 at every scroll state with no separate JS coupling on the React side. The matching `backdrop-filter: blur(8.8px)` had to be applied via inline `style={{ backdropFilter, WebkitBackdropFilter }}` in `HomeClient.jsx` / `ArchivesClient.jsx` because Lightning CSS (Turbopack's CSS optimizer) strips `backdrop-filter` declarations that reference custom properties from the built stylesheet — same issue that bit v0.39.7. A new `useHeaderGlassFilter` hook (`src/shared/hooks/useHeaderGlassFilter.mjs`) reads the `--header-glass-filter` var and updates via `MutationObserver` on `<html>`'s style attribute, bailing on no-op re-renders so the 60-fps scroll updates to `--header-bg` don't cause React churn.
- **Archives is pinned by default.** `ArchivesClient.jsx:isMapSticky` initial state flipped from `false` to `true`. The map starts in its natural flow position below the stats section; native `position: sticky` engages silently as the user scrolls down to it (same semantics as clicking the homepage FAB when already past the threshold). The slide animation deliberately does NOT play on first load because `isAnimating` remains `false` through mount. The FAB stays present on both pages — it still toggles pinned state, and re-pinning via the FAB plays the slide animation on both. Only the initial state differs.

## 0.39.13

### Bug Fixes

- **Pinned galaxy map now follows the scroll-hiding header on tablet.** At `md+` (≥768px) the header uses `public/scripts/headerGPU.js` to shift its own `top` by scroll delta (0 at rest, `-80px` when fully hidden), creating a "parks just above the viewport" effect. The sticky pinned map stayed fixed at `top: 79px` regardless, so when the header scrolled away there was an 80px empty band above the map — the map looked disconnected from the header bar it visually belongs to. Now `headerGPU.js` also writes the current offset as a `--header-offset` CSS custom property on `<html>`, and `.home-map--sticky` / `.archives-map-col--sticky` apply `transform: translateY(var(--header-offset, 0px))` so the map's visual position tracks the header 1:1. Layout-wise the sticky box still pins at `top: 49/79px`, so pin/unpin geometry and the `clip-path` reveal animation are untouched — only the rendered pixels shift.
- Uses `transform` rather than mutating `top` so the browser's sticky-engagement math (which looks at the element's natural layout position, not its transform) continues to work, and shifts happen on the GPU without triggering layout recalcs during scroll.
- `headerGPU.js` drops the custom property in `resetHeader()` when the breakpoint drops below `md`, so the fallback `0px` kicks in and the map visually sits at its normal sticky position — no stale offset bleeding between breakpoints. Desktop `lg+` reset block also explicitly sets `transform: none` for stale-class safety when a viewport resize from tablet to desktop leaves the `--sticky` modifier on.

## 0.39.12

### Bug Fixes

- **Mobile galaxy map is now capped at `55dvh` and horizontally centered.** The galaxy's natural aspect ratio (`806.93 / 868.81` ≈ 0.928) means at a portrait-tablet viewport width like 768px the SVG would render ~827px tall, filling >80% of a 1024px iPad viewport and visually "covering" the page. Cap the SVG's `max-height` at `55dvh` so it takes about half the visible viewport and the rest of the dashboard (event log, etc.) stays in view.
- **Horizontal centering was tricky** because `Map.jsx`'s SVG uses `preserveAspectRatio="xMaxYMid meet"` — when the SVG box has leftover horizontal space, that alignment pushes content hard against the right edge, which on a capped-height tablet layout would leave a big empty dark band on the left instead of centered content. Rather than change the preserveAspectRatio (which affects the desktop right-column map too), cap `max-width: calc(55dvh * 806.93 / 868.81)` so the SVG box itself matches the content's aspect ratio exactly — no leftover horizontal space inside the SVG for `xMax` to push into — and then `margin-inline: auto` centers the whole shrunk box inside the full-bleed sticky panel.
- Applies to `.home-map #map > svg` and `.archives-map-col #map > svg` (scoped to the galaxy's Map.jsx wrapper so incidental icon SVGs elsewhere aren't caught). Explicit `max-height: none` / `max-width: none` / `margin-inline: 0` reset inside the `@media (min-width: 1024px)` block unwinds all three at desktop so the real grid cell is sized by its flex chain.

## 0.39.11

### Bug Fixes

- **Sticky mobile map is now visually seamless with the header.** Four small changes combined: (1) map `top` dropped from `50px` → `49px` (and `80px` → `79px` at sm+) so the map's top row lands on the exact pixel where the header's 1px bottom border is drawn; (2) header demoted from `z-50` → `z-40` and pinned map bumped from `z-10` → `z-50` so the map wins at that 1px overlap and its `surface-1` background overpaints the ghost hairline — no more visible seam between the two dark panels; (3) full-bleed `margin-inline: calc(50% - 50vw)` + `padding-inline: calc(50vw - 50%)` pull the pinned map's background out past the `.gutters` horizontal padding so the surface-1 panel spans edge-to-edge like the header does; (4) `padding-bottom: 1rem` added so the galaxy SVG no longer touches the map's own ghost-colored bottom border (matches the mobile gutter `px-4`).
- All four apply to `.home-map--sticky` (homepage) and `.archives-map-col--sticky` (archives) identically. The desktop `lg+` reset block explicitly unwinds all of them so a stale modifier class left over from a mobile→desktop viewport resize can't leak into the desktop grid column. Only the header's Tailwind class (`src/shared/components/Header/Header.jsx:15`) changes on the JSX side.
- Grepped for `z-40` / `z-50` collisions before demoting the header: none found. BottomNav at `z-50` is bottom-of-viewport and doesn't visually overlap with the top-pinned map; the `focus:z-50` skip-to-content link (`src/app/layout.jsx:187`) still sits above both the demoted header and the pinned map when focused; Navigation's own inner `z-50` lives inside the header's own stacking context (now rooted at 40 globally) and is visually unaffected.

## 0.39.10

### Bug Fixes

- **Sticky mobile map now shares the header's background for a continuous "plane" look.** v0.39.8 drew a `filter: drop-shadow()` halo around the pinned galaxy; v0.39.10 replaces that with a solid `background: var(--color-surface-1)` + `border-bottom: 1px solid var(--color-ghost)` applied only on mobile (reset to transparent at `lg+`). This matches the header's own mobile styling so the pinned map and fixed header read as one dark panel at the top of the viewport.
- **Pin-in animation switched to a `clip-path: inset(0 0 100% 0) → inset(0 0 0 0)` reveal** instead of a `translateY` slide. The translate variant would have revealed the map's bottom edge first — with `position: sticky; top: 50px`, a negative translate shifts the whole box up so its bottom sits at y=50, meaning the _bottom half_ arrives first, not the top. The clip-path variant reveals top-down from the header's bottom edge, which is the intended "slide out from behind the header" feel. Duration bumped from 280ms → 400ms for the larger reveal. `@media (prefers-reduced-motion: reduce)` still disables the animation entirely.
- Applies identically to `.home-map--sticky` and `.archives-map-col--sticky`.

## 0.39.9

### Bug Fixes

- **Scroll-sync "selected event" anchor now sits at 75% of viewport height on mobile (<1024px), up from 38%.** On mobile, when the user pins the galaxy map to the top via the FAB, the pinned map occupies roughly the upper half of the viewport — with the previous 38% anchor, the scroll-sync hook selected whichever event card was closest to 38% down the visible area, which landed _behind_ the pinned map's drop-shadow halo. The selected card was effectively invisible. Bumping the mobile anchor to 75% keeps the highlighted card in the lower quarter of the viewport, always visible below the pinned map area. Desktop anchor stays at 38% because the map is in the right column there, not overlapping the event log. Drift range on mobile (`0.15`) is also tighter than desktop (`0.24`) so the anchor stays below 90% even at page bottom.
- Single change to `src/features/archives/useScrollEvent.mjs` — self-detects mobile viewport via `window.innerWidth < 1024` inside the scroll handler, no caller changes.

## 0.39.8

### Changes

- **Sticky mobile map now uses a CSS drop-shadow halo instead of a radial gradient fill.** v0.39.7 used `background: radial-gradient(...)` + `backdrop-filter: blur()` to create a frosted-glass effect, but the gradient filled the full rectangular map container and occluded content in corners. Replaced with a two-layer `filter: drop-shadow()` stack that casts a soft dark halo around the SVG galaxy's actual visible shape — the shadow follows the paths of the map and fades radially away from them. Content scrolling behind the map stays fully visible wherever the galaxy shape doesn't reach, so event log cards are clearly readable at the corners and sides; only the area immediately around the map's visible content is darkened. The double-layered shadow (24px blur + 8px blur, both near-black) gives the halo enough density to read against bright scrolling content without using any backdrop-filter or background fill. Applies to both `.home-map--sticky` and `.archives-map-col--sticky`, both now pure CSS (no inline-style workaround — `filter: drop-shadow` isn't stripped by Lightning CSS the way `backdrop-filter` was).

## 0.39.7

### Changes

- **Sticky mobile map now uses a frosted-glass effect instead of a solid black background.** Both `.home-map--sticky` (homepage) and `.archives-map-col--sticky` (archives) previously had `background: var(--color-surface-0)` which painted a hard rectangular occlusion over scrolling content. Replaced with `background: radial-gradient(ellipse at center, rgba(19,19,19,0.85) 20%, rgba(19,19,19,0.45) 65%, rgba(19,19,19,0) 100%)` — the center stays opaque enough for map legibility while the edges fade to fully transparent. A `backdrop-filter: blur(10px)` adds a soft blur to whatever content scrolls behind the map, completing the frosted-glass feel. Event log cards are now visible through the gradient edges rather than disappearing behind a dark rectangle.

### Workaround

- **`backdrop-filter` applied via inline style, not CSS.** Lightning CSS (the Turbopack-integrated optimizer) strips the un-prefixed `backdrop-filter` declaration from stylesheets and leaves only the `-webkit-backdrop-filter` prefix. Chrome does not apply the `-webkit-` prefix as a fallback for the standard property, so the blur ended up as a no-op when declared in `HomeClient.css`/`ArchivesLayout.css`. Declaring it via `style={{ backdropFilter, WebkitBackdropFilter }}` on the JSX elements bypasses Lightning CSS entirely.

## 0.39.6

### Changes

- **`/archives` mobile map toggle now matches the homepage's pin/unpin semantics** instead of show/hide. Default is **unpinned** — the archives galaxy map is at the top of the mobile flex column in normal flow and scrolls away as you read the event log, like a regular section. Tap the `.archives-map-toggle` FAB (📌 icon) to add the `.archives-map-col--sticky` modifier class, which applies `position: sticky; top: 50px` (80px at `sm+`), `z-index: 10`, `background: var(--color-surface-0)`, and a 280ms fade-in animation. The map pins at the top of the viewport and stays visible as you continue scrolling. Tap again (✕ icon) to unpin — map returns to normal flow.
- This is a behavior change from the previous version where `.archives-map-col` was always sticky on mobile and the FAB toggled visibility via conditional rendering. The map is now always rendered (scroll-sync selection still fires) but only becomes sticky on opt-in. Matches `v0.39.5`'s homepage implementation exactly.

## 0.39.5

### Features

- **Homepage mobile map pin/unpin toggle.** Added a floating-action button that toggles whether the galaxy map is sticky (pinned at the top of the viewport) or scrolls away with the page. Default is **unpinned** — the map renders in normal flow at the top of the mobile layout and scrolls away like it did before. Tap the FAB (📌 icon) to pin the map: `.home-map` gains the `.home-map--sticky` modifier class, which adds `position: sticky; top: 50px` (80px at `sm+`), `z-index: 10`, and `background: var(--color-surface-0)` — the map snaps to the top of the viewport below the header and stays visible as the user continues scrolling. Tap again (✕ icon) to unpin. A subtle 280ms fade-in + slide-down animation (`@keyframes home-map-pin-in`) softens the pinning transition when pinning an already-scrolled-past map, disabled under `prefers-reduced-motion: reduce`.
- The FAB is fixed at the bottom-right of the viewport above the BottomNav, mirroring the `.archives-map-toggle` pattern. Hidden at `lg+` (desktop) since the desktop grid layout applies its own permanent sticky behavior to the map column regardless of this state.

## 0.39.4

### Bug Fixes

- **Galaxy SVG no longer overflows its `#map` wrapper.** v0.39.3 fixed `.home-map` → `#galaxy` sizing via the flex chain, but the leak continued one level deeper: inside `src/features/galaxy/Map.jsx`, the `<div id="map" className="max-h-full w-full">` wrapper had no concrete height, and Tailwind's `max-h-full` resolves to `max-height: 100%` which needs an explicit parent height to apply. The SVG inside had `h-full w-full` with the same problem, so it fell back to its intrinsic size derived from its viewBox and the parent's width — ending up ~32px taller than its container at desktop widths, clipping the bottom of the map below the viewport fold. Fixed by extending the flex-layout chain through Map.jsx: `#map` is now `flex flex-col flex-1 min-h-0 w-full` (a flex child of `#galaxy`), and the `<svg>` is `flex-1 min-h-0 min-w-0 w-full` (a flex child of `#map`). Every layer down to the SVG now correctly resolves height from its flex parent. Fix applies to both `/` and `/archives` since `Map.jsx` is the shared rendering component.

### Testing

- DevTools verification on `/` at 1710×934: all four layers (`.home-map`, `#galaxy`, `#map`, `<svg>`) are now 822px tall with `bottom: 918px` (16px of breathing room before the viewport edge at 934). Before the fix the SVG was 854px and extended to 949.99 — 16px below the viewport.
- DevTools verification on `/archives` at the same viewport: all layers in sync at 822px when unscrolled, and sticky map pins correctly when scrolled (clamped to whatever the max-height resolves to at the current scroll position).

## 0.39.3

### Bug Fixes

- **Homepage galaxy map no longer overflows its container at the bottom.** v0.39.1's new `.home-map` grid cell had `max-height: calc(100dvh - 80px - 2rem)` but no `display: flex` — so Galaxy's inner `<section class="h-full w-full">` had no concrete parent height to resolve `h-full` against, and the SVG fell back to its intrinsic size and spilled past the cell boundary into the viewport below. Fixed by making `.home-map` a flex column and setting `flex: 1; min-height: 0; min-width: 0` on its first child, matching the pattern `.archives-map-col` already uses.

## 0.39.2

### Bug Fixes

- **Removed the redundant "selected event" info card overlay on `/archives`.** The small card that displayed region + faction + duration + WON/LOST status below the map when an event was scroll-selected is now unnecessary — the event log itself (now in the left column of the scrollytelling grid with `border-l-primary` highlighting the selected card) already shows all that information more clearly. Dropped the unused `factions` and `getEventRegionLabel` imports that only fed that overlay.

## 0.39.1

### Bug Fixes

- **Simplified the homepage scrollytelling map.** v0.39.0's fixed-position overlay + size-transition animation was overengineered — the event log column has the same width as the hero sidebar, so the map doesn't need to resize at all, it just needs to stay pinned at the same size across both sections. Replaced the overlay with a single grid-spanning sticky map: `HomeClient` owns one continuous two-row grid where the right column (the galaxy map) spans both the hero row and the scrollytelling row, with `position: sticky; top: 80px`. One `<Galaxy>` instance, one `mapState` prop that switches between live and `computeMapStateAtEvent(selectedEvent, data)` depending on whether `useScrollEvent` has latched onto a card.
- **`/archives` grid now matches the homepage dimensions.** Changed `ArchivesLayout.css` `.archives-scrollytelling` from `grid-template-columns: minmax(260px, 1fr) minmax(0, 50dvh)` to the same `minmax(260px, 1fr) minmax(0, calc((100dvh - 80px) * 806.93 / 868.81))` the homepage uses. Both pages now present the same visual map anchor; only the data (live now vs. historical season) differs. The archives grid also moved from the `md:` (768px) breakpoint to `lg:` (1024px) to match the homepage.

### Chores

- **Deleted** `HomeGalaxyOverlay.jsx`, `HomeGalaxyOverlay.css`, `HomeScrollytelling.jsx`, `HomeScrollytelling.css`, `useHomeMapPinned.mjs`, and `useHomeMapPinned.test.mjs` — the entire overlay + scroll-threshold animation infrastructure from v0.39.0.
- **Stripped `DashboardClient`** of its grid layout and inline galaxy map — it's now a pure sidebar-content component. The grid layout and the galaxy map both live in `HomeClient` now. `.dashboard-scroll-hint` also removed (the grid is continuous; no scroll hint needed).
- New `src/features/dashboard/HomeClient.css` owns the home grid: flex column at mobile, two-row grid with a spanning map column at `lg+`.
- Removed the obsolete `galaxy` and `scroll-hint-button` assertions from `DashboardClient.test.jsx`.

## 0.39.0

### Features

- **Homepage scrollytelling galaxy map.** Ported the archives "animate map + select event on scroll" pattern to `/`. Below the hero, the homepage now has a 2-column scrollytelling section: single-column event log on the left, pinned galaxy map on the right. As you scroll through the event log, the map time-travels to show what the galaxy looked like at the currently-focused event's moment (same `computeMapStateAtEvent` logic archives uses). The map itself transitions from its big hero size to a small pinned sidebar position via a state-driven CSS transition — the boolean flips when ≤25% of the hero is still visible, and a single 400ms `top/right/width/height` animation handles the shrink + reposition. Narrative: "live now" (hero) → "recent past" (scrollytelling).
- Homepage event log now uses `layout="stack"` — same vertical single-column layout archives uses, required for `useScrollEvent`'s DOM-order optimization.

### Chores

- Extracted `computeMapStateAtEvent` from `src/features/archives/ArchiveMap.jsx` into `src/shared/utils/game/computeMapStateAtEvent.mjs` so it can be reused by both `ArchiveMap` and the new homepage `HomeGalaxyOverlay`.
- Deleted `src/features/timeline/HomeEventLog.jsx` — its only job (feeding `LiveDataContext` into `EventLog`) is now inlined inside `HomeScrollytelling`.
- New `HomeClient.jsx` wrapper owns the hero `useRef` and lets `src/app/page.jsx` remain a server component with its metadata/JSON-LD exports intact.

### Mobile

- Mobile (<1024px) is unaffected: the inline galaxy map stays inside the hero, the event log stacks below it in normal flow, no sticky map or scroll-driven transitions. The `HomeGalaxyOverlay` is hidden via `display: none` below `lg:`.

## 0.38.2

### Improvements

- **Toasts now render at `top-center` on mobile, `bottom-right` on desktop.** Matches native iOS/Android push notification placement (where users instinctively look for "something just happened" feedback) and clears the bottom of the screen which is occupied by `BottomNav` on mobile. Desktop layout is unchanged. Implemented in `LiveToasts.jsx` by detecting viewport once on mount via `window.matchMedia('(max-width: 767px)')` and keying the `<Toaster>` so Sonner remounts with the correct `position` (it reads the prop only at first mount and ignores subsequent changes). Page-load detection only — resize-during-session is intentionally not supported. Closes #285.

## 0.38.1

### Bug Fixes

- **`/archives` — restored scroll-sync ("animate map + select event") and the vertical stack layout** that was lost in v0.38.0. The unified-event-log rename (`timeline-day-grid` → `event-log-day-grid`) left a stale CSS override in `ArchivesLayout.css` that used to force the archive event rail to a single vertical column; without that override, the new `EventLog.css` desktop grid (`repeat(2/3/4, 1fr)` at md/lg/xl) took over and wrapped cards into columns. The multi-column grid in turn broke `useScrollEvent`'s DOM-order early-break optimization (which only holds when cards are vertically stacked), so scrolling the event rail no longer synced the selected event to the map.
- **Fix:** `EventLog` gains an explicit `layout: 'grid' | 'stack'` prop. `ArchivesClient.jsx` passes `layout="stack"` to force a single-column flex layout at all widths via the new `.event-log-days--stack` class in `EventLog.css`. `useScrollEvent` is unchanged — once cards are stacked vertically again, the DOM-order assumption holds and scroll-sync works.
- Removed stale `.archives-event-col .timeline-*` overrides from `ArchivesLayout.css` (they targeted classes that no longer exist).

## 0.38.0

### Features

- **Unified event log across homepage and archives.** Removed the vertical timeline rail from the desktop homepage event log — the day-grouped card list is now the single source of truth for both `/` and `/archives`, fed different data by each page via a new shared `EventLog` component. Added a square sort-order toggle (newest ↔ oldest) next to the event log title, with preference persisted to `localStorage` and shared between both pages. Archives cards now show an absolute date/time (e.g. `Apr 4, 2026 · 14:23`) instead of a relative "ended X ago" string; homepage cards continue to tick live with "Started X ago" / "Ended X ago" plus points progress.

### Chores

- Consolidated `Event.jsx` + `ArchiveEvent.jsx` → single `EventLogCard` with a `timeFormat` prop that flips between ticking relative time (`'live'`) and static absolute timestamps (`'absolute'`).
- Consolidated `TimelineSection.jsx` + `ArchiveEventRail.jsx` → single `EventLog` component consumed by `HomeEventLog.jsx` (homepage wrapper) and directly by `ArchivesClient.jsx`.
- Extended `groupEventsByDay` with an optional `sortOrder: 'asc' | 'desc'` parameter; default remains `'desc'` for backwards compatibility.
- Deleted `TimelineSection.css`, `Event.jsx`, `ArchiveEvent.jsx`, `ArchiveEventRail.jsx`, and their stale test files (`TimelineSection.test.jsx`, `ArchiveEventRail.test.jsx`, `Event.test.jsx`).

## 0.37.11

### Security

- **Stopped leaking `SENTRY_AUTH_TOKEN` (and the other Sentry credentials) via the image's BuildKit provenance attestation.** `Dockerfile.app` previously declared `ARG SENTRY_AUTH_TOKEN` etc., and `staging.docker.yml` / `release.docker.yml` populated them via `build-args:` from `secrets.SENTRY_AUTH_TOKEN`. The substituted values landed in the SLSA provenance metadata that BuildKit pushes alongside each image — for the public `ghcr.io/elfensky/helldiversbot:staging` and `:latest` packages, that meant anyone with anonymous `docker pull` access could extract the token via `docker buildx imagetools inspect`. Replaced with BuildKit `--mount=type=secret,id=...,env=...` directives in the build RUN, plus matching `secrets:` inputs in both workflow files. Secrets mounted this way live only in the RUN's tmpfs, never touch any image layer, build cache, or attestation. The `SENTRY_AUTH_TOKEN` has been rotated. Closes #284.

### Chores

- Same change also resolves the recurring `SecretsUsedInArgOrEnv` BuildKit lint warning that has been present in every CI build since #283 added `# syntax=docker/dockerfile:1`.

## 0.37.10

### Bug Fixes

- **`Dockerfile.app` HEALTHCHECK was silently failing on every probe** because the directive shelled out to `curl`, which is not installed in `node:24-alpine` (only busybox `wget` exists). Containers were being reported as `unhealthy` forever — broken monitoring and a real issue if anything downstream consumes the health status. Replaced with `wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/healthcheck`. Also bumped `--start-period` from 5s to 30s so a Next.js cold-start (5–15 seconds) doesn't trip the probe before the server is ready.

### Chores

- **`Dockerfile.app` slim-down**: stripped Sharp's glibc-arm64 and glibc-x64 binaries (`@img/sharp-libvips-linux-{arm64,x64}` and `@img/sharp-linux-{arm64,x64}`) immediately after `npm ci`. Alpine is musl, so the linuxmusl variants are the only ones loaded at runtime; the glibc variants are pulled in defensively as npm optional deps but never `dlopen()`'d on a musl host. Saves ~16.6 MB on the final image because Next.js's `@vercel/nft` standalone trace would otherwise include them. Image: 407 MB → ~390 MB.
- **Added BuildKit cache mounts** to both deps (`/root/.npm`) and builder (`/app/.next/cache`) RUN steps. The npm download cache and Next.js webpack/turbopack compilation cache now persist outside the image across builds — typically 60–80% faster rebuilds in CI once the cache is warm. Zero impact on the final image (cache lives in BuildKit storage, not in any image layer). Requires the `# syntax=docker/dockerfile:1` directive at the top of the file, which is now present.
- **Improved `.dockerignore`** with exclusions for IDE configs (`.vscode`, `.idea`), test files (`src/**/*.test.*`, `src/**/__tests__`), vitest configs, prettier configs, and explicit `coverage`/`docs`/`CHANGELOG.md` entries. Doesn't affect image size — improves build context transfer speed (~5–10%) and prevents the `COPY . .` builder cache layer from being invalidated when test files or docs change.

Closes #283.

## 0.37.9

### Chores

- **Synced `package-lock.json`** — committed the pending Next.js patch bump (`16.2.2 → 16.2.3`, plus matching `@next/env`, `@next/mdx`, and `@next/swc-*` platform variants) that had been sitting unstaged after an out-of-band `npm install`. Also corrected the lockfile's project `version` field, which had drifted from `0.33.0` because successive `package.json` version bumps weren't paired with `npm install` runs. Closes #282.

## 0.37.8

### Chores

- **`Dockerfile.migrate` is now self-documenting.** Added detailed inline comments explaining each section: why this image exists separately from `Dockerfile.app`, why the install pattern looks unusual (project package.json on disk = npm pulls 1.2 GB of Next.js deps; the `/tmp` reference + minimal `package.json` workaround keeps the install to ~300 MB), why each of the 4 packages is needed, why everything is one big chained `RUN` (single image layer), and why `chown -R` was deliberately omitted (~1.4 GB of layer-doubling waste). No behavior change — purely documentation. Closes #281.

## 0.37.7

### Chores

- **Removed commit SHA from the footer and build-time console.info.** Footer now shows only `v{version} – {environment}` instead of `v{version} – {sha} – {environment}`. Dropped the `COMMIT_SHA` computation and `NEXT_PUBLIC_COMMIT_SHA` env var from `next.config.mjs` entirely, along with the `console.info` line it used. Sentry's own release tracking is unaffected — it reads from distinct CI-provided env vars (`CI_COMMIT_SHA`, `VERCEL_GIT_COMMIT_SHA`, etc.).

## 0.37.6

### Bug Fixes

- **Admin push notification tester now supports stateful transitions** — same pattern as the toast tester in 0.37.5. Push `Started` creates a fresh notification with a new high-range random `event_id` (900M+ range, no collision with real ids). `Won`/`Lost` re-use the same `event_id`, which matches the existing pushNotifier tag convention (`tag: event-${event_id}` + `renotify: true`) so the browser replaces the previous notification in place. `sendTestNotification` server action accepts an optional `event_id` parameter; legacy calls without it still get a fresh random id.

## 0.37.5

### Bug Fixes

- **Dismissed toasts now stay fully suppressed across reloads until the event's status actually changes.** The old implementation used a soft-reappear pattern (8-second auto-dismiss for previously-dismissed toasts on page load), which meant users who closed a toast still saw it flash briefly every time they returned. The new implementation tracks dismissals as `{eventId: statusAtDismissal}` — on catch-up, an event whose dismissed-status still matches its current status is skipped entirely. When the event transitions (e.g., `active` → `success`/`fail`), the catch-up effect detects the status mismatch and fires the corresponding `event_won` / `event_lost` toast automatically, so users don't silently miss terminal outcomes.
- **Fixed `event.id` → `event.event_id` in `eventToast` and `LiveToasts`** — the toast dedupe key was producing `event-undefined` for every toast (since the real field is `event_id`, not `id`), which meant Sonner collapsed all toasts to a single reusable slot. The `dismissedEvents` Set was similarly writing the literal string `"undefined"` and never actually suppressing anything on reload. Dismissal tracking now works.
- **Toasts now have a close button (desktop).** Enabled Sonner's built-in `closeButton` prop on `<Toaster>` — small X control for explicit dismissal. Works across mobile too (touch-swipe gestures still work).
- **Admin debug toast tester updated** — `randomEvent` now generates high-range random numeric `event_id` values (900M+ range) to avoid collisions with real HD1 event ids (1-100k range), and includes `status` derived from the toast kind. Previously the test events had no `event_id` and no `status`, which meant Sonner deduped them all to one visible toast and new dismissal logic couldn't classify them.

### Migration

- `dismissedEvents` localStorage record changed from `Array<string>` to `Record<string, status>`. Legacy array entries are migrated in-place on first read — each id is assumed to have been dismissed while `active`, which is the only status a user could plausibly have dismissed prior to this change.

## 0.37.4

### Bug Fixes

- **Event log cards now show descriptive action verbs tied to the region** instead of generic `"Won defend Event"` / `"Failed attack Event"` status descriptors. New shared helper `getEventActionLabel` maps `(type, status)` → verb: `Attacking`/`Captured`/`Lost` for attack events, `Defending`/`Defended`/`Lost` for defend events. Applied to both live dashboard event log (`Event.jsx`) and archives event rail (`ArchiveEvent.jsx`). Dashboard card now reads e.g. `"DEFENDING SUPER EARTH"`; archive card reads e.g. `"CAPTURED"` with region on a separate line.

## 0.37.3

### Chores

- **`Dockerfile.migrate` slimmed from ~4.7 GB to ~670 MB (86% reduction).** Two changes: (1) read project versions from a temp-path copy of `package.json` and run `npm install` against a minimal one in `/app` so npm only installs the 4 declared packages instead of inheriting the full Next.js dependency tree (1.2 GB → 306 MB `node_modules`); (2) drop the standalone `RUN chown -R node:node /app` step that was creating a full duplicate of `/app` in a second image layer — the `node` user reads root-owned files fine since migrate + seed are read-only against `/app`. Also clean npm cache + `/tmp` in the same `RUN` layer.

## 0.37.2

### Bug Fixes

- **`DefeatedCard` label now uses underscores** — `ALL SECTORS CAPTURED` → `ALL_SECTORS_CAPTURED` to match the convention used by all other bar labels (`SECTOR_PROGRESS`, `CAPITAL_DEFENSE`, `HOMEWORLD_ASSAULT`, `SUPER_EARTH_DEFENSE`).

## 0.37.1

### Bug Fixes

- **Super Earth defend events now display correctly across map, cards, and notifications.** During an active SE defense (`defend_event.region === 0`), toasts/push/archives no longer show "Unknown Region under attack" — they now resolve to "Super Earth" via a new shared `getEventRegionLabel` helper (fixes 4 copy-pasted broken lookups against `map[event.enemy][event.region]` for SE events where Super Earth actually lives at `map[3][0]`).
- **Dashboard now shows a "Defending Super Earth" card in place of the attacker's frontier card** while an SE defense is active (closes #279). Mirrors the existing sector-defend takeover pattern.
- **Galaxy map hides the attacking faction's campaign progression during an SE defense.** `computeMapState` force-resets all sectors (1-11) of the attacker to `lost` state since in-game, no progression can occur for that faction while Super Earth is being defended. Super Earth itself continues to pulse red.

## 0.37.0

### Features

- **Archives stats audit** — removed 8 redundant/confusing stats (DEFENSE_WON, ATTACK_WON, TOTAL_OVERKILL, LONGEST/SHORTEST_EVENT, PEAK_SURGE, raw MISSIONS, MOST_CONTESTED), renamed 6 to player-friendly labels (WIN_RATE, DURATION, K/D, TOTAL_DIVERS, BATTLES, HOTSPOT), added section headings (War Summary, Notable Moments, Combat Record).
- **Closest calls & cascade detection** — new `seasonAnalytics.mjs` utility with `findClosestCalls()` (narrowest win/loss events) and `findWorstCascade()` (longest cascade of consecutive failed defenses). Displayed as Notable Moments stat cards.
- **Cyberstan interference easter egg** — on defeat seasons, the archives header shows resistance text ("Leaked Campaign Records") with a 5-phase glitch cycle: idle → takeover (word-by-word scramble to propaganda) → hold → fight (chaotic noise) → restore. Two independent per-character effect layers: copy swap (propaganda leak-through) and Cyberstan font scramble.
- **7 randomized resistance messages** — server-side random selection per request across 3 tonal directions (sardonic, hacker-broadcast, fourth-wall). No hydration mismatch.
- **GlitchText component** — persistent looping text scramble with synced phase clock (`useGlitchCycle`), word-by-word settling in batches of 1-3, `prefers-reduced-motion` support, client-only rendering via `next/dynamic`.
- **Effects toggle** — localStorage-persisted disable switch for interference effects.
- **StatCard subtitle** — optional subtitle prop with clickable card support for linking Notable Moments to the event timeline.
- **Scroll-driven event selection** — `useScrollEvent` hook with IntersectionObserver for archives timeline-to-map sync.
- **Legal page** — in-lore terms of service, privacy policy, and cookies sections.

### Improvements

- Error pages use brandkit button styling and Big Brother copy ("This incident has been logged" + "Resume approved Super Earth broadcast").
- Background watermark ("THE RECORD IS FALSE") on defeat seasons with fade-in transition.
- Cyberstan font (Collective Consciousness) registered as `--font-cyberstan` theme token with `0.6em` sizing and `1ch` width containment to prevent reflow.
- Archives header body text capped at `max-w-screen-md` for readability.

### Bug Fixes

- Fixed GlitchText SSR hydration mismatch by deferring random state to `useEffect` and using `next/dynamic` with `ssr: false`.
- Fixed mismatched text/altText lengths causing truncated propaganda text during glitch takeover.
- Fixed `useCyberstanEffects` hydration mismatch by moving `Math.random()` dice rolls from `useState` initializer to `useEffect`.

### Chores

- Deleted `OutcomeReveal.jsx` (236 lines) — replaced by unified GlitchText component.
- Removed dead `statFlickers` code from hook and CSS.
- Extracted resistance messages to `resistanceMessages.mjs` shared constants.

## 0.36.0

### Features

- **Phase A season analytics** — 10+ stat cards per season: outcome, duration, events won, defense/attack rates, overkill, longest/shortest events, most contested region, peak mobilization. Works for ALL seasons (derived from events + snapshots, not h1_live).
- **Per-faction analytics with FactionTabs** — Bugs/Cyborgs/Illuminate tab switcher on archives. Per-faction stats: defense rate, attack rate, event count, average duration, peak surge, most attacked region, overkill, conquest progress.
- **Unified ArchiveStats** — merged SeasonStats + CombatStats + EventStats into one component. Shows h1_live combat stats (kills, accuracy, FF) when available, event-derived stats always.
- **Shared EventCardLayout** — extracted card shell for dashboard/archive event card reuse.

### Improvements

- Archives sidebar restructured with H1 blurb ("Declassified Campaign Archives"), H2 section headings (Statistics, Faction Analysis, Event Log), season selector inline with Statistics heading.
- VICTORY/DEFEAT rendered as StatCard with colored text (green/red) instead of custom banner.
- Sticky map uses full viewport height, clips naturally from top at bottom of page.

### Bug Fixes

- Archive map: gap-event replay for accurate historical map reconstruction (fixes stale snapshot issues).
- Archive map: clamp sector points to defend frontier (fixes sectors beyond defend region showing as captured).
- Sticky map no longer overlaps footer.
- React hooks violation fixed in ArchiveEventRail.
- Composite event key (type+event_id) for correct event selection.

### Chores

- Codebase cleanup: deleted 7 dead files, extracted shared utilities (FACTION_COLORS, formatCompactDuration, eventKey), fixed convention violations (Umami env var, design tokens, try/catch).
- Moved SeasonSelector to archives feature directory.
- Dependencies updated (Prisma 7.7, better-auth 1.6, vitest 4.1.3, etc).

## 0.35.0

### Features

- **Archives page redesign** — two-column layout (narrative sidebar + sticky galaxy map) mirroring the dashboard pattern. New components: SeasonOverview (outcome banner), SeasonStats (aggregated stats grid), FactionSummary (per-faction win/loss), ArchiveEventRail (clickable event log controlling the map), ArchiveMap (map-state-at-event computation).
- **Shared EventCardLayout** — extracted card shell (accent bar + status styling) used by both dashboard LiveEvent and archive ArchiveEvent. Archive events show region name, final duration, and outcome.
- **Archive map gap-event replay** — reconstruct map state by replaying events that completed between the nearest snapshot and the selected event. Handles stale snapshots (8-24h gaps), failed defend cascades, and region 0 Super Earth defends.
- **Event selection URL sync** — selected event persisted as `?event=<type>-<event_id>` composite key for shareable deep-links. Back button navigates between selections.
- **Archive event hover states** — clickable event cards get cursor-pointer + brightness lift on hover.

### Bug Fixes

- **Archive map double-counting** — fixed completed events being passed to computeMapState, causing failed defend cascades to wipe sectors already reflected in snapshot points.
- **React hooks violation** — moved useRef/useEffect above early return in ArchiveEventRail.
- **Event ID field** — corrected event.id → event.event_id with composite key (type+event_id) since event_id is not unique across attack/defend.

## 0.34.0

### Features

- **SEO & JSON-LD structured data** — add shared `JsonLd` component with CSP nonce support. Add `WebApplication` + `BreadcrumbList` schemas to homepage, `WebPage` + `BreadcrumbList` to docs layout. Refactor archives page to use shared component. Fix Event schema validation: add `location` (VirtualLocation), `eventAttendanceMode`, `eventStatus`, and `performer` fields. Flesh out attack event schemas with full structured data. Add `operatingSystem` to archives WebApplication.

### Chores

- Update author URL from `lavrenov.io` to `lav.ren` across all schemas, footer, and README.

## 0.33.0

### Features

- **Region-centric toasts** — replace plain-text toast labels with JSX content showing faction icons, region names as titles, and event type as subtitle. Switch animation from `toast-glow` box-shadow pulse to `action-flash` opacity flash for transition toasts; catch-up toasts are now static. Push notification payloads updated to match.

## 0.32.0

### Features

- **Defeated faction cards** — show defeated factions in the Regions section with a muted gold "DEFEATED" label, faction name, full progress bar, and campaign duration instead of hiding them.

## 0.31.1

### Features

- **Pace status shorthand** — move pace indicator (ahead/behind/on track) to the event type label row (e.g. `CAPITAL_DEFENSE · 1.2K ahead`), right-aligned via `space-between`. Shorten format from verbose "Ahead by 1234 points" to compact "1.2K ahead". Add live countdown timer to EventCountdown.

## 0.31.0

### Features

- **Region card redesign** — merge action label and region name into a single title line (`Capturing Wise Region`, `Defending Sirius Region`). Flashing red action word during events replaces the `⚠` alert icon. Defend events now show event defense progress instead of frontier progress. Always-visible meta line with points, countdown, and pace for consistent card height. Bar labels use stat-style snake case (`SECTOR_PROGRESS`, `CAPITAL_DEFENSE`, `HOMEWORLD_ASSAULT`).
- **Card accent width token** — extract `--card-accent-width: 6px` to `layout.css` theme. All card types (EventCard, StatGrid, timeline Event) now share a single accent bar width.

## 0.30.0

### Features

- **Timeline duration blocks** — replace rail dots with proportional duration blocks that visualize event length. Cards show compact duration pills (`2d3h`, `14h22m`). Active events pulse with danger color scheme. Empty days fill gaps between event groups for proportional timeline spacing.

## 0.29.2

### Fixes

- **Docs overview Mermaid diagram** — replace raw `mermaid` code block on `/docs` with the shared `MermaidDiagram` component so it actually renders as an interactive diagram with consistent styling, detail panels, and accessibility
- **Notification flow `db` node** — add missing details entry for the Database node in the notification-flow diagram so it's clickable like all other nodes

## 0.29.1

### Fixes

- **Defer poll emissions to `requestIdleCallback`** — prevents `enqueueModel` crashes caused by `setState` firing during RSC Flight stream processing on navigation. Coalesces rapid-fire emissions to skip intermediate status flickers.

## 0.29.0 (retroactive)

### Features

- **Progressive env vars** — only `POSTGRES_URL`, `UPDATE_KEY`, and `UPDATE_INTERVAL` are required at startup; auth (BetterAuth + OAuth) and analytics (Umami, Sentry/GlitchTip) degrade gracefully when absent. Partial auth config (secret present but provider vars missing) still throws. `withSentryConfig` skipped without `SENTRY_AUTH_TOKEN`. Umami script conditional on `UMAMI_SITE_ID`.
- **Admin notification debug buttons** — "Test Push" sends a test push notification to all subscribers via `web-push`; "Test Toast" fires a faction-colored Sonner toast. Standalone Debug section in admin area.
- **Mermaid diagram system** — replace hand-crafted SVG diagram components (~1650 LOC) with reusable `MermaidDiagram` component powered by Mermaid syntax. Diagrams are now config-driven (definition string + config object). Same color conventions as docs. Preserves flow filtering, clickable detail panels, and keyboard accessibility.
- Migrate wiki documentation to in-app `/docs` pages
- Merge admin dashboard into profile page — delete standalone admin route and ProfileNav (#259)

### Fixes

- Hide UserSection nav when offline — auth requires network
- Simplify account deletion — remove email confirmation, use confirm dialog
- Fix Mermaid diagram filtering, arrow styling, and responsive layout

### Chores

- Comprehensive docs update — add Mermaid diagrams, fix wiki refs, correct outdated content

## 0.28.0 (retroactive)

### Features

- **Umami analytics expansion** — comprehensive Level 2 feature engagement tracking with ad-blocker bypass via same-origin proxy (`/api/umami`), `useTrack` hook for dynamic interactions, `umami.identify()` for authenticated users, and `category-action` event naming convention across ~40 tracked elements
- **Serwist service worker** — migrate from hand-written `public/sw.js` to Serwist (`@serwist/next`) for automatic precache manifest with content hashes. No more manual `CACHE_NAME` version bumps. `skipWaiting` for immediate updates. Configurator mode for Turbopack compatibility

### Refactors

- Delete ServiceWorkerRegister.jsx — Serwist handles registration automatically via `register: true`

## 0.27.0 (retroactive)

### Features

- **Global live data** — `LiveDataContext` wraps all pages so every route receives real-time campaign updates via polling
- **Replace SSE with polling** — remove entire SSE infrastructure (sseManager, pg LISTEN/NOTIFY, `/api/h1/stream`). New `GET /api/h1/live` endpoint polled every 10s via `setInterval` + `fetch`. Eliminates RSC Flight stream conflicts (`enqueueModel` crashes)
- **Tri-state status indicator** — StatusDot shows green (live), orange (polling), red (offline). Uses `navigator.onLine` to detect PWA offline state
- **Push notification improvements** — add `badge` (favicon PNG), per-event `tag` grouping, and `renotify` for status changes; fix icon fallback from SVG to raster; precache badge in service worker shell assets
- **GlitchTip error tracking** — migrate from BugSink to GlitchTip with client tunnel (`/api/glitchtip`) to bypass ad blockers, CSP violation reporting via `report-uri`, and `environment` tagging to split dev/prod issues
- **Error boundaries** — route-level (`error.jsx` at root + archives) and component-level (`ComponentErrorBoundary` wrapping Galaxy Map, Regions, Stats, Timeline) for graceful degradation
- **App version in footer** — shows package version, short commit SHA, and commit message in footer and dev console (auto-generated at build time by `next.config.mjs`)

### Fixes

- **Fix Sonner toast module duplication** — co-locate `<Toaster>` inside `LiveToasts` instead of root layout to share the same Sonner `ToastState` singleton across client components
- **Fix hydration mismatch in EventCard** — add `suppressHydrationWarning` to pace label (computed via `Date.now()`, differs between SSR and client)
- **Fix React Compiler swallowing catch-up effect** — add `'use no memo'` to `LiveToasts` to prevent the compiler from merging the two `useEffect` hooks
- **Fix hydration mismatch in StatusDot** — defer `navigator.onLine` check to `connect()` (client-side only) to prevent SSR/client status divergence

### Refactors

- **Sentry SDK with native navigation** — re-add Sentry SDK while keeping native `next/link` navigation (replaces Sentry's custom Link wrapper)
- **Design token cleanup** — add `--color-warning` (`#f97316`) and `--color-success` tokens; remove `--color-outline` and `--color-outline-variant` (replaced by `ghost` and `text-muted`); all raw Tailwind green/red/yellow colors replaced with theme tokens

### Chores

- Enable production source maps and upload to GlitchTip

## 0.26.0 (retroactive)

### Features

- **Profile page** — view connected providers, manage API keys, GDPR data export and account deletion (#248)
- **Admin dashboard** — system overview, debug tools, user management (with provider/key columns), and all-keys table. Role-gated on `/profile` — no separate admin route. Each section loads independently via Suspense (#248)
- **Worker heartbeat monitoring** — cron worker writes heartbeat on each poll; `worker_heartbeat` table, `computeWorkerHealth` utility, health dot in admin dashboard
- **Sign-in polish** — provider branding (Discord/GitHub logos and colors), navigation link to sign-in page
- **Catch-up toasts for active events** — show an "in progress" toast on page load when defend/attack events are already active (#LiveToasts)

### Fixes

- **Fix profile page polish** — border separators, wider inputs, side-by-side layout, correct `.gutters` usage
- **Fix RSC cache invalidation** — use `revalidatePath` without `'page'` scope to avoid RSC cache corruption
- **Fix Zod ID validation** — replace `z.uuid()` with `z.string().min(1)` for Prisma CUID2 IDs
- **Fix session revocation** — revoke session on ban and account deletion, redirect after delete
- **Validate `BETTER_AUTH_URL` at startup** — remove unused email env vars

### Refactors

- **Brandkit overhaul** — grouped palette (Website/Status/Factions), nested surface demo, right accent line on rule card, equal-height swatches
- **Design system: fluid type scale** — add fluid type scale tokens to `@theme` with `--fs-small` floor
- **Design system: button restyle** — remove `--color-on-primary` token, restyle buttons to outline-first
- **Design system: font token rename** — rename `--fs-*` to `--text-*` and align all font sizes to 5-step scale
- **Profile redesign** — merge ProfileInfo into Your Data section, redesign pages to match site-wide visual style
- **Dashboard redirect** — redirect old dashboard routes to profile

### Chores

- Update Umami analytics URL to `umami.drunik.be`
- Apply Prettier formatting to source and test files
- npm update (dependency refresh)

## 0.25.1 (retroactive)

### Features

- **Custom API docs** — replace SwaggerUI with lightweight server-rendered API documentation page
- **Zod validation for season seeding** — validate API responses with Zod schemas before database writes (#191)
- **SEO polish** — improved sitemap, JSON-LD `mainEntity`, and breadcrumbs (#123)
- Native app-like mobile header with solid background

### Fixes

- **Fix grid overflow** — replace bare `1fr` with `minmax(0, 1fr)` in grid layouts (#193)
- **Fix healthcheck timing** — add `roundedPerformanceTime` to healthcheck route (#197)
- Fix PWA manifest — move `site.webmanifest` to `public/`, update `short_name` to HD1 Bot

### Refactors

- **`tryCatch()` wrapper adoption** — convert raw try/catch blocks to `tryCatch()` in fetch utilities (#194)

### Chores

- Add logo originals and normalize formatting in compose and client
- Remove unused assets and fix footer links

## 0.25.0 (2026-04-04)

### Phase 10: Auth Migration

#### Features

- **Migrate from NextAuth v5 to BetterAuth** — replace pre-release `next-auth@5.0.0-beta.30` with stable `better-auth` (#198)
- **New `/sign-in` page** — dedicated sign-in page with Discord and GitHub OAuth buttons
- **Client-side auth** — new `src/auth-client.js` with `signIn`, `signOut`, `useSession` exports via `better-auth/react`

#### Breaking Changes

- Auth tables dropped and recreated — all existing users, sessions, and API keys are lost
- `AUTH_SECRET` env var renamed to `BETTER_AUTH_SECRET`
- `AUTH_TRUST_HOST` env var removed
- New `BETTER_AUTH_URL` env var required

#### Architecture

- Server auth config (`src/auth.js`) uses `betterAuth()` with Prisma adapter and social providers
- Session retrieval: `auth()` → `auth.api.getSession({ headers: await headers() })`
- Sign-in/sign-out converted from server actions to client component using `better-auth/react`
- Route handler moved from `[...nextauth]` to `[...all]` with `toNextJsHandler`
- Prisma schema: Account uses `accessTokenExpiresAt`/`refreshTokenExpiresAt`, Session uses `token`/`expiresAt`, new Verification model

#### Chores

- Update CI workflow env vars (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`)
- Update env validation in `initialize.env.mjs`
- Update all test mocks for BetterAuth session pattern

## 0.24.1 (2026-04-04)

### Fixes

- Decouple Postgres SSL from `NODE_ENV` — new `POSTGRES_SSL` env var controls SSL independently of build mode
- Add `platform: linux/amd64` to `docker-compose.yml` for ARM Mac compatibility
- Fix README Docker build tags (`:local` → `:staging`)
- Move `themeColor` from `metadata` to `viewport` export (Next.js 16 requirement)

### Chores

- Remove unused `SKIP_MIGRATIONS` env var (never read by application)
- Remove Prettier formatting check from CI
- Normalize `docker-compose.yml` indentation, update host port

## 0.24.0 (2026-04-04)

### Phase 8: Real-Time Updates

#### Features

- **SSE live data streaming** — dashboard updates automatically every 10-15 seconds without page reload (#41)
- **Sonner toast notifications** — persistent, faction-colored toasts with glow animation on campaign start/win/lose (#229)
- **Web Notifications** — native browser notifications when tab is backgrounded (BroadcastChannel leader election prevents duplicates)
- **Push notifications** — server-initiated notifications via Web Push API when browser is closed (#24)
- **PWA offline support** — service worker caches app shell, localStorage preserves last-known dashboard data for offline viewing
- **Connection status indicator** — live/reconnecting/offline pill replaces "Updated X ago" when connected

#### Architecture

- Server-Sent Events (SSE) transport via Next.js Route Handler (`/api/h1/stream`)
- Postgres LISTEN/NOTIFY for cross-process change broadcasting between worker and SSE manager
- SSE manager singleton with connection limits (5/IP, 500 total), heartbeat, exponential backoff reconnection, and graceful shutdown
- Client-side change detection (`detectChanges`) shared between toast and push notification paths
- Push subscription API with Zod validation and stale subscription cleanup (410/404)
- Server-side push notifier with concurrency-limited fan-out (max 50 concurrent)

#### UI Changes

- Remove `Alerts` banner component — persistent event status now shown in enhanced `EventCard` (progress bar, pace, countdown timer)
- Single "Enable notifications" button enables both web notifications and push subscription
- Shows "Notifications blocked" / "Notifications unavailable" when denied or unsupported
- Toasts use right-side accent line matching brandkit convention

#### Documentation

- Add `/docs/notifications` page with interactive flow diagram (clickable nodes, flow filtering)
- Add notification category styles to shared diagram CSS

#### Dependencies

- Add `sonner` (~5KB gzipped) for toast notifications
- Add `web-push` (~15KB, server only) for push notification delivery

#### Database

- Add `push_subscription` table (endpoint, keys, created_at)

#### Environment Variables (New)

- `VAPID_PUBLIC_KEY` — Web Push VAPID public key
- `VAPID_PRIVATE_KEY` — Web Push VAPID private key
- `VAPID_SUBJECT` — VAPID subject (mailto: email)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — client-side VAPID public key

## 0.23.0 (2026-04-04)

### Security

- Replace `unsafe-inline` CSP with nonce-based policy via custom server proxy (`proxy.js`) (#226)
- Remove `unsafe-eval` from CSP in production; keep for dev only (#226)

### Infrastructure

- Run migration container as non-root user (#227)
- Standardize Docker user to built-in `node` user (#228)
- Rename Docker workflow display names for clarity
- Consolidate duplicated code and extract shared utilities
- Standardize quoting in CI workflows and reformat openapi.json

### Frontend

- Consolidate /about, /faq, /architecture, /brandkit, /discord into unified /docs section
- Add MDX authoring support via @next/mdx with remark-gfm
- Add docs layout with sidebar navigation (desktop persistent, mobile dropdown)
- Migrate ProgressExplainer from architecture to FAQ page
- Move API documentation (OpenAPI/Swagger) to /docs/api
- Remove standalone /discord page (absorbed into /docs/about)
- Update HeaderNav, BottomNav, Footer, and sitemap to reference /docs routes

## 0.22.3 (2026-04-04)

### CI & Infrastructure

- Upgrade from Node 22 to Node 24 (ships npm 11 natively)
- Remove npm@11 pin from CI and Dockerfiles — no longer needed
- Pin GitHub Actions to commit SHAs and upgrade to latest versions
- Add CI, CodeQL, and dependency review workflows with branch protections
- Remove SonarCloud from CI — replaced by local vitest coverage
- Add Prisma generate step to CI before build
- Fix duplicate CodeQL trigger on pull_request
- Fix pagespeed workflow: push to orphan metrics branch, fix syntax errors
- Remove commented-out metrics steps referencing METRICS_TOKEN
- Add .prettierignore for auto-generated openapi.json

### Tests

- Raise unit test coverage from 66% to 85% (619 tests across 69 files)
- Add 9 new test files: Footer, Auth, Header, DocsClient, Navigation, Wings, formdata, initializeOpenapi, rebroadcast route
- Extend utils and umami tests with edge cases and error paths
- Fix vitest coverage exclusions (.js→.mjs glob mismatch)
- Suppress console noise in test output via global mocks
- Align smoke tests with new error schema, use TEST_SERVER_URL

### Code Quality

- Extract shared helpers to reduce duplication
- Remove debug console.log from initialize.worker.mjs
- Simplify Event card and improve timeline date handling
- Run Prettier

### Docs

- Explain why Production always builds migrate image (#217)
- Clarify Prettier pre-commit command and CI check; fix README indent

## 0.22.2 (2026-04-03)

- Include Docker pull commands in GitHub Release notes

## 0.22.1 (2026-04-03)

### Release Workflow Fix

- Switch Production Docker auth from expired PAT to `GITHUB_TOKEN`
- Remove release-please (conflicted with manual tagging)
- Add GitHub Release job with changelog extraction to Production workflow
- Fix changelog extraction: use state-machine awk, add empty-body validation

## 0.22.0 (2026-04-02)

### Phase 9: Dashboard & Timeline Polish

#### Features

- Proportional timeline rail: replace block segments with proportional dots, ghost day circles, and gap-aware separators
- Merge rail into single container with overlapping dots and tick marks
- Sticky galaxy map on desktop when sidebar overflows
- Sticky scroll hint with animated arrow on desktop hero layout
- Right-align timeline day header accent on mobile
- Show active faction label in Stats heading
- Rebrand footer to "Ministry of Truth" with full-width accent line
- Add ghost-border color to Tailwind theme
- Add ProgressExplainer component with heartbeat animation and recharts dependency
- Color-code evaluateProgress pace text by status (green/white/red)
- Event card hover highlights corresponding timeline rail dot (glow + scale)

#### Bug Fixes

- Top-align galaxy map by spanning it across alerts row
- Increase top-padding on timeline day headers for clearer separation
- Left-align timeline day header text on mobile
- Inline pace text with due-time on active event cards
- Rename `--color-ghost-border` to `--color-ghost` for Tailwind v4 compatibility
- Stretch EventCard to fill grid row height
- Remove left accent and right ghost-border from event cards
- Scope background overlay to main element only
- Migrate Event component to Tailwind with status-based accent colors
- Move pace indicator inline with event label in EventCard
- Map attack animation turns black — add glow and alert indicators
- Fix timeline rail dot ordering — invert vertical axis so top = most recent

#### Refactors

- Remove redundant galaxy map hover tooltip component

#### Chores

- Delete AI working docs (plans, specs, debates) — tracked in docs instead
- Consolidate CSS files and reintroduce responsive header scroll-hide
- Replace gutters wrapper with fragment on home page

## 0.21.0 (2026-04-02)

### Infrastructure & Code Quality

#### Security

- Add HSTS header to close Checkmarx security finding
- Update CSP to allow external analytics and error tracking scripts

#### Infrastructure

- Replace Playwright with Vitest smoke tests, update docker-compose for local dev (#202)
- Consolidate package.json scripts — remove 4 redundant commands (#201)
- Automate production releases with tag-triggered GitHub Releases
- Self-heal missing migrate image in staging CI

#### Code Quality (desloppify)

- Fix server action directives — remove from pipeline, standardize in queries
- Refactor rebroadcast queries and route validation order
- Standardize query return shapes across `db/queries/`
- Standardize auth/error handling in `api.mjs`
- Fix contract lies in utils — explicit returns, docstrings, error logging
- Restore module-level `'use server'` on `api.mjs` — required for client imports

#### Chores

- Disable link prefetching, reorganize README security section

## 0.20.0 (2026-03-31)

### Phase 8: Timeline Visual Redesign

#### Features

- Add TimelineSection with vertical rail and date grouping below dashboard
- Add WarSummary component with win/loss counts (replaces timeline in sidebar)
- Add compact variant to Event card for resolved events
- Add `groupEventsByDay` utility with date labeling
- Add snap scroll container with TimelineSection below dashboard
- Refine timeline layout — unified scroll, smart map fit, season events in StatGrid
- Redesign timeline rail — per-segment mobile, circle+line desktop (#186)

#### Bug Fixes

- Match sidebar-map column gap to page gutters (6rem / 96px)
- Timeline rail polish — alignment, breakpoints, grid scaling

## 0.19.0 (2026-03-30)

### Phase 7b: Responsive Polish & SEO

#### Features

- Rename `/war` to `/archives` with in-universe SEO copy
- Add permanent redirect `/war` → `/archives`
- Add canonical URLs and `og:url` to all pages
- Add in-universe Super Earth propaganda copy to error and placeholder pages
- Show FactionTabs icon + text together at sm:+
- Show FactionTabs icons in sidebar at lg: (#167)
- Desktop & wide responsive layout (#168)

#### Bug Fixes

- Small phone responsive — faction icons, grid overflow, viewport warning
- Map invisible on `/war` at md:, move nav switch to md: breakpoint
- CSS audit — delete global button styles, unify overlays, fix tokens
- Show header Status/GitHub icons above 250px instead of sm:
- Hide BottomNav at lg: via unlayered CSS media query
- Add horizontal and vertical padding to desktop dashboard grid
- Restore sr-only h1 lost during sidebar restructure (#167)

#### Security

- Fix timing attack vulnerability in password comparison

#### Refactoring

- Simplify responsive overrides after review
- Extract map callbacks to named functions

## 0.18.0 (2026-03-30)

### Phase 7a: Tablet Responsive & Accessibility

#### Features

- Dashboard sidebar layout at lg: breakpoint (#167)
- Add header page navigation links at lg: (#167)
- Galaxy map max-width at md:, reset at lg: (#167)
- StatGrid 4 columns at md: (#167)
- Alerts horizontal scroll at md: (#167)
- Hide BottomNav at lg: breakpoint (#167)
- Add md: gutter breakpoint and lg:pb-0 on main (#167)
- Restore SEO content on homepage, expand sitemap, fix noindex gaps (#123)

#### Bug Fixes

- Page-level WCAG accessibility fixes (#152)
- Semantic HTML improvements for screen readers (#150)
- Form accessibility — error linking, table headers, avatar alt (#151)
- Add missing h1 headings across all pages (#149)

#### Chores

- Delete redirect stubs for `/api` and `/docs` pages
- Delete unused Button component (#169)
- Clean up api-reference documentation

## 0.17.0 (2026-03-29)

### Phase 6b: Mobile Polish & Documentation

#### Features

- Add interactive data-flow architecture page
- Refactor `evaluateProgress()` to structured return, fix div-by-zero, surface pace in UI
- Mobile carousel for WarTimeline — swipeable cards replace range slider
- Apply brandkit design tokens to all pages
- Restyle BottomNav — horizontal layout, spacing, font sizes
- Migrate OG image from static PNG + API route to file convention

#### Bug Fixes

- Add CSP headers to `next.config.mjs` to unblock sign-in page
- Remove awkward "On track by 0 points" label

#### Refactoring

- Centralize event/status constants and remove prototype code

#### Chores

- Update doc references, fix Mermaid FK-UK syntax
- Move loadout builder spec + plan to GitHub issue #162
- Add grouping and schedule alignment to dependabot config

## 0.16.0 (2026-03-28)

### Infrastructure

- Chain seed script after `prisma migrate deploy` in `Dockerfile.migrate` — historical season data is now automatically seeded on deployment

### Features

- On-demand season fetching: `/war` page derives season selector from current season number instead of querying DB. Missing seasons are fetched from the official Helldivers API and stored on first request via `fetchAndSeedSeason()`
- Deleted `getSeasonList.mjs` query — no longer needed

### Bug Fixes

- Fix map sector calculation: only pass active events to `computeMapState()` on live homepage and OG image. Completed defend events were overwriting campaign score-based sector ownership, causing fewer sectors to appear captured than the score warranted
- Affects: `src/app/page.jsx`, `src/app/api/og/route.js`

### Debugging Technique

- Used Chrome DevTools MCP to parse live DOM sector classes and extract RSC payload data, comparing `points` vs `points_taken` field values across all three factions to identify the root cause

## 0.15.0 (2026-03-28)

### Phase 5: Design System

- Create design token system (`src/styles/tokens.css`) with colors, surfaces, fonts, spacing
- Integrate tokens into Tailwind v4 `@theme` block with 0px radius overrides
- Load Space Grotesk and Inter via `next/font/google`
- Create `/brandkit` visual reference page (palette, typography, spacing, components)
- Fix faction colors to match game icons: Bugs=orange, Cyborgs=dark red, Illuminate=cyan
- Standardize card component: right-side accent line, grid-based layout

### Phase 6: Mobile-First Dashboard

- Add BottomNav component (fixed bottom tab bar: Live/History/About)
- Add FactionTabs segmented control (Global/Bugs/Cyborgs/Illuminate)
- Add StatGrid 2×2 data card grid with faction filtering
- Rewrite Event cards with right-side accent, status-based background tinting
- Rewrite Alerts as full-width stacked banners (replacing carousel)
- Complete homepage rewrite with DashboardClient mobile-first layout
- Update war history page for mobile-first single column
- Slim header on mobile (hide nav links, BottomNav handles primary nav)
- Migrate `.card` class from Tailwind hardcoded to design tokens
- Update war outcome badge to use design tokens

## 0.14.0 (2026-03-27)

### Security

- Migrate update endpoint auth from query param to Bearer token header
- Upgrade API key hashing from MD5 to SHA-256
- Normalize auth patterns across all protected endpoints

### Code Quality (desloppify)

- Add 210 unit tests across 16 files (validators, queries, utilities)
- Migrate `api.mjs` and `post.mjs` to `tryCatch` pattern, fix `db.post` → `db.review`
- Rename all enum and validator files from `.js` to `.mjs` for consistency
- Standardize rebroadcast query structure, remove dead code
- Deduplicate logic, simplify utilities, remove unused exports
- Add `evaluateProgress` utility for live event progress tracking
- Add `'use server'` directives where missing

### Performance

- Fix React rendering waterfalls, reduce bundle size, improve caching (#146)

### Features

- Timeline deep-linking with URL hash navigation
- Lost sector visibility improvements on war page
- Season URL redirect (bare `/war` → current season)

### Chores

- Move OG image spec/plan to completed
- Remove deprecated `TODO.md`
- Run prettier formatting pass

## 0.13.0 (2026-03-26)

- Dynamic OG image generation showing galaxy map with live war progress
- Extract SVG path geometry into shared `src/enums/mapPaths.mjs`
- Extract `getWarOutcome` into shared utility with unit tests
- Refactor `Map.jsx` to consume shared path data
- Add OG route smoke test

## 0.12.0 (2026-03-26)

- Add Vitest testing infrastructure with node environment, v8 coverage, and `@`/`@test-utils` path aliases
- Add global mocks for NextAuth v5 `auth()`, Prisma client (all models), and Next.js modules
- Add test utilities: `createMockRequest`, `createMockSession`, `createMockModel`
- Migrate Playwright smoke tests from `tests/` to `src/__tests__/e2e/` (aegis conventions)
- Configure Playwright screenshot-on-failure and trace-on-first-retry
- Add `docs/06-testing.md` — testing conventions, mock factories, API route testing patterns
- Add starter unit tests for `tryCatch` utility (100% coverage)
- Fix war outcome detection: data-derived algorithm replaces lookup table, verified against 137 wiki seasons (0 mismatches)

## 0.11.0 (2026-03-26)

- Phase 3: Gate `/api/h1/rebroadcast` behind API key validation (Bearer token + MD5 hash lookup)
- Phase 4: War Outcome & Interactive Timeline on `/war?season=N`
    - Victory/Defeat banner derived from snapshot + event data
    - Interactive timeline scrubber (`<input type="range">`) with event markers
    - Extract `computeMapState` pure utility from Galaxy (no more shared mutable state)
    - Refactor Galaxy to accept `mapState` prop
    - Re-enable attack event visualization on the map
    - Native `<select>` season dropdown replaces 155-button grid
    - Exclude active season from history (homepage shows live war)
    - Sort snapshots by time ascending in campaign query
- Merge `/about`, `/docs`, `/api` pages into single `/about` page with Swagger UI
- Add blinking red "Live" nav item linking to homepage
- Restructure navigation: site links | external links (heartbeat + GitHub) | user section
- Dashboard link moved into user avatar (clickable) section
- Fix homepage Galaxy map visibility on desktop (fixed-position width regression)
- Sync OpenAPI spec with actual response format (`time`/`code`/`message` fields)
- Fix rebroadcast `after()` closure bug and analytics URL copy-paste error
- Fix documentation inaccuracies across all 5 doc files

## 0.10.0 (2026-03-26)

- Restructure homepage as live war dashboard (galaxy map, faction stats, event timeline)
- Repurpose `/war` as historical season browser with season selector
- Create `/about` page for relocated marketing content (about, discord, API)
- Update navigation: rename "War" to "History", add "About" link
- Add `getSeasonList` query for season selector
- Update sitemap with `/war` and `/about` entries
- Update layout metadata to reflect dashboard purpose
- Upgrade to Next.js 16 with Turbopack default bundler
- Upgrade to Prisma 7.5 with `@prisma/adapter-pg` driver adapter
- Phase 1 backend: restructure Prisma schema — unify events into `h1_event`, add `h1_live`, drop redundant tables (`h1_campaign`, `h1_defend_event`, `h1_attack_event`, `h1_statistic`)
- Phase 2 backend: add `h1_live_snapshot` and `h1_event_snapshot` tables for time-series data
- Add in-memory snapshot throttle system (15-min stats, 10-min events)
- Wire snapshot capture into the polling pipeline
- Add seed files for all 156 past seasons
- Add database migration for Phase 1 schema rewrite
- Implement fluid typography with CSS `clamp()` for responsive text scaling
- Add ESM `"type": "module"` to `package.json`
- Add Vitest smoke tests (`npm run test:smoke`)

## 0.8.0 (2025-12-09)

- Completely rework the website layout and structure
    - Add Active component
    - Update Navigation with Github links and umami event tracking
    - Update HomePage to say more about the project (actual landing page)
        - Features
        - About
        - Roadmap
    - Update Footer to have a proper sitemap, legal and donate links.
    - Move the detailed map a new /campaign page
    - Move stats to the /stats page
- Add Mobile Navigation
- Add JSON LD to Event component
- Add robots.txt
- Add sitemap.js to generate sitemap.xml
- Update Umami tracking to only run in production.
- Remove NodeMailer and email/password login from auth.

## 0.7.4 (2025-12-09)

- fix react2shell

## 0.7.3 (2025-06-24)

- Add Github Action to generate PageSpeed Insights Metrics
- Update favicon.ico so there's less whitespace (more icon)
- Add loaderio verification file

## 0.7.2 (2025-06-20)

- Update Timeline to display nothing when no events are present.
- Fix Cyborg map order
- Update and reorganise README.md
- Add CodeQL and Dependabot badges to README.md

## 0.7.1 (2025-06-17)

- Update Umami tracking code(s)
- Update Tooltip to always show inside body
- Hidden campaigns now correctly display as 0 progress
- "in_progress" (contested region) doesn't pulse red. Only "active" (Defend & Attack Events) should pulse red.

## 0.7.0 (2025-06-16)

- Add reload.js to reload the page in client every 30 seconds.
- Update Map
    - show attack events (flashing)
    - show defend events (flashing)
    - Homeworld Tooptips
- Update Header to hide and show on scroll
- Update Timeline to show human readable time
- Update umami to use environment variables
- Fix Timeline
    - fix text color in Firefox & Chrome light modes
- Fix Map
    - progress styling in Firefox & Chrome
    - active event keeps showing up after finishing
- Fix Lighthouse bugs
    - Image sizing
    - WebP Fixes
    - Caching

## 0.6.3 (2025-06-11)

- add human readable time to attack and defend events
- add progress bar with points and percentage
- add event type icons

## 0.6.2 (2025-06-11)

- remove console.logs
- fix bug showing 0% Sol System
- rename layout2 to layout
- remove footer (temporarily)
- add season time
- track api calls as events instead of page visits.
- initialize.env.mjs - check if all .env variables are set.
- add proper favicons
- fix layout

## 0.6.1 (2025-06-09)

- Fixes to get Docker working (again).
- Responsive fixes
- code split Galaxy into:
    - Galaxy.jsx
        - Map.jsx & Map.css
        - Tooltip.jsx & Tooltip.css
- Adjust Tooltop
    - show percentage bar
    - show points earned/max
- Adjust Timeline
    - proper styling
- Create War Stats

## 0.6.0 (2025-06-09)

- Update Galaxy.jsx functionality
    - show captured regions (yellow border, yellow color)
    - show in_progress region (gold border, faction color)
    - show lost region (dark/transparent)
    - hover tooltip over regions to show region name

- Create Timeline.jsx component
    - show list of all defend/attack events, sorted by start_time

## 0.5.4 (2025-06-08)

- rewrite update logic to avoid having to generate complete season list.
- update worker to use .env variables for key and interval
- update route.js & rebroadcast.mjs for new logic
    - working POST /api/h1/rebroadcast
- update route.js & getCampaigns().mjs for new logic
    - working GET /api/h1/campaign
    - working GET /api/h1/campaign?season=[season]

## 0.5.3 (2025-05-31)

- rebroadcast now attempts to fetch data if it's not available locally before erroring out on season (get_snapshots) requests.
    - it will not fetch data for status (get_campaign_status) requests, because that data is continiously updated by the worker.
    - it will not longer check last_updated and trigger automatic updates in after().
        - current campaign's data is continiously updated by the worker.
        - old data will never change, and an update should thus only be triggered manually.
- GET /api/h1/campaign/ -> complete current/latest season data
- GET /api/h1/campaign?season=[season] -> complete specific season data

## 0.5.2 (2025-05-30)

- add server-side umami tracking to api routes
- adjust instrumentation.js
    - to make use of the new update functions to initialize the database with the current campaign
    - to add a node.js worker that will continiously update the database every 20 seconds

## 0.5.1 (2025-05-30)

- rework update functions
    - add `/api/h1/update` route to test update functionality
    - separate `update` directory
    - code split into:
        - fetch.mjs -> functions to fetch data from the API
        - status.mjs -> standalone function to update current status
        - season.mjs -> standalone function to update specified season
    - separate upsert queries for each data type
        - upsertAttackEvents.mjs
        - upsertCampaigns.mjs
        - upsertDefendEvent.mjs
        - upsertDefendEvents.mjs
        - upsertIntroductionOrder.mjs
        - upsertPointsMax.mjs
        - upsertSeason.mjs
        - upsertSnapshots.mjs
        - upsertStatistics.mjs

## 0.5.0 (2025-05-28)

- status badges in README.md
- /docs works in SSR mode
- generate opengraph-image at /api/og
- moved openapi spec to /public/openapi.json and adjust /Docs page
- moved prisma to production dependencies (as to run migrations from the docker container)
- cleaned up github action workflows
    - deleted manual.docker.yml
    - disabled status.docker.yml
    - created staging.docker.yml
        - added NODE_ENV=staging to build-args
        - added manual dispatch option (replaces manual.docker.yml)
    - edited release.docker.yml, added NODE_ENV=production to build-args
    - adjusted Dockerfile to support build-arg "NODE_ENV"

## 0.4.2 (2025-05-28)

- migrate openapi generation to instrumentation.js -> npm run build removes all comments from the code, so it cannot be generated live.
- add umami.js
- add Galactic Map
- add Stats
- Docker fixes
- Hosted and available at staging.helldivers.bot

## 0.4.1 (2025-05-20)

- create `/api/openapi` route.js that uses swagger-jsdoc and the JSDoc comments in `/api/h1/\*\*/\*.js` to generate an OpenAPI spec.
- create `/docs` page.jsx that uses swagger-ui-dist to render the OpenAPI spec.

## 0.4.0 (2025-05-20)

- implement Prisma Models for helldivers1 data
- POST /api/h1/rebroadcast
    - get_campaign_status
    - get_snapshots
- updateStatus.mjs
- updateSnapshot.mjs
- validate works in docker

## 0.3.3 (2025-05-19)

- Flesh out the Dashboard
    - Show list of API keys
    - Create new API key
    - Delete existing API key
- zod for validation
- Validate works in docker

## 0.3.2 (2025-05-15)

- Add nodemailer provider to auth
- Flesh out Frontend layout
- Add json-ld to Homepage
- Create Posts button ("use server")
- Show Posts

## 0.3.1 (2025-05-12)

- Validate auth still works in docker

## 0.3.0 (2025-05-12)

- Add dependencies for next-auth
- Configure [Auth](https://authjs.dev/getting-started/installation?framework=Next.js)
- Adjust Prisma Schema to support authentication
- Add pages and components to handle authentication

## 0.2.0 (2025-05-11)

- Change Github Actions to only build for amd64 -> this is so I can properly use the Labels in the Dockerfile, without requiring the use of annotations. [read more](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry#adding-a-description-to-multi-arch-images)
- Added and configured PrismaORM
- Added .example.env file
- Switched whole project to JavaScript (once again I am convinced typescript doesn't actually help, but only put spokes in your wheels).
- Working Docker build with PrismaORM

## 0.1.0 (2025-05-10)

- initialize project with `npx create-next-app@latest`
- Configure next.config.js to use output: 'standalone', which will be used by the container
- Configure Dockerfile, docker-compose.yml and .dockerignore to build a working container
- Configure Prettier and make it sort Tailwind CSS classes
- Add Chokidar to watch for changes in the src folder and run linting and prettier
- Add README.md, CHANGELOG.md, LICENSE
- Add Github Action to manually build the container and push it to Github Container Registry
- Add labels to Dockerfile
- Add some folder structure to the project
    - src/app -> routable content
    - src/components -> reusable components
- Add Github Action to automatically build and push the container to Github Container Registry on every tagged commit, and create a new release on Github.
