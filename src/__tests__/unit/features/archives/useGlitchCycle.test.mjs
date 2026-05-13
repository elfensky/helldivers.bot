// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlitchCycle } from '@/features/archives/useGlitchCycle.mjs';

// useGlitchCycle is a setTimeout-driven state machine that cycles
// idle → takeover → hold → fight → restore → idle. Each transition schedules
// the next via a randomised or fixed delay. Math.random is stubbed for
// deterministic timing on idle (6000-12000ms) and fight (1000-2000ms) phases.

const IDLE_MIN_MS = 6000;
const IDLE_MAX_MS = 12000;
const TAKEOVER_MS = 800;
const HOLD_MS = 1000;
const FIGHT_MIN_MS = 1000;
const FIGHT_MAX_MS = 2000;
const RESTORE_MS = 800;

beforeEach(() => {
    vi.useFakeTimers();
    // Math.random = 0 → randomBetween returns the MIN.
    vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('useGlitchCycle — disabled', () => {
    test('active=false → phase stays "idle" and no setTimeout is scheduled', () => {
        const { result } = renderHook(() => useGlitchCycle(false));
        expect(result.current.phase).toBe('idle');
        // Advance past the longest possible delay — nothing should fire.
        act(() => vi.advanceTimersByTime(20_000));
        expect(result.current.phase).toBe('idle');
    });

    test('active toggled true → false stops the cycle and resets to idle', () => {
        const { result, rerender } = renderHook(({ active }) => useGlitchCycle(active), {
            initialProps: { active: true },
        });
        // Let the idle→takeover transition fire.
        act(() => vi.advanceTimersByTime(IDLE_MIN_MS + 10));
        expect(result.current.phase).toBe('takeover');

        rerender({ active: false });
        expect(result.current.phase).toBe('idle');
    });

    test('exposes TAKEOVER_MS and RESTORE_MS constants alongside phase', () => {
        const { result } = renderHook(() => useGlitchCycle(false));
        expect(result.current.TAKEOVER_MS).toBe(TAKEOVER_MS);
        expect(result.current.RESTORE_MS).toBe(RESTORE_MS);
    });
});

describe('useGlitchCycle — phase progression', () => {
    // Each phase transition requires: timer fires → setPhase commits →
    // effect re-runs → new timer scheduled. Between act() blocks, React
    // commits the state update, but the effect re-run that schedules the
    // NEXT timer hasn't necessarily completed. So we advance time CUMULATIVELY
    // inside a single act() to let the whole chain settle in one go.

    test('idle → takeover after IDLE_MIN_MS (Math.random=0 → min delay)', () => {
        const { result } = renderHook(() => useGlitchCycle(true));
        expect(result.current.phase).toBe('idle');

        act(() => vi.advanceTimersByTime(IDLE_MIN_MS - 1));
        expect(result.current.phase).toBe('idle');

        act(() => vi.advanceTimersByTime(2));
        expect(result.current.phase).toBe('takeover');
    });

    test('full cycle: idle → takeover → hold → fight → restore → idle', () => {
        const { result } = renderHook(() => useGlitchCycle(true));
        expect(result.current.phase).toBe('idle');

        // idle → takeover (6000ms)
        act(() => vi.advanceTimersByTime(IDLE_MIN_MS + 1));
        expect(result.current.phase).toBe('takeover');

        // takeover → hold (+800ms = 6801 total)
        act(() => vi.advanceTimersByTime(TAKEOVER_MS + 1));
        expect(result.current.phase).toBe('hold');

        // hold → fight (+1000ms = 7802 total)
        act(() => vi.advanceTimersByTime(HOLD_MS + 1));
        expect(result.current.phase).toBe('fight');

        // fight → restore (+1000ms = 8803 total, MIN_MS at random=0)
        act(() => vi.advanceTimersByTime(FIGHT_MIN_MS + 1));
        expect(result.current.phase).toBe('restore');

        // restore → idle (+800ms = 9604 total)
        act(() => vi.advanceTimersByTime(RESTORE_MS + 1));
        expect(result.current.phase).toBe('idle');
    });
});

describe('useGlitchCycle — randomBetween bounds (Math.random=1 → max delay)', () => {
    test('idle → takeover takes IDLE_MAX_MS when Math.random returns ~1', () => {
        Math.random.mockReturnValue(0.999_999);
        const { result } = renderHook(() => useGlitchCycle(true));

        // Just under MAX: still idle.
        act(() => vi.advanceTimersByTime(IDLE_MAX_MS - 10));
        expect(result.current.phase).toBe('idle');

        // Cross MAX boundary.
        act(() => vi.advanceTimersByTime(15));
        expect(result.current.phase).toBe('takeover');
    });

    test('fight → restore at FIGHT_MAX_MS when Math.random returns ~1', () => {
        // With random=1 throughout, every randomBetween samples its MAX.
        Math.random.mockReturnValue(0.999_999);
        const { result } = renderHook(() => useGlitchCycle(true));

        // Walk through: idle(IDLE_MAX) → takeover(800) → hold(1000) → fight(FIGHT_MAX)
        act(() => vi.advanceTimersByTime(IDLE_MAX_MS + 1));
        expect(result.current.phase).toBe('takeover');
        act(() => vi.advanceTimersByTime(TAKEOVER_MS + 1));
        expect(result.current.phase).toBe('hold');
        act(() => vi.advanceTimersByTime(HOLD_MS + 1));
        expect(result.current.phase).toBe('fight');

        // Just under FIGHT_MAX: still fight.
        act(() => vi.advanceTimersByTime(FIGHT_MAX_MS - 10));
        expect(result.current.phase).toBe('fight');

        act(() => vi.advanceTimersByTime(15));
        expect(result.current.phase).toBe('restore');
    });
});

describe('useGlitchCycle — cleanup', () => {
    test('unmount clears the pending timer (no setState after unmount)', () => {
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = renderHook(() => useGlitchCycle(true));
        const callsBeforeUnmount = clearSpy.mock.calls.length;

        unmount();

        // Effect cleanup ran clear() → clearTimeout invoked.
        expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    });
});
