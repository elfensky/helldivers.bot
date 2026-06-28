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

    test('does not render an empty TODAY section when today has no events', () => {
        const pastEvent = {
            ...fakeEvents[0],
            start_time: NOW - 5 * 86400,
            end_time: NOW - 5 * 86400 + 500,
        };
        const { container } = render(<EventLog events={[pastEvent]} timeFormat="live" />);
        expect(container.querySelector('.event-log-day--no-events')).toBeNull();
        // only the real event's day group renders — no synthetic TODAY marker
        expect(container.querySelectorAll('.event-log-day')).toHaveLength(1);
    });

    test('cards have data-event-key attributes for scroll-sync wiring', () => {
        const { container } = render(
            <EventLog events={fakeEvents} timeFormat="absolute" layout="stack" />,
        );
        const cards = container.querySelectorAll('[data-event-key]');
        expect(cards.length).toBeGreaterThan(0);
        expect(cards[0].getAttribute('data-event-key')).toBe('defend-1');
    });

    test('marks cascade-highlighted cards with data-highlighted and data-faction', () => {
        const { container } = render(
            <EventLog
                events={fakeEvents}
                timeFormat="absolute"
                layout="stack"
                highlightedKeys={new Set(['defend-1'])}
            />,
        );
        const wrapper = container.querySelector('[data-event-key="defend-1"]');
        expect(wrapper.getAttribute('data-faction')).toBe('0');
        expect(wrapper.hasAttribute('data-highlighted')).toBe(true);
    });

    test('omits data-highlighted when the key is not in highlightedKeys', () => {
        const { container } = render(
            <EventLog
                events={fakeEvents}
                timeFormat="absolute"
                layout="stack"
                highlightedKeys={new Set(['defend-999'])}
            />,
        );
        const wrapper = container.querySelector('[data-event-key="defend-1"]');
        expect(wrapper.getAttribute('data-faction')).toBe('0');
        expect(wrapper.hasAttribute('data-highlighted')).toBe(false);
    });
});
