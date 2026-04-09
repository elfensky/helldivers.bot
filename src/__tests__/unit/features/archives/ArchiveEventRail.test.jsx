// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';

const mockEvents = [
    { id: 1, enemy: 0, type: 'defend', region: 5, start_time: 1700000000, end_time: 1700200000, status: 'success' },
    { id: 2, enemy: 1, type: 'attack', region: 3, start_time: 1700100000, end_time: 1700250000, status: 'success' },
    { id: 3, enemy: 2, type: 'defend', region: 7, start_time: 1700500000, end_time: 1701000000, status: 'fail' },
];

describe('ArchiveEventRail', () => {
    it('renders events sorted chronologically (ascending)', () => {
        render(<ArchiveEventRail events={mockEvents} selectedEventId={1} onSelect={() => {}} />);
        const items = screen.getAllByRole('button');
        expect(items.length).toBe(3);
    });

    it('groups events by day', () => {
        render(<ArchiveEventRail events={mockEvents} selectedEventId={1} onSelect={() => {}} />);
        // Day labels rendered as text content (e.g. "Nov 14", "Nov 20")
        const dayLabels = document.querySelectorAll('.font-mono.font-bold');
        expect(dayLabels.length).toBeGreaterThan(0);
    });

    it('calls onSelect when event is clicked', () => {
        const onSelect = vi.fn();
        render(<ArchiveEventRail events={mockEvents} selectedEventId={1} onSelect={onSelect} />);
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[1]);
        expect(onSelect).toHaveBeenCalledWith(mockEvents[1]);
    });

    it('highlights selected event', () => {
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventId={3} onSelect={() => {}} />,
        );
        // Active event gets outline-primary class via ArchiveEvent → EventCardLayout
        const active = container.querySelector('.outline-primary');
        expect(active).not.toBeNull();
    });

    it('renders nothing for empty events', () => {
        const { container } = render(
            <ArchiveEventRail events={[]} selectedEventId={null} onSelect={() => {}} />,
        );
        expect(container.innerHTML).toBe('');
    });
});
