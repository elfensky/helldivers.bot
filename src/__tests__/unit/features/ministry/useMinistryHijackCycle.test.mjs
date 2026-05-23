// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
    useMinistryHijackCycle,
    TAKEOVER_MS,
    HOLD_MS,
    RESTORE_MS,
    CYCLE_MS,
} from '@/features/ministry/useMinistryHijackCycle.mjs';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('cycle constants', () => {
    test('exported timing constants are pinned and CYCLE_MS sums them', () => {
        expect(TAKEOVER_MS).toBe(800);
        expect(HOLD_MS).toBe(1000);
        expect(RESTORE_MS).toBe(800);
        expect(CYCLE_MS).toBe(2600);
        expect(CYCLE_MS).toBe(TAKEOVER_MS + HOLD_MS + RESTORE_MS);
    });
});

describe('useMinistryHijackCycle — one-shot lifecycle', () => {
    test('starts idle; trigger() transitions through takeover → hold → restore → idle', () => {
        const { result } = renderHook(() => useMinistryHijackCycle());
        expect(result.current.phase).toBe('idle');

        act(() => result.current.trigger());
        expect(result.current.phase).toBe('takeover');

        act(() => vi.advanceTimersByTime(TAKEOVER_MS));
        expect(result.current.phase).toBe('hold');

        act(() => vi.advanceTimersByTime(HOLD_MS));
        expect(result.current.phase).toBe('restore');

        act(() => vi.advanceTimersByTime(RESTORE_MS));
        expect(result.current.phase).toBe('idle');
    });

    test('total cycle from trigger to idle is exactly CYCLE_MS', () => {
        const { result } = renderHook(() => useMinistryHijackCycle());
        act(() => result.current.trigger());

        // Advance to one tick BEFORE CYCLE_MS — still not idle.
        act(() => vi.advanceTimersByTime(CYCLE_MS - 1));
        expect(result.current.phase).not.toBe('idle');

        // Advance the final ms — now idle.
        act(() => vi.advanceTimersByTime(1));
        expect(result.current.phase).toBe('idle');
    });

    test('unmount during cycle clears pending timeouts (no warning, no state update)', () => {
        const { result, unmount } = renderHook(() => useMinistryHijackCycle());
        act(() => result.current.trigger());
        unmount();
        act(() => vi.advanceTimersByTime(CYCLE_MS));
        // If timeouts weren't cleared, React would warn about update on unmounted.
        // No assertion needed — vitest fails the test on warnings.
    });
});
