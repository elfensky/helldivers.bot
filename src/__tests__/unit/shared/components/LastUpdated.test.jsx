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
        expect(screen.getByText(/Updated \d+ seconds? ago/)).toBeInTheDocument();
    });

    test('ticks every second', () => {
        const start = new Date();
        render(<LastUpdated lastUpdated={start} />);
        expect(screen.getByText('Updated just now')).toBeInTheDocument();

        act(() => {
            vi.advanceTimersByTime(1_000);
        });
        // timeago.js shows "just now" for the first few seconds
        expect(screen.getByText('Updated just now')).toBeInTheDocument();

        // Advance enough time to show actual seconds (timeago.js typically shows "just now" for < 10 seconds)
        act(() => {
            vi.advanceTimersByTime(10_000);
        });
        // After 10+ seconds, it should show the actual time
        expect(screen.getByText(/Updated \d+ seconds? ago/)).toBeInTheDocument();
    });

    test('clears the interval on unmount', () => {
        const { unmount } = render(<LastUpdated lastUpdated={new Date()} />);
        expect(vi.getTimerCount()).toBe(1);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });
});