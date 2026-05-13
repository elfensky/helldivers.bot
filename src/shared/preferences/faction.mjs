export const FACTION_KEY = 'hd1-faction';
export const FACTION_DEFAULT = 'global';

const VALID = new Set(['global', 'bugs', 'cyborgs', 'illuminate']);

export function validateFaction(value) {
    return VALID.has(value) ? value : FACTION_DEFAULT;
}
