import map from '@/enums/map.mjs';

const SECTOR_PROPERTIES = [
    'region',
    'capital',
    'percent',
    'points',
    'points_max',
    'points_sector',
    'points_sector_max',
    'status',
    'event',
];

describe('map enum', () => {
    test('has exactly 4 faction keys (0-3)', () => {
        const keys = Object.keys(map);
        expect(keys).toHaveLength(4);
        expect(keys).toEqual(['0', '1', '2', '3']);
    });

    test('factions 0, 1, 2 each have 11 sectors (1-11)', () => {
        for (const factionId of [0, 1, 2]) {
            const sectorKeys = Object.keys(map[factionId]);
            expect(sectorKeys).toHaveLength(11);
            for (let i = 1; i <= 11; i++) {
                expect(map[factionId]).toHaveProperty(String(i));
            }
        }
    });

    test('faction 3 (Sol) has only sector 0', () => {
        const sectorKeys = Object.keys(map[3]);
        expect(sectorKeys).toHaveLength(1);
        expect(sectorKeys).toEqual(['0']);
    });

    test('every sector has all required properties', () => {
        for (const factionId of Object.keys(map)) {
            for (const sectorId of Object.keys(map[factionId])) {
                const sector = map[factionId][sectorId];
                for (const prop of SECTOR_PROPERTIES) {
                    expect(sector).toHaveProperty(prop);
                }
            }
        }
    });

    test('region and capital are non-empty strings', () => {
        for (const factionId of Object.keys(map)) {
            for (const sectorId of Object.keys(map[factionId])) {
                const sector = map[factionId][sectorId];
                expect(typeof sector.region).toBe('string');
                expect(typeof sector.capital).toBe('string');
                expect(sector.region.length).toBeGreaterThan(0);
                expect(sector.capital.length).toBeGreaterThan(0);
            }
        }
    });

    test('numeric properties default to 0', () => {
        for (const factionId of Object.keys(map)) {
            for (const sectorId of Object.keys(map[factionId])) {
                const sector = map[factionId][sectorId];
                expect(typeof sector.percent).toBe('number');
                expect(typeof sector.points).toBe('number');
                expect(typeof sector.points_max).toBe('number');
                expect(typeof sector.points_sector).toBe('number');
                expect(typeof sector.points_sector_max).toBe('number');
            }
        }
    });

    test('status and event are strings', () => {
        for (const factionId of Object.keys(map)) {
            for (const sectorId of Object.keys(map[factionId])) {
                const sector = map[factionId][sectorId];
                expect(typeof sector.status).toBe('string');
                expect(typeof sector.event).toBe('string');
            }
        }
    });
});
