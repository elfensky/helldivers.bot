import { isValidStatus } from '@/validators/isValidStatus.mjs';
import {
    makeCampaignStatus,
    makeStatusDefendEvent as makeDefendEvent,
    makeStatusAttackEvent as makeAttackEvent,
    makeStatistics,
    makeValidStatus,
} from '@test-utils/hd1.mjs';

describe('isValidStatus', () => {
    test('accepts valid status data', () => {
        const result = isValidStatus.safeParse(makeValidStatus());
        expect(result.success).toBe(true);
    });

    test('accepts null defend_event', () => {
        const result = isValidStatus.safeParse(makeValidStatus({ defend_event: null }));
        expect(result.success).toBe(true);
    });

    test('accepts empty attack_events array', () => {
        // attack_events is allowed to be empty (the API returns lagged entries
        // from old seasons but also sometimes returns nothing). campaign_status
        // and statistics, however, must always be non-empty — see the rejection
        // tests below. This is enforced so getSeasonFromStatus always has a
        // reliable current-season signal.
        const result = isValidStatus.safeParse(makeValidStatus({ attack_events: [] }));
        expect(result.success).toBe(true);
    });

    test('rejects empty campaign_status', () => {
        const result = isValidStatus.safeParse(makeValidStatus({ campaign_status: [] }));
        expect(result.success).toBe(false);
    });

    test('rejects campaign_status with fewer than 3 factions', () => {
        const result = isValidStatus.safeParse({
            ...makeValidStatus(),
            campaign_status: [makeCampaignStatus()],
        });
        expect(result.success).toBe(false);
    });

    test('rejects campaign_status with more than 3 factions', () => {
        const result = isValidStatus.safeParse({
            ...makeValidStatus(),
            campaign_status: [
                makeCampaignStatus({ introduction_order: 0 }),
                makeCampaignStatus({ introduction_order: 1 }),
                makeCampaignStatus({ introduction_order: 2 }),
                makeCampaignStatus({ introduction_order: 3 }),
            ],
        });
        expect(result.success).toBe(false);
    });

    test('rejects empty statistics', () => {
        const result = isValidStatus.safeParse(makeValidStatus({ statistics: [] }));
        expect(result.success).toBe(false);
    });

    test('rejects statistics with fewer than 3 factions', () => {
        const result = isValidStatus.safeParse({
            ...makeValidStatus(),
            statistics: [makeStatistics({ enemy: 0 })],
        });
        expect(result.success).toBe(false);
    });

    test('rejects statistics with more than 3 factions', () => {
        const result = isValidStatus.safeParse({
            ...makeValidStatus(),
            statistics: [
                makeStatistics({ enemy: 0 }),
                makeStatistics({ enemy: 1 }),
                makeStatistics({ enemy: 2 }),
                makeStatistics({ enemy: 3 }),
            ],
        });
        expect(result.success).toBe(false);
    });

    describe('time validation', () => {
        test('rejects time below minimum (1000000000)', () => {
            const result = isValidStatus.safeParse(makeValidStatus({ time: 999999999 }));
            expect(result.success).toBe(false);
        });

        test('rejects time above maximum (2000000000)', () => {
            const result = isValidStatus.safeParse(makeValidStatus({ time: 2000000001 }));
            expect(result.success).toBe(false);
        });

        test('rejects non-integer time', () => {
            const result = isValidStatus.safeParse(
                makeValidStatus({ time: 1700000000.5 }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts boundary values', () => {
            expect(
                isValidStatus.safeParse(makeValidStatus({ time: 1000000000 })).success,
            ).toBe(true);
            expect(
                isValidStatus.safeParse(makeValidStatus({ time: 2000000000 })).success,
            ).toBe(true);
        });
    });

    describe('campaign_status', () => {
        test('rejects invalid status enum', () => {
            const result = isValidStatus.safeParse(
                makeValidStatus({
                    campaign_status: [makeCampaignStatus({ status: 'unknown' })],
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts all valid statuses', () => {
            for (const status of ['active', 'defeated', 'hidden']) {
                const result = isValidStatus.safeParse(
                    makeValidStatus({
                        campaign_status: [
                            makeCampaignStatus({ introduction_order: 0, status }),
                            makeCampaignStatus({ introduction_order: 1, status }),
                            makeCampaignStatus({ introduction_order: 2, status }),
                        ],
                    }),
                );
                expect(result.success).toBe(true);
            }
        });

        test('rejects missing required field', () => {
            const { points_max: _points_max, ...incomplete } = makeCampaignStatus();
            const result = isValidStatus.safeParse(
                makeValidStatus({ campaign_status: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('defend_event', () => {
        test('rejects invalid status', () => {
            const result = isValidStatus.safeParse(
                makeValidStatus({
                    defend_event: makeDefendEvent({ status: 'unknown' }),
                }),
            );
            expect(result.success).toBe(false);
        });

        test('accepts all valid statuses', () => {
            for (const status of ['active', 'success', 'fail']) {
                const result = isValidStatus.safeParse(
                    makeValidStatus({
                        defend_event: makeDefendEvent({ status }),
                    }),
                );
                expect(result.success).toBe(true);
            }
        });

        test('rejects missing region', () => {
            const { region: _region, ...noRegion } = makeDefendEvent();
            const result = isValidStatus.safeParse(
                makeValidStatus({ defend_event: noRegion }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('attack_events', () => {
        test('rejects missing players_at_start', () => {
            const { players_at_start: _players_at_start, ...incomplete } =
                makeAttackEvent();
            const result = isValidStatus.safeParse(
                makeValidStatus({ attack_events: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects missing max_event_id', () => {
            const { max_event_id: _max_event_id, ...incomplete } = makeAttackEvent();
            const result = isValidStatus.safeParse(
                makeValidStatus({ attack_events: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('statistics', () => {
        test('rejects missing required field', () => {
            const { kills: _kills, ...incomplete } = makeStatistics();
            const result = isValidStatus.safeParse(
                makeValidStatus({ statistics: [incomplete] }),
            );
            expect(result.success).toBe(false);
        });

        test('rejects string value for numeric field', () => {
            const result = isValidStatus.safeParse(
                makeValidStatus({
                    statistics: [makeStatistics({ players: 'many' })],
                }),
            );
            expect(result.success).toBe(false);
        });
    });

    describe('edge cases', () => {
        test('rejects null', () => {
            expect(isValidStatus.safeParse(null).success).toBe(false);
        });

        test('rejects undefined', () => {
            expect(isValidStatus.safeParse(undefined).success).toBe(false);
        });

        test('rejects empty object', () => {
            expect(isValidStatus.safeParse({}).success).toBe(false);
        });

        test('rejects missing top-level fields', () => {
            const { campaign_status: _campaign_status, ...rest } = makeValidStatus();
            expect(isValidStatus.safeParse(rest).success).toBe(false);
        });

        test('rejects non-object types', () => {
            expect(isValidStatus.safeParse('string').success).toBe(false);
            expect(isValidStatus.safeParse(42).success).toBe(false);
            expect(isValidStatus.safeParse([]).success).toBe(false);
        });
    });
});
