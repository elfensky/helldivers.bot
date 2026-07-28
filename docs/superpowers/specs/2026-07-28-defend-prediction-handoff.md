# Handoff prompt — further attempts at defend prediction

Copy everything below the line into a fresh session.

---

You are taking over an in-progress statistical investigation in the `helldivers.bot` repo. Your goal: **determine whether the start of a Helldivers 1 defend "train" can be predicted well enough to ship**, after two prior attempts failed to clear the bar.

Read `/docs/predict` on the site or `src/app/docs/predict/page.mdx` for the current public state, and `docs/superpowers/findings/2026-07-27-next-event-timing.md` for the full record.

## The problem

Defend events arrive in **trains**. A train continues iff the players _failed_ the previous defend (97.1% continue after a loss, 0.1% after a win) — a game mechanic, not a tendency. So ~61% of all defend events are mechanical follow-ups, and only the **~1,978 train starts** are forecasting targets.

Train starts are reasonably regular — start-to-start gaps p25 33.6h / p50 44.1h / p75 56.0h, CV 0.45 — but no model has clearly beaten a constant.

**Best result so far:** skill ratio **0.753, 95% CI [0.732, 0.773]**; median absolute error **9.1h** against a constant baseline's 12.1h; calibration passes; sharpness fails (band 23.1h vs marginal 22.4h). Verdict: INCONCLUSIVE.

## The bar (pre-registered, do not move it)

Ship-worthy requires **all three**:

- calibration within ±0.05 of nominal at p25/p50/p75
- skill-ratio **CI upper bound** ≤ 0.6 (read the CI, never the point estimate)
- p25–p75 band narrower than the unconditional marginal

Skill-ratio CI lower bound > 0.8 means not usefully predictable. "It didn't work" is a completely acceptable outcome — the project has published two such conclusions already. **Do not tune, re-window, or re-scope to manufacture a pass.**

## Existing machinery — reuse it, don't rebuild it

`scripts/analysis/`, run as `node --env-file=.env.development scripts/analysis/<file>`:

- `lib/dataset.mjs` — `loadDataset()` → `{events, seasons, statusAt, liberationAt, playerPercentileAt}`. Each defend carries `isTrainStart`, `prevTrainLength`, `prevTrainFailures`. Train labelling is per-`(season, enemy)`.
- `lib/backtest.mjs` — `walkForward(...)`: walk-forward by season, censoring-aware calibration, effective-N reporting, season-level block-bootstrap CI, leakage assert. **Its guards are mutation-tested. Do not modify it.** To restrict the event set, pass an already-filtered `events` array — the internal `type` filter becomes a no-op.
- `01-trigger-hunt.mjs` — concentration + permutation test with phase-matched controls
- `02-baseline.mjs`, `04-train-baseline.mjs` — empirical residual-life baselines
- `05-defend-covariates.mjs` — the covariate sweep

Every module self-checks via inline `assert` when run directly. There are no vitest files by design: `src/__tests__/unit/_meta/mirrorTree.test.mjs` resolves test paths only against the `src` and `public` roots, so a test for `scripts/` breaks `npm run test:unit`.

## Already tested — do not repeat without a new angle

**Established rules (all measured across the full 160-season history):**

- two defends never run concurrently (0 overlapping pairs in 5,091)
- a defend never runs while that same faction has an attack active (0 overlaps)
- a defend and an attack on _different_ factions can overlap (955 pairs)
- defends only occur while a faction is `active`
- attacks fire at 90–100% liberation, always against the homeworld — mechanically triggered, not a forecasting problem

**Rejected as predictors of train-start timing:**

| Variable                                    | Result                                                                             |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| liberation level                            | null (IQR ratio ~1.05)                                                             |
| sectors captured                            | null (1.000)                                                                       |
| days into season                            | null (~1.40)                                                                       |
| player percentile                           | null (~1.17)                                                                       |
| players relative to season median           | null — and the test had a self-inclusion defect, so re-test properly if you use it |
| `points_taken` ratio                        | null                                                                               |
| time since previous event                   | null for train starts (0.93)                                                       |
| previous train length / failures            | null (Pearson r ≈ −0.004 / −0.031 vs lull)                                         |
| liberation velocity 1d / 3d / 7d            | **artifact** — see below                                                           |
| faction status active                       | definitional                                                                       |
| other-faction event active                  | 13.4pp definitional; residual ≈ −13.4pp real                                       |
| hour-of-day + weekend, in a logistic hazard | made predictions _worse_ than a constant (skill 1.057–1.464)                       |

## The traps — read this twice

This project has produced **four separate false positives**, and every one came from control design or test construction, not from modelling. Assume you will hit a fifth.

1. **Cross-season controls manufacture effects.** The liberation-velocity finding looked solid (IQR ratio 0.832, p=0.0005). Redrawn with controls from the event's _own_ season it became 0.998, p=0.4838 — gone. Different wars simply run at different speeds. **A same-season placebo is still not implemented in the scripts. Add it, and run it on every positive you find, before believing any of them.**

2. **Degenerate controls have shipped twice.** Both times, a control's value was silently copied from the event rather than computed independently at the control moment. Signature: IQR ratio exactly 1.000 with p exactly 1.0000. Before trusting any test, verify some control values fall outside the set of event values.

3. **Significance ≠ effect size.** With ~2,000 events and 2,000 permutations, p bottoms out at 0.0005. That means "more extreme than every permutation", not "large". Always report effect size and direction alongside p.

4. **Definitional results masquerade as discoveries.** Check whether a "finding" is forced by a game mechanic before reporting it.

5. **Effective N is far below the moment count.** 3h clock stepping produces autocorrelated near-duplicates. Read the block-bootstrap CI, never a bare point estimate.

## Untried angles, roughly by promise

1. **Clock features on train starts specifically.** The hour-of-day effect (χ²=128.1, df=23; trough 12:00–15:00 UTC, peak 17:00–01:00) and the weekend bump (χ²=21.7) were measured on **all defends** — 61% of which are mechanical follow-ups whose start time is inherited from their train start. Nobody has tested these on the 1,978 train starts alone. The dilution could cut either way. **This is the most obvious gap.**

2. **Is there a hard cooldown floor?** Lull length runs p25 27.8h / p50 36.8h / p75 46.4h with CV 0.45 — tight enough to suspect a scheduled minimum. Look at the _minimum_ and the left tail. A hard floor would be a mechanic worth more than any model.

3. **Per-faction cadence.** Are Bugs / Cyborgs / Illuminate on different train-start rhythms? Never tested. `enemy` is on every event.

4. **Season-level random effects.** Per-season p50 hit rate swings 0.12–1.00 with a trend across the history. If wars have "fast" and "slow" archetypes, a per-season offset estimated from that season's first few trains may beat a global model.

5. **Region.** `h1_event.region` is loaded but never used as a predictor.

6. **The chain-vs-lull mixture model.** Scoped out twice. Model P(chain) and the lull distribution as one two-component object rather than filtering to lulls.

7. **`h1_statistic` telemetry** — 11 fields (kills, deaths, missions, shots, hits, players…) but only **49 train starts** in S157–160. Too thin to conclude from; exploratory only, and say so.

## Rules of engagement

- Report what the numbers say. A null sweep is a good outcome.
- Every positive gets a same-season placebo and an independence check before it goes in a report.
- No new npm dependencies (`pg` and `node:assert` only). No `tryCatch`/try-catch in these scripts. Relative imports only, no `dotenv`. Deterministic — seeded LCG only, never `Math.random()`.
- `npm run lint:fix && npm run lint && npm run typecheck && npm run test:unit` before committing. `npm run build` needs `set -a && . ./.env.development && set +a` first.
- Work on a branch off `develop`, never commit to `develop` or `main` directly.
- If you find something that looks big, assume it is a control artifact until you have proven otherwise. That instinct has been right four times out of four here.
