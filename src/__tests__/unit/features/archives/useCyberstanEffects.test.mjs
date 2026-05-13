// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
    useCyberstanEffects,
    toggleCyberstanEffects,
} from '@/features/archives/useCyberstanEffects.mjs';

// useCyberstanEffects randomises the watermark via Math.random — stub it
// for deterministic assertions. Plus 3 gates: isDefeat, prefers-reduced-motion,
// localStorage user-disabled toggle.

const STORAGE_KEY = 'cyberstan-effects-disabled';

function stubMatchMedia(reducedMotion) {
    window.matchMedia = vi.fn((query) => ({
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
    }));
}

beforeEach(() => {
    localStorage.clear();
    stubMatchMedia(false);
    // random=0 → watermark ON when no gate blocks (0 < 0.5 is true). Tests
    // that need watermark OFF explicitly set random > 0.5.
    vi.spyOn(Math, 'random').mockReturnValue(0);
});

afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe('useCyberstanEffects — gates', () => {
    test('isDefeat=false → no effects (full NO_EFFECTS object)', () => {
        const { result } = renderHook(() => useCyberstanEffects(false));
        expect(result.current).toEqual({ headerScramble: false, watermark: false });
    });

    test('isDefeat=true, no gates, random < 0.5 → headerScramble on, watermark ON (Math.random() < 0.5 is true)', () => {
        Math.random.mockReturnValue(0.4); // < 0.5 → predicate true → watermark on
        const { result } = renderHook(() => useCyberstanEffects(true));
        expect(result.current).toEqual({ headerScramble: true, watermark: true });
    });

    test('isDefeat=true, no gates, random >= 0.5 → headerScramble on, watermark OFF', () => {
        Math.random.mockReturnValue(0.7); // >= 0.5 → predicate false → watermark off
        const { result } = renderHook(() => useCyberstanEffects(true));
        expect(result.current).toEqual({ headerScramble: true, watermark: false });
    });

    test('isDefeat=true but prefers-reduced-motion → both effects off', () => {
        stubMatchMedia(true);
        const { result } = renderHook(() => useCyberstanEffects(true));
        expect(result.current).toEqual({ headerScramble: false, watermark: false });
    });

    test('isDefeat=true but user-disabled in localStorage → both effects off', () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        const { result } = renderHook(() => useCyberstanEffects(true));
        expect(result.current).toEqual({ headerScramble: false, watermark: false });
    });

    test('user-disabled stored value other than "true" does NOT disable (only literal "true" matches)', () => {
        localStorage.setItem(STORAGE_KEY, 'yes'); // not literal "true"
        Math.random.mockReturnValue(0.4); // < 0.5 → watermark on
        const { result } = renderHook(() => useCyberstanEffects(true));
        expect(result.current).toEqual({ headerScramble: true, watermark: true });
    });

    test('matchMedia undefined (older browsers) → guard falls through to default branch', () => {
        delete window.matchMedia;
        Math.random.mockReturnValue(0.7); // >= 0.5 → watermark off
        const { result } = renderHook(() => useCyberstanEffects(true));
        // Reduced-motion check is `typeof window.matchMedia === 'function'` —
        // false here, so the guard fails and we proceed to roll the dice.
        expect(result.current).toEqual({ headerScramble: true, watermark: false });
    });
});

describe('useCyberstanEffects — isDefeat transitions', () => {
    test('toggling isDefeat false→true→false re-evaluates effects on each change', () => {
        Math.random.mockReturnValue(0.4); // < 0.5 → watermark on when defeat
        const { result, rerender } = renderHook(
            ({ isDefeat }) => useCyberstanEffects(isDefeat),
            { initialProps: { isDefeat: false } },
        );
        expect(result.current).toEqual({ headerScramble: false, watermark: false });

        rerender({ isDefeat: true });
        expect(result.current).toEqual({ headerScramble: true, watermark: true });

        rerender({ isDefeat: false });
        expect(result.current).toEqual({ headerScramble: false, watermark: false });
    });
});

describe('toggleCyberstanEffects', () => {
    test('first call writes "true" to localStorage and returns true (now disabled)', () => {
        expect(toggleCyberstanEffects()).toBe(true);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    });

    test('second call flips back: writes "false" to localStorage and returns false (re-enabled)', () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        expect(toggleCyberstanEffects()).toBe(false);
        expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
    });

    test('toggling round-trip: false → true → false', () => {
        // Starting from absent (treated as enabled).
        expect(toggleCyberstanEffects()).toBe(true);
        expect(toggleCyberstanEffects()).toBe(false);
        expect(toggleCyberstanEffects()).toBe(true);
    });

    test('returns the NEW state, not the previous one', () => {
        // Already disabled (true) → toggle returns false (re-enabled).
        localStorage.setItem(STORAGE_KEY, 'true');
        const returned = toggleCyberstanEffects();
        expect(returned).toBe(false);
        expect(returned).toBe(localStorage.getItem(STORAGE_KEY) === 'true');
    });
});
