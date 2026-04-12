// @vitest-environment jsdom
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useHomeMapPinned } from '@/features/dashboard/useHomeMapPinned.mjs';

function makeRect(top, bottom) {
    return () => ({
        top,
        bottom,
        height: bottom - top,
        left: 0,
        right: 1920,
        width: 1920,
        x: 0,
        y: top,
        toJSON: () => ({}),
    });
}

describe('useHomeMapPinned', () => {
    let heroEl;

    beforeEach(() => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 1920,
        });
        Object.defineProperty(window, 'innerHeight', {
            configurable: true,
            value: 1080,
        });

        heroEl = document.createElement('div');
        document.body.appendChild(heroEl);
        heroEl.getBoundingClientRect = vi.fn(makeRect(0, 1000));

        const header = document.createElement('div');
        header.id = 'header';
        Object.defineProperty(header, 'offsetHeight', { value: 80 });
        document.body.appendChild(header);
    });

    afterEach(() => {
        document.body.replaceChildren();
    });

    test('returns false when hero is fully visible', () => {
        const ref = createRef();
        ref.current = heroEl;
        const { result } = renderHook(() => useHomeMapPinned(ref));
        expect(result.current).toBe(false);
    });

    test('returns true when ≤25% of hero is visible (pinned)', () => {
        // Hero top=-800, bottom=200 → visible height 200-80=120, ratio=0.12
        heroEl.getBoundingClientRect = vi.fn(makeRect(-800, 200));
        const ref = createRef();
        ref.current = heroEl;
        const { result } = renderHook(() => useHomeMapPinned(ref));
        expect(result.current).toBe(true);
    });

    test('returns false when hero is more than 25% visible', () => {
        // Hero halfway out: top=-500, bottom=500 → visible=420, ratio=0.42
        heroEl.getBoundingClientRect = vi.fn(makeRect(-500, 500));
        const ref = createRef();
        ref.current = heroEl;
        const { result } = renderHook(() => useHomeMapPinned(ref));
        expect(result.current).toBe(false);
    });

    test('returns false on mobile (viewport < 1024px) regardless of scroll', () => {
        Object.defineProperty(window, 'innerWidth', {
            configurable: true,
            value: 375,
        });
        heroEl.getBoundingClientRect = vi.fn(makeRect(-900, 100));
        const ref = createRef();
        ref.current = heroEl;
        const { result } = renderHook(() => useHomeMapPinned(ref));
        expect(result.current).toBe(false);
    });

    test('returns false when ref is unset', () => {
        const ref = createRef();
        const { result } = renderHook(() => useHomeMapPinned(ref));
        expect(result.current).toBe(false);
    });
});
