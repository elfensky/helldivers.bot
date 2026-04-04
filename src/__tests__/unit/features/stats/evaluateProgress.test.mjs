import { vi } from 'vitest';
import { evaluateProgress } from '@/features/stats/evaluateProgress.mjs';

describe('evaluateProgress', () => {
    // Pin Date.now() to avoid flaky timing between test setup and function call
    const fakeNowMs = 1_700_000_000_000; // arbitrary fixed timestamp
    const now = Math.floor(fakeNowMs / 1000);

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(fakeNowMs);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns structured object with "ahead" status when points exceed expected + buffer', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 900,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).not.toBeNull();
        expect(result.status).toBe('ahead');
        expect(result.delta).toBeGreaterThan(0);
        expect(result.label).toMatch(/Ahead by \d+ points/);
        expect(typeof result.currentRate).toBe('number');
        expect(typeof result.requiredRate).toBe('number');
        expect(typeof result.deltaPercent).toBe('number');
    });

    test('returns "behind" status when points are below expected', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 100,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).not.toBeNull();
        expect(result.status).toBe('behind');
        expect(result.label).toMatch(/Behind by \d+ points/);
    });

    test('returns "on_track" status when points are within buffer', () => {
        const event = {
            start_time: now - 500,
            end_time: now + 500,
            points: 500,
            points_max: 1000,
            status: 'active',
        };
        const result = evaluateProgress(event);
        expect(result).not.toBeNull();
        expect(result.status).toBe('on_track');
        expect(result.label).toBe('On track');
    });

    test('returns null for non-active events', () => {
        const event = {
            start_time: now - 1000,
            end_time: now + 1000,
            points: 500,
            points_max: 1000,
            status: 'success',
        };
        expect(evaluateProgress(event)).toBeNull();
    });

    test('returns null when elapsedTime is zero (event just started)', () => {
        const event = {
            start_time: now,
            end_time: now + 2000,
            points: 0,
            points_max: 1000,
            status: 'active',
        };
        expect(evaluateProgress(event)).toBeNull();
    });

    test('returns null when totalTime is zero (invalid event)', () => {
        const event = {
            start_time: now,
            end_time: now,
            points: 500,
            points_max: 1000,
            status: 'active',
        };
        expect(evaluateProgress(event)).toBeNull();
    });

    test('handles expired event (remainingTime <= 0) without crashing', () => {
        const event = {
            start_time: now - 2000,
            end_time: now - 100,
            points: 800,
            points_max: 1000,
            status: 'active',
        };
        // Should still return a result (event hasn't been marked as success/fail yet)
        const result = evaluateProgress(event);
        expect(result).not.toBeNull();
        expect(result.requiredRate).toBe(Infinity);
        expect(Number.isFinite(result.currentRate)).toBe(true);
    });
});
