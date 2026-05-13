// @vitest-environment jsdom
import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEventLogSort } from '@/features/timeline/useEventLogSort.mjs';

const STORAGE_KEY = 'event-log-sort';

function clearCookies() {
    document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim();
        if (name) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
    });
}

describe('useEventLogSort', () => {
    beforeEach(() => {
        clearCookies();
    });

    test('uses initial value passed in', () => {
        const { result } = renderHook(() => useEventLogSort('desc'));
        expect(result.current[0]).toBe('desc');
    });

    test('accepts asc as initial value', () => {
        const { result } = renderHook(() => useEventLogSort('asc'));
        expect(result.current[0]).toBe('asc');
    });

    test('toggle flips desc → asc and persists to cookie', () => {
        const { result } = renderHook(() => useEventLogSort('desc'));
        expect(result.current[0]).toBe('desc');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('asc');
        expect(document.cookie).toContain(`${STORAGE_KEY}=asc`);
    });

    test('toggle flips asc → desc and persists to cookie', () => {
        const { result } = renderHook(() => useEventLogSort('asc'));
        expect(result.current[0]).toBe('asc');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('desc');
        expect(document.cookie).toContain(`${STORAGE_KEY}=desc`);
    });
});
