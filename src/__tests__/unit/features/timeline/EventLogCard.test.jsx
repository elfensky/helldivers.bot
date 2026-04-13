// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import EventLogCard from '@/features/timeline/EventLogCard';

const NOW = 1700000000;

describe('EventLogCard', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW * 1000));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const activeDefend = {
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

    describe('live timeFormat', () => {
        test('renders action label + region', () => {
            render(<EventLogCard event={activeDefend} timeFormat="live" />);
            expect(screen.getByText('Defending Ross System')).toBeInTheDocument();
        });

        test('renders ticking "Started X ago" text', () => {
            render(<EventLogCard event={activeDefend} timeFormat="live" />);
            expect(screen.getByText(/Started .* ago/)).toBeInTheDocument();
        });

        test('shows points progress', () => {
            render(<EventLogCard event={activeDefend} timeFormat="live" />);
            expect(screen.getByText(/500 \/ 1000/)).toBeInTheDocument();
        });

        test('won status uses success styling', () => {
            const wonEvent = { ...activeDefend, status: 'success' };
            const { container } = render(
                <EventLogCard event={wonEvent} timeFormat="live" />,
            );
            expect(screen.getByText('Defended Ross System')).toBeInTheDocument();
            expect(container.querySelector('.bg-success')).toBeInTheDocument();
        });

        test('failed status uses muted styling + "Lost [region]" label', () => {
            const failedEvent = { ...activeDefend, status: 'fail' };
            const { container } = render(
                <EventLogCard event={failedEvent} timeFormat="live" />,
            );
            expect(screen.getByText('Lost Ross System')).toBeInTheDocument();
            expect(container.querySelector('.bg-ghost')).toBeInTheDocument();
        });

        test('renders "Ended X ago" for completed events', () => {
            const completedEvent = { ...activeDefend, status: 'success' };
            render(<EventLogCard event={completedEvent} timeFormat="live" />);
            expect(screen.getByText(/Ended .* ago/)).toBeInTheDocument();
        });

        test('fires onMouseEnter/onMouseLeave callbacks', () => {
            const onEnter = vi.fn();
            const onLeave = vi.fn();
            render(
                <EventLogCard
                    event={activeDefend}
                    timeFormat="live"
                    onMouseEnter={onEnter}
                    onMouseLeave={onLeave}
                />,
            );
            const article = screen.getByRole('article');
            fireEvent.mouseEnter(article);
            expect(onEnter).toHaveBeenCalledTimes(1);
            fireEvent.mouseLeave(article);
            expect(onLeave).toHaveBeenCalledTimes(1);
        });

        test('shows faction icon', () => {
            render(<EventLogCard event={activeDefend} timeFormat="live" />);
            const icon = screen.getByAltText('Bugs');
            expect(icon).toBeInTheDocument();
            expect(icon.getAttribute('src')).toBe('/icons/faction0.webp');
        });

        test('isSelected applies highlight classes', () => {
            const { container } = render(
                <EventLogCard event={activeDefend} timeFormat="live" isSelected />,
            );
            expect(container.querySelector('.border-l-primary')).toBeInTheDocument();
            expect(container.querySelector('.\\!bg-primary-tint')).toBeInTheDocument();
        });
    });

    describe('absolute timeFormat', () => {
        test('renders "Started" + absolute date for active events', () => {
            render(<EventLogCard event={activeDefend} timeFormat="absolute" />);
            // Should contain "Started" prefix and a 4-digit year
            const line = screen.getByText(/Started.*202[0-9]/);
            expect(line).toBeInTheDocument();
            // Should NOT contain "ago"
            expect(line.textContent).not.toMatch(/ago/);
        });

        test('renders "Ended" + absolute date for completed events', () => {
            const completedEvent = { ...activeDefend, status: 'success' };
            render(<EventLogCard event={completedEvent} timeFormat="absolute" />);
            const line = screen.getByText(/Ended.*202[0-9]/);
            expect(line).toBeInTheDocument();
            expect(line.textContent).not.toMatch(/ago/);
        });

        test('still shows points progress', () => {
            render(<EventLogCard event={activeDefend} timeFormat="absolute" />);
            expect(screen.getByText(/500 \/ 1000/)).toBeInTheDocument();
        });

        test('duration pill shows end−start duration for completed event', () => {
            const completedEvent = {
                ...activeDefend,
                status: 'success',
                start_time: NOW - 1000,
                end_time: NOW,
            };
            render(<EventLogCard event={completedEvent} timeFormat="absolute" />);
            // 1000 seconds ≈ 16m40s — formatCompactDuration produces something like "16m"
            expect(screen.getByText(/\d+m/)).toBeInTheDocument();
        });
    });
});
