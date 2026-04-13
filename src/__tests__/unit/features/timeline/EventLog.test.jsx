// @vitest-environment jsdom
import { vi } from 'vitest';
import { render } from '@testing-library/react';

import EventLog from '@/features/timeline/EventLog';

const NOW = 1700000000;

describe('EventLog', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(NOW * 1000));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    const fakeEvents = [
        {
            event_id: 1,
            type: 'defend',
            status: 'active',
            enemy: 0,
            points: 500,
            points_max: 1000,
            start_time: NOW - 500,
            end_time: NOW + 500,
            region: 3,
        },
    ];

    test('default layout does not apply the stack modifier class', () => {
        const { container } = render(<EventLog events={fakeEvents} timeFormat="live" />);
        const daysContainer = container.querySelector('.event-log-days');
        expect(daysContainer).toBeInTheDocument();
        expect(daysContainer.classList.contains('event-log-days--stack')).toBe(false);
    });

    test('layout="stack" applies the stack modifier class', () => {
        const { container } = render(
            <EventLog events={fakeEvents} timeFormat="absolute" layout="stack" />,
        );
        const daysContainer = container.querySelector('.event-log-days');
        expect(daysContainer).toBeInTheDocument();
        expect(daysContainer.classList.contains('event-log-days--stack')).toBe(true);
    });

    test('layout="grid" explicitly keeps the stack modifier absent', () => {
        const { container } = render(
            <EventLog events={fakeEvents} timeFormat="live" layout="grid" />,
        );
        const daysContainer = container.querySelector('.event-log-days');
        expect(daysContainer.classList.contains('event-log-days--stack')).toBe(false);
    });

    test('cards have data-event-key attributes for scroll-sync wiring', () => {
        const { container } = render(
            <EventLog events={fakeEvents} timeFormat="absolute" layout="stack" />,
        );
        const cards = container.querySelectorAll('[data-event-key]');
        expect(cards.length).toBeGreaterThan(0);
        expect(cards[0].getAttribute('data-event-key')).toBe('defend-1');
    });
});
