import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';
import { findAllCascades } from '@/shared/utils/game/seasonAnalytics.mjs';
import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { getEventRegionLabel } from '@/shared/utils/game/getEventRegionLabel.mjs';

const SECONDS_PER_DAY = 86400;

/**
 * Resolve a faction's display name from its enemy id, stripped of any leading
 * definite article. "The Illuminate" in the enum becomes "Illuminate" so the
 * templates — which all supply their own "the ${name}" — never read "the The
 * Illuminate". Bugs / Cyborgs are unaffected.
 *
 * @param {number} enemy - Faction id (0=Bugs, 1=Cyborgs, 2=Illuminate).
 * @returns {string}
 */
function factionName(enemy) {
    const name = factions[enemy]?.name ?? 'Unknown forces';
    return name.replace(/^The\s+/i, '');
}

/**
 * Day-into-war for a unix-seconds timestamp, 1-indexed. Day 1 is the war's
 * opening day. Guards a missing/late anchor by clamping to a minimum of 1 so
 * no beat ever reads "Day 0" or negative.
 *
 * @param {number} time - Event unix-seconds timestamp.
 * @param {number} warStart - Unix-seconds anchor for day 1.
 * @returns {number}
 */
function dayOf(time, warStart) {
    const day = Math.floor((time - warStart) / SECONDS_PER_DAY) + 1;
    return day < 1 ? 1 : day;
}

/**
 * Build an ordered, in-world "war narrative" for a season from its campaign
 * data. Each beat is a day-stamped sentence in the Ministry of Truth's
 * propaganda voice — the opening of the war, each faction's arrival, the
 * dramatic cascade runs collapsed into a single beat, and the war's outcome
 * capping the chronicle.
 *
 * Generated, not pooled: the strings are season-specific (region names,
 * faction names, day offsets), so they are templated from the data rather than
 * drawn from a static content pool. Voice conventions mirror
 * `src/features/ministry/ministryContent.mjs` and `generateCascadeLede.mjs`:
 * dark-comedy military tone, franchise-only, no real-world politics.
 *
 * @param {object} data - Campaign data (the getCampaign shape): `events[]`,
 *   `status[]`, `snapshots[]`, `introduction_order.order`, `war_start`.
 * @returns {Array<{ day: number, text: string }>} Beats in chronological order.
 *   Empty array when there is no event data to narrate.
 */
export function buildWarNarrative(data) {
    const events = data?.events ?? [];
    if (events.length === 0) return [];

    // Anchor day 1 to war_start, falling back to the earliest event start_time.
    // reduce, not Math.min(...spread): a large event array spread as call
    // arguments can throw RangeError — mirror buildEngagementSeries.mjs.
    const warStart =
        data?.war_start ??
        events.reduce((m, e) => Math.min(m, e.start_time ?? Infinity), Infinity);
    if (!Number.isFinite(warStart)) return [];

    /** @type {Array<{ time: number, day: number, order: number, text: string }>} */
    const beats = [];
    // `order` is a stable tiebreaker for same-timestamp beats so the opening,
    // faction arrivals, and field reports stay in a sensible reading order.
    let seq = 0;

    // --- Opening beat -------------------------------------------------------
    beats.push({
        time: warStart,
        day: 1,
        order: seq++,
        text: 'The war begins. By order of the Ministry of Truth, every citizen is a soldier and every soldier is a statistic.',
    });

    // --- Faction-arrival beats ---------------------------------------------
    // introduction_order.order is enemy-id-indexed: order[enemy] = the 1-based
    // slot in which that faction was revealed. status[i].first_seen is the
    // earliest non-hidden bucket for that faction — the moment it entered the
    // war. Splice one arrival beat per faction, anchored at first_seen so it
    // interleaves with the field reports by timestamp.
    const introOrder = data?.introduction_order?.order ?? [];
    const firstSeenByEnemy = new Map(
        (data?.status ?? [])
            .filter((s) => s?.first_seen != null)
            .map((s) => [s.enemy, s.first_seen]),
    );
    // Skip the first-introduced faction: it is already on the field at war
    // start, so its "arrival" would duplicate the opening beat.
    const firstIntroducedEnemy = introOrder.reduce(
        (best, ord, enemy) =>
            ord > 0 && (best === -1 || ord < introOrder[best]) ? enemy : best,
        -1,
    );
    for (let enemy = 0; enemy < introOrder.length; enemy++) {
        if (introOrder[enemy] <= 0) continue; // never introduced this season
        if (enemy === firstIntroducedEnemy) continue;
        const seen = firstSeenByEnemy.get(enemy);
        if (seen == null) continue;
        beats.push({
            time: seen,
            day: dayOf(seen, warStart),
            order: seq++,
            text: `The ${factionName(enemy)} enter the war. The Ministry assures all citizens this was anticipated, scheduled, and is going entirely according to plan.`,
        });
    }

    // --- Cascade beats (collapse a run into one dramatic line) -------------
    // Each cascade is a chain of failed defenses for one faction marching
    // toward the home region. Replace the whole run with a single beat and
    // suppress its constituent events from the per-event pass below.
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
            text: `A devastating cascade. The ${factionName(cascade.factionIndex)} push through ${cascade.length} regions ${dayPhrase}.${home} Reports of panic have been reclassified as enthusiasm.`,
        });
    }

    // --- Per-event field reports -------------------------------------------
    // One beat per notable resolved event (excluding those folded into a
    // cascade). Active/unresolved events carry no outcome to narrate, so skip
    // them. Sort ascending by start_time first so day offsets read in order.
    const sorted = [...events].sort((a, b) => (a.start_time ?? 0) - (b.start_time ?? 0));
    for (const e of sorted) {
        if (cascadeEvents.has(e)) continue;
        if (e.start_time == null) continue;
        const text = describeEvent(e);
        if (!text) continue;
        beats.push({
            time: e.start_time,
            day: dayOf(e.start_time, warStart),
            order: seq++,
            text,
        });
    }

    // --- Outcome beat (caps the chronicle) ---------------------------------
    const outcome = getWarOutcome(data);
    if (outcome) {
        // Anchor the final beat to the last event so it always reads last.
        const lastTime = sorted.reduce(
            (m, e) => Math.max(m, e.end_time ?? e.start_time ?? warStart),
            warStart,
        );
        beats.push({
            time: lastTime,
            day: dayOf(lastTime, warStart),
            order: seq++,
            text: describeOutcome(outcome),
        });
    }

    // Chronological order, with the per-beat `order` breaking timestamp ties
    // so the opening leads and the outcome trails within the same day.
    beats.sort((a, b) => a.time - b.time || a.order - b.order);

    return beats.map(({ day, text }) => ({ day, text }));
}

/**
 * Render a single resolved event as one Ministry-voice field report. Returns
 * '' for events that carry no narratable outcome (active/unknown), so the
 * caller can skip them.
 *
 * @param {object} e - An h1_event record.
 * @returns {string}
 */
function describeEvent(e) {
    const region = getEventRegionLabel(e);
    const enemy = factionName(e.enemy);

    if (e.type === EVENT_TYPE.ATTACK) {
        if (e.status === EVENT_STATUS.SUCCESS) {
            return `Helldivers storm the ${enemy} homeworld and raise the flag over ${region}. The Ministry declares the celebration mandatory.`;
        }
        if (e.status === EVENT_STATUS.FAIL) {
            return `The assault on the ${enemy} at ${region} falters. The Ministry has retroactively scheduled this setback as a morale exercise.`;
        }
        return '';
    }

    if (e.type === EVENT_TYPE.DEFEND) {
        if (e.status === EVENT_STATUS.SUCCESS) {
            return `${region} holds against the ${enemy}. The Ministry credits its own foresight and nothing else.`;
        }
        if (e.status === EVENT_STATUS.FAIL) {
            return `${region} falls to the ${enemy}. The Ministry reminds citizens that a region lost is merely a region awaiting glorious recapture.`;
        }
        return '';
    }

    return '';
}

/**
 * Render the war's final outcome beat. Victory and defeat each get a
 * faction-attributed line; the faction may be null when attribution is
 * unavailable, in which case the line stays generic.
 *
 * @param {{ outcome: string, faction: number|null }} outcome - The resolved war
 *   outcome from getWarOutcome (outcome + faction attribution). `outcome` is
 *   one of 'victory' | 'defeat'; typed loosely as `string` to match the value
 *   tsc infers from getWarOutcome's object-literal returns.
 * @returns {string}
 */
function describeOutcome(outcome) {
    if (outcome.outcome === 'victory') {
        const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
        const attribution = enemy ? ` The ${enemy} were the last to fall.` : '';
        return `The war is won. Super Earth stands victorious — managed democracy prevails, exactly as the Ministry always knew it would.${attribution}`;
    }

    const enemy = outcome.faction != null ? factionName(outcome.faction) : null;
    if (enemy) {
        return `Super Earth falls. The ${enemy} have won. The Ministry assures surviving citizens that this defeat was both temporary and, in hindsight, inspirational.`;
    }
    return 'The war is lost. The Ministry has classified the outcome as a strategic reposition and recommends citizens look forward, never back.';
}
