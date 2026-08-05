import { describe, it, expect } from 'vitest';
import { sectorForecast, attackForecast } from '@/features/dashboard/attackForecast.mjs';

const HOUR = 3600;
const NOW = 1_800_000_000;

/** Steady 10k pts/h for 30h, campaign 1.0M, currently at 430k (sector 5 of 10). */
function makeData({ points = 430_000, events = [] } = {}) {
    const snapshots = [];
    for (let i = 30; i >= 0; i--) {
        snapshots.push({
            time: NOW - i * HOUR,
            data: [{ points: points - i * 10_000, points_taken: 0, status: 'active' }],
        });
    }
    return {
        status: [{ enemy: 0, points, points_max: 1_000_000, status: 'active' }],
        snapshots,
        events,
    };
}

const model = {
    // minimal valid attack model (isValidModel requires it); flat dow so the
    // day-of-week correction is a no-op in these fixtures
    bands: [0.02, 0.05, 0.1, 0.2, 0.4, 1.01],
    dow: [1, 1, 1, 1, 1, 1, 1],
    ratios: Object.fromEntries(
        [0, 1, 2, 3, 4, 5].map((b) => [b, { r25: 1, r50: 1, r75: 1 }]),
    ),
    meta: { rateWindowHours: 24, displayHours: 48, minEtaHours: 0.25 },
};

describe('sectorForecast', () => {
    it('targets the next sector boundary, not the campaign end', () => {
        // 430k of 1.0M → next boundary 500k → 70k remaining at 10k/h = 7h
        const f = sectorForecast(makeData(), 0, NOW, model);
        expect(f.mode).toBe('median');
        expect(f.p50).toBeCloseTo(7, 0);
        expect(f.remaining).toBe(70_000);
        expect(f.imminent).toBe(false);
    });

    it('hides while any event is active for the faction', () => {
        const events = [{ type: 'defend', status: 'active', enemy: 0, region: 3 }];
        const f = sectorForecast(makeData({ events }), 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'event-active' });
    });

    it('shows multi-hour medians (the old 8h window is gone)', () => {
        // 401k → 99k remaining at 10k/h ≈ 9.9h — now shown
        const f = sectorForecast(makeData({ points: 401_000 }), 0, NOW, model);
        expect(f.mode).toBe('median');
        expect(f.p50).toBeCloseTo(9.9, 0);
    });

    it('hides beyond the 30-day sanity cap', () => {
        // 100 pts/h pace: 99k to the boundary ≈ 990h > 720h cap
        const snapshots = [];
        for (let i = 30; i >= 0; i--) {
            snapshots.push({
                time: NOW - i * HOUR,
                data: [{ points: 401_000 - i * 100, points_taken: 0, status: 'active' }],
            });
        }
        const slow = {
            status: [
                { enemy: 0, points: 401_000, points_max: 1_000_000, status: 'active' },
            ],
            snapshots,
            events: [],
        };
        const f = sectorForecast(slow, 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'beyond-window' });
    });

    it('hides a complete campaign', () => {
        const f = sectorForecast(makeData({ points: 1_000_000 }), 0, NOW, model);
        expect(f).toEqual({ mode: 'hidden', reason: 'complete' });
    });

    it('marks a sub-hour estimate imminent', () => {
        // 495k → 5k remaining at 10k/h = 0.5h
        const f = sectorForecast(makeData({ points: 495_000 }), 0, NOW, model);
        expect(f.mode).toBe('median');
        expect(f.imminent).toBe(true);
    });

    it('defers to the calibrated attack forecast in the last sector', () => {
        // 950k of 1.0M → next boundary IS the campaign end; the sector line
        // must be the same calibrated window the campaign view shows.
        const data = makeData({ points: 950_000 });
        const f = sectorForecast(data, 0, NOW, model);
        expect(f).toEqual(attackForecast(data, 0, NOW, model));
        expect(f.mode).toBe('window');
        // 50k remaining at 10k/h = 5h; fixture ratios are 1s
        expect(f.p50).toBeCloseTo(5, 0);
    });
});
