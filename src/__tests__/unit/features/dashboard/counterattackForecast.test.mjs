import {
    counterattackForecast,
    ASSAULT_TIMEOUT_SECONDS,
} from '@/features/dashboard/counterattackForecast.mjs';

const HOUR = 3600;
const NOW = 1_000_000;

/** @param {object[]} events */
const data = (events) => ({ events });

const attack = (overrides = {}) => ({
    type: 'attack',
    enemy: 0,
    region: 11,
    status: 'active',
    start_time: NOW - 24 * HOUR,
    end_time: NOW + 24 * HOUR,
    points: 500_000,
    points_max: 1_000_000,
    ...overrides,
});

describe('counterattackForecast', () => {
    test('the timeout constant is the measured 48h', () => {
        expect(ASSAULT_TIMEOUT_SECONDS).toBe(48 * 3600);
    });

    test('hidden without data, without an assault, and during a defend', () => {
        expect(counterattackForecast(null, NOW).reason).toBe('no-data');
        expect(counterattackForecast(data([]), NOW).reason).toBe('no-assault');
        expect(
            counterattackForecast(
                data([
                    attack(),
                    {
                        type: 'defend',
                        enemy: 1,
                        status: 'active',
                        start_time: NOW - HOUR,
                        end_time: NOW + HOUR,
                    },
                ]),
                NOW,
            ).reason,
        ).toBe('wave-active');
        expect(
            counterattackForecast(data([attack({ status: 'fail' })]), NOW).reason,
        ).toBe('no-assault');
    });

    test('clock at assault start + 48h; earliest assault wins', () => {
        const early = attack({ start_time: NOW - 30 * HOUR, enemy: 1 });
        const late = attack({ start_time: NOW - 2 * HOUR });
        const f = counterattackForecast(data([late, early]), NOW);
        expect(f.mode).toBe('clock');
        expect(f.at).toBe(early.start_time + ASSAULT_TIMEOUT_SECONDS);
        expect(f.assaultStart).toBe(early.start_time);
    });

    test('pace mirrors the shipped eventForecast verdict', () => {
        // Halfway through with half the points -> on track.
        const onTrack = counterattackForecast(data([attack({ points: 500_000 })]), NOW);
        expect(onTrack.pace).toBe('on_track');

        // Halfway through with a fifth of the points -> behind (margin 0.2).
        const behind = counterattackForecast(data([attack({ points: 200_000 })]), NOW);
        expect(behind.pace).toBe('behind');

        // Zero points, elapsed time -> stalled.
        const stalled = counterattackForecast(data([attack({ points: 0 })]), NOW);
        expect(stalled.pace).toBe('stalled');
    });

    test('no usable pace yet leaves the clock standing with pace null', () => {
        // Assault starting exactly now: elapsed 0, eventForecast hides.
        const f = counterattackForecast(
            data([attack({ start_time: NOW, end_time: NOW + 48 * HOUR })]),
            NOW,
        );
        expect(f.mode).toBe('clock');
        expect(f.pace).toBeNull();
    });
});
