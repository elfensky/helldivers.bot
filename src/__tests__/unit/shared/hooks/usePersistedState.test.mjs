// @vitest-environment jsdom
import { describe, test, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

vi.mock('@/shared/utils/cookies.mjs', () => ({
    setPreferenceCookie: vi.fn(),
}));

import { setPreferenceCookie } from '@/shared/utils/cookies.mjs';

afterEach(() => {
    vi.clearAllMocks();
});

describe('usePersistedState — initial value', () => {
    test('returns the initial value passed in', () => {
        const { result } = renderHook(() => usePersistedState('faction', 'global'));
        expect(result.current[0]).toBe('global');
    });
});

describe('usePersistedState — update setter', () => {
    test('calling update sets state and writes cookie', () => {
        const { result } = renderHook(() => usePersistedState('faction', 'global'));

        act(() => {
            result.current[1]('bugs');
        });

        expect(result.current[0]).toBe('bugs');
        expect(setPreferenceCookie).toHaveBeenCalledWith('faction', 'bugs');
    });

    test('repeated updates persist the latest value', () => {
        const { result } = renderHook(() => usePersistedState('faction', 'global'));

        act(() => result.current[1]('bugs'));
        act(() => result.current[1]('cyborgs'));
        act(() => result.current[1]('illuminate'));

        expect(result.current[0]).toBe('illuminate');
        expect(setPreferenceCookie).toHaveBeenLastCalledWith('faction', 'illuminate');
        expect(setPreferenceCookie).toHaveBeenCalledTimes(3);
    });

    test('update is a stable reference across re-renders while key is unchanged', () => {
        const { result, rerender } = renderHook(() =>
            usePersistedState('faction', 'global'),
        );
        const firstSetter = result.current[1];
        rerender();
        expect(result.current[1]).toBe(firstSetter);
    });

    test('update returns a new reference when key changes', () => {
        const { result, rerender } = renderHook(
            ({ key }) => usePersistedState(key, 'default'),
            { initialProps: { key: 'key-a' } },
        );
        const setterA = result.current[1];

        rerender({ key: 'key-b' });

        expect(result.current[1]).not.toBe(setterA);
    });

    test('after key change, writes go to the new key', () => {
        const { result, rerender } = renderHook(
            ({ key }) => usePersistedState(key, 'default'),
            { initialProps: { key: 'key-a' } },
        );

        act(() => result.current[1]('val-a'));
        expect(setPreferenceCookie).toHaveBeenCalledWith('key-a', 'val-a');

        rerender({ key: 'key-b' });

        act(() => result.current[1]('val-b'));
        expect(setPreferenceCookie).toHaveBeenCalledWith('key-b', 'val-b');
    });
});
