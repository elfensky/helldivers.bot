# /docs/predict Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `/docs/predict` into a hub + `/docs/predict/defend` + `/docs/predict/attack`, with the defend page rebuilt TLDR-first and blog-style around live DB-backed numbers and an interactive gamma-k explorer.

**Architecture:** Two new analysis scripts first (they mint the page's new figures reproducibly), then a pure+thin live-stats module (hourly ISR), the GammaExplorer client component, then the three MDX pages (attack+hub are mostly verbatim moves; defend is the new narrative), then verification.

**Tech Stack:** Next 16 App Router MDX pages (RSC by default), Recharts (installed) via the existing dynamic-Loader pattern, Prisma `db` client for server queries, Vitest + @testing-library.

**Spec:** `docs/superpowers/specs/2026-07-31-predict-split-design.md` (approved).

## Global Constraints

- Branch `feature/predict-split` exists (holds spec + this plan). Work in a worktree: `git worktree add .worktrees/feature-predict-split feature/predict-split` from the main checkout, then `cp ../../.env.development . && npm install && npx prisma generate` inside it.
- Node via mise: prefix every node/npm command with `mise exec --`.
- KISS; no new npm dependencies. Analysis scripts: `pg` + `node:` core only, relative imports, no try/catch, deterministic (seeded LCG only — `makeRng` from `lib/dataset.mjs`). App code: JSDoc must pass `npm run typecheck` (checkJs); no try/catch (use total functions / `tryCatch` only if async error handling is genuinely needed — it isn't in this plan).
- **Numbers policy (binding):** any figure minted by the NEW scripts (12/13) must be transcribed from the script's actual run output — the plan gives expected ballparks as sanity checks, not values to copy. Any figure MOVED from the current `page.mdx` must be moved byte-verbatim (the defend skill numbers were re-baselined 2026-07-30: headline baseline 0.789 [0.766, 0.812], KM model 0.679 [0.651, 0.707] — do NOT "correct" them to older values).
- Copy rules: "likely" never "will"; no countdown; every DB-derived figure carries a "live · refreshes hourly" affordance; every static backtest figure keeps a "reproduce: script NN" footer.
- Umami: every new link gets `data-umami-event` (category `docs`); the gamma slider fires `docs-gamma-explore` via `useTrack` once per mount (ref guard), not per tick.
- BEFORE every commit: `mise exec -- npm run lint:fix`, then confirm `mise exec -- npm run lint` exits 0 (errors block; jsdoc warnings are repo status quo).
- Commits: small, `feat(predict-split): ...` / `analysis(...): ...` style, each ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Verification chain before merge: lint / typecheck / test:unit / build (build needs `set -a && . ./.env.development && set +a` first).

---

### Task 1: `scripts/analysis/13-scheduler-shape.mjs` — distribution forensics

**Files:**
- Create: `scripts/analysis/13-scheduler-shape.mjs`
- Modify: `scripts/README.md` (bullet + run line, text below)
- Modify: `docs/superpowers/findings/2026-07-27-next-event-timing.md` (new section, text below)

**Interfaces:**
- Consumes: `loadDataset`, `HOUR`, `makeRng` from `./lib/dataset.mjs`; `quantileOf` from `./lib/backtest.mjs`.
- Produces (for Task 6's defend page): printed figures — lull n/mean/CV/skew, KS distances (exponential / gamma method-of-moments / shifted-uniform), fitted `k` and `theta`, comb-test table, per-faction vs pooled CV table, anchor correlation, CV-by-wave-index table. Expected ballparks: CV ≈ 0.45–0.50, gamma k ≈ 3.5–5.5 with KS ≈ 0.05–0.10, exponential KS ≈ 0.3, per-faction CV ≈ 0.75–0.80 vs pooled ≈ 0.45.

- [ ] **Step 1: Write the script**

```js
/**
 * 13-scheduler-shape.mjs — reverse-engineering the wave scheduler's SHAPE.
 *
 * Asks "which game-dev design produces the observed lull distribution?" and
 * discriminates six candidate implementations by their statistical
 * fingerprints:
 *   H1 memoryless dice (per-tick p)        -> exponential lulls, CV = 1
 *   H2 cooldown + uniform roll             -> flat-topped window
 *   H3 coarse scheduler tick               -> comb in lull mod tick
 *   H4 k-stage accumulator                 -> gamma shape, CV = 1/sqrt(k)
 *   H5 per-faction independent timers      -> per-faction cleaner than pooled
 *   H6 fixed per-season schedule table     -> regularity varies by wave index
 *
 * Every statistic here is descriptive-forensic, not a hypothesis test with
 * a placebo — the discriminations rest on large, qualitative gaps (KS 0.07
 * vs 0.31; CV 0.78 vs 0.45), not on p-values. The one caveat is printed
 * with the comb test: only tick sizes well below the distribution's spread
 * are testable that way.
 *
 * Run: node --env-file=.env.development scripts/analysis/13-scheduler-shape.mjs
 */

import assert from 'node:assert/strict';
import { loadDataset, HOUR } from './lib/dataset.mjs';
import { quantileOf } from './lib/backtest.mjs';

// --- pure math helpers -------------------------------------------------------

/**
 * Natural log of the gamma function (Lanczos approximation, g=7).
 *
 * @param {number} x positive real
 * @returns {number}
 */
export function lnGamma(x) {
    const g = [
        676.5203681218851, -1259.1392167224028, 771.32342877765313,
        -176.61502916214059, 12.507343278686905, -0.13857109526572012,
        9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
    x -= 1;
    let a = 0.99999999999980993;
    const t = x + 7.5;
    for (let i = 0; i < 8; i++) a += g[i] / (x + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

/**
 * Regularized lower incomplete gamma P(k, x/theta) — the gamma CDF.
 * Series expansion; adequate for the k/x ranges used here.
 *
 * @param {number} x value (hours)
 * @param {number} k shape
 * @param {number} theta scale (hours)
 * @returns {number} in [0, 1]
 */
export function gammaCdf(x, k, theta) {
    const z = x / theta;
    if (z <= 0) return 0;
    let sum = 1 / k;
    let term = sum;
    for (let n = 1; n < 500; n++) {
        term *= z / (k + n);
        sum += term;
        if (term < 1e-14) break;
    }
    return Math.min(1, sum * Math.exp(-z + k * Math.log(z) - lnGamma(k)));
}

/**
 * Kolmogorov-Smirnov distance between a sorted sample and a CDF.
 *
 * @param {number[]} sortedSample ascending
 * @param {(x: number) => number} cdf
 * @returns {number}
 */
export function ksDistance(sortedSample, cdf) {
    let d = 0;
    const n = sortedSample.length;
    for (let i = 0; i < n; i++) {
        const c = cdf(sortedSample[i]);
        d = Math.max(d, Math.abs((i + 1) / n - c), Math.abs(i / n - c));
    }
    return d;
}

/**
 * Chi-squared of values folded modulo `mod` into `bins` equal bins, against
 * a uniform expectation. Used for both wall-clock and relative tick combs.
 *
 * @param {number[]} values seconds
 * @param {number} mod seconds
 * @param {number} bins
 * @returns {{chi2: number, maxShare: number}}
 */
export function combChi2(values, mod, bins) {
    const counts = new Array(bins).fill(0);
    for (const v of values) {
        counts[Math.floor((((v % mod) + mod) % mod) / (mod / bins))]++;
    }
    const n = values.length;
    const exp = n / bins;
    const chi2 = counts.reduce((a, c) => a + (c - exp) ** 2 / exp, 0);
    return { chi2, maxShare: Math.max(...counts) / n };
}

// --- self-checks (no DB) -----------------------------------------------------

{
    // lnGamma against known values: Γ(5) = 24, Γ(0.5) = sqrt(pi).
    assert(Math.abs(lnGamma(5) - Math.log(24)) < 1e-9, 'lnGamma(5)');
    assert(Math.abs(lnGamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9, 'lnGamma(0.5)');
    // gammaCdf: k=1 is exponential — CDF(theta) = 1 - 1/e.
    assert(
        Math.abs(gammaCdf(10, 1, 10) - (1 - Math.exp(-1))) < 1e-6,
        'gammaCdf k=1 must reduce to exponential',
    );
    // Median of gamma(k=1, theta=1) is ln 2.
    assert(Math.abs(gammaCdf(Math.LN2, 1, 1) - 0.5) < 1e-6, 'gammaCdf median');
    // ksDistance: a sample drawn AT the CDF's own quantiles scores near 1/(2n)... use
    // an exact fixture: sample [1,2,3] vs CDF(x)=x/4 -> max deviation at x=3: |1 - 0.75|.
    assert(
        Math.abs(ksDistance([1, 2, 3], (x) => x / 4) - 0.25) < 1e-12,
        'ksDistance fixture',
    );
    // combChi2 detects a planted tick: multiples of 3600 fold into one bin.
    const ticked = Array.from({ length: 120 }, (_, i) => (i + 1) * 3600);
    const flat = Array.from({ length: 120 }, (_, i) => i * 997 + 13);
    assert(
        combChi2(ticked, 3600, 12).chi2 > combChi2(flat, 3600, 12).chi2 * 10,
        'combChi2 must detect a planted tick',
    );
}

console.log('=== 13-scheduler-shape: pure self-checks OK ===');

// --- data --------------------------------------------------------------------

const ds = await loadDataset();
const allDefends = ds.events.filter((e) => e.type === 'defend');
const bySeason = new Map();
for (const e of allDefends) {
    if (!bySeason.has(e.season)) bySeason.set(e.season, []);
    bySeason.get(e.season).push(e);
}

const lulls = [];
for (const [season, list] of bySeason) {
    const idx = [];
    for (let i = 0; i < list.length; i++) if (list[i].isTrainStart) idx.push(i);
    for (let k = 1; k < idx.length; k++) {
        lulls.push({
            season,
            h: (list[idx[k]].start_time - list[idx[k] - 1].end_time) / HOUR,
            sec: list[idx[k]].start_time - list[idx[k] - 1].end_time,
            waveIndex: k,
            prevTrainDurationH:
                (list[idx[k] - 1].end_time - list[idx[k - 1]].start_time) / HOUR,
        });
    }
}
assert(lulls.length > 1500, `expected ~1800 lulls, got ${lulls.length}`);

const H = lulls.map((r) => r.h);
const mean = H.reduce((a, b) => a + b, 0) / H.length;
const sd = Math.sqrt(H.reduce((a, b) => a + (b - mean) ** 2, 0) / H.length);
const cv = sd / mean;
const skew = H.reduce((a, b) => a + ((b - mean) / sd) ** 3, 0) / H.length;
console.log(
    `\nlulls n=${H.length}  mean=${mean.toFixed(1)}h  sd=${sd.toFixed(1)}h  CV=${cv.toFixed(3)}  skew=${skew.toFixed(2)}`,
);
assert(cv < 0.9, 'CV should already rule out a memoryless process');

// --- H1/H2/H4: shape fits ----------------------------------------------------

const sorted = [...H].sort((a, b) => a - b);
const ksExp = ksDistance(sorted, (x) => 1 - Math.exp(-x / mean));
const kHat = 1 / (cv * cv);
const thetaHat = mean * cv * cv;
const ksGam = ksDistance(sorted, (x) => gammaCdf(x, kHat, thetaHat));
const a5 = quantileOf(H, 0.05);
const b95 = quantileOf(H, 0.95);
const ksUni = ksDistance(sorted, (x) =>
    Math.max(0, Math.min(1, (x - a5) / (b95 - a5))),
);
console.log('\nshape fits (KS distance, smaller = better):');
console.log(`  H1 exponential (memoryless):        ${ksExp.toFixed(3)}`);
console.log(
    `  H4 gamma (k=${kHat.toFixed(1)}, theta=${thetaHat.toFixed(1)}h):  ${ksGam.toFixed(3)}`,
);
console.log(`  H2 uniform [p05, p95]:              ${ksUni.toFixed(3)}`);
assert(ksGam < ksExp / 2, 'gamma must beat exponential decisively');

// --- H3/H6: tick combs -------------------------------------------------------

const starts = allDefends.filter((e) => e.isTrainStart);
const startTimes = starts.map((e) => e.start_time);
const nonZeroSeconds = startTimes.filter((t) => t % 60 !== 0).length;
console.log(
    `\ntimestamp entropy: ${nonZeroSeconds}/${startTimes.length} train starts have non-zero seconds`,
);
console.log('wall-clock combs (train-start times; chi2 ~ df means no comb):');
for (const [label, mod, bins] of [
    ['mod 15 min', 900, 15],
    ['mod 1 h', 3600, 12],
]) {
    const { chi2, maxShare } = combChi2(startTimes, mod, bins);
    console.log(
        `  ${label}: chi2=${chi2.toFixed(1)} (df=${bins - 1})  max bin ${(maxShare * 100).toFixed(1)}% vs uniform ${(100 / bins).toFixed(1)}%`,
    );
}
console.log(
    'relative tick combs (lull mod tick; only ticks well below the ~19h IQR are testable):',
);
const lullSecs = lulls.map((r) => r.sec);
for (const tickH of [0.5, 1, 2, 3, 6]) {
    const { chi2, maxShare } = combChi2(lullSecs, tickH * 3600, 12);
    console.log(
        `  mod ${tickH}h: chi2=${chi2.toFixed(1)} (df=11)  max bin ${(maxShare * 100).toFixed(1)}%`,
    );
}

// --- H5: per-faction vs pooled ----------------------------------------------

console.log('\nper-faction same-faction cycle vs pooled (start-to-start):');
/**
 * @param {(e: object) => boolean} filter
 * @returns {{n: number, p50: number, cv: number}}
 */
function cycleStats(filter) {
    const gaps = [];
    for (const [, list] of bySeason) {
        const mine = list.filter((e) => e.isTrainStart && filter(e));
        for (let i = 1; i < mine.length; i++) {
            gaps.push((mine[i].start_time - mine[i - 1].start_time) / HOUR);
        }
    }
    const m = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const s = Math.sqrt(gaps.reduce((a, b) => a + (b - m) ** 2, 0) / gaps.length);
    return { n: gaps.length, p50: quantileOf(gaps, 0.5), cv: s / m };
}
const pooledStats = cycleStats(() => true);
for (const en of [0, 1, 2]) {
    const s = cycleStats((e) => e.enemy === en);
    console.log(
        `  enemy ${en}: n=${s.n}  p50=${s.p50.toFixed(1)}h  CV=${s.cv.toFixed(3)}`,
    );
    assert(
        s.cv > pooledStats.cv,
        'per-faction cycles must be noisier than pooled for the global-clock verdict',
    );
}
console.log(
    `  POOLED : n=${pooledStats.n}  p50=${pooledStats.p50.toFixed(1)}h  CV=${pooledStats.cv.toFixed(3)}`,
);
console.log(
    '  VERDICT: pooled is cleaner than every per-faction series — one GLOBAL clock, faction drawn at spawn (kills H5).',
);

// --- H6: stationarity by wave index ------------------------------------------

console.log('\nlull spread by wave index (a schedule table would show structure):');
for (const [lo, hi] of [
    [1, 3],
    [4, 7],
    [8, 12],
    [13, 99],
]) {
    const sub = lulls
        .filter((r) => r.waveIndex >= lo && r.waveIndex <= hi)
        .map((r) => r.h);
    if (sub.length < 50) continue;
    const m = sub.reduce((a, b) => a + b, 0) / sub.length;
    const s = Math.sqrt(sub.reduce((a, b) => a + (b - m) ** 2, 0) / sub.length);
    console.log(
        `  wave ${String(lo).padStart(2)}-${hi}: n=${sub.length}  p50=${quantileOf(sub, 0.5).toFixed(1)}h  CV=${(s / m).toFixed(3)}`,
    );
}

// --- anchor check ------------------------------------------------------------

{
    const xs = lulls.map((r) => r.prevTrainDurationH);
    const ys = lulls.map((r) => r.h);
    const n = xs.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let c = 0;
    let vx = 0;
    let vy = 0;
    for (let i = 0; i < n; i++) {
        const dx = xs[i] - mx;
        const dy = ys[i] - my;
        c += dx * dy;
        vx += dx * dx;
        vy += dy * dy;
    }
    const r = c / Math.sqrt(vx * vy);
    console.log(
        `\nr(previous train DURATION, following lull) = ${r.toFixed(3)} — near zero means the scheduler anchors on the train's END`,
    );
}

console.log(
    '\nRECONSTRUCTED DESIGN: one global end-anchored timer, delay ~ gamma(k≈' +
        kHat.toFixed(1) +
        ', θ≈' +
        thetaHat.toFixed(1) +
        'h); faction drawn at spawn; no ticks, no schedule table.',
);
```

- [ ] **Step 2: Run it**

Run: `mise exec -- node --env-file=.env.development scripts/analysis/13-scheduler-shape.mjs`
Expected: self-checks OK; CV ≈ 0.45–0.50; gamma KS ≈ 0.05–0.10 vs exponential ≈ 0.3; per-faction CVs ≈ 0.75–0.80 all above pooled ≈ 0.45; asserts all pass. **Record the printed values verbatim in your report — Task 6 transcribes them into the page.**

- [ ] **Step 3: README + findings**

`scripts/README.md`, after the `11-emit-attack-model.mjs` bullet (verify the actual last bullet name first and append after it):

```markdown
- `13-scheduler-shape.mjs` -- distribution forensics on the train-start lull:
  discriminates six candidate scheduler implementations by shape (KS vs
  exponential/gamma/uniform), tick combs, per-faction-vs-pooled CV, and
  wave-index stationarity. Verdict: one global end-anchored timer with a
  gamma(k~4-5) delay; faction drawn at spawn. Forensic-descriptive -- the
  discriminations rest on order-of-magnitude gaps, not p-values.
```

And its run line in the `### Running` block. In `docs/superpowers/findings/2026-07-27-next-event-timing.md`, append before `## Recommendation`:

```markdown
## Scheduler shape (2026-07-31)

**Script:** `13-scheduler-shape.mjs`. Reverse-engineering framing: which
game-dev implementation produces the observed lulls? Fingerprints measured
on the full history (transcribe the script's printed values here — n, CV,
the three KS distances, fitted k/theta, per-faction vs pooled CV):

- Memoryless per-tick spawning: dead (KS vs exponential ~0.31; CV ~0.48
  against the memoryless CV of 1).
- Cooldown + uniform roll: dead (KS ~0.24).
- Coarse scheduler tick: dead (train-start timestamps carry full
  second-level entropy; no comb at 15min/1h wall-clock or 0.5-6h relative).
- k-stage accumulator / gamma delay: fits (KS ~0.07 at k~4.4).
- Per-faction independent timers: dead — per-faction cycles are NOISIER
  (CV ~0.78) than the pooled series (CV ~0.45); superposition signature of
  ONE global clock with the faction drawn at spawn.
- Fixed schedule table: dead (lull CV flat across wave index).
- End-anchored: r(prev train duration, lull) ~ 0.

Reconstructed: `onTrainEnd(WIN): nextWaveAt = now + Gamma(k≈4.4, θ≈9h)`,
faction chosen at spawn (see § Faction choice), with the assault-window
pause and counterattack override layered on top.
```

(Replace the `~` ballparks with the actual printed values.)

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/13-scheduler-shape.mjs scripts/README.md docs/superpowers/findings/2026-07-27-next-event-timing.md
git commit -m "analysis(scheduler): distribution forensics — global gamma-delay clock

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `scripts/analysis/12-faction-choice.mjs` — which faction gets hit

**Files:**
- Create: `scripts/analysis/12-faction-choice.mjs`
- Modify: `scripts/README.md`, `docs/superpowers/findings/2026-07-27-next-event-timing.md`

**Interfaces:**
- Consumes: `loadDataset`, `makeRng`, `SECTOR_COUNT` from `./lib/dataset.mjs`; `quantileOf` from `./lib/backtest.mjs`.
- Produces (for Task 6): the counterattack-rule count (expect "all fail-resolved assaults followed by a wave on that faction" — ~179/179 scale, exact printed count governs), succeeded-assault exclusion (~0/27), SC9-faction targeting rate (~0.58) with a within-season permutation p, residual-rule accuracies (~0.30–0.45), transition matrix.

- [ ] **Step 1: Write the script**

Structure it exactly like `06-train-covariates.mjs` (header comment stating the question, pure helpers, self-checks, DB part, printed verdicts). Contents:

1. Build one record per lull (same walk as Task 1): `{ season, next: cur.enemy, prevStart.enemy, t0 }` plus, at `t0`: per-faction `sectorsCaptured` (formula `Math.trunc(st.points / (max / SECTOR_COUNT))` guarded by `points_max > 0`, via `ds.statusAt`/`ds.seasons`), per-faction `status`, the active attack (if any) with its `enemy` and final `status`, and `hoursSinceOwnLastDefend` per faction.
2. **Counterattack rule:** among lulls with an attack active at `t0` whose final status is `fail`, count how often `next === attackedFaction`. Print the exact fraction. `assert(rate > 0.95)` — if this fires, STOP and report (the rule was 100% on 2026-07-30 data).
3. **Succeeded assaults:** same conditioning with final status `success` — print `next === attackedFaction` count (expected 0; definitional — the faction is defeated).
4. **SC9 targeting:** among lulls with NO active attack and exactly one faction at `sc === 9`, rate of `next === sc9Faction`. Add a **within-season permutation placebo** (the `withinStratumPermutation` pattern from `06-train-covariates.mjs`, copied verbatim per the scripts-duplicate-helpers convention, seeded `makeRng`): permute the `next===sc9` outcomes within season, statistic = pooled rate, 2000 draws, report p and the degenerate-control spread guard.
5. **Residual rules** (no attack, no SC9): accuracy of predicting `next` by (a) majority class, (b) same-as-previous, (c) own-last-defend-longest-ago among active, (d) highest own liberation among active, (e) majority among active-status factions. Print each with n.
6. **Transition matrix** P(next | prev) and base rates.
7. Self-checks (pure, no DB): the permutation machinery on a planted/null fixture (copy the fixture pattern from 06, different seeds); a synthetic counterattack world (attack-fail lull records where next always equals attacked faction → rate 1.0; shuffled → ~1/3).

- [ ] **Step 2: Run it**

Run: `mise exec -- node --env-file=.env.development scripts/analysis/12-faction-choice.mjs`
Expected: counterattack rate ≈ 1.000 on fail-resolved assaults (n ≈ 180); success-resolved ≈ 0/27; SC9 targeting ≈ 0.58 with p=0.0005; residual rules ≈ chance except majority-among-active ≈ 0.45. **Record printed values verbatim.**

- [ ] **Step 3: README bullet + findings section**

README (after the Task 1 bullet):

```markdown
- `12-faction-choice.mjs` -- which faction the next wave hits. The
  counterattack rule (a FAILED homeworld assault is always followed by a
  wave on that faction -- print the exact count), succeeded-assault
  exclusion, SC9-window targeting (~58%, within-season permutation
  placebo), and the honest remainder: near-random among active factions;
  per-faction recency/liberation/sector rules all at chance.
```

Findings doc, append a `## Faction choice (2026-07-31)` section before `## Scheduler shape` mirroring the README claims with the script's printed numbers and the explicit note that the counterattack rule is a sequencing MECHANIC (same epistemic class as train continuation), while SC9 targeting is statistical.

- [ ] **Step 4: Commit**

```bash
git add scripts/analysis/12-faction-choice.mjs scripts/README.md docs/superpowers/findings/2026-07-27-next-event-timing.md
git commit -m "analysis(faction): counterattack rule + SC9 targeting, placebo-treated

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `liveStats.mjs` — hourly DB-backed figures (TDD)

**Files:**
- Create: `src/app/docs/predict/defend/liveStats.mjs`
- Test: `src/__tests__/unit/app/docs/predict/defend/liveStats.test.mjs`

**Interfaces:**
- Consumes: `db` from `@/db/db` (thin wrapper only); `deriveTrainStarts`, `waveForecast` from `@/features/dashboard/waveForecast.mjs`; `EVENT_TYPE` from `@/shared/enums/events.mjs`.
- Produces (Tasks 4/5/6 rely on these exact names):
  - `computeDefendStats(defendRows, currentSeasonEvents, currentStatusRows, nowSeconds)` — PURE. Returns `{ counts: { defends, trainStarts, seasons }, lull: { n, p25, p50, p75, meanH, cv, fittedK, fittedTheta }, histogram: { binWidthH: 2, maxH: 120, bins: number[] }, now: { forecast, lastTrainStart } }` where `forecast` is the `waveForecast` return value (window or hidden).
  - `getDefendLiveStats()` — async wrapper: queries `h1_event` (all seasons, `type = 'defend'`, fields `season, enemy, start_time, end_time, status`), the latest season's full events + per-faction latest status rows (same `DISTINCT ON` shape as `getCampaign` — copy that raw query), calls the pure core with `Math.floor(Date.now() / 1000)`.
  - `getEventCounts()` — async: `{ defends, attacks, seasons }` via three cheap `db.h1_event.count`/`groupBy` calls (hub page).

- [ ] **Step 1: Write the failing tests**

Test the PURE core only (no db mocks). Fixture: two seasons of synthetic defends with known train structure — season 1: defends A(t=0–10h, fail), B(10.05h–20h chain, success), C(60h–70h, success) → lulls: B-end→C-start = 40h; season 2: one defend (no lull). Assert: `counts.trainStarts` = 3 (A, C, season-2's one), `counts.seasons` = 2, `lull.n` = 1, `lull.p50` = 40, `histogram.bins[20]` = 1 (40h in 2h bins) and `bins` sums to `lull.n`, `fittedK = 1/cv²` is finite when n>1 (add a second lull to make cv computable — extend fixture with season 3 providing a 20h lull; then meanH=30, and assert fittedK ≈ (30/10)² = 9 given sd=10), `now.forecast` mode matches a hand-built current-season fixture (reuse the window fixture from `waveForecast.test.mjs`), and chain-rule correctness is delegated (already covered) but cross-season isolation is asserted: a defend 5 minutes after another season's defend is still a train start.

- [ ] **Step 2: Run to verify failure** (`module not found`), **Step 3: implement** — the pure core groups defends per season, applies `deriveTrainStarts` per season group, computes lulls (end of previous train = the defend immediately before each train start in that season's time-ordered list, exactly as `04-train-baseline.mjs`'s `buildLullRecords` does), quantiles via a local sorted-interpolation helper (~8 lines; do NOT import from `scripts/`), histogram with clamp at `maxH`, `fittedK/theta` by method of moments, and `now` via `waveForecast({ events: currentSeasonEvents, status: currentStatusRows }, nowSeconds)`. **Step 4: tests pass. Step 5: typecheck + lint. Step 6: Commit** `feat(predict-split): liveStats pure core + db wrapper`.

---

### Task 4: GammaExplorer (TDD)

**Files:**
- Create: `src/app/docs/predict/defend/gammaMath.mjs` (pure: `lnGamma`, `gammaPdf`, `gammaCdf`, `ksAgainstHistogram(bins, binWidthH, k, theta)`)
- Create: `src/app/docs/predict/defend/GammaExplorer.jsx` (client)
- Create: `src/app/docs/predict/defend/GammaExplorerLoader.jsx` (copy the `DefendRegularityChartLoader.jsx` pattern verbatim, changed names)
- Test: `src/__tests__/unit/app/docs/predict/defend/gammaMath.test.mjs`, `src/__tests__/unit/app/docs/predict/defend/GammaExplorer.test.jsx`

**Interfaces:**
- Consumes: `useTrack` from `@/shared/hooks/useTrack.mjs`; Recharts (`BarChart`/`Bar`/`Line`/`ComposedChart`/`XAxis`/`YAxis`/`Tooltip`/`ResponsiveContainer` — mirror imports from `DefendRegularityChart.jsx`).
- Produces: `<GammaExplorer bins={number[]} binWidthH={number} n={number} meanH={number} fittedK={number} />` — Task 6 renders it via the Loader with props from `getDefendLiveStats()`.

- [ ] **Step 1: gammaMath failing tests** — `gammaPdf` integrates to ~1 over a fine grid (k=4.4, θ=9, trapezoid over 0–400h, tolerance 0.01); `gammaCdf(x, 1, θ)` equals `1 − e^(−x/θ)` (three x values); `ksAgainstHistogram` returns 0-ish for a histogram generated FROM the same gamma (build bins by differencing the CDF at bin edges, scale by n) and > 0.25 for that histogram vs an exponential CDF with the same mean; all functions finite for k ∈ [0.5, 50].
- [ ] **Step 2: fail run. Step 3: implement gammaMath** (Lanczos `lnGamma` and series `gammaCdf` — same code as Task 1's helpers; duplicated because app code must not import from `scripts/`; note that in a comment). `gammaPdf(x,k,theta) = exp((k−1)·ln x − x/θ − lnGamma(k) − k·ln θ)` with `x<=0 → 0`. `ksAgainstHistogram` compares the histogram's cumulative shares at each bin's right edge against `gammaCdf` there (accepts any `cdf`-shaped `(x)=>number` as 4th arg? NO — keep the signature `(bins, binWidthH, k, theta)` plus a sibling `ksAgainstHistogramCdf(bins, binWidthH, cdf)` used by both). **Step 4: pass.**
- [ ] **Step 5: GammaExplorer failing tests** — renders a slider (`role="slider"` via `<input type="range">`), default value = `fittedK` prop; shows the KS readout text (`/KS distance/i`); preset buttons "memoryless (k=1)", "best fit", "fixed timer (k=50)" present with `data-umami-event` ABSENT (they use `useTrack` — assert the buttons exist by accessible name and that clicking "memoryless (k=1)" moves the slider value to 1); chart renders (Recharts in jsdom: assert the container `.recharts-responsive-container` exists — mirror whatever `DefendRegularityChart`'s rendering does in existing usage; if Recharts needs a sized container in jsdom, assert on the wrapper element instead — check how existing chart components are (not) tested and keep assertions DOM-level, not SVG-level).
- [ ] **Step 6: implement** — `'use client'`; state `k` (default `fittedK`); `theta = meanH / k` recomputed each render; ComposedChart: bars = observed histogram shares, line = gamma bin probabilities (difference of `gammaCdf` at bin edges); KS readout via `ksAgainstHistogram`; copy line under the chart: `"If the scheduler were a coin flip every tick, the curve would look like k=1 — drag the slider and watch it miss."`; `useTrack` fires `docs-gamma-explore` on first slider interaction only (a `useRef` boolean guard). Colors: bars `var(--color-surface-4)`, gamma line `var(--color-primary)`; axis/text `var(--color-text-muted)`; no new CSS files (inline Recharts props, matching `DefendRegularityChart.jsx`'s conventions — read it first).
- [ ] **Step 7: pass, lint, typecheck. Step 8: Commit** `feat(predict-split): GammaExplorer interactive gamma-k fit`.

---

### Task 5: Attack page + hub + sidebar + ⓘ retarget

**Files:**
- Create: `src/app/docs/predict/attack/page.mdx`
- Modify: `src/app/docs/predict/page.mdx` (becomes the hub)
- Modify: `src/app/docs/components/DocsSidebar.jsx` (~line 52 — read the item shape first; add child/sibling entries for Defend + Attack with `track: 'docs-predict-defend'` / `'docs-predict-attack'`, following whatever nesting convention the sidebar's data structure supports)
- Modify: `src/features/dashboard/NextWaveCard.jsx` (ⓘ `href` → `/docs/predict/defend`)
- Modify: `src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx` (link href assertion)

**Interfaces:**
- Consumes: `getEventCounts()` from `@/app/docs/predict/defend/liveStats.mjs` (Task 3).
- Produces: `/docs/predict/attack` carrying ALL current attack content; the hub linking to both subpages.

- [ ] **Step 1: Create the attack page.** `export const metadata` with title `'Predicting Attacks | Helldivers Bot'`, canonical `/docs/predict/attack`. Structure: a new `# Can we predict attacks?` heading, then a new **TLDR** section (verbatim below), then MOVE — byte-verbatim — the entire current `## Attacks` block of `page.mdx`: every line from the heading `## Attacks` through the end of its `<details>` block (the line `</details>` immediately before the `---` that precedes `## Defends`). Demote the moved `## Attacks` heading to prose (drop the heading itself; keep everything after it). The TLDR (new, verbatim):

```markdown
**TLDR — how we predict attacks:** an attack fires the moment a faction's
campaign hits full points — `points == points_max`, exactly, within minutes
(an earlier version of this report thought it was a fuzzy "90–98% band";
that was our own daily-resolution sensor smearing a hard rule, and the
correction is documented below). So the forecast is just arithmetic:
`eta = (points_max − points) / rate`, with a day-of-week correction to the
pace. Backtested walk-forward it clears every leg of the project's
pre-registered gate — skill 0.23–0.33 against a 0.6 bar — and ships on the
dashboard as an assault heads-up line. It never becomes a clock: the window
is ~21h wide a day out, ~5h wide two hours out. [How the defend side
compares →](/docs/predict/defend)
```

- [ ] **Step 2: Rewrite the hub** (`page.mdx`) — full replacement content (verbatim, except the two `{...}` live numbers rendered via a tiny inline async component `Counts` defined in the MDX file itself importing `getEventCounts`):

```mdx
export const metadata = {
    title: 'Can We Predict Events? | Helldivers Bot',
    description:
        'Can Helldivers 1 events be predicted? Attacks: yes — deterministic trigger, forecast ships. Defends: partially — a calibrated likelihood window ships, a countdown does not.',
    alternates: { canonical: '/docs/predict' },
    openGraph: { url: '/docs/predict' },
};
export const revalidate = 3600;

# Can we predict events?

A two-part report on Helldivers 1 event predictability, built from every
recorded event across the game's ~160-season history and refreshed hourly
from the live database. Short answer: **attacks yes, defends partially —
and the difference is the whole story.**

## ⚔️ Attacks — solved

Attacks are **deterministic**: one fires within minutes of a faction's
campaign reaching full points. Forecasting one is arithmetic plus a pace
estimate, it clears the project's pre-registered accuracy gate
(skill 0.23–0.33 vs a 0.6 bar), and it ships on the dashboard as the
assault heads-up line.

**[Read how the attack forecast works →](/docs/predict/attack)**

## 🛡️ Defends — partially, honestly

Defend waves ride one global, hidden timer. Three modeling attempts, a
placebo-tested covariate sweep, and a reverse-engineering of the
scheduler's shape got typical error down to ~8h on a ~44h cycle — enough
to ship the calibrated **likelihood window** on the dashboard, not enough
to ship a countdown (the pre-registered bar was missed and respected).

**[Read the full defend story — how we got the closest →](/docs/predict/defend)**

---

Both pages mix two kinds of numbers, visually distinguished: live
distribution figures pulled hourly from the database, and static backtest
verdicts each reproducible from a committed script in
[`scripts/analysis/`](https://github.com/elfensky/helldivers.bot/tree/main/scripts/README.md).
```

Add `data-umami-event="docs-predict-attack"` / `"docs-predict-defend"` to the two links (MDX: use `<a>` with the attribute or keep markdown links and add a rehype-free inline `<a>` — use plain `<a href="..." data-umami-event="...">` elements). Render live counts in the intro sentence via the `Counts` component if trivially achievable; otherwise keep the intro count-free (the defend page carries the live counts) — do not fight MDX for it.

- [ ] **Step 3: Sidebar + ⓘ.** Read `DocsSidebar.jsx`'s item structure; add Defend/Attack entries under or beside the predict entry per its existing convention (other items may already nest — mirror them). Update `NextWaveCard.jsx` ⓘ `href` to `/docs/predict/defend` and its test's `toHaveAttribute('href', '/docs/predict/defend')`.
- [ ] **Step 4:** `mise exec -- npx vitest run src/__tests__/unit/features/dashboard/NextWaveCard.test.jsx` passes; lint. **Step 5: Commit** `feat(predict-split): attack subpage, hub, sidebar, card link`.

---

### Task 6: Defend page

**Files:**
- Create: `src/app/docs/predict/defend/page.mdx`
- Move: `DefendRegularityChart.jsx`, `DefendRegularityChartLoader.jsx`, `LullByTrainLengthChart.jsx`, `LullByTrainLengthChartLoader.jsx` from `src/app/docs/predict/` to `src/app/docs/predict/defend/` (git mv; fix relative imports inside the loaders)

**Interfaces:**
- Consumes: `getDefendLiveStats()` (Task 3), `GammaExplorerLoader` (Task 4), the moved chart loaders, figures from Tasks 1–2 reports, and MOVED content blocks from the current `page.mdx` (anchors below).

- [ ] **Step 1: Assemble the page.** `export const metadata` (title `'Predicting Defend Waves | Helldivers Bot'`, canonical `/docs/predict/defend`), `export const revalidate = 3600`. Define one inline async component `LiveStats` at the top of the MDX that awaits `getDefendLiveStats()` once and renders the TLDR chip + passes histogram props to `GammaExplorerLoader` (structure: fetch once in the page component — MDX pages can hoist `const stats = await getDefendLiveStats()` at module level? NO — do it inside an async component; simplest correct: make TWO small server components in `defend/` — `LiveNowChip.jsx` and `GammaExplorerSection.jsx`, each async, each calling `getDefendLiveStats()` (module-scope `cache()` from React in `liveStats.mjs` dedupes the query within a render) — and import both into the MDX. Wrap `getDefendLiveStats` in `React.cache` in Task 3's implementation — add that to `liveStats.mjs` now if Task 3 didn't).

Content order (M = byte-verbatim move from current `page.mdx`, N = new prose written here):

1. **N — TLDR "How we predict it":** five numbered lines: (1) watch three observable things — is an assault running, is any faction one sector from triggering one (`maxSC == 9`), and how long since the last wave; (2) look up every moment in ~160 wars that looked the same and read off how long the wait turned out to be (Kaplan-Meier over the state × elapsed table the dashboard card ships with); (3) show the 50% band and the within-24h/48h probabilities — "likely in 14–32h · 63% within 24h"; (4) it's calibrated: verified walk-forward, the band contains the true wave at the advertised rates within ±0.05 at every quartile; (5) it is deliberately NOT a countdown — typical miss is ±8h on a ~44h cycle, and the pre-registered countdown bar (skill CI ≤ 0.6) was missed and respected. Then `<LiveNowChip />` — "Right now: state NORMAL · 22h since the last wave · likely in 12–31h · 61% within 24h · live, refreshes hourly" (render from `now.forecast`; when `forecast.mode === 'hidden'` render "Right now: a wave is in progress — the window returns when it resolves").
2. **N — "The rules of the game" intro line** + **M:** the five-rules list and the mermaid diagram — everything from `## Defends`'s first paragraph ("A \"defend\" is an enemy assault…") through the paragraph ending "…between one train ending and the next one starting." (current lines ~192–219). Then **N:** a sixth rule paragraph — the counterattack rule, written from Task 2's printed numbers: a FAILED homeworld assault is always followed by a wave on that faction (exact count from the script), a succeeded one never is, and the SC9-window faction is the likely-but-not-certain target (~58%, placebo-tested) — with the "reproduce: `12-faction-choice.mjs`" footer.
3. **N — "Attempt 1: we measured the wrong thing"** (~2 paragraphs): the original target pooled all 4,928 defend-to-defend gaps; 61% are ~2.5h mechanical chain restarts dictated by rule 5, so the first models were unknowingly predicting the chain mechanic. `<DefendRegularityChart />` + **M:** its caption paragraph ("The pooled defend-gap series…") and the regularity + lull tables from the current in-depth block (`### Regularity: pooled gaps vs. train-start gaps` section, verbatim, including both tables and surrounding prose).
4. **N — "Attempt 2: the honest baseline"** (~2 paragraphs): corrected target, residual-life predictor, the numbers — **M:** `### Prediction accuracy` section verbatim (skill-ratio explainer sentence, both tables, the calibration table, and the "So the model is well-calibrated…" paragraph). Then `<LullByTrainLengthChart />` + **M:** `### Does the previous train's length predict the wait?` section verbatim.
5. **N — "Attempt 3: teaching it to read the map"** (~1 paragraph framing the placebo discipline: four false positives, the Seattle/Cairo lesson) + **M:** the `### Why so many "we found it!" results didn't survive` section verbatim, then **M:** the `#### Second covariate sweep` section verbatim (intro + table + the two supporting-facts paragraph), then **M:** the `### Attempt 3: conditioning on live campaign state (2026-07-28)` section verbatim (both tables + the re-baselining note + both closing paragraphs), then **N:** one paragraph — why a calibrated band shipped anyway (two of three legs pass; a band labeled as a band never overclaims; link to the dashboard card).
6. **N — "Reverse-engineering the scheduler"**: the hypothesis table (six designs × fingerprint × verdict, from Task 1's findings section), ~2 paragraphs of game-dev framing, ending with the reconstructed pseudocode block (`onTrainEnd(WIN): nextWaveAt = now + Gamma(k≈…, θ≈…h)` — values from Task 1's run). Then `<GammaExplorerSection />` with an intro sentence: "This is the real lull histogram from the live database — drag k and watch the memoryless hypothesis miss." Footer: "reproduce: `13-scheduler-shape.mjs` · histogram live, refreshes hourly".
7. **N — "Which faction gets hit"**: transition-matrix summary sentence, the counterattack/SC9/random-remainder story with Task 2's numbers, and the one-global-clock explanation (per-faction CVs from Task 1). Footer: reproduce 12 + 13.
8. **N — "What ships"**: card anatomy (state → window → badges), honesty rules, link to `/docs/predict/attack` ("the solved half").
9. **M — the remaining in-depth material** under one `<details>`: `### Event counts` (replace the static table's counts with a sentence noting the live counts above), `#### Trigger hunt` table + note, the `#### Covariate sweep — previously untested variables` table, `### Method & caveats` (verbatim), the reproduce block (add lines for 12 and 13), the findings-doc + README links, `### Cross-references`.

**Anchor discipline:** every M block is located by its exact current heading text; move byte-verbatim; after Task 5+6 the old `page.mdx` contains ONLY the hub content — nothing may be silently dropped: diff the union of (hub + attack page + defend page) against the pre-split page and account for every removed line in the task report (allowed removals: the old top-of-page intro/bottom-line block replaced by hub prose, the old `## Defends` heading itself, the event-counts static table).

- [ ] **Step 2: Build the two small server components** (`LiveNowChip.jsx`, `GammaExplorerSection.jsx`) — async, `import { getDefendLiveStats } from './liveStats.mjs'`, chip markup with house tokens (`font-mono text-small text-text-muted`, a `text-primary` window figure, and the literal affordance text `live · refreshes hourly`), the section component rendering `<GammaExplorerLoader bins={…} binWidthH={…} n={…} meanH={…} fittedK={…} />`.
- [ ] **Step 3:** `mise exec -- npx vitest run src/__tests__/unit/` — the mirror-tree test must pass with the moved chart files (their tests don't exist; the moved LOADERS' relative imports must resolve — run `mise exec -- npm run typecheck` too). **Step 4:** lint. **Step 5: Commit** `feat(predict-split): defend explainer page`.

---

### Task 7: CHANGELOG + full verification + DevTools pass

**Files:**
- Modify: `CHANGELOG.md` (new `## Unreleased` → `### Added`/`### Changed` entries: the split, the two subpages, the GammaExplorer, the two analysis scripts, the ⓘ retarget)
- No other source changes expected; fix-forward anything the chain surfaces.

- [ ] **Step 1:** File the GitHub issue (`gh issue create --title "Split /docs/predict into defend + attack subpages" --label enhancement --label frontend --body "Spec: docs/superpowers/specs/2026-07-31-predict-split-design.md; plan: docs/superpowers/plans/2026-07-31-predict-split.md"`) — record the number for merge-time close.
- [ ] **Step 2:** Full chain: lint:fix → lint (0 errors) → typecheck → test:unit → build (env sourced). Report verbatim.
- [ ] **Step 3:** DevTools pass against a worktree dev server (`mise exec -- npx next dev -p 3001`; the main checkout's :3000 belongs to the user): all three routes render; hub links navigate; defend page — LiveNowChip shows a plausible current state, GammaExplorer slider drags and the KS readout changes, preset buttons jump k, no horizontal overflow at 390px width (`resize_page`), dark theme legible; attack page renders its tables and `<details>` blocks. Screenshot each page into the SDD workspace.
- [ ] **Step 4:** CHANGELOG entry; commit `docs(predict-split): changelog`; final report.

---

### Merge (not a plan task)

`superpowers:finishing-a-development-branch`: merge `--no-ff` into `develop`, CHANGELOG `## Unreleased` → `## 0.76.0` + `package.json`/lockfile bump in the merge commit (minor — new pages/feature), push, remove worktree, delete branch, close the Task 7 issue. No Prisma migrations in this branch.
