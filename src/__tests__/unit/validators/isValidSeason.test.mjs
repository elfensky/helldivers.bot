import { isValidSeason } from '@/validators/isValidSeason.mjs';

const makeSnapshot = (overrides = {}) => ({
    season: 1,
    time: 1700000000,
    data: JSON.stringify([{ points: 100, points_taken: 50, status: 'active' }]),
    ...overrides,
});

const makeDefendEvent = (overrides = {}) => ({
    season: 1,
    event_id: 1,
    start_time: 1700000000,
    end_time: 1700003600,
    enemy: 2,
    points_max: 1000,
    points: 500,
    status: 'success',
    players_at_start: 100,
    region: 5,
    ...overrides,
});

const makeAttackEvent = (overrides = {}) => {
    const { region, ...base } = makeDefendEvent(overrides);
    return { ...base, ...overrides };
};

const makeValidSeason = (overrides = {}) => ({
    time: 1700000000,
    error_code: 0,
    introduction_order: [1, 2, 3],
    points_max: [1000, 2000, 3000],
    snapshots: [makeSnapshot()],
    defend_events: [makeDefendEvent()],
    attack_events: [makeAttackEvent({ region: undefined })],
    ...overrides,
});

describe('isValidSeason', () => {
    test('accepts valid season data', () => {
        const result = isValidSeason(makeValidSeason());
        expect(result.success).toBe(true);
    });

    test('accepts empty arrays for events and snapshots', () => {
        const result = isValidSeason(
            makeValidSeason({
                snapshots: [],
                defend_events: [],
                attack_events: [],
            }),
        );
        expect(result.success).toBe(true);
    });

    describe('top-level fields', () => {
        test('rejects missing time', () => {
            const { time, ...rest } = makeValidSeason();
            expect(isValidSeason(rest).success).toBe(false);
        });

        test('rejects missing error_code', () => {
            const { error_code, ...rest } = makeValidSeason();
            expect(isValidSeason(rest).success).toBe(false);
        });

        test('rejects non-number introduction_order elements', () => {
            const result = isValidSeason(
                makeValidSeason({ introduction_order: ['a', 'b'] }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('snapshots', () => {
        test('rejects invalid snapshot data JSON', () => {
            const result = isValidSeason(
                makeValidSeason({
                    snapshots: [makeSnapshot({ data: 'not json' })],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects snapshot data with invalid status', () => {
            const result = isValidSeason(
                makeValidSeason({
                    snapshots: [
                        makeSnapshot({
                            data: JSON.stringify([
                                { points: 100, points_taken: 50, status: 'invalid' },
                            ]),
                        }),
                    ],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts all valid statuses in snapshot data', () => {
            for (const status of ['hidden', 'active', 'defeated']) {
                const result = isValidSeason(
                    makeValidSeason({
                        snapshots: [
                            makeSnapshot({
                                data: JSON.stringify([
                                    { points: 100, points_taken: 50, status },
                                ]),
                            }),
                        ],
                    }),
                );
                expect(result.success).toBe(true);
            }
        });

        test('rejects snapshot with missing season', () => {
            const result = isValidSeason(
                makeValidSeason({
                    snapshots: [makeSnapshot({ season: undefined })],
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('defend_events', () => {
        test('rejects defend_event without region', () => {
            const event = makeDefendEvent();
            delete event.region;
            const result = isValidSeason(
                makeValidSeason({ defend_events: [event] }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects defend_event with invalid status', () => {
            const result = isValidSeason(
                makeValidSeason({
                    defend_events: [makeDefendEvent({ status: 'active' })],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts fail and success statuses', () => {
            for (const status of ['fail', 'success']) {
                const result = isValidSeason(
                    makeValidSeason({
                        defend_events: [makeDefendEvent({ status })],
                    }),
                );
                expect(result.success).toBe(true);
            }
        });
    });

    describe('attack_events', () => {
        test('rejects attack_event with region', () => {
            const result = isValidSeason(
                makeValidSeason({
                    attack_events: [makeAttackEvent({ region: 5 })],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts attack_event without region', () => {
            const event = makeDefendEvent();
            delete event.region;
            const result = isValidSeason(
                makeValidSeason({ attack_events: [event] }),
            );
            expect(result.success).toBe(true);
        });
    });

    describe('edge cases', () => {
        test('rejects null', () => {
            expect(isValidSeason(null).success).toBe(false);
        });

        test('rejects undefined', () => {
            expect(isValidSeason(undefined).success).toBe(false);
        });

        test('rejects empty object', () => {
            expect(isValidSeason({}).success).toBe(false);
        });

        test('rejects string', () => {
            expect(isValidSeason('not an object').success).toBe(false);
        });
    });
});
