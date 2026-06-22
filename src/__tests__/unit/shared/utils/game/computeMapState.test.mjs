import {
    computeMapState,
    computeLiveMap,
    computeLiveMapState,
} from '@/shared/utils/game/computeMapState.mjs';
import { EVENT_STATUS } from '@/shared/enums/events.mjs';

function makeFaction(enemy, points, pointsMax, status = 'active') {
    return { enemy, points, points_taken: points, points_max: pointsMax, status };
}

describe('computeMapState', () => {
    const baseFactions = [
        makeFaction(0, 50000, 100000), // bugs: 5 sectors earned
        makeFaction(1, 30000, 100000), // cyborgs: 3 sectors earned
        makeFaction(2, 70000, 100000), // illuminate: 7 sectors earned
    ];

    test('defend event fail reverts sector and all beyond to lost', () => {
        const events = [
            { type: 'defend', enemy: 0, region: 4, status: 'fail', end_time: 100 },
        ];
        const map = computeMapState(baseFactions, events);

        // Sectors 1-3 should still be captured (bugs have 5 sectors earned)
        expect(map[0][1].status).toBe('captured');
        expect(map[0][2].status).toBe('captured');
        expect(map[0][3].status).toBe('captured');

        // Sectors 4-10 should be lost due to failed defend on sector 4
        for (let r = 4; r <= 10; r++) {
            expect(map[0][r].status).toBe('lost');
            expect(map[0][r].percent).toBe(0);
        }
    });

    test('defend event active sets event to active on sector', () => {
        const events = [
            { type: 'defend', enemy: 1, region: 3, status: 'active', end_time: 100 },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[1][3].event).toBe('active');
        // Status should remain what the points calculation set it to
        expect(map[1][3].status).toBe('captured');
    });

    test('defend event success sets event to idle, preserves status', () => {
        const events = [
            { type: 'defend', enemy: 0, region: 3, status: 'success', end_time: 100 },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[0][3].event).toBe('idle');
        expect(map[0][3].status).toBe('captured');
    });

    test('attack event fail reverts homeworld to lost', () => {
        const events = [
            {
                type: 'attack',
                enemy: 2,
                status: 'fail',
                end_time: 100,
                points: 5000,
                points_max: 10000,
            },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[2][11].status).toBe('lost');
        expect(map[2][11].event).toBe('idle');
    });

    test('attack event active sets homeworld to active', () => {
        const events = [
            {
                type: 'attack',
                enemy: 0,
                status: 'active',
                end_time: 100,
                points: 5000,
                points_max: 10000,
            },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[0][11].status).toBe('active');
        expect(map[0][11].event).toBe('active');
    });

    test('most recent defend event wins when multiple exist', () => {
        const events = [
            { type: 'defend', enemy: 0, region: 5, status: 'success', end_time: 100 },
            { type: 'defend', enemy: 0, region: 5, status: 'fail', end_time: 200 },
        ];
        const map = computeMapState(baseFactions, events);

        // The fail at end_time=200 should win over success at end_time=100
        expect(map[0][5].status).toBe('lost');
    });

    test('defend event on region 0 sets Super Earth to active', () => {
        const events = [
            { type: 'defend', enemy: 0, region: 0, status: 'active', end_time: 100 },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[3][0].status).toBe('active');
        expect(map[3][0].event).toBe('active');
    });

    test('active Super Earth defend forces attacker faction to lost', () => {
        const events = [
            {
                type: 'defend',
                enemy: 1, // Cyborgs attacking
                region: 0,
                status: 'active',
                end_time: 100,
            },
        ];
        const map = computeMapState(baseFactions, events);

        // All Cyborg sectors (including homeworld) forced to lost
        for (let r = 1; r <= 11; r++) {
            expect(map[1][r].status).toBe('lost');
            expect(map[1][r].event).toBe('idle');
            expect(map[1][r].percent).toBe(0);
        }

        // Super Earth itself stays active
        expect(map[3][0].status).toBe('active');
        expect(map[3][0].event).toBe('active');

        // Other factions keep their normal campaign progression
        expect(map[0][1].status).toBe('captured'); // bugs 5 earned
        expect(map[0][5].status).toBe('captured');
        expect(map[2][7].status).toBe('captured'); // illuminate 7 earned
    });

    test('Super Earth defend with status=success does NOT freeze attacker', () => {
        const events = [
            {
                type: 'defend',
                enemy: 1,
                region: 0,
                status: 'success', // completed, not active
                end_time: 100,
            },
        ];
        const map = computeMapState(baseFactions, events);

        // Cyborg sectors follow normal campaign progression, not forced to lost
        expect(map[1][1].status).toBe('captured'); // 3 sectors earned
        expect(map[1][3].status).toBe('captured');
    });

    test('Super Earth defend with status=fail does NOT freeze attacker', () => {
        const events = [
            {
                type: 'defend',
                enemy: 2,
                region: 0,
                status: 'fail',
                end_time: 100,
            },
        ];
        const map = computeMapState(baseFactions, events);

        // Illuminate sectors follow normal campaign progression
        expect(map[2][1].status).toBe('captured'); // 7 sectors earned
        expect(map[2][7].status).toBe('captured');
    });
});

describe('computeLiveMap', () => {
    const data = {
        status: [makeFaction(0, 100, 200)],
        events: [
            {
                type: 'attack',
                enemy: 0,
                region: 11,
                status: EVENT_STATUS.ACTIVE,
                points: 5,
                points_max: 10,
                end_time: 2,
            },
            {
                type: 'attack',
                enemy: 0,
                region: 11,
                status: EVENT_STATUS.SUCCESS,
                points: 10,
                points_max: 10,
                end_time: 1,
            },
        ],
    };

    test('returns only active events plus the map they produce', () => {
        const { activeEvents, mapState } = computeLiveMap(data);
        expect(activeEvents).toHaveLength(1);
        expect(activeEvents[0].status).toBe(EVENT_STATUS.ACTIVE);
        // single source: same input → same map as a direct computeMapState call
        expect(mapState).toEqual(computeMapState(data.status, activeEvents));
    });

    test('computeLiveMapState is the map half of computeLiveMap', () => {
        expect(computeLiveMapState(data)).toEqual(computeLiveMap(data).mapState);
    });

    test('tolerates empty/missing payloads', () => {
        expect(computeLiveMap({}).activeEvents).toEqual([]);
        expect(computeLiveMap(undefined).activeEvents).toEqual([]);
    });
});
