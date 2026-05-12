// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersistedState } from '@/shared/hooks/usePersistedState.mjs';

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('usePersistedState — initial value', () => {
    // React Testing Library's renderHook commits the mount effect before
    // exposing result.current, so the visible state after renderHook is
    // "post-effect": the stored value when present, otherwise defaultValue.

    test('after mount, hydrates from localStorage when key is present', () => {
        localStorage.setItem('test-key', 'stored-value');
        const { result } = renderHook(() => usePersistedState('test-key', 'default'));
        expect(result.current[0]).toBe('stored-value');
    });

    test('after mount, keeps defaultValue when localStorage key is absent', () => {
        const { result } = renderHook(() => usePersistedState('missing-key', 'fallback'));
        expect(result.current[0]).toBe('fallback');
    });
});

describe('usePersistedState — isValid validator', () => {
    test('without validator, accepts any stored string', () => {
        localStorage.setItem('faction', 'illuminate');
        const { result } = renderHook(() => usePersistedState('faction', 'global'));
        expect(result.current[0]).toBe('illuminate');
    });

    test('with validator, accepts a stored value the validator returns true for', () => {
        const isValid = vi.fn((v) =>
            ['bugs', 'cyborgs', 'illuminate', 'global'].includes(v),
        );
        localStorage.setItem('faction', 'bugs');

        const { result } = renderHook(() =>
            usePersistedState('faction', 'global', isValid),
        );

        expect(result.current[0]).toBe('bugs');
        expect(isValid).toHaveBeenCalledWith('bugs');
    });

    test('with validator, rejects stored value and keeps default when validator returns false', () => {
        const isValid = vi.fn((v) => ['asc', 'desc'].includes(v));
        // Garbage from a previous version of the app.
        localStorage.setItem('event-log-sort', 'sideways');

        const { result } = renderHook(() =>
            usePersistedState('event-log-sort', 'desc', isValid),
        );

        expect(result.current[0]).toBe('desc');
        expect(isValid).toHaveBeenCalledWith('sideways');
    });

    test('validator is called with the raw string from localStorage (no pre-parsing)', () => {
        const isValid = vi.fn(() => true);
        localStorage.setItem('key', 'some-string-value');

        renderHook(() => usePersistedState('key', 'default', isValid));

        // Always a string — the hook never parses JSON for the consumer.
        expect(isValid).toHaveBeenCalledWith('some-string-value');
    });
});

describe('usePersistedState — update setter', () => {
    test('calling update sets the state and writes to localStorage', () => {
        const { result } = renderHook(() => usePersistedState('test-key', 'default'));

        act(() => {
            result.current[1]('new-value');
        });

        expect(result.current[0]).toBe('new-value');
        expect(localStorage.getItem('test-key')).toBe('new-value');
    });

    test('repeated updates persist the latest value', () => {
        const { result } = renderHook(() => usePersistedState('test-key', 'default'));

        act(() => {
            result.current[1]('first');
        });
        act(() => {
            result.current[1]('second');
        });
        act(() => {
            result.current[1]('third');
        });

        expect(result.current[0]).toBe('third');
        expect(localStorage.getItem('test-key')).toBe('third');
    });

    test('update is a stable reference across re-renders while key is unchanged', () => {
        // Catches the bug where useCallback's dep array drops `key` (or adds
        // unstable deps), causing every consumer with `update` in their deps
        // to re-run effects on every render.
        const { result, rerender } = renderHook(() =>
            usePersistedState('test-key', 'default'),
        );
        const firstSetter = result.current[1];
        rerender();
        const secondSetter = result.current[1];
        rerender();
        const thirdSetter = result.current[1];

        expect(firstSetter).toBe(secondSetter);
        expect(secondSetter).toBe(thirdSetter);
    });

    test('update returns a new reference when key changes (re-binding)', () => {
        const { result, rerender } = renderHook(
            ({ key }) => usePersistedState(key, 'default'),
            { initialProps: { key: 'key-a' } },
        );
        const setterA = result.current[1];

        rerender({ key: 'key-b' });

        expect(result.current[1]).not.toBe(setterA);
    });
});

describe('usePersistedState — key changes', () => {
    test('changing the key re-reads localStorage from the new key', () => {
        localStorage.setItem('key-a', 'value-a');
        localStorage.setItem('key-b', 'value-b');

        const { result, rerender } = renderHook(
            ({ key }) => usePersistedState(key, 'default'),
            { initialProps: { key: 'key-a' } },
        );

        expect(result.current[0]).toBe('value-a');

        rerender({ key: 'key-b' });

        expect(result.current[0]).toBe('value-b');
    });

    test('changing the key writes future updates to the new key only', () => {
        const { result, rerender } = renderHook(
            ({ key }) => usePersistedState(key, 'default'),
            { initialProps: { key: 'key-a' } },
        );

        act(() => {
            result.current[1]('written-to-a');
        });
        expect(localStorage.getItem('key-a')).toBe('written-to-a');

        rerender({ key: 'key-b' });

        act(() => {
            result.current[1]('written-to-b');
        });
        expect(localStorage.getItem('key-b')).toBe('written-to-b');
        // Original key untouched by the post-rebind update.
        expect(localStorage.getItem('key-a')).toBe('written-to-a');
    });
});

describe('usePersistedState — localStorage failure modes', () => {
    test('getItem throwing does not crash the hook (falls back to default)', () => {
        const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('SecurityError', 'SecurityError');
        });

        const { result } = renderHook(() => usePersistedState('test-key', 'default'));

        expect(result.current[0]).toBe('default');
        expect(getItem).toHaveBeenCalled();
    });

    test('setItem throwing (quota / private mode) does not crash update', () => {
        const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('QuotaExceededError', 'QuotaExceededError');
        });

        const { result } = renderHook(() => usePersistedState('test-key', 'default'));

        expect(() => {
            act(() => {
                result.current[1]('new-value');
            });
        }).not.toThrow();

        // In-memory state still updates even if persist failed.
        expect(result.current[0]).toBe('new-value');
        expect(setItem).toHaveBeenCalled();
    });

    test('validator throwing is caught by the localStorage try/catch (falls back to default)', () => {
        // The mount effect's try/catch wraps the entire localStorage block —
        // including the isValid() call. So a throwing validator does NOT
        // surface to the consumer; the hook silently falls back to default.
        // This is the current contract; if it ever becomes "validators must
        // not throw and we surface them loudly", flip this test.
        const isValid = vi.fn(() => {
            throw new Error('validator boom');
        });
        localStorage.setItem('test-key', 'some-stored');

        const { result } = renderHook(() =>
            usePersistedState('test-key', 'default', isValid),
        );

        expect(isValid).toHaveBeenCalledWith('some-stored');
        expect(result.current[0]).toBe('default');
    });
});
