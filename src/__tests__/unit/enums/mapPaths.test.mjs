import {
    viewBox,
    bugPaths,
    cyborgPaths,
    illuminatePaths,
    superEarthCircle,
    sectorCentroids,
    factionIcons,
} from '@/enums/mapPaths.mjs';

describe('mapPaths enum', () => {
    describe('viewBox', () => {
        test('is a valid SVG viewBox string', () => {
            expect(typeof viewBox).toBe('string');
            expect(viewBox).toMatch(/^\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?\s+\d+(\.\d+)?$/);
        });
    });

    describe('faction path arrays', () => {
        test('bugPaths has 11 sectors', () => {
            expect(bugPaths).toHaveLength(11);
        });

        test('cyborgPaths has 11 sectors', () => {
            expect(cyborgPaths).toHaveLength(11);
        });

        test('illuminatePaths has 11 sectors', () => {
            expect(illuminatePaths).toHaveLength(11);
        });

        test.each([
            ['bugPaths', bugPaths, '0'],
            ['cyborgPaths', cyborgPaths, '1'],
            ['illuminatePaths', illuminatePaths, '2'],
        ])('%s entries have id, sector, and d properties', (_name, paths, prefix) => {
            for (const path of paths) {
                expect(typeof path.id).toBe('string');
                expect(path.id).toMatch(new RegExp(`^${prefix}-\\d+$`));
                expect(typeof path.sector).toBe('number');
                expect(path.sector).toBeGreaterThanOrEqual(1);
                expect(path.sector).toBeLessThanOrEqual(11);
                expect(typeof path.d).toBe('string');
                expect(path.d.length).toBeGreaterThan(0);
            }
        });

        test('sector numbers are sequential 1-11 for each faction', () => {
            for (const paths of [bugPaths, cyborgPaths, illuminatePaths]) {
                const sectors = paths.map((p) => p.sector);
                expect(sectors).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
            }
        });
    });

    describe('superEarthCircle', () => {
        test('has id, cx, cy, and r properties', () => {
            expect(superEarthCircle.id).toBe('3-0');
            expect(typeof superEarthCircle.cx).toBe('number');
            expect(typeof superEarthCircle.cy).toBe('number');
            expect(typeof superEarthCircle.r).toBe('number');
        });
    });

    describe('sectorCentroids', () => {
        test('has entries for all 4 factions', () => {
            expect(Object.keys(sectorCentroids)).toEqual(['0', '1', '2', '3']);
        });

        test('factions 0-2 have centroids for sectors 1-11', () => {
            for (const factionId of [0, 1, 2]) {
                const sectors = Object.keys(sectorCentroids[factionId]);
                expect(sectors).toHaveLength(11);
            }
        });

        test('faction 3 has only sector 0', () => {
            expect(Object.keys(sectorCentroids[3])).toEqual(['0']);
        });

        test('each centroid has numeric x and y', () => {
            for (const factionId of Object.keys(sectorCentroids)) {
                for (const sectorId of Object.keys(sectorCentroids[factionId])) {
                    const centroid = sectorCentroids[factionId][sectorId];
                    expect(typeof centroid.x).toBe('number');
                    expect(typeof centroid.y).toBe('number');
                }
            }
        });
    });

    describe('factionIcons', () => {
        test('has 4 icon entries', () => {
            expect(factionIcons).toHaveLength(4);
        });

        test('each icon has id, href, x, y, width, and height', () => {
            for (const icon of factionIcons) {
                expect(typeof icon.id).toBe('string');
                expect(typeof icon.href).toBe('string');
                expect(typeof icon.x).toBe('number');
                expect(typeof icon.y).toBe('number');
                expect(typeof icon.width).toBe('number');
                expect(typeof icon.height).toBe('number');
            }
        });

        test('hrefs point to webp icon files', () => {
            for (const icon of factionIcons) {
                expect(icon.href).toMatch(/^\/icons\/\w+\.webp$/);
            }
        });
    });
});
