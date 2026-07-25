import factions from '@/shared/enums/factions.mjs';
import { dayOf, resolveWarStart } from '@/shared/utils/game/warClock.mjs';

/**
 * Build synthetic "a faction enters the war" markers for the Event Log, shared
 * by the homepage (`/`) and the archives (`/archives`). One marker per faction
 * that (a) has a real `introduction_order` slot AND (b) has a non-null
 * `first_seen` (the earliest non-hidden status bucket). Factions that are
 * revealed but lack a recorded first appearance are skipped: without a
 * timestamp there's nowhere to interleave the marker.
 *
 * `introduction_order` is HD1's 0-based reveal slot: `0` is the faction the war
 * started against, `1`/`2` the later arrivals, and `255` means "not yet
 * introduced" this season. So the war-start faction (`slot === 0`) is flagged
 * `isWarStart` — the Event Log gives it distinct wording ("… declare war")
 * instead of the "… enter the war" used for the later factions.
 *
 * `day` uses the shared warClock `dayOf` convention (1-based): the first day
 * of the war is Day 1. `warStart` anchors Day 1, falling back to the earliest
 * `first_seen` across all introduced factions when absent (resolveWarStart).
 *
 * The faction name strips a leading article ("The Illuminate" → "Illuminate")
 * so it templates cleanly into "<Name> enter the war".
 *
 * @param {object} [data] - getCampaign output. Reads `data.introduction_order.order` (enemy-id-indexed reveal slots), `data.status[i].first_seen` / `.enemy`, and `data.war_start`.
 * @returns {Array<{kind:'intro', enemy:number, name:string, time:number, day:number, isWarStart:boolean}>} markers sorted ascending by time. Empty when data is missing.
 */
export function buildIntroMarkers(data) {
    const order = data?.introduction_order?.order;
    const status = data?.status;
    if (!Array.isArray(order) || !Array.isArray(status)) return [];

    // Map enemy id → first_seen from the per-faction status rows.
    const firstSeenByEnemy = new Map();
    for (const row of status) {
        if (row && row.enemy != null && row.first_seen != null) {
            firstSeenByEnemy.set(row.enemy, row.first_seen);
        }
    }

    // Collect candidate markers: a real reveal slot (0..2; `255`/missing means
    // not introduced) AND a known first_seen.
    const candidates = [];
    for (let enemy = 0; enemy < order.length; enemy++) {
        const slot = order[enemy];
        if (slot == null || slot >= 255) continue;
        const time = firstSeenByEnemy.get(enemy);
        if (time == null) continue;
        candidates.push({ enemy, time, isWarStart: slot === 0 });
    }
    if (candidates.length === 0) return [];

    const anchor = resolveWarStart(
        data?.war_start,
        candidates.map((c) => c.time),
    );

    return candidates
        .map(({ enemy, time, isWarStart }) => ({
            kind: /** @type {'intro'} */ ('intro'),
            enemy,
            name: stripArticle(factions[enemy]?.name ?? `Faction ${enemy}`),
            time,
            day: dayOf(time, anchor),
            isWarStart,
        }))
        .sort((a, b) => a.time - b.time);
}

/**
 * Strip a leading "The " article so a faction name templates into a sentence
 * fragment ("The Illuminate" → "Illuminate" for "Illuminate enter the war").
 *
 * @param {string} name - Faction display name.
 * @returns {string}
 */
function stripArticle(name) {
    return name.replace(/^the\s+/i, '');
}
