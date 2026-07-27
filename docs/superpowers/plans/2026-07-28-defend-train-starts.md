# Defend Train-Starts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Determine whether the start of a defend _train_ is predictable, having established that continuation within a train is a deterministic mechanic.

**Architecture:** Extends the existing, already-reviewed `scripts/analysis/` machinery. No new libraries and no harness changes — `walkForward` already filters `events.filter(e => e.type === type)`, so passing a pre-restricted event array makes that filter a no-op and the train-start series flows through unchanged.

**Tech Stack:** Node 24, `pg`, `node:assert`. No new dependencies.

**Issue:** [#472](https://github.com/elfensky/helldivers.bot/issues/472)

## Why this exists

The completed investigation (v0.69.0) pooled all 5,088 defend events. That was the wrong unit. Measured on the current data:

| Previous defend outcome | Chained within 10 min?  |
| ----------------------- | ----------------------- |
| FAILED                  | 3110 / 3208 = **96.9%** |
| SUCCEEDED               | 2 / 1720 = **0.1%**     |

Train continuation is a game mechanic — the train continues iff we failed. So ~62% of defend events are mechanical follow-ups, and pooling them with the ~1,976 train starts did two kinds of damage:

1. **Phase 1's trigger hunt was diluted.** Mechanical follow-ups carry no campaign-state relationship; mixing them with train starts could mask a real trigger.
2. **Phase 2's predictor was fed the wrong distribution.** `LULL ONLY` filtered _when_ the question was asked, but training still used all 4,928 defend-to-defend gaps — bimodal and dominated by 2.5h chain gaps — to predict ~44h waits.

Train starts are far more regular:

| Series       | n    | p25   | p50   | p75   | CV       |
| ------------ | ---- | ----- | ----- | ----- | -------- |
| all defends  | 4928 | 2.5h  | 2.5h  | 32.9h | 1.32     |
| train starts | 1816 | 33.6h | 44.1h | 56.0h | **0.45** |

## Global Constraints

Identical to the v0.69.0 cycle. All still binding:

- **No new npm dependencies.** `pg` and `node:assert` only.
- **No vitest files.** `src/__tests__/unit/_meta/mirrorTree.test.mjs` resolves test paths only against the `src` and `public` roots, so a test for `scripts/` fails the mirror rule. Inline `assert` self-checks are the verification.
- **No `tryCatch` wrapper and no try/catch**, except the pre-approved `try/finally` DB cleanup already in `dataset.mjs`.
- **Relative imports only** — the `@/*` alias does not resolve outside Next.js. No `dotenv` import; invocation is `node --env-file=.env.development ...`.
- **Deterministic.** Seeded LCG only, never `Math.random()`. Reuse the existing seeds so prior runs stay reproducible.
- **`npm run lint:fix` then `npm run lint` before every commit.** `scripts/` is linted.
- **Do not modify `lib/backtest.mjs`.** It is reviewed and its guards are mutation-tested. Restricting the event set is done by the caller.
- **`CHAIN_SECONDS = 600`** — the existing chain threshold in `02-baseline.mjs`. Use the same value; do not re-tune it.

---

### Task 1: Train-start labelling in the data layer

**Files:** Modify `scripts/analysis/lib/dataset.mjs`

**Interfaces produced:** each `defend` event gains

- `isTrainStart: boolean` — true when no same-season defend ended within `CHAIN_SECONDS` before its start
- `prevTrainLength: number|null` — defend count of the preceding train in the same season, `null` for a season's first train
- `prevTrainFailures: number|null` — how many of that preceding train were failed

- [ ] **Step 1: Add the failing self-check first**

Add to `dataset.mjs`'s self-check block. It must encode the mechanic, so a regression in the labelling is caught:

```js
// Train labelling. Continuation is a game mechanic: a defend train continues
// iff the previous defend was FAILED (measured 96.9% vs 0.1%). These asserts
// pin that relationship — if labelling regresses, they fire.
{
    const defends = ds.events.filter((e) => e.type === 'defend');
    assert(defends.length > 0, 'no defend events');

    const starts = defends.filter((e) => e.isTrainStart);
    assert(
        starts.length > 0 && starts.length < defends.length,
        `train starts (${starts.length}) should be a proper subset of defends (${defends.length})`,
    );

    // Every season's first defend is a train start.
    const bySeasonTrain = new Map();
    for (const e of defends) {
        if (!bySeasonTrain.has(e.season)) bySeasonTrain.set(e.season, []);
        bySeasonTrain.get(e.season).push(e);
    }
    for (const [, list] of bySeasonTrain) {
        assert(list[0].isTrainStart, 'a season first defend must be a train start');
    }

    // The mechanic: continuation after a SUCCESS is near-nonexistent.
    let afterSuccessContinued = 0;
    let afterSuccess = 0;
    for (const [, list] of bySeasonTrain) {
        for (let i = 1; i < list.length; i++) {
            if (list[i - 1].status !== 'success') continue;
            afterSuccess++;
            if (!list[i].isTrainStart) afterSuccessContinued++;
        }
    }
    assert(afterSuccess > 100, 'not enough post-success cases to check');
    assert(
        afterSuccessContinued / afterSuccess < 0.05,
        `trains should not continue after a success; got ${afterSuccessContinued}/${afterSuccess}`,
    );

    // prevTrainLength is null exactly for a season's first train.
    for (const [, list] of bySeasonTrain) {
        const seasonStarts = list.filter((e) => e.isTrainStart);
        assert.equal(
            seasonStarts[0].prevTrainLength,
            null,
            'first train of a season must have null prevTrainLength',
        );
        for (const s of seasonStarts.slice(1)) {
            assert(
                s.prevTrainLength >= 1,
                `prevTrainLength must be >= 1, got ${s.prevTrainLength}`,
            );
            assert(
                s.prevTrainFailures <= s.prevTrainLength,
                'prevTrainFailures cannot exceed prevTrainLength',
            );
        }
    }
}
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --env-file=.env.development scripts/analysis/lib/dataset.mjs`
Expected: FAIL — `isTrainStart` is undefined, so the proper-subset assert fires.

- [ ] **Step 3: Implement the labelling**

In `loadDataset()`, inside the existing `for (const [, list] of eventsBySeason)` derived-fields loop, after the gap computation, add:

```js
// Train labelling. A defend train continues iff the previous defend was
// failed — a game mechanic, not a statistical tendency. Only the FIRST
// defend of a train is a forecasting target; the rest are mechanical.
const CHAIN_SECONDS = 600;
const defends = list.filter((e) => e.type === 'defend');
let currentLength = 0;
let currentFailures = 0;
let lastTrainLength = null;
let lastTrainFailures = null;

for (let i = 0; i < defends.length; i++) {
    const prev = i > 0 ? defends[i - 1] : null;
    const isStart =
        prev === null || defends[i].start_time - prev.end_time > CHAIN_SECONDS;

    defends[i].isTrainStart = isStart;
    if (isStart) {
        // Close the train that just ended, then open a new one.
        lastTrainLength = i > 0 ? currentLength : null;
        lastTrainFailures = i > 0 ? currentFailures : null;
        currentLength = 0;
        currentFailures = 0;
    }
    defends[i].prevTrainLength = isStart ? lastTrainLength : null;
    defends[i].prevTrainFailures = isStart ? lastTrainFailures : null;

    currentLength++;
    if (defends[i].status === 'fail') currentFailures++;
}
```

- [ ] **Step 4: Run the self-check to verify it passes**

Run: `node --env-file=.env.development scripts/analysis/lib/dataset.mjs`
Expected: PASS.

Then confirm the counts match what motivated this work: **1,976 train starts out of 5,088 defends.** If they differ, report the actual numbers rather than forcing them.

- [ ] **Step 5: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add scripts/analysis/lib/dataset.mjs
git commit -m "analysis(472): label defend train starts and previous-train features"
```

---

### Task 2: Trigger hunt restricted to train starts

**Files:** Modify `scripts/analysis/01-trigger-hunt.mjs`

The script already runs its concentration + permutation analysis per event type. Add a **third** run over train starts only, reusing the existing machinery rather than duplicating it.

**Do not change** the method: phase-matched controls from other seasons, the 3h exclusion window, `RULE_IQR_RATIO = 0.25`, `RULE_SPAN_RATIO = 0.35`, `ALPHA = 0.05 / VARIABLES.length`, the permutation test with add-one smoothing, RULE-LIKE requiring both a large effect and significance, and the existing seeds.

- [ ] **Step 1: Generalise the run to accept an event subset**

The existing per-type function selects its events internally. Change it to accept the event array it should analyse, plus a label for output, so a caller can pass either "all defends" or "train starts only". Keep the existing two calls working identically — verify by diffing the output for the `defend` and `attack` sections against the current run before your change.

- [ ] **Step 2: Add the third run**

Add a run labelled `defend TRAIN STARTS` over `ds.events.filter(e => e.type === 'defend' && e.isTrainStart)`, printed after the existing defend section.

**This is the load-bearing comparison.** The pooled defend run found no trigger; if a trigger exists only for train starts, it appears here and was previously masked by ~62% mechanical follow-ups. Print the pooled-defend and train-start IQR ratios side by side per variable so the dilution effect is visible either way.

- [ ] **Step 3: Run and confirm the existing sections are unchanged**

```bash
node --env-file=.env.development scripts/analysis/01-trigger-hunt.mjs | tee /tmp/phase1-trains.txt
```

Diff the `attack` and pooled `defend` sections against the pre-change output. Any drift there is a bug in the refactor, not a finding.

- [ ] **Step 4: Lint and commit**

```bash
npm run lint:fix && npm run lint
git add scripts/analysis/01-trigger-hunt.mjs
git commit -m "analysis(472): trigger hunt over defend train starts"
```

---

### Task 3: Train-start baseline and previous-train features

**Files:** Create `scripts/analysis/04-train-baseline.mjs`

**Method:** identical to `02-baseline.mjs` — empirical residual life through `walkForward` — but with the event set restricted to train starts, so both training gaps and evaluation targets are train-start-to-train-start.

Key wiring, and the reason no harness change is needed:

```js
// walkForward filters `events.filter(e => e.type === type && ...)`. Passing an
// already-restricted array makes that filter a no-op, so the train-start series
// flows through unchanged — no harness modification required.
const trainStarts = ds.events.filter((e) => e.type === 'defend' && e.isTrainStart);
```

A moment filter is still needed: a train cannot start while a train is running, so exclude moments where any defend is active. That test needs the FULL defend list, not the restricted one, so close over it:

```js
const allDefends = ds.events.filter((e) => e.type === 'defend');
const activeBySeason = new Map();
for (const e of allDefends) {
    if (!activeBySeason.has(e.season)) activeBySeason.set(e.season, []);
    activeBySeason.get(e.season).push(e);
}
/** A train cannot start while any defend is still running. */
function noDefendActive(t, _seasonEvents, season) {
    const list = activeBySeason.get(season) ?? [];
    return !list.some((e) => e.start_time <= t && e.end_time > t);
}
```

If `momentFilter`'s signature does not carry the season, derive it inside the closure from the moment's own events or bind one filter per configuration — **do not modify `backtest.mjs`.**

- [ ] **Step 1: Write the self-check first**

Cover the pure helpers: that `noDefendActive` returns false during an event and true in a gap, and that the restricted event set is a proper subset of all defends. Run it and confirm it fails before implementing.

- [ ] **Step 2: Implement and run the baseline**

Report the same three scores as `02-baseline.mjs` — censoring-aware calibration (plus the uncensored-only diagnostic), sharpness against the train-start gap IQR, and skill ratio with its season-level bootstrap CI — and apply the same decision gate (calibration within ±0.05, skill-ratio CI upper bound ≤ 0.6, band narrower than the marginal IQR).

**Print an explicit comparison against the v0.69.0 numbers**, which were measured on the mis-specified target:

- `defend, all enemies`: skill 0.628, CI [0.605, 0.653]
- `defend, LULL ONLY`: skill 0.770, CI [0.746, 0.789]

- [ ] **Step 3: Add previous-train features**

Test whether `prevTrainLength` and `prevTrainFailures` predict the next train start, by the same concentration method Task 2 uses — do they differ at train starts versus phase-matched controls? These are newly available now that trains are a unit.

Report them as evidence, and only build a feature model if the concentration test shows signal. **A null result here is a perfectly good outcome** — report it plainly rather than fitting a model to noise.

- [ ] **Step 4: Run, lint, commit**

```bash
node --env-file=.env.development scripts/analysis/04-train-baseline.mjs | tee /tmp/phase4.txt
npm run lint:fix && npm run lint
git add scripts/analysis/04-train-baseline.mjs
git commit -m "analysis(472): train-start baseline and previous-train features"
```

---

### Task 4: Update the record

**Files:** Modify `docs/superpowers/findings/2026-07-27-next-event-timing.md`, `scripts/README.md`, `CHANGELOG.md`

- [ ] **Step 1: Update the findings doc**

Add a train-starts section: the fail→chain mechanic (96.9% vs 0.1%), the regularity comparison (CV 1.32 → 0.45), the trigger-hunt result on train starts, and the new baseline numbers against the old.

**Correct, do not merely append to, the defend verdict.** The v0.69.0 conclusion was measured against a mis-specified target; say so plainly wherever the old numbers appear.

- [ ] **Step 2: Document the new script** in `scripts/README.md`'s `## analysis/` section.

- [ ] **Step 3: CHANGELOG** — new version section. Do NOT touch `package.json`; the controller bumps it in the merge commit.

- [ ] **Step 4: Verify and commit**

```bash
npm run lint && npm run typecheck && npm run test:unit
```

`npm run build` needs a sourced environment (`set -a && . ./.env.development && set +a`) — without it, it fails on `POSTGRES_URL is not set` on `develop` too, so that failure is pre-existing and not caused by this branch.

---

## Self-Review

**Coverage:** the fail→chain mechanic is encoded as a self-check assert (Task 1), the diluted trigger hunt is re-run on the correct subset (Task 2), the mis-specified predictor is retrained on the correct series (Task 3), and the public record is corrected (Task 4).

**Placeholders:** none. Task 3 Step 3 is deliberately conditional — build a feature model only if the concentration test shows signal — which is a decision rule, not a gap.

**Type consistency:** `isTrainStart` / `prevTrainLength` / `prevTrainFailures` are produced in Task 1 and consumed in Tasks 2 and 3 under those exact names. `CHAIN_SECONDS = 600` matches `02-baseline.mjs`. `walkForward`'s signature is unchanged and untouched.
