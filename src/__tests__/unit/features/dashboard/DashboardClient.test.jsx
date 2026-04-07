// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

vi.mock('@/components/h1/Dashboard/DashboardClient.css', () => ({}));
vi.mock('@/features/notifications/NotificationToggle', () => ({
    default: () => null,
}));
vi.mock('@/features/galaxy/Galaxy', () => ({
    default: () => <div data-testid="galaxy" />,
}));
vi.mock('@/features/galaxy/EventCard', () => ({
    default: () => <div data-testid="event-card" />,
    computeFrontier: vi.fn(() => null),
}));
vi.mock('@/features/dashboard/FactionTabs', () => ({
    default: ({ active, onChange }) => (
        <div data-testid="faction-tabs">
            <button onClick={() => onChange('bugs')}>Bugs</button>
        </div>
    ),
}));
vi.mock('@/features/stats/StatGrid', () => ({
    default: ({ faction }) => <div data-testid="stat-grid">{faction}</div>,
}));
vi.mock('@/features/stats/evaluateProgress.mjs', () => ({
    evaluateProgress: vi.fn(() => null),
}));

import DashboardClient from '@/features/dashboard/DashboardClient';

const testData = {
    live: [
        {
            enemy: 0,
            players: 100,
            kills: 500,
            deaths: 50,
            accidentals: 10,
            successful_missions: 30,
            missions: 40,
        },
    ],
    events: [],
    last_updated: '2025-01-01',
};

const testMapState = { 0: {}, 1: {}, 2: {} };

describe('DashboardClient', () => {
    beforeEach(() => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: testData,
            mapState: testMapState,
            status: 'live',
            prevData: null,
            isLeader: true,
        });
    });

    test('renders child components', () => {
        render(<DashboardClient />);
        expect(screen.getByTestId('galaxy')).toBeInTheDocument();
        expect(screen.getByTestId('faction-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('stat-grid')).toBeInTheDocument();
    });

    test('shows "Stats — Global" heading initially', () => {
        render(<DashboardClient />);
        expect(screen.getByText('Stats — Global')).toBeInTheDocument();
    });

    test('click Bugs tab updates stat-grid faction', () => {
        render(<DashboardClient />);
        fireEvent.click(screen.getByText('Bugs'));
        expect(screen.getByTestId('stat-grid').textContent).toBe('bugs');
    });

    test('renders scroll hint button', () => {
        render(<DashboardClient />);
        const button = screen.getByRole('button', { name: /event log/i });
        expect(button).toBeInTheDocument();
    });

    test('shows SIGNAL LOST when data is null', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: null,
            mapState: null,
            status: 'connecting',
            prevData: null,
            isLeader: false,
        });
        render(<DashboardClient />);
        expect(screen.getByText('SIGNAL LOST')).toBeInTheDocument();
    });
});
