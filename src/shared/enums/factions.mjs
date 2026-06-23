const factions = {
    0: {
        name: 'Bugs',
        icon: '/icons/faction0.webp',
        url: 'https://helldivers.wiki.gg/wiki/Helldivers_1:Bugs',
    },
    1: {
        name: 'Cyborgs',
        icon: '/icons/faction1.webp',
        url: 'https://helldivers.wiki.gg/wiki/Helldivers_1:Cyborgs',
    },
    2: {
        name: 'The Illuminate',
        icon: '/icons/faction2.webp',
        url: 'https://helldivers.wiki.gg/wiki/Helldivers_1:The_Illuminate',
    },
    3: {
        name: 'Federation of Super Earth',
        icon: '/icons/faction3.webp',
        url: 'https://helldivers.wiki.gg/wiki/Helldivers_1:Federation_of_Super_Earth',
    },
};
export default factions;

export const FACTION_INDEX = { bugs: 0, cyborgs: 1, illuminate: 2 };

/**
 * Reverse of {@link FACTION_INDEX}: faction id → lowercase slug. The public API
 * exposes the slug (`bugs`/`cyborgs`/`illuminate`) instead of the raw enemy id.
 *
 * @type {Record<number, 'bugs' | 'cyborgs' | 'illuminate'>}
 */
export const FACTION_SLUG_BY_ID = Object.freeze(
    /** @type {Record<number, 'bugs' | 'cyborgs' | 'illuminate'>} */ (
        Object.fromEntries(Object.entries(FACTION_INDEX).map(([slug, id]) => [id, slug]))
    ),
);

/**
 * Faction slug → enemy id. Inverse of {@link FACTION_SLUG_BY_ID}; the public API
 * accepts the slug while the DB stores the id.
 *
 * @param {string} enemy - Faction slug (`bugs`/`cyborgs`/`illuminate`).
 * @returns {number} faction id.
 */
export function enemyIdFromSlug(enemy) {
    return FACTION_INDEX[enemy];
}
