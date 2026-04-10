import { describe, it, expect } from 'vitest';
import { findClosestCalls, findWorstCascade } from '@/shared/utils/game/seasonAnalytics.mjs';

describe('findClosestCalls', () => {
    it('returns nulls for empty events', () => {
        const result = findClosestCalls([]);
        expect(result).toEqual({ narrowestWin: null, narrowestLoss: null });
    });

    it('returns nulls for null events', () => {
        const result = findClosestCalls(null);
        expect(result).toEqual({ narrowestWin: null, narrowestLoss: null });
    });

    it('finds narrowest win from successful defenses', () => {
        const events = [
            { type: 'defend', status: 'success', enemy: 0, region: 1, points: 450, points_max: 500 },
            { type: 'defend', status: 'success', enemy: 0, region: 2, points: 100, points_max: 500 },
        ];
        const { narrowestWin } = findClosestCalls(events);
        expect(narrowestWin).not.toBeNull();
        expect(narrowestWin.ratio).toBe(0.9); // 450/500
        expect(narrowestWin.region).toBe('Wise Region'); // enemy 0, region 1
    });

    it('ignores defenses below 50% threshold', () => {
        const events = [
            { type: 'defend', status: 'success', enemy: 0, region: 1, points: 200, points_max: 500 },
        ];
        const { narrowestWin } = findClosestCalls(events);
        expect(narrowestWin).toBeNull();
    });

    it('finds narrowest loss from failed attacks', () => {
        const events = [
            { type: 'attack', status: 'fail', enemy: 1, region: 5, points: 460, points_max: 500 },
            { type: 'attack', status: 'fail', enemy: 1, region: 6, points: 100, points_max: 500 },
        ];
        const { narrowestLoss } = findClosestCalls(events);
        expect(narrowestLoss).not.toBeNull();
        expect(narrowestLoss.ratio).toBe(0.92); // 460/500
    });

    it('ignores events with zero points_max', () => {
        const events = [
            { type: 'defend', status: 'success', enemy: 0, region: 1, points: 100, points_max: 0 },
        ];
        const { narrowestWin } = findClosestCalls(events);
        expect(narrowestWin).toBeNull();
    });

    it('returns both narrowest win and loss when present', () => {
        const events = [
            { type: 'defend', status: 'success', enemy: 0, region: 1, points: 400, points_max: 500 },
            { type: 'attack', status: 'fail', enemy: 1, region: 5, points: 350, points_max: 500 },
        ];
        const { narrowestWin, narrowestLoss } = findClosestCalls(events);
        expect(narrowestWin).not.toBeNull();
        expect(narrowestLoss).not.toBeNull();
    });
});

describe('findWorstCascade', () => {
    it('returns null for empty events', () => {
        expect(findWorstCascade([])).toBeNull();
    });

    it('returns null for null events', () => {
        expect(findWorstCascade(null)).toBeNull();
    });

    it('returns null when fewer than 2 failed defends', () => {
        const events = [
            { type: 'defend', status: 'fail', enemy: 2, region: 5, end_time: 100 },
        ];
        expect(findWorstCascade(events)).toBeNull();
    });

    it('detects a cascade of decreasing regions for same faction', () => {
        const events = [
            { type: 'defend', status: 'fail', enemy: 2, region: 8, end_time: 100, event_id: 10 },
            { type: 'defend', status: 'fail', enemy: 2, region: 7, end_time: 200, event_id: 11 },
            { type: 'defend', status: 'fail', enemy: 2, region: 6, end_time: 300, event_id: 12 },
            { type: 'defend', status: 'fail', enemy: 2, region: 5, end_time: 400, event_id: 13 },
        ];
        const result = findWorstCascade(events);
        expect(result).not.toBeNull();
        expect(result.length).toBe(4);
        expect(result.faction).toBe('The Illuminate');
        expect(result.regions).toEqual([8, 7, 6, 5]);
        expect(result.firstEvent.event_id).toBe(10);
    });

    it('ignores non-defend and non-fail events', () => {
        const events = [
            { type: 'attack', status: 'success', enemy: 0, region: 5, end_time: 100 },
            { type: 'defend', status: 'success', enemy: 0, region: 4, end_time: 200 },
            { type: 'defend', status: 'fail', enemy: 0, region: 3, end_time: 300 },
        ];
        expect(findWorstCascade(events)).toBeNull();
    });

    it('does not count non-decreasing regions as cascade', () => {
        const events = [
            { type: 'defend', status: 'fail', enemy: 0, region: 3, end_time: 100 },
            { type: 'defend', status: 'fail', enemy: 0, region: 5, end_time: 200 },
        ];
        expect(findWorstCascade(events)).toBeNull();
    });

    it('finds the longest cascade across multiple factions', () => {
        const events = [
            // Bugs: 2-region cascade
            { type: 'defend', status: 'fail', enemy: 0, region: 4, end_time: 100 },
            { type: 'defend', status: 'fail', enemy: 0, region: 3, end_time: 200 },
            // Illuminate: 3-region cascade
            { type: 'defend', status: 'fail', enemy: 2, region: 7, end_time: 300 },
            { type: 'defend', status: 'fail', enemy: 2, region: 6, end_time: 400 },
            { type: 'defend', status: 'fail', enemy: 2, region: 5, end_time: 500 },
        ];
        const result = findWorstCascade(events);
        expect(result.length).toBe(3);
        expect(result.faction).toBe('The Illuminate');
    });

    it('resets cascade when region order breaks', () => {
        const events = [
            { type: 'defend', status: 'fail', enemy: 0, region: 5, end_time: 100 },
            { type: 'defend', status: 'fail', enemy: 0, region: 4, end_time: 200 },
            { type: 'defend', status: 'fail', enemy: 0, region: 7, end_time: 300 }, // breaks cascade
            { type: 'defend', status: 'fail', enemy: 0, region: 6, end_time: 400 },
        ];
        const result = findWorstCascade(events);
        expect(result.length).toBe(2); // best is 2, not 4
    });
});
