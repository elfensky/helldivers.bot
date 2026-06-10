// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@/shared/utils/cookies.mjs', () => ({
    setPreferenceCookie: vi.fn(),
}));

import { useCascadeLogSort } from '@/features/timeline/useCascadeLogSort.mjs';
import { setPreferenceCookie } from '@/shared/utils/cookies.mjs';

describe('useCascadeLogSort', () => {
    beforeEach(() => {
        setPreferenceCookie.mockReset();
    });

    it('uses the initial value', () => {
        const { result } = renderHook(() => useCascadeLogSort('recent'));
        expect(result.current[0]).toBe('recent');
    });

    it('defaults to "worst" when initial is undefined', () => {
        const { result } = renderHook(() => useCascadeLogSort());
        expect(result.current[0]).toBe('worst');
    });

    it('toggles worst → recent → worst', () => {
        const { result } = renderHook(() => useCascadeLogSort('worst'));
        act(() => result.current[1]());
        expect(result.current[0]).toBe('recent');
        act(() => result.current[1]());
        expect(result.current[0]).toBe('worst');
    });

    it('writes the new value to the preference cookie on toggle', () => {
        const { result } = renderHook(() => useCascadeLogSort('worst'));
        act(() => result.current[1]());
        expect(setPreferenceCookie).toHaveBeenCalledWith('cascade-log-sort', 'recent');
    });
});
