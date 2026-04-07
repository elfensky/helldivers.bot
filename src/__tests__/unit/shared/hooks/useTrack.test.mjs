// @vitest-environment jsdom
import { vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrack } from '@/shared/hooks/useTrack.mjs';

describe('useTrack', () => {
    afterEach(() => {
        delete window.umami;
    });

    test('calls window.umami.track when available', () => {
        window.umami = { track: vi.fn() };
        const { result } = renderHook(() => useTrack());

        result.current('test-event', { key: 'value' });

        expect(window.umami.track).toHaveBeenCalledWith('test-event', { key: 'value' });
    });

    test('no-ops silently when window.umami is not available', () => {
        const { result } = renderHook(() => useTrack());

        // Should not throw
        expect(() => result.current('test-event')).not.toThrow();
    });

    test('no-ops silently when called without data', () => {
        window.umami = { track: vi.fn() };
        const { result } = renderHook(() => useTrack());

        result.current('test-event');

        expect(window.umami.track).toHaveBeenCalledWith('test-event', undefined);
    });
});
