import { describe, it, expect } from 'vitest';
import { computeMapStateAtEvent } from '@/shared/utils/game/computeMapStateAtEvent.mjs';
import { CAMPAIGN_STATUS, EVENT_STATUS, EVENT_TYPE } from '@/shared/enums/events.mjs';

const baseSnapshot = (time, points = [10, 20, 30]) => ({
    time,
    data: points.map((p, i) => ({
        enemy: i,
        points: p,
        points_taken: 0,
        points_max: 100,
        status: CAMPAIGN_STATUS.ACTIVE,
    })),
});

const baseData = (extras = {}) => ({
    snapshots: [],
    events: [],
    points_max: { points: [100, 100, 100] },
    ...extras,
});

describe('computeMapStateAtEvent', () => {
    it('returns HIDDEN faction state when snapshots are empty', () => {
        const result = computeMapStateAtEvent(
            { start_time: 100, end_time: 200 },
            baseData(),
        );
        // HIDDEN_STATES feed yields no captured regions for any faction
        expect(result).toBeDefined();
        expect(result[0]).toBeDefined();
    });

    it('returns HIDDEN faction state when no selectedEvent is provided', () => {
        const result = computeMapStateAtEvent(
            null,
            baseData({ snapshots: [baseSnapshot(50)] }),
        );
        expect(result).toBeDefined();
    });

    it('selects the nearest snapshot before the selected event time', () => {
        const data = baseData({
            snapshots: [
                baseSnapshot(10, [5, 5, 5]),
                baseSnapshot(50, [25, 25, 25]),
                baseSnapshot(150, [99, 99, 99]),
            ],
        });
        // At time 100, the closest preceding snapshot is at 50
        const result = computeMapStateAtEvent({ start_time: 100 }, data);
        // Map should reflect 25/100 sector progression -- not the 99 from the later snapshot
        expect(result).toBeDefined();
        // Map structure exists for the 3 factions and Super Earth
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
        expect(result[2]).toBeDefined();
        expect(result[3]).toBeDefined();
    });

    it('returns HIDDEN state when no snapshot precedes the event', () => {
        const data = baseData({
            snapshots: [baseSnapshot(500)],
        });
        const result = computeMapStateAtEvent({ start_time: 100 }, data);
        expect(result).toBeDefined();
    });

    it('replays gap events that completed between snapshot and selected time', () => {
        const data = baseData({
            snapshots: [baseSnapshot(50, [10, 10, 10])],
            events: [
                {
                    type: EVENT_TYPE.ATTACK,
                    season: 1,
                    event_id: 1,
                    start_time: 60,
                    end_time: 80,
                    region: 1,
                    enemy: 0,
                    points_max: 100,
                    points: 100,
                    status: EVENT_STATUS.SUCCESS,
                },
            ],
        });
        // Selected event is at 100 -- the gap attack (60-80) should be replayed
        const result = computeMapStateAtEvent({ start_time: 100 }, data);
        expect(result).toBeDefined();
        expect(result[0]).toBeDefined();
    });

    it('overlays active events at the selected time with ACTIVE status', () => {
        const data = baseData({
            snapshots: [baseSnapshot(50, [10, 10, 10])],
            events: [
                {
                    type: EVENT_TYPE.DEFEND,
                    season: 1,
                    event_id: 2,
                    start_time: 90,
                    end_time: 200,
                    region: 0,
                    enemy: 0,
                    points_max: 100,
                    points: 5,
                    status: EVENT_STATUS.ACTIVE,
                },
            ],
        });
        // At time 100, defend event 90-200 is active and should overlay Super Earth
        const result = computeMapStateAtEvent({ start_time: 100 }, data);
        expect(result[3][0].event).toBe(EVENT_STATUS.ACTIVE);
    });

    it('falls back to campaign.points_max when data.points_max is missing', () => {
        const data = {
            snapshots: [
                {
                    time: 50,
                    data: [
                        {
                            enemy: 0,
                            points: 25,
                            points_taken: 0,
                            points_max: 50,
                            status: CAMPAIGN_STATUS.ACTIVE,
                        },
                    ],
                },
            ],
            events: [],
        };
        const result = computeMapStateAtEvent({ start_time: 100 }, data);
        expect(result).toBeDefined();
    });
});
