// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/h1/Timeline/TimelineSection.css', () => ({}));
vi.mock('@/utils/groupEventsByDay.mjs', () => ({
    groupEventsByDay: vi.fn(() => []),
}));
vi.mock('@/components/h1/Event/Event', () => ({
    default: vi.fn(({ event, onMouseEnter, onMouseLeave }) => (
        <div
            data-testid={`event-${event.event_id}`}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {event.type}
        </div>
    )),
}));

import { groupEventsByDay } from '@/utils/groupEventsByDay.mjs';
import TimelineSection from '@/components/h1/Timeline/TimelineSection';

describe('TimelineSection', () => {
    test('shows "No events recorded yet" when no events', () => {
        groupEventsByDay.mockReturnValue([]);
        render(<TimelineSection events={[]} />);
        expect(screen.getByText('No events recorded yet.')).toBeInTheDocument();
    });

    test('renders grouped events by day', () => {
        groupEventsByDay.mockReturnValue([
            {
                date: '2025-01-15',
                label: 'Jan 15',
                events: [
                    {
                        event_id: 1,
                        type: 'defend',
                        status: 'success',
                        start_time: 1705300000,
                        end_time: 1705310000,
                        enemy: 0,
                        points: 100,
                        points_max: 100,
                        region: 1,
                    },
                    {
                        event_id: 2,
                        type: 'attack',
                        status: 'fail',
                        start_time: 1705320000,
                        end_time: 1705330000,
                        enemy: 1,
                        points: 50,
                        points_max: 100,
                        region: 2,
                    },
                ],
            },
        ]);
        render(<TimelineSection events={[]} />);
        expect(screen.getByTestId('event-1')).toBeInTheDocument();
        expect(screen.getByTestId('event-2')).toBeInTheDocument();
    });

    test('shows day labels and W/L summary', () => {
        groupEventsByDay.mockReturnValue([
            {
                date: '2025-01-15',
                label: 'Jan 15',
                events: [
                    {
                        event_id: 1,
                        type: 'defend',
                        status: 'success',
                        start_time: 1705300000,
                        end_time: 1705310000,
                        enemy: 0,
                        points: 100,
                        points_max: 100,
                        region: 1,
                    },
                    {
                        event_id: 2,
                        type: 'attack',
                        status: 'fail',
                        start_time: 1705320000,
                        end_time: 1705330000,
                        enemy: 1,
                        points: 50,
                        points_max: 100,
                        region: 2,
                    },
                ],
            },
        ]);
        render(<TimelineSection events={[]} />);
        expect(screen.getByText('Jan 15')).toBeInTheDocument();
        expect(screen.getByText('1W / 1L')).toBeInTheDocument();
    });
});
