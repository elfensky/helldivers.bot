import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';
import {
    PHRASES,
    pickVariant,
    PHRASE_KEY,
} from '@/features/archives/narrativePhrasing.mjs';
import { buildPlayerBeats } from '@/features/archives/playerBeats.mjs';
import { buildConquestBeats } from '@/features/archives/conquestBeats.mjs';
import { buildNumbersBeat } from '@/features/archives/numbersBeat.mjs';

const SECONDS_PER_DAY = 86400;

function factionName(enemy) {
    return (factions[enemy]?.name ?? 'Unknown forces').replace(/^The\s+/i, '');
}

function dayOf(time, warStart) {
    const day = Math.floor((time - warStart) / SECONDS_PER_DAY) + 1;
    return day < 1 ? 1 : day;
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

    // Faction arrivals (skip the first-introduced — already on the field).
    const introOrder = data?.introduction_order?.order ?? [];
    const firstSeenByEnemy = new Map(
        (data?.status ?? [])
            .filter((s) => s?.first_seen != null)
            .map((s) => [s.enemy, s.first_seen]),
    );
    const firstIntroducedEnemy = introOrder.reduce(
        (best, ord, enemy) =>
            ord > 0 && (best === -1 || ord < introOrder[best]) ? enemy : best,
        -1,
    );
    for (let enemy = 0; enemy < introOrder.length; enemy++) {
        if (introOrder[enemy] <= 0) continue;
        if (enemy === firstIntroducedEnemy) continue;
        const seen = firstSeenByEnemy.get(enemy);
        if (seen == null) continue;
        beats.push({
            time: seen,
            day: dayOf(seen, warStart),
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
    const sorted = [...events].sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
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

    // lastTime caps the chronicle — computed before the highlight beats so we can
    // clamp them to it (telemetry/snapshot buckets can extend past the final
    // event; without clamping a late collapse could sort after the outcome).
    const lastTime = sorted.reduce(
        (m, e) => Math.max(m, e.end_time ?? e.start_time ?? warStart),
        warStart,
    );
    const lastDay = dayOf(lastTime, warStart);

    // NEW highlight beats (features 2-4) — each carries a `kind`; clamp time to
    // lastTime so none sorts after the closing outcome beat.
    for (const pb of buildPlayerBeats(data?.playerTimeseries ?? [], season)) {
        beats.push({ ...pb, time: Math.min(pb.time, lastTime), order: seq++ });
    }
    for (const cb of buildConquestBeats(
        data?.snapshots ?? [],
        data?.points_max ?? { points: [] },
        season,
        warStart,
    )) {
        beats.push({ ...cb, time: Math.min(cb.time, lastTime), order: seq++ });
    }

    // Outcome (caps the chronicle) + the numbers beat just before it.
    const outcome = getWarOutcome(data);
    const numbers = buildNumbersBeat(telemetry, lastTime, lastDay, season);
    if (numbers) beats.push({ ...numbers, order: seq++ });
    if (outcome) {
        beats.push({
            time: lastTime,
            day: lastDay,
            order: seq++,
            text: describeOutcome(outcome, season),
        });
    }

    beats.sort((a, b) => a.time - b.time || a.order - b.order);
    return coherenceGuard(beats).map(({ day, text }) => ({ day, text }));
}
