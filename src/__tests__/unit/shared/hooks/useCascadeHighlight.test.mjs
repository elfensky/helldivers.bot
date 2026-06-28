// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCascadeHighlight } from '@/shared/hooks/useCascadeHighlight.mjs';

const ev = (id) => ({ type: 'defend', event_id: id });
const cascades = [{ events: [ev(1), ev(2), ev(3)] }];

describe('useCascadeHighlight', () => {
    beforeEach(() => {
        window.location.hash = '';
    });
    afterEach(() => {
        window.location.hash = '';
    });

    it('pinCascade sets highlightedKeys to every event key in the cascade', () => {
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys).toBeNull();
        act(() => {
            result.current.pinCascade(cascades[0]);
        });
        expect([...result.current.highlightedKeys].sort()).toEqual([
            'defend-1',
            'defend-2',
            'defend-3',
        ]);
    });

    it('resolves an existing location.hash on mount', () => {
        window.location.hash = '#defend-2';
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys?.has('defend-2')).toBe(true);
    });

    it('ignores a hash that matches no cascade', () => {
        window.location.hash = '#defend-999';
        const railRef = { current: null };
        const { result } = renderHook(() => useCascadeHighlight(cascades, railRef));
        expect(result.current.highlightedKeys).toBeNull();
    });
});
