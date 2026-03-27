import { isValidStatus } from '@/validators/isValidStatus.mjs';

const makeCampaignStatus = (overrides = {}) => ({
    season: 1,
    points: 500,
    points_taken: 250,
    points_max: 1000,
    status: 'active',
    introduction_order: 1,
    ...overrides,
});

const makeDefendEvent = (overrides = {}) => ({
    season: 1,
    event_id: 10,
    start_time: 1700000000,
    end_time: 1700003600,
    region: 3,
    enemy: 2,
    points_max: 1000,
    points: 500,
    status: 'active',
    ...overrides,
});

const makeAttackEvent = (overrides = {}) => ({
    season: 1,
    event_id: 20,
    start_time: 1700000000,
    end_time: 1700003600,
    enemy: 1,
    points_max: 2000,
    points: 800,
    status: 'active',
    players_at_start: 150,
    max_event_id: 25,
    ...overrides,
});

const makeStatistics = (overrides = {}) => ({
    season: 1,
    season_duration: 86400,
    enemy: 2,
    players: 1000,
    total_unique_players: 5000,
    missions: 10000,
    successful_missions: 8000,
    total_mission_difficulty: 50000,
    completed_planets: 5,
    defend_events: 10,
    successful_defend_events: 7,
    attack_events: 15,
    successful_attack_events: 12,
    deaths: 50000,
    kills: 200000,
    accidentals: 5000,
    shots: 1000000,
    hits: 600000,
    ...overrides,
});

const makeValidStatus = (overrides = {}) => ({
    time: 1700000000,
    error_code: 0,
    campaign_status: [makeCampaignStatus()],
    defend_event: makeDefendEvent(),
    attack_events: [makeAttackEvent()],
    statistics: [makeStatistics()],
    ...overrides,
});

describe('isValidStatus', () => {
    test('accepts valid status data', () => {
        const result = isValidStatus(makeValidStatus());
        expect(result.success).toBe(true);
    });

    test('accepts null defend_event', () => {
        const result = isValidStatus(makeValidStatus({ defend_event: null }));
        expect(result.success).toBe(true);
    });

    test('accepts empty arrays', () => {
        const result = isValidStatus(
            makeValidStatus({
                campaign_status: [],
                attack_events: [],
                statistics: [],
            }),
        );
        expect(result.success).toBe(true);
    });

    describe('time validation', () => {
        test('rejects time below minimum (1000000000)', () => {
            const result = isValidStatus(makeValidStatus({ time: 999999999 }));
            expect(result.success).toBe(false);
        });

        test('rejects time above maximum (2000000000)', () => {
            const result = isValidStatus(makeValidStatus({ time: 2000000001 }));
            expect(result.success).toBe(false);
        });

        test('rejects non-integer time', () => {
            const result = isValidStatus(makeValidStatus({ time: 1700000000.5 }));
            expect(result.success).toBe(false);
        });

        test('accepts boundary values', () => {
            expect(isValidStatus(makeValidStatus({ time: 1000000000 })).success).toBe(
                true,
            );
            expect(isValidStatus(makeValidStatus({ time: 2000000000 })).success).toBe(
                true,
            );
        });
    });

    describe('campaign_status', () => {
        test('rejects invalid status enum', () => {
            const result = isValidStatus(
                makeValidStatus({
                    campaign_status: [makeCampaignStatus({ status: 'unknown' })],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts all valid statuses', () => {
            for (const status of ['active', 'defeated', 'hidden']) {
                const result = isValidStatus(
                    makeValidStatus({
                        campaign_status: [makeCampaignStatus({ status })],
                    }),
                );
                expect(result.success).toBe(true);
            }
        });

        test('rejects missing required field', () => {
            const { points_max, ...incomplete } = makeCampaignStatus();
            const result = isValidStatus(
                makeValidStatus({ campaign_status: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('defend_event', () => {
        test('rejects invalid status', () => {
            const result = isValidStatus(
                makeValidStatus({
                    defend_event: makeDefendEvent({ status: 'unknown' }),
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts all valid statuses', () => {
            for (const status of ['active', 'success', 'fail']) {
                const result = isValidStatus(
                    makeValidStatus({
                        defend_event: makeDefendEvent({ status }),
                    }),
                );
                expect(result.success).toBe(true);
            }
        });

        test('rejects missing region', () => {
            const { region, ...noRegion } = makeDefendEvent();
            const result = isValidStatus(
                makeValidStatus({ defend_event: noRegion }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('attack_events', () => {
        test('rejects missing players_at_start', () => {
            const { players_at_start, ...incomplete } = makeAttackEvent();
            const result = isValidStatus(
                makeValidStatus({ attack_events: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects missing max_event_id', () => {
            const { max_event_id, ...incomplete } = makeAttackEvent();
            const result = isValidStatus(
                makeValidStatus({ attack_events: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('statistics', () => {
        test('rejects missing required field', () => {
            const { kills, ...incomplete } = makeStatistics();
            const result = isValidStatus(
                makeValidStatus({ statistics: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects string value for numeric field', () => {
            const result = isValidStatus(
                makeValidStatus({
                    statistics: [makeStatistics({ players: 'many' })],
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('rejects null', () => {
            expect(isValidStatus(null).success).toBe(false);
        });

        test('rejects undefined', () => {
            expect(isValidStatus(undefined).success).toBe(false);
        });

        test('rejects empty object', () => {
            expect(isValidStatus({}).success).toBe(false);
        });

        test('rejects missing top-level fields', () => {
            const { campaign_status, ...rest } = makeValidStatus();
            expect(isValidStatus(rest).success).toBe(false);
        });

        test('rejects non-object types', () => {
            expect(isValidStatus('string').success).toBe(false);
            expect(isValidStatus(42).success).toBe(false);
            expect(isValidStatus([]).success).toBe(false);
        });
    });
});
