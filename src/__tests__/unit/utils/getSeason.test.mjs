import { vi } from 'vitest';
import { getSeasonFromStatus, getSeasonFromSnapshot } from '@/utils/getSeason.mjs';

describe('getSeasonFromStatus', () => {
    test('extracts season from consistent status data', () => {
        const data = {
            campaign_status: [{ season: 5 }, { season: 5 }],
            defend_event: { season: 5 },
            statistics: [{ season: 5 }],
        };
        expect(getSeasonFromStatus(data)).toBe(5);
    });

    test('extracts season from campaign_status alone', () => {
        const data = {
            campaign_status: [{ season: 3 }],
            defend_event: null,
            statistics: [],
        };
        expect(getSeasonFromStatus(data)).toBe(3);
    });

    test('extracts season from statistics alone', () => {
        const data = {
            campaign_status: [],
            defend_event: null,
            statistics: [{ season: 7 }],
        };
        expect(getSeasonFromStatus(data)).toBe(7);
    });

    test('extracts season from defend_event alone', () => {
        const data = {
            campaign_status: [],
            defend_event: { season: 2 },
            statistics: [],
        };
        expect(getSeasonFromStatus(data)).toBe(2);
    });

    test('handles string season numbers by coercing to number', () => {
        const data = {
            campaign_status: [{ season: '4' }],
            statistics: [],
        };
        expect(getSeasonFromStatus(data)).toBe(4);
    });

    test('warns but returns first season when multiple seasons present', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const data = {
            campaign_status: [{ season: 5 }, { season: 6 }],
            statistics: [],
        };
        const result = getSeasonFromStatus(data);
        expect(result).toBe(5);
        expect(warnSpy).toHaveBeenCalledWith(
            'Multiple seasons present in status data',
            expect.any(Array),
        );
        warnSpy.mockRestore();
    });

    test('throws when data is null', () => {
        expect(() => getSeasonFromStatus(null)).toThrow('status is missing');
    });

    test('throws when data is undefined', () => {
        expect(() => getSeasonFromStatus(undefined)).toThrow('status is missing');
    });

    test('throws when no seasons found', () => {
        const data = {
            campaign_status: [],
            defend_event: null,
            statistics: [],
        };
        expect(() => getSeasonFromStatus(data)).toThrow(
            'No seasons found in status data',
        );
    });

    test('throws when season is not a valid number', () => {
        const data = {
            campaign_status: [{ season: 'abc' }],
            statistics: [],
        };
        expect(() => getSeasonFromStatus(data)).toThrow('Invalid Current Season');
    });

    test('throws when season is negative', () => {
        const data = {
            campaign_status: [{ season: -1 }],
            statistics: [],
        };
        expect(() => getSeasonFromStatus(data)).toThrow('Invalid Current Season');
    });

    test('throws when season is zero', () => {
        const data = {
            campaign_status: [{ season: 0 }],
            statistics: [],
        };
        expect(() => getSeasonFromStatus(data)).toThrow('Invalid Current Season');
    });

    test('handles missing optional arrays gracefully', () => {
        const data = {
            // campaign_status and statistics default to []
        };
        expect(() => getSeasonFromStatus(data)).toThrow(
            'No seasons found in status data',
        );
    });
});

describe('getSeasonFromSnapshot', () => {
    test('extracts season from consistent snapshot data', () => {
        const data = {
            snapshots: [{ season: 10 }, { season: 10 }],
            defend_events: [{ season: 10 }],
            attack_events: [{ season: 10 }],
        };
        expect(getSeasonFromSnapshot(data)).toBe(10);
    });

    test('extracts season from snapshots alone', () => {
        const data = {
            snapshots: [{ season: 8 }],
            defend_events: [],
            attack_events: [],
        };
        expect(getSeasonFromSnapshot(data)).toBe(8);
    });

    test('extracts season from defend_events alone', () => {
        const data = {
            snapshots: [],
            defend_events: [{ season: 3 }],
            attack_events: [],
        };
        expect(getSeasonFromSnapshot(data)).toBe(3);
    });

    test('extracts season from attack_events alone', () => {
        const data = {
            snapshots: [],
            defend_events: [],
            attack_events: [{ season: 6 }],
        };
        expect(getSeasonFromSnapshot(data)).toBe(6);
    });

    test('warns but returns first season when multiple seasons present', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const data = {
            snapshots: [{ season: 5 }],
            defend_events: [{ season: 6 }],
            attack_events: [],
        };
        const result = getSeasonFromSnapshot(data);
        expect(result).toBe(5);
        expect(warnSpy).toHaveBeenCalled();
        warnSpy.mockRestore();
    });

    test('throws when data is null', () => {
        expect(() => getSeasonFromSnapshot(null)).toThrow('snapshot is missing');
    });

    test('throws when data is undefined', () => {
        expect(() => getSeasonFromSnapshot(undefined)).toThrow('snapshot is missing');
    });

    test('throws when no seasons found', () => {
        const data = {
            snapshots: [],
            defend_events: [],
            attack_events: [],
        };
        expect(() => getSeasonFromSnapshot(data)).toThrow(
            'No seasons found in snapshot data',
        );
    });

    test('throws when season is not a valid number', () => {
        const data = {
            snapshots: [{ season: null }],
            defend_events: [],
            attack_events: [],
        };
        expect(() => getSeasonFromSnapshot(data)).toThrow('Invalid Current Season');
    });

    test('handles string season numbers', () => {
        const data = {
            snapshots: [{ season: '12' }],
            defend_events: [],
            attack_events: [],
        };
        expect(getSeasonFromSnapshot(data)).toBe(12);
    });
});
