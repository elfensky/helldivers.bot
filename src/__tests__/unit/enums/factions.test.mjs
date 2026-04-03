import factions from '@/enums/factions.mjs';

describe('factions enum', () => {
    test('has exactly 4 faction keys (0-3)', () => {
        const keys = Object.keys(factions);
        expect(keys).toHaveLength(4);
        expect(keys).toEqual(['0', '1', '2', '3']);
    });

    test('each faction has name, icon, and url strings', () => {
        for (const key of Object.keys(factions)) {
            const faction = factions[key];
            expect(typeof faction.name).toBe('string');
            expect(typeof faction.icon).toBe('string');
            expect(typeof faction.url).toBe('string');
            expect(faction.name.length).toBeGreaterThan(0);
            expect(faction.icon.length).toBeGreaterThan(0);
            expect(faction.url.length).toBeGreaterThan(0);
        }
    });

    test('icon paths follow /icons/factionN.webp pattern', () => {
        for (const key of Object.keys(factions)) {
            expect(factions[key].icon).toBe(`/icons/faction${key}.webp`);
        }
    });

    test('urls point to helldivers wiki', () => {
        for (const key of Object.keys(factions)) {
            expect(factions[key].url).toMatch(/^https:\/\/helldivers\.wiki\.gg\/wiki\//);
        }
    });

    test('faction names match expected values', () => {
        expect(factions[0].name).toBe('Bugs');
        expect(factions[1].name).toBe('Cyborgs');
        expect(factions[2].name).toBe('The Illuminate');
        expect(factions[3].name).toBe('Federation of Super Earth');
    });
});
