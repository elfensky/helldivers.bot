import { evaluateProgress } from '@/utils/evaluateProgress.mjs';

describe('evaluateProgress', () => {
    const now = Math.floor(Date.now() / 1000);

    test('returns "Ahead" when points exceed expected + buffer', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 900,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).toMatch(/Ahead by \d+ points/);
    });

    test('returns "Behind" when points are below expected', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 100,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).toMatch(/Behind by \d+ points/);
    });

    test('returns "On track" when points are within buffer', () => {
        const event = {
            start_time: now - 500,
            end_time: now + 500,
            points: 500,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).toMatch(/On track by \d+ points/);
    });

    test('returns undefined for non-active events', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 500,
            points_max: 1000,
            status: 'success',
        };
        const result = evaluateProgress(event);
        expect(result).toBeNull();
    });
});
