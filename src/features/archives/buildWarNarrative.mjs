import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { getWarOutcome } from '@/shared/utils/game/getWarOutcome.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import {
    PHRASES,
    pickVariant,
    PHRASE_KEY,
} from '@/features/archives/narrativePhrasing.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { dayOf, SECONDS_PER_DAY } from '@/shared/utils/game/warClock.mjs';

function factionName(enemy) {
    return (factions[enemy]?.name ?? 'Unknown forces').replace(/^The\s+/i, '');
}

const GATES_THRESHOLD = 0.9; // "at the gates" — homeworld-assault range
const SURGE_FACTOR = 1.4; // a peak ≥ 1.4× baseline is a "rally"
const COLLAPSE_FACTOR = 0.6; // a trough ≤ 0.6× baseline is "the front grows quiet"

function median(nums) {
    if (nums.length === 0) return 0;
    const s = [...nums].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Player surge/collapse beats from the per-bucket player timeseries. The single
 * most extreme surge and the single most extreme collapse (past the opening
 * ramp) are emitted when they clear their thresholds — at most 2 beats.
 *
 * @param {Array<{ time:number, day:number, total:number }>} playerTimeseries - per-bucket player count samples
 * @param {number} season - phrasing seed
 * @returns {Array<{ time:number, day:number, kind:'surge'|'collapse', text:string }>}
 */
function buildPlayerBeats(playerTimeseries, season) {
    const series = playerTimeseries ?? [];
    if (series.length < 2) return [];

    const baseline = median(series.map((p) => p.total));
    if (baseline <= 0) return [];

    /** @type {Array<{ time:number, day:number, kind:'surge'|'collapse', text:string }>} */
    const beats = [];

    // Surge: global max, anywhere.
    const peak = series.reduce((a, b) => (b.total > a.total ? b : a));
    if (peak.total >= SURGE_FACTOR * baseline) {
        beats.push({
            time: peak.time,
            day: peak.day,
            kind: 'surge',
            text: pickVariant(
                PHRASES.surge,
                season,
                peak.time | 0,
            )(formatNumber(peak.total)),
        });
    }

    // Collapse: global min, skipping the first (opening-ramp) bucket.
    const tail = series.slice(1);
    const trough = tail.reduce((a, b) => (b.total < a.total ? b : a));
    if (trough.total <= COLLAPSE_FACTOR * baseline) {
        beats.push({
            time: trough.time,
            day: trough.day,
            kind: 'collapse',
            text: pickVariant(
                PHRASES.collapse,
                season,
                trough.time | 0,
            )(formatNumber(trough.total)),
        });
    }

    return beats;
}

/**
 * Offensive conquest milestones from the campaign snapshots. `points/points_max`
 * is Super Earth's conquest progress toward the enemy homeworld (high = SE
 * winning — verified vs computeMapState + the HD1 API). Emits at most two beats:
 *   - breakthrough: first time any faction's frac first crosses GATES_THRESHOLD
 *   - first homeworld falls: first time any faction first reads 'defeated'
 *
 * @param {Array<{ time:number, data:Array<{ points:number, status:string }|null> }>} snapshots - data[enemy] positional (index = faction id). Through getCampaign every entry is [f0,f1,f2] non-null (partial buckets are filtered); the null guard below is defensive only.
 * @param {{ points:number[] }} pointsMax - Maximum points array indexed by faction
 * @param {number} season - Season number for narrative phrase selection
 * @param {number} warStart - Unix-seconds anchor for day 1 (war start).
 * @returns {Array<{ time:number, day:number, kind:'conquest', text:string }>} Conquest milestone beats
 */
function buildConquestBeats(snapshots, pointsMax, season, warStart) {
    const snaps = snapshots ?? [];
    const maxes = pointsMax?.points ?? [];
    if (snaps.length === 0) return [];

    let breakthrough = null; // first snapshot any faction crosses the gates
    let firstFall = null; // first snapshot any faction is defeated

    for (const snap of snaps) {
        const data = snap.data ?? [];
        for (let enemy = 0; enemy < data.length; enemy++) {
            const s = data[enemy];
            if (!s) continue; // factions[i] may be null pre-introduction
            const max = maxes[enemy] || 0;
            const frac =
                s.status === 'defeated' ? 1
                : max > 0 ? s.points / max
                : 0;
            if (!breakthrough && frac >= GATES_THRESHOLD) {
                breakthrough = { time: snap.time, enemy };
            }
            if (!firstFall && s.status === 'defeated') {
                firstFall = { time: snap.time, enemy };
            }
        }
        if (breakthrough && firstFall) break;
    }

    /** @type {Array<{ time:number, day:number, kind:'conquest', text:string }>} */
    const beats = [];
    if (breakthrough) {
        beats.push({
            time: breakthrough.time,
            day: dayOf(breakthrough.time, warStart),
            kind: 'conquest',
            text: pickVariant(
                PHRASES.breakthrough,
                season,
                breakthrough.enemy,
            )(factionName(breakthrough.enemy)),
        });
    }
    if (firstFall) {
        beats.push({
            time: firstFall.time,
            day: dayOf(firstFall.time, warStart),
            kind: 'conquest',
            text: pickVariant(
                PHRASES.homeworldFalls,
                season,
                firstFall.enemy + 10,
            )(factionName(firstFall.enemy)),
        });
    }

    // Dedupe: same faction reaching the gates and falling on the same day reads
    // as one moment — keep the "falls" beat.
    if (
        beats.length === 2 &&
        breakthrough &&
        firstFall &&
        breakthrough.enemy === firstFall.enemy &&
        beats[0].day === beats[1].day
    ) {
        return [beats[1]];
    }
    return beats;
}

/**
 * One "war by the numbers" beat from the season telemetry totals, anchored at
 * `lastTime` (the last event) so the orchestrator can order it just before the
 * closing outcome beat. Returns `null` for telemetry-less seasons.
 *
 * @param {{ kills:number, missions:number, accidentals:number } | null} telemetry season telemetry totals
 * @param {number} lastTime last event timestamp for anchoring
 * @param {number} day season day number
 * @param {number} season season number for phrase variant selection
 * @returns {{ time:number, day:number, kind:'numbers', text:string } | null} beat object or null if no telemetry
 */
function buildNumbersBeat(telemetry, lastTime, day, season) {
    if (!telemetry) return null;
    const text = pickVariant(PHRASES.numbers, season, PHRASE_KEY.numbers)(
        formatNumber(telemetry.kills),
        formatNumber(telemetry.missions),
        formatNumber(telemetry.accidentals),
    );
    return { time: lastTime, day, kind: 'numbers', text };
}

/** One Ministry-voice field report for a resolved event, via seeded phrasing. */
function describeEvent(e, season) {
    const region = getEventRegionLabel(e);
    const enemy = factionName(e.enemy);
    if (e.type === EVENT_TYPE.ATTACK) {
        if (e.status === EVENT_STATUS.SUCCESS)
            return pickVariant(PHRASES.attackWon, season, e.event_id)(region, enemy);
        if (e.status === EVENT_STATUS.FAIL)
            return pickVariant(PHRASES.attackLost, season, e.event_id)(region, enemy);
        return '';
    }
    if (e.type === EVENT_TYPE.DEFEND) {
        if (e.status === EVENT_STATUS.SUCCESS)
            return pickVariant(PHRASES.defendWon, season, e.event_id)(region, enemy);
        if (e.status === EVENT_STATUS.FAIL)
            return pickVariant(PHRASES.defendLost, season, e.event_id)(region, enemy);
        return '';
    }
    return '';
}

/** The closing victory/defeat beat, via seeded phrasing. */
function describeOutcome(outcome, season) {
    if (outcome.outcome === 'victory') {
        const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
        const attribution = enemy ? ` The ${enemy} were the last to fall.` : '';
        return pickVariant(PHRASES.victory, season, PHRASE_KEY.victory)(attribution);
    }
    const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
    if (enemy) return pickVariant(PHRASES.defeat, season, PHRASE_KEY.defeat)(enemy);
    return pickVariant(PHRASES.defeatGeneric, season, PHRASE_KEY.defeat)();
}

/**
 * After chronological sort, drops the LATER of two adjacent opposite-sentiment
 * highlight beats (surge↔collapse, same day) — surge/collapse are the global
 * max/min of one series so same-day adjacency is near-impossible; this is a
 * cheap safety net. Per-event/opening/outcome beats (no `kind`) are never dropped.
 */
// Only surge↔collapse are opposites; conquest/numbers beats are intentionally never suppressed.
const OPPOSITE = { surge: 'collapse', collapse: 'surge' };
function coherenceGuard(beats) {
    const out = [];
    for (const beat of beats) {
        const prev = out[out.length - 1];
        if (
            prev &&
            beat.kind &&
            prev.kind &&
            OPPOSITE[beat.kind] === prev.kind &&
            beat.day === prev.day
        ) {
            continue; // skip this one — keep the earlier (already-placed) beat
        }
        out.push(beat);
    }
    return out;
}

/**
 * Build the ordered War Narrative beats for a season. Deterministic (no
 * Math.random) so the server-rendered output is stable.
 *
 * @param {object} data - getCampaign shape: events[], status[], snapshots[],
 *   introduction_order.order[], points_max.points[], playerTimeseries[], war_start.
 * @param {{ kills:number, missions:number, accidentals:number } | null} [telemetry]
 *   - season telemetry totals (getSeasonTelemetryTotals); null ⇒ no numbers beat.
 * @returns {Array<{ day:number, text:string }>}
 */
export function buildWarNarrative(data, telemetry = null) {
    const events = data?.events ?? [];
    if (events.length === 0) return [];

    const season = data?.season ?? 0;
    const warStart =
        data?.war_start ??
        events.reduce((m, e) => Math.min(m, e.start_time ?? Infinity), Infinity);
    if (!Number.isFinite(warStart)) return [];

    /** @type {Array<{ time:number, day:number, order:number, kind?:string, text:string }>} */
    const beats = [];
    let seq = 0;

    // Opening.
    beats.push({
        time: warStart,
        day: 1,
        order: seq++,
        text: pickVariant(PHRASES.opening, season, PHRASE_KEY.opening)(),
    });

    // lastTime caps the chronicle. Computed up front so every non-outcome beat can be
    // clamped to it: arrivals and telemetry/snapshot buckets can both fall after the
    // final event, and an unclamped beat sorts *after* the closing outcome beat.
    // Hoisting only the computation — no beats.push moves, so every `order` value and
    // therefore every tie-break is unchanged.
    const sorted = [...events].sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
    const lastTime = sorted.reduce(
        (m, e) => Math.max(m, e.end_time ?? e.start_time ?? warStart),
        warStart,
    );
    const lastDay = dayOf(lastTime, warStart);

    // Faction arrivals. `introduction_order` is HD1's 0-based reveal slot: `0` is the
    // faction the war started against (the opening beat covers it), `255` means never
    // introduced. Mirrors buildIntroMarkers, fixed in 31ac255 — this reader was written
    // under a 1-based assumption, so its two guards compounded and dropped the slot-1
    // faction's arrival from every season's narrative.
    const introOrder = data?.introduction_order?.order ?? [];
    const firstSeenByEnemy = new Map(
        (data?.status ?? [])
            .filter((s) => s?.first_seen != null)
            .map((s) => [s.enemy, s.first_seen]),
    );
    for (let enemy = 0; enemy < introOrder.length; enemy++) {
        const slot = introOrder[enemy];
        if (slot == null || slot === 0 || slot >= 255) continue;
        const seen = firstSeenByEnemy.get(enemy);
        if (seen == null) continue;
        beats.push({
            time: Math.min(seen, lastTime),
            day: Math.min(dayOf(seen, warStart), lastDay),
            order: seq++,
            text: pickVariant(PHRASES.arrival, season, enemy + 1)(factionName(enemy)),
        });
    }

    // Cascades (collapse a failed-defend run into one beat; suppress its events).
    const cascades = findAllCascades(events);
    /** @type {Set<object>} */
    const cascadeEvents = new Set();
    for (const cascade of cascades) {
        for (const e of cascade.events) cascadeEvents.add(e);
        const reachedHome = cascade.regions[cascade.regions.length - 1] <= 0;
        const span = Math.max(1, Math.round(cascade.durationSec / SECONDS_PER_DAY));
        const dayPhrase = span === 1 ? 'in a single day' : `over ${span} days`;
        const home =
            reachedHome ?
                ' The breach reached the inner regions; the Ministry calls this a controlled withdrawal.'
            :   '';
        beats.push({
            time: cascade.startTime,
            day: dayOf(cascade.startTime, warStart),
            order: seq++,
            text: pickVariant(PHRASES.cascade, season, cascade.startTime | 0)(
                factionName(cascade.factionIndex),
                cascade.length,
                dayPhrase,
                home,
            ),
        });
    }

    // Per-event field reports (excluding cascade-folded events).
    for (const e of sorted) {
        if (cascadeEvents.has(e)) continue;
        if (e.start_time == null) continue;
        const text = describeEvent(e, season);
        if (!text) continue;
        beats.push({
            time: e.start_time,
            day: dayOf(e.start_time, warStart),
            order: seq++,
            text,
        });
    }

    // NEW highlight beats (features 2-4) — each carries a `kind`; clamp time to
    // lastTime so none sorts after the closing outcome beat.
    for (const pb of buildPlayerBeats(data?.playerTimeseries ?? [], season)) {
        beats.push({
            ...pb,
            time: Math.min(pb.time, lastTime),
            day: Math.min(pb.day, lastDay),
            order: seq++,
        });
    }
    for (const cb of buildConquestBeats(
        data?.snapshots ?? [],
        data?.points_max ?? { points: [] },
        season,
        warStart,
    )) {
        beats.push({
            ...cb,
            time: Math.min(cb.time, lastTime),
            day: Math.min(cb.day, lastDay),
            order: seq++,
        });
    }

    // Outcome (caps the chronicle) + the numbers beat just before it.
    const outcome = getWarOutcome(data);
    const numbers = buildNumbersBeat(telemetry, lastTime, lastDay, season);
    if (numbers) beats.push({ ...numbers, order: seq++ });
    if (outcome) {
        beats.push({
            time: lastTime,
            day: lastDay,
            order: seq,
            text: describeOutcome(outcome, season),
        });
    }

    beats.sort((a, b) => a.time - b.time || a.order - b.order);
    return coherenceGuard(beats).map(({ day, text }) => ({ day, text }));
}
