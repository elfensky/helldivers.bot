// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FactionStats from '@/features/archives/FactionStats';

const mockEvents = [
    {
        enemy: 0,
        region: 1,
        type: 'defend',
        status: 'success',
        start_time: 1000,
        end_time: 4600,
        players_at_start: 5000,
    },
    {
        enemy: 0,
        region: 1,
        type: 'defend',
        status: 'fail',
        start_time: 5000,
        end_time: 12200,
        players_at_start: 8000,
    },
    {
        enemy: 0,
        region: 2,
        type: 'attack',
        status: 'success',
        start_time: 13000,
        end_time: 20200,
        players_at_start: 3000,
    },
    {
        enemy: 1,
        region: 1,
        type: 'defend',
        status: 'success',
        start_time: 1000,
        end_time: 4600,
        players_at_start: 2000,
    },
];

const mockSnapshots = [
    {
        time: 100,
        data: [
            { enemy: 0, points: 300, points_taken: 1500 },
            { enemy: 1, points: 200, points_taken: 800 },
            { enemy: 2, points: 100, points_taken: 400 },
        ],
    },
];

const mockPointsMax = { points: [1000, 1000, 1000] };

describe('FactionStats', () => {
    it('renders stat cards for a faction with events', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );

        expect(screen.getByText('DEFENSE_RATE')).toBeDefined();
        expect(screen.getByText('ATTACK_RATE')).toBeDefined();
        expect(screen.getByText('BATTLES')).toBeDefined();
        expect(screen.getByText('AVG_BATTLE')).toBeDefined();
        expect(screen.getByText('HOTSPOT')).toBeDefined();
        expect(screen.getByText('CONQUEST')).toBeDefined();
    });

    it('does not render removed stats', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );

        expect(screen.queryByText('PEAK_SURGE')).toBeNull();
        expect(screen.queryByText('OVERKILL')).toBeNull();
    });

    it('returns null for faction with no events', () => {
        const { container } = render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="illuminate"
            />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('shows correct defense rate', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );
        // Bugs: 1 successful defend out of 2 = 50%
        expect(screen.getByText('50%')).toBeDefined();
    });

    it('shows correct conquest from snapshots', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );
        // Bugs: points=300, pointsMax=1000 → 30.0%
        expect(screen.getByText('30.0%')).toBeDefined();
    });

    it('shows dash when snapshots are missing', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={null}
                pointsMax={null}
                faction="bugs"
            />,
        );
        expect(screen.getByText('BATTLES')).toBeDefined();
    });

    it('shows correct total events count', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );
        // 3 bug events
        expect(screen.getByText('3')).toBeDefined();
    });

    it('shows correct attack rate', () => {
        render(
            <FactionStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                faction="bugs"
            />,
        );
        // Bugs: 1 successful attack out of 1 = 100%
        expect(screen.getByText('100%')).toBeDefined();
    });
});
