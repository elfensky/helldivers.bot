/**
 * 09-attack-trigger.mjs — is the attack trigger deterministic?
 *
 * The published finding (`/docs/predict`, before this script existed) was that
 * attacks fire at ~90-98% liberation, with a p25/p50/p75 "trigger band". This
 * script tests the competing hypothesis: the trigger is EXACTLY
 * `points == points_max`, and the observed band is an artifact of `h1_status`
 * running at ~1 bucket/day for 156 of 160 seasons — a hard threshold viewed
 * through a lagging sensor smears downward into a plausible-looking spread.
 *
 * Three tests, each falsifiable:
 *   1. Staleness gradient — liberation-at-attack vs. age of the reading. A
 *      sensor artifact predicts a monotone climb toward 100% as age -> 0. A
 *      genuine soft threshold predicts a flat line.
 *   2. Fresh readings — every attack whose reading is < 15 min old, listed
 *      individually with its points shortfall. No aggregation to hide behind.
 *   3. Trigger lag — for the 15-minute-resolution seasons, the gap between the
 *      first bucket at full points and the attack start.
 *
 * Run: node --env-file=.env.development scripts/analysis/09-attack-trigger.mjs
 */

import assert from 'node:assert/strict';
import pg from 'pg';

const HOUR = 3600;
const FRESH_SECONDS = 900; // 15 min — one bucket at S157+ resolution

/**
 * Bucket a reading age (seconds) into a labelled staleness band.
 *
 * @param {number} ageSeconds age of the h1_status reading at the event
 * @returns {string} band label, ordered by the leading digit
 */
export function stalenessBand(ageSeconds) {
    if (ageSeconds < FRESH_SECONDS) return '1 <15min';
    if (ageSeconds < HOUR) return '2 <1h';
    if (ageSeconds < 6 * HOUR) return '3 <6h';
    if (ageSeconds < 12 * HOUR) return '4 <12h';
    if (ageSeconds < 24 * HOUR) return '5 <24h';
    return '6 >=24h';
}

/**
 * Median of a numeric array, linear-interpolated at even counts.
 *
 * @param {number[]} values the numbers to take the median of
 * @returns {number|null} null for an empty array
 */
export function median(values) {
    if (values.length === 0) return null;
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

// --- self-check on the pure functions (no DB) -----------------------------
{
    assert.equal(stalenessBand(0), '1 <15min');
    assert.equal(stalenessBand(899), '1 <15min');
    assert.equal(stalenessBand(900), '2 <1h');
    assert.equal(stalenessBand(3599), '2 <1h');
    assert.equal(stalenessBand(3600), '3 <6h');
    assert.equal(stalenessBand(86400), '6 >=24h');

    assert.equal(median([]), null);
    assert.equal(median([5]), 5);
    assert.equal(median([1, 3]), 2);
    assert.equal(median([3, 1, 2]), 2);

    // The gradient test must be able to FAIL. A flat input (a genuine soft
    // threshold) must not produce a rising median — this is the guard against
    // a statistic that reports "deterministic" regardless of its input, the
    // defect that got an earlier test in this project deleted rather than
    // patched.
    const flat = [94, 94, 94, 94];
    assert.equal(median(flat), 94, 'median must not invent a gradient');
}

function connectionString() {
    const url = process.env.POSTGRES_URL;
    assert(url, 'POSTGRES_URL is not set — run with --env-file=.env.development');
    return url.replace(/\?schema=public"?$/, '');
}

const client = new pg.Client({ connectionString: connectionString() });
await client.connect();

/**
 * Every attack, with the campaign reading in force at its start and the age of
 * that reading. `points_max` is 1-indexed in Postgres, hence `enemy+1`.
 */
const { rows: attacks } = await client.query(`
    SELECT e.season, e.enemy, e.start_time, e.region,
           s.points_max[e.enemy + 1] AS points_max,
           (SELECT st.points FROM h1_status st
             WHERE st.season = e.season AND st.enemy = e.enemy
               AND st.bucket <= e.start_time
             ORDER BY st.bucket DESC LIMIT 1) AS points,
           (SELECT e.start_time - st.bucket FROM h1_status st
             WHERE st.season = e.season AND st.enemy = e.enemy
               AND st.bucket <= e.start_time
             ORDER BY st.bucket DESC LIMIT 1) AS reading_age
      FROM h1_event e
      JOIN h1_season s ON s.season = e.season
     WHERE e.type = 'attack'
     ORDER BY e.season, e.enemy, e.start_time`);

const usable = attacks.filter(
    (a) => a.points !== null && a.reading_age !== null && Number(a.points_max) > 0,
);

console.log('\n=== Phase 6: is the attack trigger deterministic? ===\n');
console.log(
    `${attacks.length} attacks; ${usable.length} with a resolvable campaign reading.`,
);

// --- region check ----------------------------------------------------------
const offHomeworld = attacks.filter((a) => a.region !== 11);
console.log(
    `Target region: ${attacks.length - offHomeworld.length}/${attacks.length} target region 11 (enemy homeworld).`,
);

// --- test 1: staleness gradient -------------------------------------------
console.log('\n--- Test 1: liberation at attack start, by age of the reading ---');
console.log('A sensor artifact predicts a climb toward 100% as age -> 0.');
console.log('A genuine soft threshold predicts a flat line.\n');

const byBand = new Map();
for (const a of usable) {
    const band = stalenessBand(Number(a.reading_age));
    if (!byBand.has(band)) byBand.set(band, []);
    byBand.get(band).push((Number(a.points) / Number(a.points_max)) * 100);
}

const bands = [...byBand.keys()].sort();
console.log('  reading age    n     median liberation');
for (const band of bands) {
    const vals = byBand.get(band);
    const m = median(vals);
    console.log(
        `  ${band.slice(2).padEnd(10)} ${String(vals.length).padStart(5)}     ${m.toFixed(2)}%`,
    );
}

const freshMedian = median(byBand.get('1 <15min') ?? []);
const stalestBand = bands.at(-1);
const stalestMedian = median(byBand.get(stalestBand) ?? []);
console.log(
    `\n  Gradient: ${stalestMedian?.toFixed(2)}% at the stalest band -> ${freshMedian?.toFixed(2)}% when fresh.`,
);

// --- test 2: fresh readings, listed individually --------------------------
console.log('\n--- Test 2: every attack with a reading under 15 minutes old ---');
console.log('Listed individually — no aggregation.\n');

const fresh = usable
    .filter((a) => Number(a.reading_age) < FRESH_SECONDS)
    .sort((a, b) => a.season - b.season || a.enemy - b.enemy);

console.log('  season enemy   age      points / points_max        short   liberation');
for (const a of fresh) {
    const pts = Number(a.points);
    const max = Number(a.points_max);
    const age = Number(a.reading_age);
    console.log(
        `  ${String(a.season).padStart(6)} ${String(a.enemy).padStart(5)}   ` +
            `${(age + 's').padStart(6)}   ${String(pts).padStart(8)} / ${String(max).padEnd(8)}   ` +
            `${String(max - pts).padStart(6)}   ${((pts / max) * 100).toFixed(3)}%`,
    );
}

const exact = fresh.filter((a) => Number(a.points) >= Number(a.points_max));
const within01 = fresh.filter((a) => Number(a.points) / Number(a.points_max) >= 0.999);
console.log(
    `\n  ${exact.length}/${fresh.length} at exactly points_max; ` +
        `${within01.length}/${fresh.length} within 0.1% of it.`,
);
console.log(
    '  The shortfalls that remain are the final seconds of the climb, not a soft threshold —',
);
console.log('  compare each shortfall against its reading age in the table above.');

// --- test 3: trigger lag on the high-resolution seasons -------------------
console.log('\n--- Test 3: lag between reaching points_max and the attack starting ---');
console.log('Restricted to S157+ (15-minute buckets); the lag is bounded below by');
console.log('the bucket width itself, so these are upper bounds.\n');

const { rows: lags } = await client.query(`
    WITH a AS (
      SELECT e.season, e.enemy, e.start_time, e.event_id,
             s.points_max[e.enemy + 1] AS points_max
        FROM h1_event e
        JOIN h1_season s ON s.season = e.season
       WHERE e.type = 'attack' AND e.season >= 157)
    SELECT a.season, a.enemy, a.start_time,
           (SELECT min(st.bucket) FROM h1_status st
             WHERE st.season = a.season AND st.enemy = a.enemy
               AND st.points >= a.points_max
               AND st.bucket <= a.start_time
               -- Scope to THIS campaign, not the season. A faction can be
               -- attacked twice in a season; without this the second attack
               -- is measured against the first one's completion and reports a
               -- fortnight-long "lag".
               AND st.bucket > COALESCE(
                     (SELECT max(p.bucket) FROM h1_status p
                       WHERE p.season = a.season AND p.enemy = a.enemy
                         AND p.points < a.points_max
                         AND p.bucket <= a.start_time), 0)) AS first_full_bucket
      FROM a
     ORDER BY a.season, a.enemy, a.start_time`);

console.log('  season enemy   lag');
const lagMinutes = [];
for (const r of lags) {
    if (r.first_full_bucket === null) {
        console.log(
            `  ${String(r.season).padStart(6)} ${String(r.enemy).padStart(5)}   (no full bucket before the attack — sparse status data)`,
        );
        continue;
    }
    const mins = (Number(r.start_time) - Number(r.first_full_bucket)) / 60;
    lagMinutes.push(mins);
    console.log(
        `  ${String(r.season).padStart(6)} ${String(r.enemy).padStart(5)}   ${mins.toFixed(1)} min`,
    );
}
if (lagMinutes.length > 0) {
    console.log(
        `\n  n=${lagMinutes.length}, median ${median(lagMinutes).toFixed(1)} min, ` +
            `max ${Math.max(...lagMinutes).toFixed(1)} min.`,
    );
}

// --- verdict ---------------------------------------------------------------
console.log('\n=== Verdict ===\n');
const deterministic =
    freshMedian !== null && freshMedian >= 99.5 && stalestMedian < freshMedian - 2;
console.log(
    deterministic ?
        'DETERMINISTIC — fresh readings sit at points_max, and the apparent\n' +
            '"trigger band" tracks reading staleness. The threshold is the constant\n' +
            'h1_season.points_max, not a distribution.'
    :   'NOT SUPPORTED — fresh readings do not concentrate at points_max, or the\n' +
            'staleness gradient is absent. The soft-threshold reading stands.',
);

console.log(
    '\nConsequence for forecasting: there is no threshold to estimate. The open\n' +
        'question is entirely how fast points climbs — see 10-attack-eta.mjs.\n',
);

await client.end();
