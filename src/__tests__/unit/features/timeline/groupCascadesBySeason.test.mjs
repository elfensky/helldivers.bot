import { describe, it, expect } from 'vitest';
import { groupCascadesBySeason } from '@/features/timeline/groupCascadesBySeason.mjs';

const c = (overrides) => ({
    season: 0,
    length: 3,
    factionIndex: 0,
    faction: 'Bugs',
    regions: [3, 2, 1],
    startTime: 0,
    endTime: 1000,
    durationSec: 1000,
    events: [],
    firstEvent: {},
    lastEvent: {},
    ...overrides,
});

describe('groupCascadesBySeason', () => {
    it('returns [] for empty input', () => {
        expect(groupCascadesBySeason([])).toEqual([]);
        expect(groupCascadesBySeason(null)).toEqual([]);
    });

    it('worst-first: orders groups by their worst cascade rank', () => {
        const input = [
            c({ season: 142, length: 4, endTime: 100 }),
            c({ season: 155, length: 9, endTime: 200 }),
            c({ season: 198, length: 6, endTime: 300 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'worst' });
        expect(groups.map((g) => g.season)).toEqual([155, 198, 142]);
    });

    it('recent-first: orders groups by season DESC', () => {
        const input = [
            c({ season: 142, length: 4 }),
            c({ season: 155, length: 9 }),
            c({ season: 198, length: 6 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'recent' });
        expect(groups.map((g) => g.season)).toEqual([198, 155, 142]);
    });

    it('keeps multi-cascade seasons grouped together', () => {
        const input = [
            c({ season: 198, length: 6, endTime: 100 }),
            c({ season: 155, length: 9, endTime: 200 }),
            c({ season: 198, length: 3, endTime: 300 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'worst' });
        const s198 = groups.find((g) => g.season === 198);
        expect(s198.cascades).toHaveLength(2);
        // Within group, longer first
        expect(s198.cascades[0].length).toBe(6);
        expect(s198.cascades[1].length).toBe(3);
    });

    it('within-group recent ordering uses endTime DESC', () => {
        const input = [
            c({ season: 198, length: 3, endTime: 100 }),
            c({ season: 198, length: 3, endTime: 300 }),
            c({ season: 198, length: 3, endTime: 200 }),
        ];
        const groups = groupCascadesBySeason(input, { sortOrder: 'recent' });
        expect(groups[0].cascades.map((c) => c.endTime)).toEqual([300, 200, 100]);
    });
});
