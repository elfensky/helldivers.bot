// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/utils/evaluateProgress.mjs', () => ({
    evaluateProgress: vi.fn(() => ({ status: 'ahead', label: 'Ahead by 50 points' })),
}));

import Event from '@/components/h1/Event/Event';

const NOW = 1700000000;

describe('Event', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW * 1000));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const activeEvent = {
        event_id: 1,
        type: 'defend',
        status: 'active',
        enemy: 0,
        points: 500,
        points_max: 1000,
        start_time: NOW - 500,
        end_time: NOW + 500,
        region: 3,
    };

    test('renders "Active defend Event" text', () => {
        render(<Event event={activeEvent} />);
        expect(screen.getByText('Active defend Event')).toBeInTheDocument();
    });

    test('shows points display', () => {
        render(<Event event={activeEvent} />);
        expect(screen.getByText(/500 \/ 1000/)).toBeInTheDocument();
    });

    test('shows progress bar in non-compact mode', () => {
        const { container } = render(<Event event={activeEvent} />);
        // Progress bar is the div with bg-primary inside bg-danger
        const bars = container.querySelectorAll('.bg-danger .bg-primary');
        expect(bars.length).toBeGreaterThan(0);
    });

    test('hides progress bar in compact mode for resolved events', () => {
        const resolvedEvent = { ...activeEvent, status: 'success' };
        const { container } = render(<Event event={resolvedEvent} compact />);
        const bars = container.querySelectorAll('.bg-danger .bg-primary');
        expect(bars.length).toBe(0);
    });

    test('calls onMouseEnter/onMouseLeave callbacks', () => {
        const onEnter = vi.fn();
        const onLeave = vi.fn();
        render(
            <Event event={activeEvent} onMouseEnter={onEnter} onMouseLeave={onLeave} />,
        );
        const article = screen.getByRole('article');
        fireEvent.mouseEnter(article);
        expect(onEnter).toHaveBeenCalledTimes(1);
        fireEvent.mouseLeave(article);
        expect(onLeave).toHaveBeenCalledTimes(1);
    });

    test('shows faction icon', () => {
        render(<Event event={activeEvent} />);
        const icon = screen.getByAltText('Bugs');
        expect(icon).toBeInTheDocument();
        expect(icon.getAttribute('src')).toBe('/icons/faction0.webp');
    });
});
