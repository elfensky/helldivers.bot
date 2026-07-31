# Handoff: does the counterattack mechanic mis-specify the defend target (again)?

**Date:** 2026-07-31
**Origin:** Discord feedback (SomeDoggo, RS13): "Does your predicted wave
count failed homeworld attacks (i.e. enemy counter attack)? My hunch is the
cooldown to attack is always the same, but the defend event just waits for
an appropriate time to begin."
**Predecessor:** `docs/superpowers/specs/2026-07-28-defend-prediction-handoff.md`
(the attempt-3 handoff — read it for the project's full trap history).

You are taking over a mature statistical investigation in the
`helldivers.bot` repo. Your mission: **determine whether counterattack
trains — the defend trains that follow a FAILED homeworld assault — are
mechanically scheduled, and if so, re-verify the entire defend-prediction
gate on the corrected target.** This would be the project's THIRD target
correction, and the pattern is familiar: attempt 1 unknowingly modeled the
chain mechanic (61% of "gaps" were mechanical follow-ups); this question
asks whether attempt 3 unknowingly modeled the counterattack mechanic.

Read first: `/docs/predict/defend` (`src/app/docs/predict/defend/page.mdx`)
for the published state, and
`docs/superpowers/findings/2026-07-27-next-event-timing.md` for the full
record (§ Faction choice and § Scheduler shape are the sections this
handoff builds on).

## What is already established (do not re-derive)

- **The counterattack rule** (`scripts/analysis/12-faction-choice.mjs`,
  committed, self-checking): among lulls that began with a homeworld
  assault in progress, every assault that resolved FAILED was followed by a
  defend wave on that same faction — **179/179 across ~95 seasons**.
  Assaults that resolved SUCCESS were never followed by that faction
  (0/27 — it is defeated). This is a sequencing mechanic, same epistemic
  class as "trains continue until you win."
- **Attack-active lulls are SHORT**: −11.5h within-season delta at lull
  start (p=0.0005, `06-train-covariates.mjs` test 8), lull p50 26.5h vs
  38.0h. Consistent with "assault fails → counterattack comes quickly" —
  but the DELTA FROM ATTACK END has never been measured directly. That
  measurement is your first task.
- **Attacks are deterministic and their ETA is modeled**: an attack fires
  the moment `points == points_max` (`09-attack-trigger.mjs`), and the
  pace-based ETA model (`10-attack-eta.mjs`, `11-emit-attack-model.mjs`)
  PASSES the project gate (skill 0.23–0.33, all legs). This matters:
  if counterattack delay is near-constant, then the whole SC9 → assault →
  counterattack pipeline may be predictable as (attack ETA) + (assault
  duration) + (constant), which would be far sharper than the KM table
  for that branch.
- **The scheduler's shape** (`13-scheduler-shape.mjs`): ONE global
  end-anchored clock, delay ~ gamma(k≈4.4, θ≈8.9h), no ticks, no schedule
  table, faction drawn at spawn. Note this was fit on ALL lulls including
  the ~179 counterattack ones — if those are mechanical, the "free" lull
  distribution is the gamma fit MINUS a contaminating component. Refit on
  the split populations.
- **Current best defend model** (the number to beat, post
  `forwardRecurrenceMedian` fix): STATE-KM skill **0.679 [0.651, 0.707]**,
  calibration PASS, sharpness PASS (20.4h vs 22.4h marginal), verdict
  INCONCLUSIVE against the CI-upper ≤ 0.6 ship bar
  (`07-train-state-model.mjs`). Baseline 0.789 [0.766, 0.812].
- The shipped artifacts: `08-emit-wave-model.mjs` →
  `src/features/dashboard/waveModel.mjs` (the dashboard card),
  reliability-gated. If the target changes, this needs regeneration and
  the card's honesty text re-checking.

## The questions, in order

1. **Measure the counterattack delay directly.** For each of the ~179
   fail-resolved assaults: `delta = counterattack train start_time −
   attack end_time`. Distribution: n, min, p05/p25/p50/p75/p95, CV,
   histogram. Also measure it for the SC9→assault pipeline pieces:
   assault duration itself (fail-resolved attacks' end−start).
   **Pre-register the "mechanical" criterion before looking:** the project
   suggests delta CV < 0.25 OR p95−p05 < 6h ⇒ mechanical (cf. the chain
   rule's 10-minute window); state yours in the script header and hold to
   it. The Discord hunch ("attack cooldown constant, defend waits") maps
   to: is `delta` tight while normal lulls are gamma-wide?
2. **If mechanical (or even semi-mechanical): correct the target.**
   Exclude counterattack trains from the forecasting series (exactly as
   mechanical follow-ups were excluded in the attempt-2 correction) and
   re-run: the featureless baseline and the STATE-KM model through
   `walkForward`, with the gate. CRITICAL: recompute the sharpness
   comparator from the corrected series' own marginal — comparing against
   the old 22.4h IQR is the exact mistake a prior review caught
   (`04-train-baseline.mjs` header). Report the gate verdict for the
   corrected target whatever it is.
3. **If the delta is NOT tight:** that is a publishable null — the
   counterattack rule fixes the faction but not the timing, the current
   target stands, and the write-up should say so explicitly (the Discord
   question deserves a direct answer either way).
4. **The pipeline model (only if 1 found tightness):** for moments in SC9
   or ATTACK states, chain the components: attack ETA (already modeled) →
   assault duration distribution → counterattack delta. Compare that
   branch's error against the KM table's ATTACK/SC9 rows. This is a
   pre-registered comparison, not a fishing trip: declare the composite
   before running it.
5. **Bookkeeping either way:** does `deriveTrainStarts` /
   `lib/dataset.mjs`'s `isTrainStart` need a `isCounterattack` flag?
   (Labelling only — do not change the chain rule.)

## The bar (unchanged — do not move it)

Ship-worthy for any timing claim: calibration within ±0.05 at p25/p50/p75,
skill-ratio **CI upper bound** ≤ 0.6, band narrower than the (corrected)
marginal. CI lower > 0.8 = not usefully predictable. A null on question 1
is a good outcome. **Do not tune, re-window, or re-scope to manufacture a
pass.** Every positive gets the within-season placebo treatment
(`06-train-covariates.mjs` has the machinery) and a degenerate-control
check before it is believed.

## Machinery (reuse, do not rebuild)

`scripts/analysis/`, run as
`mise exec -- node --env-file=.env.development scripts/analysis/<file>`:
`lib/dataset.mjs` (`loadDataset()`; per-(season,enemy) train labelling;
`statusAt`/`liberationAt`; seeded `makeRng`), `lib/backtest.mjs`
(`walkForward` — mutation-tested guards, do not modify; pass a
pre-filtered events array to restrict the target), `12-faction-choice.mjs`
(the lull-record walk + attack conditioning you will extend),
`13-scheduler-shape.mjs` (gamma fit machinery), `07-train-state-model.mjs`
(the STATE-KM model + gate). Scripts self-check when run directly; no
vitest for `scripts/` (mirror-tree rule). Conventions: `pg` + `node:` core
only, relative imports, no try/catch, deterministic (seeded LCG only),
duplicate helpers between scripts rather than importing them.

## Traps — this project has produced FIVE false positives, all from test
construction

The full catalog is in the predecessor handoff; the ones specific to this
mission:

1. **The 179 lulls are already in the training data.** The current model's
   ATTACK-state cell partially encodes the counterattack pattern. Removing
   them changes both the model AND the baseline — walk-forward both on the
   same corrected series.
2. **Outcome conditioning is retrospective at lull start but observable at
   attack end.** "Assault failed" is only known when it resolves. A
   real-time product can use it from that moment on; a backtest must not
   use it earlier. `h1_event.status` stores the FINAL state — deriving
   "when did the outcome become known" needs `end_time`, not `status`
   alone.
3. **Censoring:** assaults near season end / successful assaults truncate
   the series (0/27). Selection on outcome is not selection bias here
   (the mechanic itself conditions on outcome) but keep the two
   conditionals separate in every table.
4. **Staleness:** `h1_status` is ~daily for 156/160 seasons; attack
   start/end times come from `h1_event` (event-sourced, second-resolution,
   NOT smeared) — use event times, not status buckets, for the delta.
5. **Small n:** ~179 deltas. Report CIs (season-level bootstrap if you
   walk-forward), never bare points; effective N discipline per
   `lib/backtest.mjs`.

## Rules of engagement

Report what the numbers say; nulls are good outcomes. Work on a branch off
`develop` in a worktree (§ Worktree Workflow in CLAUDE.md), never commit
to develop/main directly. `mise exec --` prefix (repo pins node 24).
Verification chain before merging: lint:fix, lint, typecheck, test:unit,
build (env-sourced). If findings change the published story, update
`/docs/predict/defend`, the findings doc, and — only if the target
correction changes the model — regenerate `waveModel.mjs` via
`08-emit-wave-model.mjs` (its reliability gate must pass) and re-check the
dashboard card copy. File a GitHub issue for the work; close it with the
verdict. If you find something big, assume it is a construction artifact
until proven otherwise — that instinct is now five for five.
