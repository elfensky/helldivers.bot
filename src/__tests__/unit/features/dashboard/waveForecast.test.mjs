import {
    waveForecast,
    deriveTrainStarts,
    IMMINENT_THRESHOLD,
} from '@/features/dashboard/waveForecast.mjs';

const HOUR = 3600;

/** A model where every lookup is recognizable per state. */
const row = (p25, p50, p75, p24, p48) => ({ p25, p50, p75, p24, p48 });
const rows = (r) => Array.from({ length: 168 }, () => r);
const MODEL = {
    meta: { binHours: 1, bins: 168 },
    states: {
        NORMAL: rows(row(10, 20, 30, 0.6, 0.9)),
        SC9: rows(row(31, 45, 58, 0.2, 0.55)),
        SC10: rows(row(9, 19, 31, 0.62, 0.91)),
        ATTACK: rows(row(12, 25, 40, 0.45, 0.8)),
    },
};

/** Minimal live-payload factory: one healthy faction, one finished train. */
function makeData({ events, status } = {}) {
    return {
        events: events ?? [
            // A single-defend train that ended 30h before NOW (t=1000000).
            {
                type: 'defend',
                enemy: 0,
                region: 5,
                start_time: 1000000 - 40 * HOUR,
                end_time: 1000000 - 30 * HOUR,
                status: 'fail',
            },
        ],
        status: status ?? [
            { enemy: 0, points: 5000, points_max: 10000, status: 'active' },
            { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
            { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
        ],
    };
}
const NOW = 1000000;

describe('deriveTrainStarts', () => {
    test('first defend of a faction is a train start', () => {
        const d = [{ enemy: 0, start_time: 100, end_time: 200 }];
        expect(deriveTrainStarts(d)).toHaveLength(1);
    });

    test('same-faction defend within 600s of previous end is NOT a start', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 0, start_time: 500, end_time: 900 }, // 300s after end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(1);
    });

    test('same-faction defend more than 600s after previous end IS a start', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 0, start_time: 900, end_time: 1000 }, // 700s after end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(2);
    });

    test('cross-faction proximity does not chain', () => {
        const d = [
            { enemy: 0, start_time: 100, end_time: 200 },
            { enemy: 1, start_time: 300, end_time: 400 }, // 100s after enemy 0 end
        ];
        expect(deriveTrainStarts(d)).toHaveLength(2);
    });
});

describe('waveForecast hidden modes', () => {
    test('hidden while a defend is active', () => {
        const data = makeData();
        data.events.push({
            type: 'defend',
            enemy: 1,
            region: 3,
            start_time: NOW - HOUR,
            end_time: NOW + HOUR,
            status: 'active',
        });
        expect(waveForecast(data, NOW, MODEL)).toEqual({
            mode: 'hidden',
            reason: 'wave-active',
        });
    });

    test('hidden when the season has no defends yet', () => {
        const data = makeData({ events: [] });
        expect(waveForecast(data, NOW, MODEL)).toEqual({
            mode: 'hidden',
            reason: 'no-train-yet',
        });
    });

    test('hidden on missing payload pieces', () => {
        expect(waveForecast(null, NOW, MODEL).reason).toBe('no-data');
        expect(waveForecast({ events: null, status: [] }, NOW, MODEL).reason).toBe(
            'no-data',
        );
        expect(waveForecast(makeData(), NOW, null).reason).toBe('no-data');
        expect(
            waveForecast(makeData(), NOW, { meta: {}, states: {} }).reason,
        ).toBe('no-data');
    });
});

describe('waveForecast window mode', () => {
    test('NORMAL state looks up the NORMAL row and derives flags', () => {
        const f = waveForecast(makeData(), NOW, MODEL);
        expect(f).toMatchObject({
            mode: 'window',
            state: 'NORMAL',
            p25: 10,
            p50: 20,
            p75: 30,
            p24: 0.6,
            p48: 0.9,
            runningLong: false,
        });
        expect(f.imminent).toBe(true); // 0.6 >= 0.51
        expect(f.lastTrainStart).toBe(NOW - 40 * HOUR);
    });

    test('SC9 when a faction holds 9 of 10 sectors; runningLong, not imminent', () => {
        const data = makeData({
            status: [
                { enemy: 0, points: 9200, points_max: 10000, status: 'active' },
                { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
                { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
            ],
        });
        const f = waveForecast(data, NOW, MODEL);
        expect(f.state).toBe('SC9');
        expect(f.runningLong).toBe(true);
        expect(f.imminent).toBe(false); // 0.2 < IMMINENT_THRESHOLD
    });

    test('an active ATTACK outranks SC9', () => {
        const data = makeData({
            status: [
                { enemy: 0, points: 9200, points_max: 10000, status: 'active' },
                { enemy: 1, points: 0, points_max: 0, status: 'hidden' },
                { enemy: 2, points: 0, points_max: 0, status: 'hidden' },
            ],
        });
        data.events.push({
            type: 'attack',
            enemy: 0,
            region: 11,
            start_time: NOW - 2 * HOUR,
            end_time: NOW + 10 * HOUR,
            status: 'active',
        });
        expect(waveForecast(data, NOW, MODEL).state).toBe('ATTACK');
    });

    test('elapsed clamps to the last bin and negative elapsed to bin 0', () => {
        // 300h since the only train start — way past 167 bins.
        const data = makeData({
            events: [
                {
                    type: 'defend',
                    enemy: 0,
                    region: 5,
                    start_time: NOW - 300 * HOUR,
                    end_time: NOW - 299 * HOUR,
                    status: 'success',
                },
            ],
        });
        expect(waveForecast(data, NOW, MODEL).mode).toBe('window');
        // Train "starting" in the future (clock skew) must not crash.
        const skew = makeData({
            events: [
                {
                    type: 'defend',
                    enemy: 0,
                    region: 5,
                    start_time: NOW + HOUR,
                    end_time: NOW + 2 * HOUR,
                    status: 'fail',
                },
            ],
        });
        expect(waveForecast(skew, NOW, MODEL).mode).toBe('window');
    });

    test('IMMINENT_THRESHOLD is the spec value', () => {
        expect(IMMINENT_THRESHOLD).toBe(0.51);
    });
});
