import { describe, test, expect } from 'vitest';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';

describe('detectChanges', () => {
    test('returns empty array when prevEvents is null', () => {
        const result = detectChanges(null, [
            { event_id: 1, type: 'defend', status: 'active' },
        ]);
        expect(result).toEqual([]);
    });

    test('returns empty array when nextEvents is null', () => {
        const result = detectChanges(
            [{ event_id: 1, type: 'defend', status: 'active' }],
            null,
        );
        expect(result).toEqual([]);
    });

    test('returns empty array when both are empty', () => {
        expect(detectChanges([], [])).toEqual([]);
    });

    test('returns empty array when no changes', () => {
        const events = [{ event_id: 1, type: 'defend', status: 'active' }];
        expect(detectChanges(events, events)).toEqual([]);
    });

    test('detects event_started when new event appears', () => {
        const prev = [{ event_id: 1, type: 'defend', status: 'active' }];
        const next = [
            { event_id: 1, type: 'defend', status: 'active' },
            { event_id: 2, type: 'attack', status: 'active' },
        ];
        const result = detectChanges(prev, next);
        expect(result).toEqual([{ kind: 'event_started', event: next[1] }]);
    });

    test('detects event_won when active → success', () => {
        const prev = [{ event_id: 1, type: 'defend', status: 'active' }];
        const next = [{ event_id: 1, type: 'defend', status: 'success' }];
        const result = detectChanges(prev, next);
        expect(result).toEqual([{ kind: 'event_won', event: next[0] }]);
    });

    test('detects event_lost when active → fail', () => {
        const prev = [{ event_id: 1, type: 'defend', status: 'active' }];
        const next = [{ event_id: 1, type: 'defend', status: 'fail' }];
        const result = detectChanges(prev, next);
        expect(result).toEqual([{ kind: 'event_lost', event: next[0] }]);
    });

    test('detects multiple changes simultaneously', () => {
        const prev = [
            { event_id: 1, type: 'defend', status: 'active' },
            { event_id: 2, type: 'attack', status: 'active' },
        ];
        const next = [
            { event_id: 1, type: 'defend', status: 'success' },
            { event_id: 2, type: 'attack', status: 'fail' },
            { event_id: 3, type: 'defend', status: 'active' },
        ];
        const result = detectChanges(prev, next);
        expect(result).toHaveLength(3);
        expect(result[0].kind).toBe('event_won');
        expect(result[1].kind).toBe('event_lost');
        expect(result[2].kind).toBe('event_started');
    });

    test('ignores non-transition status changes', () => {
        const prev = [{ event_id: 1, type: 'defend', status: 'success' }];
        const next = [{ event_id: 1, type: 'defend', status: 'success' }];
        expect(detectChanges(prev, next)).toEqual([]);
    });

    test('matches by both event_id and type', () => {
        const prev = [{ event_id: 1, type: 'defend', status: 'active' }];
        // Same event_id but different type — treated as new event
        const next = [{ event_id: 1, type: 'attack', status: 'active' }];
        const result = detectChanges(prev, next);
        expect(result).toEqual([{ kind: 'event_started', event: next[0] }]);
    });
});
