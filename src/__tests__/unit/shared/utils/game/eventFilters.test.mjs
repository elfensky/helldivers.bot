import {
    getActiveEvents,
    sortEventsByRecent,
    countOutcomes,
} from '@/shared/utils/game/eventFilters.mjs';

describe('getActiveEvents', () => {
    test('filters to only status active', () => {
        const events = [
            { id: 1, status: 'active' },
            { id: 2, status: 'success' },
            { id: 3, status: 'fail' },
            { id: 4, status: 'active' },
        ];
        expect(getActiveEvents(events)).toEqual([
            { id: 1, status: 'active' },
            { id: 4, status: 'active' },
        ]);
    });

    test('returns [] for null/undefined', () => {
        expect(getActiveEvents(null)).toEqual([]);
        expect(getActiveEvents(undefined)).toEqual([]);
    });
});

describe('sortEventsByRecent', () => {
    test('sorts by start_time descending', () => {
        const events = [
            { id: 1, start_time: 100 },
            { id: 2, start_time: 300 },
            { id: 3, start_time: 200 },
        ];
        expect(sortEventsByRecent(events).map((e) => e.id)).toEqual([2, 3, 1]);
    });

    test('does not mutate input', () => {
        const events = [
            { id: 1, start_time: 100 },
            { id: 2, start_time: 200 },
        ];
        const before = [...events];
        sortEventsByRecent(events);
        expect(events).toEqual(before);
    });
});

describe('countOutcomes', () => {
    test('counts success as wins and fail as losses', () => {
        const events = [{ status: 'success' }, { status: 'success' }, { status: 'fail' }];
        expect(countOutcomes(events)).toEqual({ wins: 2, losses: 1 });
    });

    test('ignores unknown statuses — no off-by-one, no loose matching', () => {
        const events = [
            { status: 'success' },
            { status: 'active' },
            { status: 'won' }, // NOT a valid DB status
            { status: 'lost' }, // NOT a valid DB status
            { status: 'SUCCESS' }, // case-sensitive — should NOT match
            { status: 'fail' },
        ];
        expect(countOutcomes(events)).toEqual({ wins: 1, losses: 1 });
    });

    test('handles empty array', () => {
        expect(countOutcomes([])).toEqual({ wins: 0, losses: 0 });
    });
});
