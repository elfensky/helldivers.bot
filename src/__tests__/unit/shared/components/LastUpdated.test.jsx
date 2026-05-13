// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';

import LastUpdated from '@/shared/components/LastUpdated';

describe('LastUpdated', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('returns null when lastUpdated is missing', () => {
        const { container } = render(<LastUpdated />);
        expect(container.innerHTML).toBe('');
    });

    test('renders formatTimeAgo output', () => {
        const thirtySecondsAgo = new Date(Date.now() - 30_000);
        render(<LastUpdated lastUpdated={thirtySecondsAgo} />);
        expect(screen.getByText(/Updated \d+s ago/)).toBeInTheDocument();
    });

    test('ticks every second', () => {
        const start = new Date();
        render(<LastUpdated lastUpdated={start} />);
        expect(screen.getByText(/Updated 0s ago/)).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1_000);
        });
        expect(screen.getByText(/Updated 1s ago/)).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1_000);
        });
        expect(screen.getByText(/Updated 2s ago/)).toBeInTheDocument();
    });

    test('clears the interval on unmount', () => {
        const { unmount } = render(<LastUpdated lastUpdated={new Date()} />);
        expect(vi.getTimerCount()).toBe(1);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});
