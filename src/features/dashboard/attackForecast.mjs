/**
 * attackForecast — per-faction assault ETA from the live payload.
 *
 * Attacks are deterministic: one fires within minutes of a faction's campaign
 * reaching `points_max` (see /docs/predict § Attacks). So the forecast is
 * arithmetic the client can do, plus two calibration tables it cannot derive,
 * which ship in attackModel.mjs.
 *
 *     eta = (points_max − points) / rate − readingAge
 *     shown = eta × {r25, r50, r75} for this remaining-fraction band
 *
 * Total function: every failure path returns { mode: 'hidden', reason }
 * rather than throwing, so the card degrades to exactly its old meta row.
 */
import defaultModel from '@/features/dashboard/attackModel.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';

const HOUR = 3600;

const SECTOR_COUNT = 10;
/**
 * Sector gates. In code, not the model: no calibrated sector table exists yet
 * (scripts/analysis/13-sector-eta.mjs is the future grading tool — only 4
 * high-res seasons exist, effN=1 after walk-forward training), so the sector
 * forecast is MEDIAN-ONLY raw arithmetic until that gate is evaluable.
 */
const SECTOR_MIN_ETA_HOURS = 1 / 12; // 5 minutes

/**
 * Sanity cap on any displayed ETA. Multi-day estimates render (as rough
 * day figures — the band ratios are relative, so their measured spread
 * scales with the horizon), but past a month the pace is so low the number
 * is astrology and the line hides instead.
 */
const FAR_CAP_HOURS = 720; // 30 days

/**
 * @param {object} model candidate attack model
 * @returns {boolean} true when it carries usable band and day-of-week tables
 */
export function isValidModel(model) {
    if (!model || !Array.isArray(model.bands) || !Array.isArray(model.dow)) return false;
    if (model.dow.length !== 7 || !model.dow.every((f) => Number.isFinite(f) && f > 0)) {
        return false;
    }
    if (!model.ratios) return false;
    for (let b = 0; b < model.bands.length; b++) {
        const r = model.ratios[b];
        if (!r) return false;
        if (![r.r25, r.r50, r.r75].every((x) => Number.isFinite(x) && x > 0))
            return false;
        if (!(r.r25 <= r.r50 && r.r50 <= r.r75)) return false;
    }
    return true;
}

/**
 * Index of the remaining-fraction band containing `frac`.
 *
 * @param {number} frac remaining points as a fraction of points_max
 * @param {number[]} bands band edges from the model
 * @returns {number} band index
 */
export function bandOf(frac, bands) {
    for (let i = 0; i < bands.length; i++) if (frac < bands[i]) return i;
    return bands.length - 1;
}

/**
 * Campaign points for a faction ~`hoursAgo` before `nowSeconds`, read from the
 * season's snapshot history.
 *
 * `snapshots` is POSITIONAL — `data[enemy]` — unlike `status`, which is keyed
 * by an explicit `.enemy`. Mixing the two conventions up is a bug this repo has
 * already shipped once (see getCampaign.mjs), so this reads only `snapshots`.
 *
 * @param {{time: number, data: object[]}[]} snapshots ascending by time
 * @param {number} enemy faction id
 * @param {number} at unix seconds
 * @returns {{points: number, time: number}|null} latest snapshot at or before `at`
 */
export function pointsAt(snapshots, enemy, at) {
    let best = null;
    for (const snap of snapshots) {
        if (snap.time > at) break;
        const row = snap.data?.[enemy];
        if (row && Number.isFinite(Number(row.points))) {
            best = { points: Number(row.points), time: snap.time };
        }
    }
    return best;
}

/**
 * The shared "points remaining ÷ pace" core: rate over the model's snapshot
 * window → day-of-week correction → staleness anchor. Used by both
 * `attackForecast` (target = campaign end) and `sectorForecast` (target =
 * next sector boundary) — same arithmetic, different `remaining`. Callers
 * apply their OWN floor (`model.meta.minEtaHours` vs `SECTOR_MIN_ETA_HOURS`)
 * because the two floors are measured differently.
 *
 * `eventForecast.mjs` is deliberately NOT a consumer: its rate is the
 * average since the event started (event points, no snapshots, no dow, no
 * staleness), and that exact math is what script 14b validated — sharing
 * code would change nothing but risk the calibrated predicate.
 *
 * @param {object} data the live campaign payload (needs `.snapshots`)
 * @param {number} enemy faction id
 * @param {number} nowSeconds unix seconds
 * @param {object} model calibration tables (rate window + dow)
 * @param {number} remaining points to the caller's target
 * @returns {{etaHours: number}|{reason: 'no-data'|'stalled'}} pre-floor ETA
 */
function paceEtaHours(data, enemy, nowSeconds, model, remaining) {
    const then = pointsAt(
        data.snapshots,
        enemy,
        nowSeconds - model.meta.rateWindowHours * HOUR,
    );
    const now = pointsAt(data.snapshots, enemy, nowSeconds);
    if (!then || !now || !(now.time > then.time)) {
        return { reason: 'no-data' };
    }

    const spanHours = (now.time - then.time) / HOUR;
    const ratePerHour = (now.points - then.points) / spanHours;
    // A front that is not moving has no arrival time, and silence is the honest
    // output. Measured at ~38-47% of moments across history.
    if (!(ratePerHour > 0)) return { reason: 'stalled' };

    let etaHours = remaining / ratePerHour;

    // Day-of-week correction. Campaign pace runs ~29% faster on the busiest day
    // than the quietest, and a 24h rate window carries yesterday's weekday into
    // a forecast about tomorrow's.
    const meanFactor = (from, to) => {
        let sum = 0;
        let n = 0;
        for (let t = from; t < to; t += 6 * HOUR) {
            sum += model.dow[new Date(t * 1000).getUTCDay()];
            n++;
        }
        return n > 0 ? sum / n : 1;
    };
    const horizon = Math.min(Math.max(etaHours, 1), 48);
    const adj =
        meanFactor(then.time, now.time) /
        meanFactor(nowSeconds, nowSeconds + horizon * HOUR);
    if (adj > 0) etaHours *= adj;

    // Anchor at now, not at the reading: `remaining / rate` otherwise answers
    // "how long from when the reading was taken".
    etaHours -= (nowSeconds - now.time) / HOUR;
    return { etaHours };
}

/**
 * Assault ETA for one faction.
 *
 * @param {object} data the live campaign payload
 * @param {number} enemy faction id (0 bugs, 1 cyborgs, 2 illuminate)
 * @param {number} nowSeconds unix seconds
 * @param {object} [model] the committed calibration tables
 * @returns {{mode: 'window', p25: number, p50: number, p75: number,
 *   remaining: number, imminent: boolean}
 *   | {mode: 'hidden', reason: 'no-data'|'attack-active'|'complete'|'stalled'|'beyond-window'}}
 */
export function attackForecast(data, enemy, nowSeconds, model = defaultModel) {
    if (
        !data ||
        !Array.isArray(data.status) ||
        !Array.isArray(data.snapshots) ||
        !isValidModel(model)
    ) {
        return { mode: 'hidden', reason: 'no-data' };
    }

    // An assault already running against this faction makes the question moot,
    // and mirrors the `filtered` configuration the model was measured under.
    const attackActive = (data.events ?? []).some(
        (e) =>
            e.type === EVENT_TYPE.ATTACK &&
            e.status === EVENT_STATUS.ACTIVE &&
            e.enemy === enemy,
    );
    if (attackActive) return { mode: 'hidden', reason: 'attack-active' };

    const row = data.status.find((r) => r.enemy === enemy);
    if (!row || !(Number(row.points_max) > 0)) {
        return { mode: 'hidden', reason: 'no-data' };
    }

    const pointsMax = Number(row.points_max);
    const remaining = pointsMax - Number(row.points);
    if (!(remaining > 0)) return { mode: 'hidden', reason: 'complete' };

    const pace = paceEtaHours(data, enemy, nowSeconds, model, remaining);
    if (!('etaHours' in pace)) return { mode: 'hidden', reason: pace.reason };
    const etaHours = Math.max(pace.etaHours, model.meta.minEtaHours);

    const r = model.ratios[bandOf(remaining / pointsMax, model.bands)];
    const p50 = etaHours * r.r50;
    if (!(p50 < FAR_CAP_HOURS)) {
        return { mode: 'hidden', reason: 'beyond-window' };
    }

    return {
        mode: 'window',
        p25: etaHours * r.r25,
        p50,
        p75: etaHours * r.r75,
        remaining,
        imminent: p50 < 4,
    };
}

/**
 * Median ETA until the faction's NEXT SECTOR boundary (points_max/10 steps) —
 * the sector-view counterpart of `attackForecast`. Same rate/dow/staleness
 * core, but median-only (no p25/p75: unmeasured ranges are not shown). Own
 * gates: hidden while ANY active event exists for the faction (defends freeze
 * the campaign; during attacks the campaign is complete).
 *
 * In the LAST sector the next boundary IS the campaign end — the calibrated
 * attack model exists for exactly that target, so this defers to
 * `attackForecast` (window mode) rather than showing an uncalibrated median
 * for the same number one card-toggle away.
 *
 * @param {object} data the live campaign payload
 * @param {number} enemy faction id
 * @param {number} nowSeconds unix seconds
 * @param {object} [model] used for its `dow` pace table only
 * @returns {{mode:'median', p50:number, remaining:number, imminent:boolean}
 *   | {mode:'window', p25:number, p50:number, p75:number, remaining:number, imminent:boolean}
 *   | {mode:'hidden', reason:'no-data'|'event-active'|'complete'|'stalled'|'beyond-window'|'attack-active'}}
 */
export function sectorForecast(data, enemy, nowSeconds, model = defaultModel) {
    if (
        !data ||
        !Array.isArray(data.status) ||
        !Array.isArray(data.snapshots) ||
        !isValidModel(model)
    ) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    const eventActive = (data.events ?? []).some(
        (e) => e.status === EVENT_STATUS.ACTIVE && e.enemy === enemy,
    );
    if (eventActive) return { mode: 'hidden', reason: 'event-active' };

    const row = data.status.find((r) => r.enemy === enemy);
    if (!row || !(Number(row.points_max) > 0)) {
        return { mode: 'hidden', reason: 'no-data' };
    }
    const pointsMax = Number(row.points_max);
    const points = Number(row.points);
    if (points >= pointsMax) return { mode: 'hidden', reason: 'complete' };

    const pps = pointsMax / SECTOR_COUNT;
    const boundary = (Math.trunc(points / pps) + 1) * pps;
    if (boundary >= pointsMax) {
        return attackForecast(data, enemy, nowSeconds, model);
    }
    const remaining = boundary - points;

    const pace = paceEtaHours(data, enemy, nowSeconds, model, remaining);
    if (!('etaHours' in pace)) return { mode: 'hidden', reason: pace.reason };
    const p50 = Math.max(pace.etaHours, SECTOR_MIN_ETA_HOURS);

    if (!(p50 < FAR_CAP_HOURS)) {
        return { mode: 'hidden', reason: 'beyond-window' };
    }
    return { mode: 'median', p50, remaining, imminent: p50 < 1 };
}
