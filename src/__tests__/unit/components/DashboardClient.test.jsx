// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/components/h1/Dashboard/DashboardClient.css', () => ({}));
vi.mock('@/components/h1/Alerts/Alerts', () => ({
    default: () => <div data-testid="alerts" />,
}));
vi.mock('@/components/h1/Galaxy/Galaxy', () => ({
    default: () => <div data-testid="galaxy" />,
}));
vi.mock('@/components/h1/Galaxy/EventCard', () => ({
    default: () => <div data-testid="event-card" />,
    computeFrontier: vi.fn(() => null),
}));
vi.mock('@/components/h1/FactionTabs/FactionTabs', () => ({
    default: ({ active, onChange }) => (
        <div data-testid="faction-tabs">
            <button onClick={() => onChange('bugs')}>Bugs</button>
        </div>
    ),
}));
vi.mock('@/components/h1/StatGrid/StatGrid', () => ({
    default: ({ faction }) => <div data-testid="stat-grid">{faction}</div>,
}));
vi.mock('@/utils/evaluateProgress.mjs', () => ({
    evaluateProgress: vi.fn(() => null),
}));
vi.mock('@/utils/formatTimeAgo.mjs', () => ({
    formatTimeAgo: vi.fn(() => 'Updated 5 minutes ago'),
}));

import DashboardClient from '@/components/h1/Dashboard/DashboardClient';

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
    test('renders child components', () => {
        render(<DashboardClient data={testData} mapState={testMapState} />);
        expect(screen.getByTestId('alerts')).toBeInTheDocument();
        expect(screen.getByTestId('galaxy')).toBeInTheDocument();
        expect(screen.getByTestId('faction-tabs')).toBeInTheDocument();
        expect(screen.getByTestId('stat-grid')).toBeInTheDocument();
    });

    test('shows "Stats — Global" heading initially', () => {
        render(<DashboardClient data={testData} mapState={testMapState} />);
        expect(screen.getByText('Stats — Global')).toBeInTheDocument();
    });

    test('click Bugs tab updates stat-grid faction', () => {
        render(<DashboardClient data={testData} mapState={testMapState} />);
        fireEvent.click(screen.getByText('Bugs'));
        expect(screen.getByTestId('stat-grid').textContent).toBe('bugs');
    });

    test('renders scroll hint button', () => {
        render(<DashboardClient data={testData} mapState={testMapState} />);
        const button = screen.getByRole('button', { name: /event log/i });
        expect(button).toBeInTheDocument();
    });
});
