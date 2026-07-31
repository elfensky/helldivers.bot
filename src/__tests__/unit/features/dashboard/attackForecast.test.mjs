import { describe, it, expect } from 'vitest';
import {
    attackForecast,
    isValidModel,
    bandOf,
    pointsAt,
} from '@/features/dashboard/attackForecast.mjs';

const HOUR = 3600;
const NOW = 1_800_000_000;

/** A model with neutral tables, so arithmetic is checkable by hand. */
const flatModel = {
    meta: { rateWindowHours: 24, displayHours: 24, minEtaHours: 0.25 },
    bands: [0.02, 0.05, 0.1, 0.2, 0.4, 1.01],
    ratios: Object.fromEntries(
        Array.from({ length: 6 }, (_, i) => [i, { r25: 0.5, r50: 1, r75: 2 }]),
    ),
    dow: [1, 1, 1, 1, 1, 1, 1],
};

/**
 * Campaign closing on its threshold at a steady pace.
 *
 * @param {object} o
 * @returns {object} a live payload
 */
function payload({
    points = 9000,
    pointsMax = 10_000,
    pointsThen = 8000,
    enemy = 0,
    events = [],
    nowTime = NOW,
} = {}) {
    return {
        status: [{ enemy, points, points_max: pointsMax }],
        snapshots: [
            { time: nowTime - 24 * HOUR, data: [{ points: pointsThen }] },
            { time: nowTime, data: [{ points }] },
        ],
        events,
    };
}

describe('bandOf', () => {
    it('separates the remaining-fraction regimes', () => {
        const b = flatModel.bands;
        expect(bandOf(0.0, b)).toBe(0);
        expect(bandOf(0.019, b)).toBe(0);
        expect(bandOf(0.02, b)).toBe(1);
        expect(bandOf(0.9, b)).toBe(5);
        // Distinct regimes must land in distinct bands, or the per-band table
        // is a pooled table wearing a costume.
        expect(
            new Set([0.01, 0.03, 0.07, 0.15, 0.3, 0.9].map((f) => bandOf(f, b))).size,
        ).toBe(6);
    });
});

describe('isValidModel', () => {
    it('accepts the flat fixture', () => {
        expect(isValidModel(flatModel)).toBe(true);
    });

    it('rejects non-monotone multipliers', () => {
        const bad = {
            ...flatModel,
            ratios: { ...flatModel.ratios, 0: { r25: 2, r50: 1, r75: 3 } },
        };
        expect(isValidModel(bad)).toBe(false);
    });

    it('rejects a malformed day-of-week table', () => {
        expect(isValidModel({ ...flatModel, dow: [1, 1, 1] })).toBe(false);
        expect(isValidModel({ ...flatModel, dow: [1, 1, 1, 1, 1, 1, 0] })).toBe(false);
    });

    it('rejects junk without throwing', () => {
        for (const junk of [null, undefined, {}, { bands: [] }, 42, 'model']) {
            expect(isValidModel(junk)).toBe(false);
        }
    });
});

describe('pointsAt', () => {
    const snaps = [
        { time: 100, data: [{ points: 10 }] },
        { time: 200, data: [{ points: 20 }] },
        { time: 300, data: [{ points: 30 }] },
    ];

    it('returns the latest snapshot at or before the instant', () => {
        expect(pointsAt(snaps, 0, 250)).toEqual({ points: 20, time: 200 });
        expect(pointsAt(snaps, 0, 300)).toEqual({ points: 30, time: 300 });
    });

    it('returns null before the first snapshot', () => {
        expect(pointsAt(snaps, 0, 50)).toBeNull();
    });

    it('reads positionally by faction index', () => {
        const multi = [
            { time: 100, data: [{ points: 1 }, { points: 2 }, { points: 3 }] },
        ];
        expect(pointsAt(multi, 2, 150).points).toBe(3);
    });
});

describe('attackForecast', () => {
    it('computes the window from remaining points and pace', () => {
        // 1000 points left, 1000 gained over 24h => ~42 pt/h => eta 24h.
        // Multi-hour ETAs now show (day formatting handles the far end);
        // only the 30-day sanity cap hides.
        const day = attackForecast(payload(), 0, NOW, flatModel);
        expect(day.mode).toBe('window');
        expect(day.p50).toBeCloseTo(24, 0);

        // 1000 left at 1 pt/h => eta 1000h — beyond the 720h cap, hidden.
        const far = attackForecast(
            payload({ points: 9000, pointsThen: 8976 }),
            0,
            NOW,
            flatModel,
        );
        expect(far).toEqual({ mode: 'hidden', reason: 'beyond-window' });

        // 100 left at 1000/24h => eta ~2.4h, inside the window.
        const near = attackForecast(
            payload({ points: 9900, pointsThen: 8900 }),
            0,
            NOW,
            flatModel,
        );
        expect(near.mode).toBe('window');
        expect(near.p50).toBeCloseTo(2.4, 1);
        expect(near.p25).toBeCloseTo(1.2, 1);
        expect(near.p75).toBeCloseTo(4.8, 1);
        expect(near.remaining).toBe(100);
    });

    it('keeps the quantiles ordered', () => {
        const f = attackForecast(
            payload({ points: 9900, pointsThen: 8900 }),
            0,
            NOW,
            flatModel,
        );
        expect(f.p25).toBeLessThanOrEqual(f.p50);
        expect(f.p50).toBeLessThanOrEqual(f.p75);
    });

    it('stays silent on a stalled front', () => {
        // This is ~38-47% of real moments, not an edge case.
        const flat = attackForecast(
            payload({ points: 9900, pointsThen: 9900 }),
            0,
            NOW,
            flatModel,
        );
        expect(flat).toEqual({ mode: 'hidden', reason: 'stalled' });

        const losing = attackForecast(
            payload({ points: 9900, pointsThen: 9950 }),
            0,
            NOW,
            flatModel,
        );
        expect(losing).toEqual({ mode: 'hidden', reason: 'stalled' });
    });

    it('stays silent while an assault on that faction is running', () => {
        const p = payload({
            points: 9900,
            pointsThen: 8900,
            events: [{ type: 'attack', status: 'active', enemy: 0 }],
        });
        expect(attackForecast(p, 0, NOW, flatModel)).toEqual({
            mode: 'hidden',
            reason: 'attack-active',
        });
    });

    it('ignores an assault on a DIFFERENT faction', () => {
        const p = payload({
            points: 9900,
            pointsThen: 8900,
            events: [{ type: 'attack', status: 'active', enemy: 1 }],
        });
        expect(attackForecast(p, 0, NOW, flatModel).mode).toBe('window');
    });

    it('stays silent on a completed campaign', () => {
        const p = payload({ points: 10_000, pointsThen: 9000 });
        expect(attackForecast(p, 0, NOW, flatModel)).toEqual({
            mode: 'hidden',
            reason: 'complete',
        });
    });

    it('anchors the estimate at now, not at the reading', () => {
        // Same campaign state, but the newest snapshot is 2h stale. The ETA must
        // come out 2h SHORTER — this is the anchoring bug the backtest caught.
        const fresh = attackForecast(
            payload({ points: 9900, pointsThen: 8900 }),
            0,
            NOW,
            flatModel,
        );
        const stale = attackForecast(
            payload({ points: 9900, pointsThen: 8900, nowTime: NOW - 2 * HOUR }),
            0,
            NOW,
            flatModel,
        );
        expect(stale.mode).toBe('window');
        expect(fresh.p50 - stale.p50).toBeCloseTo(2, 1);
    });

    it('applies the day-of-week correction in the right direction', () => {
        // The multiplier is past/ahead and eta *= adj. Dividing instead inverts
        // it — a faster week ahead would push the arrival LATER — which is a
        // bug that shipped once in the analysis script, so both directions are
        // pinned rather than just one.
        //
        // The measurement window is the trailing 24h (previous day + today);
        // the forward horizon here is only ~2.4h, so it lands entirely on
        // today. Skewing today against the rest therefore sets ahead-vs-past.
        const p = payload({ points: 9900, pointsThen: 8900 });
        const nowDow = new Date(NOW * 1000).getUTCDay();
        const skew = (today, rest) =>
            Array.from({ length: 7 }, (_, i) => (i === nowDow ? today : rest));

        const base = attackForecast(p, 0, NOW, flatModel);

        // Today faster than the days behind => arrival sooner.
        const aheadFaster = attackForecast(p, 0, NOW, {
            ...flatModel,
            dow: skew(2, 0.5),
        });
        expect(aheadFaster.p50).toBeLessThan(base.p50);

        // Today slower than the days behind => arrival later.
        const aheadSlower = attackForecast(p, 0, NOW, {
            ...flatModel,
            dow: skew(0.5, 2),
        });
        expect(aheadSlower.p50).toBeGreaterThan(base.p50);
    });

    it('degrades to hidden rather than throwing on junk', () => {
        for (const junk of [null, undefined, {}, { status: [] }, { snapshots: [] }]) {
            expect(attackForecast(junk, 0, NOW, flatModel).mode).toBe('hidden');
        }
        expect(attackForecast(payload(), 0, NOW, { bands: [] }).mode).toBe('hidden');
    });

    it('works against the committed model without throwing', async () => {
        const { default: real } = await import('@/features/dashboard/attackModel.mjs');
        expect(isValidModel(real)).toBe(true);
        const f = attackForecast(
            payload({ points: 9990, pointsThen: 8990 }),
            0,
            NOW,
            real,
        );
        expect(['window', 'hidden']).toContain(f.mode);
        if (f.mode === 'window') {
            expect(f.p25).toBeLessThanOrEqual(f.p50);
            expect(f.p50).toBeLessThanOrEqual(f.p75);
            expect(f.p50).toBeLessThan(720); // FAR_CAP_HOURS
        }
    });
});
