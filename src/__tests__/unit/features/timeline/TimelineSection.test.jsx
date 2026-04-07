// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

vi.mock('@/components/h1/Timeline/TimelineSection.css', () => ({}));
vi.mock('@/features/timeline/groupEventsByDay.mjs', () => ({
    groupEventsByDay: vi.fn(() => []),
}));
vi.mock('@/features/timeline/Event', () => ({
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

import { groupEventsByDay } from '@/features/timeline/groupEventsByDay.mjs';
import TimelineSection from '@/features/timeline/TimelineSection';

describe('TimelineSection', () => {
    beforeEach(() => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: { events: [] },
            mapState: null,
            status: 'live',
            prevData: null,
            isLeader: false,
        });
    });

    test('shows "No events recorded yet" when no events', () => {
        groupEventsByDay.mockReturnValue([]);
        render(<TimelineSection />);
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
        render(<TimelineSection />);
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
        render(<TimelineSection />);
        expect(screen.getByText('Jan 15')).toBeInTheDocument();
        expect(screen.getByText('1W / 1L')).toBeInTheDocument();
    });

    test('handles null data gracefully', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: null,
            mapState: null,
            status: 'connecting',
            prevData: null,
            isLeader: false,
        });
        groupEventsByDay.mockReturnValue([]);
        render(<TimelineSection />);
        expect(screen.getByText('No events recorded yet.')).toBeInTheDocument();
    });
});
