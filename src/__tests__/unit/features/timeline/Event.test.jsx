// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Event from '@/features/timeline/Event';

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

    test('renders "Defending [region]" text for active defend', () => {
        render(<Event event={activeEvent} />);
        expect(screen.getByText('Defending Ross System')).toBeInTheDocument();
    });

    test('shows points display', () => {
        render(<Event event={activeEvent} />);
        expect(screen.getByText(/500 \/ 1000/)).toBeInTheDocument();
    });

    test('does not render a progress bar', () => {
        const { container } = render(<Event event={activeEvent} />);
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

    test('renders "Defended [region]" for successful defend', () => {
        const wonEvent = { ...activeEvent, status: 'success' };
        const { container } = render(<Event event={wonEvent} />);
        expect(screen.getByText('Defended Ross System')).toBeInTheDocument();
        expect(container.querySelector('.bg-success')).toBeInTheDocument();
    });

    test('renders "Lost [region]" for failed defend', () => {
        const failedEvent = { ...activeEvent, status: 'fail' };
        const { container } = render(<Event event={failedEvent} />);
        expect(screen.getByText('Lost Ross System')).toBeInTheDocument();
        expect(container.querySelector('.bg-ghost')).toBeInTheDocument();
    });
});
