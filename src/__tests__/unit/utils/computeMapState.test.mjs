import { computeMapState } from '@/utils/computeMapState.mjs';

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
            { type: 'attack', enemy: 2, status: 'fail', end_time: 100, points: 5000, points_max: 10000 },
        ];
        const map = computeMapState(baseFactions, events);

        expect(map[2][11].status).toBe('lost');
        expect(map[2][11].event).toBe('idle');
    });

    test('attack event active sets homeworld to active', () => {
        const events = [
            { type: 'attack', enemy: 0, status: 'active', end_time: 100, points: 5000, points_max: 10000 },
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
});
