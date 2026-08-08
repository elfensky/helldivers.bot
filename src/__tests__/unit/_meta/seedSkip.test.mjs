import { describe, expect, test } from 'vitest';
import { pendingSeasonFiles, seasonFromFilename } from '../../../../prisma/seed/seed.mjs';

// Repo tooling rather than app code, so it lives in _meta — prisma/ is not one
// of the mirror-tree roots. The logic under test decides whether a deploy
// rewrites 159 seasons or writes the one that is actually new.
describe('seasonFromFilename', () => {
    test('reads the season out of the padded filename', () => {
        expect(seasonFromFilename('season-001.json')).toBe(1);
        expect(seasonFromFilename('season-159.json')).toBe(159);
    });

    test('returns null for anything that is not a season file', () => {
        expect(seasonFromFilename('readme.md')).toBeNull();
        expect(seasonFromFilename('season-.json')).toBeNull();
        expect(seasonFromFilename('season-12.json.bak')).toBeNull();
    });
});

describe('pendingSeasonFiles', () => {
    const FILES = ['season-001.json', 'season-002.json', 'season-003.json'];

    test('returns only the seasons missing from the database', () => {
        expect(pendingSeasonFiles(FILES, new Set([1, 2]))).toEqual(['season-003.json']);
    });

    test('returns nothing when every season is present', () => {
        expect(pendingSeasonFiles(FILES, new Set([1, 2, 3]))).toEqual([]);
    });

    // The old count check compared h1_season.count() against the file count, so
    // a database holding the 3 seed seasons PLUS an on-demand backfill of 160
    // had 4 rows against 3 files, and re-seeded all three.
    test('extra seasons in the database do not trigger a re-seed', () => {
        expect(pendingSeasonFiles(FILES, new Set([1, 2, 3, 160]))).toEqual([]);
    });

    // The same count check re-seeded everything whenever one file was added,
    // which is exactly what the weekly seed-refresh workflow does.
    test('adding one file seeds one season, not all of them', () => {
        const grown = [...FILES, 'season-004.json'];

        expect(pendingSeasonFiles(grown, new Set([1, 2, 3]))).toEqual([
            'season-004.json',
        ]);
    });

    // A count match could also hide a genuinely missing season: 3 rows, 3
    // files, but the rows are for different seasons than the files.
    test('a matching count with the wrong seasons still seeds', () => {
        expect(pendingSeasonFiles(FILES, new Set([1, 2, 999]))).toEqual([
            'season-003.json',
        ]);
    });

    test('seeds files whose name does not encode a season', () => {
        expect(pendingSeasonFiles(['odd-name.json'], new Set([1]))).toEqual([
            'odd-name.json',
        ]);
    });
});
