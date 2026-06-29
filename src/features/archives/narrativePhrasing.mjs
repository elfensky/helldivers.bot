/**
 * Deterministic phrasing variety for the War Narrative. SSR-safe: every pick
 * is a pure function of (season, key) — no Math.random — so the server-rendered
 * narrative is byte-stable. Voice mirrors src/features/ministry/ministryContent
 * .mjs (Ministry-of-Truth dark comedy, franchise-only, profanity-free).
 */

// 32-bit avalanche hash (xxHash-style finalizer) → uniform pool index.
function hash32(n) {
    let h = n >>> 0 || 1;
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
}

/**
 * Deterministically select a variant from `pool`, seeded by `season` + `key`
 * (an event_id for per-event beats, or a `PHRASE_KEY` constant for singletons).
 *
 * @template T
 * @param {T[]} pool The variants to select from.
 * @param {number} season The season number (part of the hash seed).
 * @param {number} key The event ID or PHRASE_KEY constant (part of the hash seed).
 * @returns {T}
 */
export function pickVariant(pool, season, key) {
    return pool[hash32(season * 1000003 + key) % pool.length];
}

/** Fixed keys so singleton beats (no event_id) still vary by season. */
export const PHRASE_KEY = { opening: 1, victory: 2, defeat: 3, numbers: 4 };

/**
 * Each pool is an array of template functions. Variant 0 of the existing
 * beats reproduces the pre-extension wording so the change is additive.
 */
export const PHRASES = {
    opening: [
        () =>
            'The war begins. By order of the Ministry of Truth, every citizen is a soldier and every soldier is a statistic.',
        () =>
            'The war begins. The Ministry of Truth has already written the victory speech; only the date remains classified.',
    ],
    /** (enemy) */
    arrival: [
        (enemy) =>
            `The ${enemy} enter the war. The Ministry assures all citizens this was anticipated, scheduled, and is going entirely according to plan.`,
        (enemy) =>
            `The ${enemy} join the war. The Ministry welcomes the additional opportunity for managed democracy.`,
    ],
    /** (enemy, count, dayPhrase, home) */
    cascade: [
        (enemy, count, dayPhrase, home) =>
            `A devastating cascade. The ${enemy} push through ${count} regions ${dayPhrase}.${home} Reports of panic have been reclassified as enthusiasm.`,
        (enemy, count, dayPhrase, home) =>
            `The line breaks. The ${enemy} sweep ${count} regions ${dayPhrase}.${home} The Ministry files the rout under "tactical generosity."`,
    ],
    /** (region, enemy) */
    attackWon: [
        (region, enemy) =>
            `Helldivers storm the ${enemy} homeworld and raise the flag over ${region}. The Ministry declares the celebration mandatory.`,
        (region, enemy) =>
            `${region} is liberated from the ${enemy}. The Ministry has scheduled three parades and one mandatory cheer.`,
    ],
    /** (region, enemy) */
    attackLost: [
        (region, enemy) =>
            `The assault on the ${enemy} at ${region} falters. The Ministry has retroactively scheduled this setback as a morale exercise.`,
        (region, enemy) =>
            `The push on ${region} stalls before the ${enemy}. The Ministry reclassifies the advance as a "strategic pause."`,
    ],
    /** (region, enemy) */
    defendWon: [
        (region, enemy) =>
            `${region} holds against the ${enemy}. The Ministry credits its own foresight and nothing else.`,
        (region, enemy) =>
            `${region} repels the ${enemy}. The Ministry notes the outcome was never in doubt, and never will have been.`,
    ],
    /** (region, enemy) */
    defendLost: [
        (region, enemy) =>
            `${region} falls to the ${enemy}. The Ministry reminds citizens that a region lost is merely a region awaiting glorious recapture.`,
        (region, enemy) =>
            `The ${enemy} take ${region}. The Ministry has redrawn the map; the region was always optional.`,
    ],
    /** (attribution) — attribution is '' or a leading-space sentence */
    victory: [
        (attribution) =>
            `The war is won. Super Earth stands victorious — managed democracy prevails, exactly as the Ministry always knew it would.${attribution}`,
        (attribution) =>
            `Victory. Super Earth endures, and the Ministry's confidence is retroactively vindicated in full.${attribution}`,
    ],
    /** (enemy) */
    defeat: [
        (enemy) =>
            `Super Earth falls. The ${enemy} have won. The Ministry assures surviving citizens that this defeat was both temporary and, in hindsight, inspirational.`,
        (enemy) =>
            `The ${enemy} prevail. The Ministry has filed Super Earth's defeat under "aggressive rebranding opportunity."`,
    ],
    defeatGeneric: [
        () =>
            'The war is lost. The Ministry has classified the outcome as a strategic reposition and recommends citizens look forward, never back.',
        () =>
            'The war is lost. The Ministry asks only that citizens remember the version of events it will provide shortly.',
    ],
    /** (n) — formatted player count */
    surge: [
        (n) => `The Helldivers rally — deployments surge to ${n}.`,
        (n) => `Recruitment spikes; ${n} citizens answer the call at once.`,
    ],
    /** (n) — formatted player count */
    collapse: [
        (n) => `The front grows quiet; deployments thin to ${n}.`,
        (n) => `Mobilization wanes — only ${n} remain on the line.`,
    ],
    /** (enemy) */
    breakthrough: [
        (enemy) =>
            `The ${enemy} are driven to the gates of their homeworld — the assault begins.`,
        (enemy) =>
            `Super Earth reaches the ${enemy} homeworld; the final push is at hand.`,
    ],
    /** (enemy) */
    homeworldFalls: [
        (enemy) => `The ${enemy} homeworld falls — the first front is won.`,
        (enemy) => `The ${enemy} are routed to extinction; the first homeworld is taken.`,
    ],
    /** (kills, missions, accidentals) — all pre-formatted strings */
    numbers: [
        (kills, missions, accidentals) =>
            `By the numbers: ${kills} exterminated across ${missions} missions; ${accidentals} citizens met managed democracy ahead of schedule.`,
        (kills, missions, accidentals) =>
            `The ledger of war: ${kills} enemy dead, ${missions} missions run, and ${accidentals} friendly-fire commendations issued posthumously.`,
    ],
};
