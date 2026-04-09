// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';

const mockEvents = [
    { event_id: 1, enemy: 0, type: 'defend', region: 5, start_time: 1700000000, end_time: 1700200000, status: 'success' },
    { event_id: 2, enemy: 1, type: 'attack', region: 3, start_time: 1700100000, end_time: 1700250000, status: 'success' },
    { event_id: 3, enemy: 2, type: 'defend', region: 7, start_time: 1700500000, end_time: 1701000000, status: 'fail' },
];

describe('ArchiveEventRail', () => {
    it('renders events sorted chronologically (ascending)', () => {
        render(<ArchiveEventRail events={mockEvents} selectedEventKey="defend-1" onSelect={() => {}} />);
        const items = screen.getAllByRole('button');
        expect(items.length).toBe(3);
    });

    it('groups events by day with dashboard timeline classes', () => {
        render(<ArchiveEventRail events={mockEvents} selectedEventKey="defend-1" onSelect={() => {}} />);
        const dayLabels = document.querySelectorAll('.timeline-day-label');
        expect(dayLabels.length).toBeGreaterThan(0);
    });

    it('calls onSelect when event is clicked', () => {
        const onSelect = vi.fn();
        render(<ArchiveEventRail events={mockEvents} selectedEventKey="defend-1" onSelect={onSelect} />);
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[1]);
        expect(onSelect).toHaveBeenCalledWith(mockEvents[1]);
    });

    it('highlights selected event', () => {
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventKey="defend-3" onSelect={() => {}} />,
        );
        const active = container.querySelector('.border-l-primary');
        expect(active).not.toBeNull();
    });

    it('renders nothing for empty events', () => {
        const { container } = render(
            <ArchiveEventRail events={[]} selectedEventKey={null} onSelect={() => {}} />,
        );
        expect(container.innerHTML).toBe('');
    });
});
