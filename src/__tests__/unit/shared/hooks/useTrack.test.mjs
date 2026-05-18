// @vitest-environment jsdom
import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

describe('useTrack', () => {
    afterEach(() => {
        delete window.umami;
    });

    test('forwards eventName + data to window.umami.track when present', () => {
        const track = vi.fn();
        window.umami = { track };
        const { result } = renderHook(() => useTrack());

        result.current('faction-tab-switch', { faction: 'bugs' });

        expect(track).toHaveBeenCalledTimes(1);
        expect(track).toHaveBeenCalledWith('faction-tab-switch', { faction: 'bugs' });
    });

    test('forwards undefined data when called with eventName only', () => {
        const track = vi.fn();
        window.umami = { track };
        const { result } = renderHook(() => useTrack());

        result.current('logo-click');

        expect(track).toHaveBeenCalledWith('logo-click', undefined);
    });

    test('returns a stable function reference across re-renders (useCallback memo)', () => {
        // If this breaks, any consumer that lists `track` in a useCallback/useEffect
        // dep array will fire spuriously every render.
        const { result, rerender } = renderHook(() => useTrack());
        const first = result.current;
        rerender();
        const second = result.current;
        rerender();
        const third = result.current;

        expect(first).toBe(second);
        expect(second).toBe(third);
    });

    test('no-ops without throwing when window.umami is absent (ad-blocker / dev)', () => {
        // No window.umami assigned.
        const { result } = renderHook(() => useTrack());
        expect(() => result.current('test-event', { x: 1 })).not.toThrow();
    });

    test('no-ops silently when window.umami exists but track is not a function', () => {
        window.umami = {};
        const { result } = renderHook(() => useTrack());

        expect(() => result.current('test-event')).not.toThrow();
    });

    test('separate calls forward independently (no argument leak)', () => {
        const track = vi.fn();
        window.umami = { track };
        const { result } = renderHook(() => useTrack());

        result.current('event-a', { a: 1 });
        result.current('event-b');
        result.current('event-c', { c: 3 });

        expect(track.mock.calls).toEqual([
            ['event-a', { a: 1 }],
            ['event-b', undefined],
            ['event-c', { c: 3 }],
        ]);
    });
});
