// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventLogSort } from '@/features/timeline/useEventLogSort.mjs';

const STORAGE_KEY = 'event-log-sort';

describe('useEventLogSort', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('defaults to desc when no stored value', () => {
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('desc');
    });

    test('restores asc from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEY, 'asc');
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('asc');
    });

    test('restores desc from localStorage on mount', () => {
        localStorage.setItem(STORAGE_KEY, 'desc');
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('desc');
    });

    test('ignores malformed localStorage value and keeps default', () => {
        localStorage.setItem(STORAGE_KEY, 'sideways');
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('desc');
    });

    test('toggle flips desc → asc and persists', () => {
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('desc');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('asc');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('asc');
    });

    test('toggle flips asc → desc and persists', () => {
        localStorage.setItem(STORAGE_KEY, 'asc');
        const { result } = renderHook(() => useEventLogSort());
        expect(result.current[0]).toBe('asc');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('desc');
        expect(localStorage.getItem(STORAGE_KEY)).toBe('desc');
    });
});
