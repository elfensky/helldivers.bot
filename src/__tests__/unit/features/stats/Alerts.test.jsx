// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/h1/Alerts/Alerts.css', () => ({}));
vi.mock('@/features/stats/evaluateProgress.mjs', () => ({
    evaluateProgress: vi.fn(() => ({ status: 'ahead', label: 'Ahead by 50 points' })),
}));

import Alerts from '@/features/stats/Alerts';

const NOW = 1700000000;

describe('Alerts', () => {
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
        start_time: NOW - 1000,
        end_time: NOW + 1000,
        region: 1,
    };

    test('returns null when no active events', () => {
        const { container } = render(<Alerts data={{ events: [] }} />);
        expect(container.innerHTML).toBe('');
    });

    test('renders alert for each active event', () => {
        const secondEvent = { ...activeEvent, event_id: 2, enemy: 1, region: 2 };
        render(<Alerts data={{ events: [activeEvent, secondEvent] }} />);
        const items = screen.getAllByText(/Active defend Event/);
        expect(items).toHaveLength(2);
    });

    test('shows event type text', () => {
        render(<Alerts data={{ events: [activeEvent] }} />);
        expect(screen.getByText('Active defend Event')).toBeInTheDocument();
    });

    test('shows progress bar with role="progressbar"', () => {
        render(<Alerts data={{ events: [activeEvent] }} />);
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    test('filters out non-active events', () => {
        const finishedEvent = { ...activeEvent, event_id: 3, status: 'success' };
        render(<Alerts data={{ events: [finishedEvent] }} />);
        expect(screen.queryByText(/Active defend Event/)).not.toBeInTheDocument();
    });
});
