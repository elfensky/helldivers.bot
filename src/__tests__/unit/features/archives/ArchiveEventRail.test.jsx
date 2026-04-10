// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchiveEventRail from '@/features/archives/ArchiveEventRail';
import React from 'react';

const mockEvents = [
    { event_id: 1, enemy: 0, type: 'defend', region: 5, start_time: 1700000000, end_time: 1700200000, status: 'success' },
    { event_id: 2, enemy: 1, type: 'attack', region: 3, start_time: 1700100000, end_time: 1700250000, status: 'success' },
    { event_id: 3, enemy: 2, type: 'defend', region: 7, start_time: 1700500000, end_time: 1701000000, status: 'fail' },
];

describe('ArchiveEventRail', () => {
    it('renders all events', () => {
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventKey="defend-1" />,
        );
        const cards = container.querySelectorAll('[data-event-key]');
        expect(cards.length).toBe(3);
    });

    it('groups events by day with dashboard timeline classes', () => {
        render(<ArchiveEventRail events={mockEvents} selectedEventKey="defend-1" />);
        const dayLabels = document.querySelectorAll('.timeline-day-label');
        expect(dayLabels.length).toBeGreaterThan(0);
    });

    it('adds data-event-key attributes for scroll observation', () => {
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventKey={null} />,
        );
        const keys = [...container.querySelectorAll('[data-event-key]')].map(
            (el) => el.dataset.eventKey,
        );
        expect(keys).toContain('defend-1');
        expect(keys).toContain('attack-2');
        expect(keys).toContain('defend-3');
    });

    it('highlights selected event', () => {
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventKey="defend-3" />,
        );
        const active = container.querySelector('.border-l-primary');
        expect(active).not.toBeNull();
    });

    it('attaches railRef to container', () => {
        const ref = React.createRef();
        const { container } = render(
            <ArchiveEventRail events={mockEvents} selectedEventKey={null} railRef={ref} />,
        );
        expect(ref.current).toBe(container.firstChild);
    });

    it('renders nothing for empty events', () => {
        const { container } = render(
            <ArchiveEventRail events={[]} selectedEventKey={null} />,
        );
        expect(container.innerHTML).toBe('');
    });
});
