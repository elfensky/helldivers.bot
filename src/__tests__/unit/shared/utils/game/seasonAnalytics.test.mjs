import { describe, it, expect } from 'vitest';
import { findWorstCascade } from '@/shared/utils/game/seasonAnalytics.mjs';

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
            {
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region: 8,
                end_time: 100,
                event_id: 10,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region: 7,
                end_time: 200,
                event_id: 11,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region: 6,
                end_time: 300,
                event_id: 12,
            },
            {
                type: 'defend',
                status: 'fail',
                enemy: 2,
                region: 5,
                end_time: 400,
                event_id: 13,
            },
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
