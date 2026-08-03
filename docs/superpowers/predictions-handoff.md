# Predictions investigation — living handoff

**Purpose:** the single entry point for anyone (human or fresh agent
session) picking up the HD1 event-prediction work. Read this first; follow
pointers for depth. **Keep it living:** every attempt, correction, or
shipped artifact updates this file in the same branch.

**Last updated:** 2026-08-03 (verdict/sector docs + paceEtaHours dedup, after v0.88.0)
**Issue trail:** #472 → #479 → #480 → #482 → #483 → #486 → #487 (open,
data-gated) → #488 → #489
**Full narrative record:**
[`findings/2026-07-27-next-event-timing.md`](findings/2026-07-27-next-event-timing.md)
**Per-script reference:** [`scripts/README.md`](../../scripts/README.md)
(§ analysis/) **Published story:** `/docs/predict` (+ `/attack`, `/defend`)

---

## TL;DR state

There are **two kinds of prediction** in this project, and they must never
be conflated (doing so produced three target mis-specifications):

| | MECHANICAL (clocks) | STATISTICAL (models) |
| --- | --- | --- |
| What | Assault trigger, 48h timeout, counterattack fire, chain rule, assault gate, victory release | Free-wave timing, assault-start ETA, faction choice residual |
| Error | ~0 (minutes) | Attack ETA: gate PASSED (skill 0.23–0.33). Free waves: gate FAILED five times (best CI [0.559–0.621] vs ≤0.6 bar) |
| Ships as | Counterattack clock, assault trigger readout, chain/gate behavior | Attack ETA line (`attackModel.mjs`), free-wave band (`waveModel.mjs`) |
| Epistemic status | Game rules, measured exact | Calibrated bands, pre-registered gate |

**Current verdicts:** attacks SOLVED (deterministic trigger + pace ETA,
gate passed). Counteroffensive SOLVED (deterministic clock, conditional on
the assault failing). Free waves **INCONCLUSIVE after five attempts** — a
calibrated band ships, a countdown does not; the pre-registered bar
(skill-ratio CI upper ≤ 0.6 + calibration ±0.05 + band < marginal) has
never been met and must not be moved.

**The single identified path forward is data, not modelling** — see
§ Data clocks.

## Confirmed mechanics (each with the script that re-proves it on every run)

1. **One global defend slot** — two defends never co-run: 0/120,082 pairs.
   A defend never co-runs with a SAME-faction attack: 0/9,584. Cross-faction
   defend-attack co-runs are routine: 955/19,756. Attack-attack: 375/2,936;
   max 3 simultaneous events, never 2 defends. *(14)*
2. **Chain rule** — a failed defend chains another within 10 min (~97.1%);
   a won defend ends the train (0.1% continue). Only train STARTS are
   forecasting targets. *(lib/dataset.mjs self-check)*
3. **Deterministic assault trigger** — an attack fires the moment
   `points == points_max`; the published "trigger band" was staleness smear.
   *(09)*
4. **Exact 48h assault timeout** — every fail-resolved assault ran 48.0h
   (544/544 ±30min); successes end early on points (p50 37.0h). "Failed" is
   therefore observable in real time. *(14, 17)*
5. **Immediate counterattack** — slot-free counterattacks start within
   10 min of the timeout (467/474; p05–p95 = 0.0h; 0 exactly-0s timestamps,
   so not an event-sourcing artifact). Queued cases fire LATE (double-queue
   p50 36.8h) — never pool them with the slot-free population. Region 9 in
   97.8% of cases. Counterattack trains are harder to stop: first-defend win
   22.6% vs 46.7%, length p50 3 vs 1, duration p50 7.3h vs 2.5h. *(14, 17)*
6. **Assault gate** — zero free waves have ever started during an assault
   (178/178 during-assault train starts are counterattacks; 0 in 24,651h of
   assault-active lull exposure vs 34.9 starts/1000h assault-free). *(14)*
7. **Victory release** — after a WON assault the held clock releases: next
   free wave at p25 = p50 = 0.0h (n=166; KS 0.733 vs a fresh draw). After a
   counterattack train it's a fresh end-anchored draw (KS 0.161). *(17)*
8. **The free scheduler** — one global end-anchored timer, faction drawn at
   spawn (per-faction cycles are NOISIER than pooled — superposition
   signature). Decontaminated fit (free lulls net of gated time):
   **gamma(k≈8.8, θ≈3.6h)**, mean ~32h, CV 0.336, KS 0.077. The old
   k≈4.4 fit was counterattack-contaminated. *(13, 15)*
9. **Faction choice** — counterattack rule fixes it after failed assaults
   (179/179); SC9-window tilt 61.4% (placebo p=0.0005); residual
   near-random (best naive rule 44.3% vs 33% chance). *(12)*
10. **Outcome survival** — P(fail | assault still running at elapsed e)
    climbs 0.588 → 0.966 between e=0 and e=47h, stable across history
    halves. The live pace verdict is near-decisive (on-track past 35%
    elapsed: 0/260 moment-observations failed; behind: ~70% fail) **but
    rests on n=7 progress-tracked assaults** — unquantifiable until #487's
    data exists. *(17)*

## How the counteroffensive clock reuses the attack stack

The counterattack forecast is assembled ENTIRELY from attack-side pieces —
nothing statistical of its own:

| Piece | Origin | Status |
| --- | --- | --- |
| When an assault starts | Deterministic trigger (09) + pace ETA (10/11, `attackModel.mjs`) | SHIPPED (gate passed) |
| How long a failing assault lasts | Exact 48h timeout (14) | Constant |
| When the counterattack lands | Timeout + <10min (14) | Constant |
| Will it fail at all | `eventForecast.mjs` pace verdict (#483 margin work), reused verbatim by `counterattackForecast.mjs` | SHIPPED as qualitative wording; quantification blocked on #487 |
| Chaining ETA→timeout from SC9 | Tested in 16 | REJECTED (ratio 1.296, CI spans 1 — ETA noise swamps the deterministic tail; do not re-ship without new evidence) |

Backtest of the clock itself: during assaults, "next wave = assault start
+ 48h" scores median |err| **0.0h vs the KM table's 9.2h** (7,282 paired
moments, 130 seasons, win rate 0.894) — conditional on the ~59% fail base
rate; the ~41% success branch is the honest error mass. *(16)*

## Script inventory (`scripts/analysis/`, chronological)

Run as `mise exec -- node --env-file=.env.development scripts/analysis/<f>`.
Every script self-checks via inline `assert` when run directly. Full
descriptions: [`scripts/README.md`](../../scripts/README.md).

| # | Script | Question | Verdict / keepers |
| --- | --- | --- | --- |
| lib | `dataset.mjs` | Single loader: events + train labels (`isTrainStart`, `isCounterattack`) + point-in-time lookups + seeded RNG | Options: `{statistics}`, `{eventProgress}` (S157+ only) |
| lib | `backtest.mjs` | `walkForward` — censoring-aware, season-block bootstrap CI, leakage asserts. **Mutation-tested; do not modify** — restrict targets by passing a pre-filtered events array | `records` exposed for paired comparisons |
| 01 | trigger-hunt | Does campaign state trigger events? | Attacks YES (liberation/sectors rule-like); defends NO |
| 02 | baseline | Featureless residual-life, pooled gaps | Superseded by 04 (wrong target) |
| 03 | hazard | Clock features in a logistic hazard | WORSE than constant (1.057–1.464) |
| 04 | train-baseline | Corrected-target featureless baseline | Skill 0.789 [0.766–0.812]; sharpness comparator discipline lives in its header |
| 05 | defend-covariates | 7-covariate sweep, cross-season controls | All rejected (incl. the libVelocity placebo lesson) |
| 06 | train-covariates | 8 pre-declared covariates, WITHIN-SEASON placebos built in | Real: maxSC==9 (+20.3h), attack-active, prevRegion==10. Null: clock features, cooldown floor |
| 07 | train-state-model | STATE-KM (kNN + Kaplan-Meier) through the gate | 0.679 [0.651–0.707], cal+sharp PASS, skill FAIL → INCONCLUSIVE |
| 08 | emit-wave-model | Emits `waveModel.mjs` (dashboard band), reliability-gated | Regenerate only via its own gate |
| 09 | attack-trigger | Is the trigger exactly points==max? | YES — staleness explained the "band" |
| 10 | attack-eta | ETA = remaining/rate, 24h window, staleness anchor, dow | **PASSES the gate** (skill 0.23–0.33) |
| 11 | emit-attack-model | Emits `attackModel.mjs` constants | Alert-bar gated |
| 12 | faction-choice | WHICH faction is next | Counterattack 179/179; SC9 61.4%; residual random |
| 12b | faction-players-eta | Player-telemetry ETA variants (S157–160) | Directionally better, effN 2–3 → keep shipped model; re-run ~S165+ (#481) |
| 13 | scheduler-shape | Which scheduler design fits the lulls | Gamma accumulator; global end-anchored clock (contaminated fit — see 15) |
| 13b | sector-eta | Next-sector ETA backtest | Gate not yet evaluable (#484) |
| 14 | counterattack-delta | Is the counterattack delay mechanical? | **MECHANICAL** (criterion met); concurrency census; Steam-guide checks |
| 14b | event-verdict-margin | Anti-flicker slack for the pace verdict | **Margin 0** + 25% elapsed gate shipped in `eventForecast.mjs`; verdict is 91.6% accurate (130 events / 2,193 moments) once the deadline bias is corrected — see trap below |
| 15 | counterattack-target | 3rd target correction + gate re-run + gamma refit | STATE-KM 0.625 [0.599–0.664], cal+sharp FAIL → INCONCLUSIVE; clean gamma(k≈8.8, θ≈3.6h) |
| 16 | counterattack-pipeline | Mechanistic composite vs KM table | ATTACK branch WINS (0.0h vs 9.2h); SC9 branch REJECTED |
| 17 | assault-outcome | P(fail\|elapsed), verdict conditioning, clock provenance, counterattack trains | The attempt-5 measurement set (see mechanics 4/5/7/10) |
| 18 | outcome-composite | Attempt 5: outcome-conditioned MC mixture through the gate | **NULL** — 0.588 [0.559–0.621] but cal+sharp FAIL and flat on paired uncensored ATTACK moments (1.045, CI 0.81–1.11). DO NOT ADOPT |

## The gate (pre-registered — do not move it)

Ship-worthy for any timing claim requires ALL THREE, walk-forward:

1. Calibration within ±0.05 at p25/p50/p75 (censoring-aware metric).
2. Skill-ratio **CI upper bound** ≤ 0.6 (never the point estimate).
3. p25–p75 band narrower than the target series' OWN marginal IQR
   (recompute the comparator whenever the target changes).

CI lower bound > 0.8 = not usefully predictable. A null is a good outcome.
**Do not tune, re-window, or re-scope to manufacture a pass.** Every
positive gets a within-season placebo (06 has the machinery) and a
degenerate-control check before it is believed.

## Traps catalog — the project's false positives all came from test construction

1. **Cross-season controls manufacture effects** (the libVelocity lesson) —
   always same-season placebos.
2. **Degenerate controls** — signature: IQR ratio exactly 1.000, p exactly
   1.0000; verify control values differ from event values.
3. **Effective N ≪ moment count** — 3h clock stepping autocorrelates;
   read season-block-bootstrap CIs only.
4. **Definitional results masquerade as discoveries** — check whether a
   mechanic forces the "finding".
5. **Mis-specified targets** — 3 times now: chain follow-ups (attempt 1),
   the forwardRecurrenceMedian filter mismatch, counterattacks (attempt 5's
   predecessor). When the target changes, re-run model AND baseline on the
   same corrected series, and recompute the sharpness comparator.
6. **The queueing confound** — the single defend slot makes pooled deltas
   smear an exact mechanic; always split slot-free vs queued.
7. **Outcome conditioning is retrospective** — "assault failed" is knowable
   only at its end (= the 48h timeout); backtests must not use it earlier.
8. **Censored-moment score inflation** — overall skill gains driven by
   censored lower-bound moments are weak evidence (attempt 5's lesson);
   adoption decisions read the paired UNCENSORED comparison.
9. **h1_status staleness** — ~1 bucket/day for 156/160 seasons; event
   times (`h1_event`, second-resolution) for deltas, never status buckets.
10. **Timestamp artifacts** — an exactly-0s delta spike would be
    event-sourcing, not mechanics; check granularity (14 § a does).
11. **A won event's `end_time` is not its deadline** (2026-08-03, cost script
    14b ~7 accuracy points and a wrong shipped constant) — wins are recorded
    at the moment their points filled, losses at the timer's expiry. Any
    replay that treats `end_time` as "the deadline this event was racing"
    silently hands every success a deadline that never existed and biases the
    rule toward "behind" on exactly the events that succeeded. Reconstruct the
    nominal timer (150 min defends, 48h assaults) — `nominalDeadline` in 14b.
    Anything replaying live-card logic over finished events inherits this.

## Conventions (scripts/)

`pg` + `node:` core only; relative imports; no try/catch; deterministic
(seeded LCG via `makeRng`, never `Math.random()`); helpers DUPLICATED
between scripts rather than shared (each script stays self-contained);
inline `assert` self-checks, **no vitest files** (the mirror-tree rule has
no `scripts/` root); pre-register criteria in the header BEFORE running.
Repo chain before merging: `lint:fix`, `lint`, `typecheck`, `test:unit`,
env-sourced `build`. Work in worktrees off `develop` (§ CLAUDE.md).

## Shipped artifacts map (src/features/dashboard/)

| Module | What | Fed by |
| --- | --- | --- |
| `waveForecast.mjs` | FREE-wave band; hides `assault-active` (gate) / `wave-active` | `waveModel.mjs` (08; ATTACK rows now unused) |
| `counterattackForecast.mjs` | Counteroffensive clock + pace qualifier | 48h constant (14) + `eventForecast.mjs` |
| `eventForecast.mjs` | Win/loss outcome verdict, margin 0, hidden below 25% elapsed | 14b |
| `attackForecast.mjs` / `attackModel.mjs` | Assault-start ETA line + `sectorForecast` (next-boundary median, same `paceEtaHours` core, median-only until 13b's gate is evaluable) | 10/11 |
| `NextWaveCard.jsx` | Renders whichever regime owns the moment | both forecasts |

Notes (2026-08-03): the rate/dow/staleness block is deduplicated into a
module-private `paceEtaHours` in `attackForecast.mjs` (behavior-identical,
tests untouched). `evaluateProgress`'s 'behind' is ALGEBRAICALLY the
complement of `eventForecast.onTrack` at margin 0 (p < M·e/T ⟺ fill ETA >
time left) — the ▲/▼ indicator and the Falls/Fails verdict cannot disagree;
pinned by `paceVerdict.contract.test.mjs`. Script 14b now also prints
accuracy by elapsed decile (no-skip), feeding the /docs/predict chart.
Published: hub "While an event runs" section (+ `LiveOutcomeNow` live
example), attack page "While the assault runs" + "The sector ETA".

## Data clocks — open, blocked on history accumulating

| Issue | Unblocks | Trigger |
| --- | --- | --- |
| **#487** | Attempt 6: verdict-conditioned P(fail) → possibly the first gate pass for assault-epoch waves | ~30+ resolved attacks with ≥3 `h1_event_progress` buckets (17 § 2 prints the count; 7 as of 2026-08) |
| #481 | Per-faction player-telemetry attack ETA re-run | ~S165+ |
| #477 | Assault ETA band width re-measure | ~S172 |
| #484 | Sector-ETA range (13b gate becomes evaluable) | More 15-min seasons |

## Fresh-session checklist

1. Read this file, then the relevant handoff spec in
   [`specs/`](specs/) if resuming a specific attempt.
2. Check the data clocks above — if none have triggered, there is NO
   modelling work to do on free waves; the angle list is exhausted.
3. Never re-derive the mechanics in § Confirmed — the scripts re-prove them
   on every run.
4. Any new positive: assume construction artifact until placebo-tested.
   That instinct is now five for five.
5. File a GitHub issue before starting; close it with the verdict; update
   THIS file and the findings doc in the same branch.
