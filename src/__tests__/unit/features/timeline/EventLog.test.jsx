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

    describe('intro markers (archives opt-in)', () => {
        const introMarkers = [
            {
                kind: 'intro',
                enemy: 2,
                name: 'Illuminate',
                time: NOW - 400,
                day: 4,
                isWarStart: false,
            },
        ];

        test('renders an intro marker row when introMarkers is provided', () => {
            const { container } = render(
                <EventLog
                    events={fakeEvents}
                    timeFormat="absolute"
                    layout="stack"
                    introMarkers={introMarkers}
                />,
            );
            const marker = container.querySelector('.event-log-intro');
            expect(marker).toBeInTheDocument();
            expect(marker.textContent).toContain('Day 4');
            expect(marker.textContent).toContain('Illuminate enter the war');
        });

        test('war-start marker reads "declare war" instead of "enter the war"', () => {
            const { container } = render(
                <EventLog
                    events={fakeEvents}
                    timeFormat="absolute"
                    layout="stack"
                    introMarkers={[
                        {
                            kind: 'intro',
                            enemy: 0,
                            name: 'Bugs',
                            time: NOW - 800,
                            day: 1,
                            isWarStart: true,
                        },
                    ]}
                />,
            );
            const marker = container.querySelector('.event-log-intro');
            expect(marker.textContent).toContain('Day 1');
            expect(marker.textContent).toContain('Bugs declare war');
            expect(marker.textContent).not.toContain('enter the war');
        });

        test('does NOT render any intro marker when introMarkers is empty', () => {
            const { container } = render(
                <EventLog
                    events={fakeEvents}
                    timeFormat="absolute"
                    layout="stack"
                    introMarkers={[]}
                />,
            );
            expect(container.querySelector('.event-log-intro')).toBeNull();
        });

        test('output is identical with the default (omitted) introMarkers prop', () => {
            const withDefault = render(
                <EventLog events={fakeEvents} timeFormat="absolute" layout="stack" />,
            ).container.innerHTML;
            const withEmpty = render(
                <EventLog
                    events={fakeEvents}
                    timeFormat="absolute"
                    layout="stack"
                    introMarkers={[]}
                />,
            ).container.innerHTML;
            expect(withEmpty).toBe(withDefault);
        });

        test('markers are not treated as events (no data-event-key, no W/L count)', () => {
            const { container } = render(
                <EventLog
                    events={[]}
                    timeFormat="absolute"
                    layout="stack"
                    introMarkers={introMarkers}
                />,
            );
            // The marker renders but contributes no event card / scroll-sync key
            expect(container.querySelector('.event-log-intro')).toBeInTheDocument();
            expect(container.querySelector('[data-event-key]')).toBeNull();
            // No outcome summary when the day holds only an intro marker
            expect(container.querySelector('.event-log-day-summary')).toBeNull();
        });
    });

    describe('futureSlot', () => {
        const slot = <div data-testid="future-content">forecast</div>;
        const labels = (container) =>
            [...container.querySelectorAll('.event-log-day-label')].map(
                (el) => el.textContent,
            );

        test('renders the slot under a FUTURE label before day groups (newest first)', () => {
            const { container, getByTestId } = render(
                <EventLog events={fakeEvents} timeFormat="absolute" futureSlot={slot} />,
            );
            expect(getByTestId('future-content')).toBeInTheDocument();
            expect(labels(container)[0]).toBe('FUTURE');
            // No win/loss summary on the future group
            const futureGroup = container.querySelector('.event-log-day');
            expect(futureGroup.querySelector('.event-log-day-summary')).toBeNull();
        });

        test('renders after the day groups when sorting oldest first', () => {
            const { container } = render(
                <EventLog
                    events={fakeEvents}
                    timeFormat="absolute"
                    futureSlot={slot}
                    initialSortOrder="asc"
                />,
            );
            const all = labels(container);
            expect(all[all.length - 1]).toBe('FUTURE');
            expect(all[0]).not.toBe('FUTURE');
        });

        test('no FUTURE group when the slot is null (default)', () => {
            const { container } = render(
                <EventLog events={fakeEvents} timeFormat="absolute" />,
            );
            expect(labels(container)).not.toContain('FUTURE');
        });

        test('renders the future group even when no events exist yet', () => {
            const { container, getByTestId, queryByText } = render(
                <EventLog events={[]} timeFormat="absolute" futureSlot={slot} />,
            );
            expect(getByTestId('future-content')).toBeInTheDocument();
            expect(queryByText('No events recorded yet.')).toBeNull();
            expect(labels(container)).toEqual(['FUTURE']);
        });
    });
});
