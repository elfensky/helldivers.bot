// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchiveStats from '@/features/archives/ArchiveStats';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(() => ({ outcome: 'victory', reason: 'All enemy factions have been defeated.' })),
}));

const mockEvents = [
    { event_id: 1, type: 'defend', enemy: 0, region: 1, start_time: 1000, end_time: 4600, status: 'success', players_at_start: 200 },
    { event_id: 2, type: 'defend', enemy: 0, region: 1, start_time: 5000, end_time: 19400, status: 'fail', players_at_start: 150 },
    { event_id: 3, type: 'attack', enemy: 1, region: 11, start_time: 20000, end_time: 27200, status: 'success', players_at_start: 300 },
];

const mockSnapshots = [
    {
        time: 1000,
        data: JSON.stringify([
            { points: 100, points_taken: 200, status: 'active' },
            { points: 200, points_taken: 300, status: 'active' },
            { points: 50, points_taken: 100, status: 'active' },
        ]),
    },
];

const mockPointsMax = { points: [500, 500, 500] };

describe('ArchiveStats', () => {
    it('renders event-derived stats', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                live={[]}
                data={{ events: mockEvents }}
            />,
        );
        expect(screen.getByText('OUTCOME')).toBeDefined();
        expect(screen.getByText('VICTORY')).toBeDefined();
        expect(screen.getByText('SEASON_DURATION')).toBeDefined();
        expect(screen.getByText('EVENTS_WON')).toBeDefined();
        expect(screen.getByText('2/3')).toBeDefined();
        expect(screen.getByText('DEFENSE_WON')).toBeDefined();
        expect(screen.getByText('1/2')).toBeDefined();
        expect(screen.getByText('ATTACK_WON')).toBeDefined();
        expect(screen.getByText('1/1')).toBeDefined();
    });

    it('renders snapshot-derived overkill stat', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                live={[]}
                data={{ events: mockEvents }}
            />,
        );
        expect(screen.getByText('TOTAL_OVERKILL')).toBeDefined();
        // (200 + 300 + 100) / (500 + 500 + 500) = 600 / 1500 = 40.0%
        expect(screen.getByText('40.0%')).toBeDefined();
    });

    it('returns null when events is empty', () => {
        const { container } = render(
            <ArchiveStats
                events={[]}
                snapshots={[]}
                pointsMax={mockPointsMax}
                live={[]}
                data={{}}
            />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('returns null when events is null', () => {
        const { container } = render(
            <ArchiveStats
                events={null}
                snapshots={[]}
                pointsMax={mockPointsMax}
                live={[]}
                data={{}}
            />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders h1_live stats when live data is provided', () => {
        const mockLive = [
            {
                enemy: 0,
                players: 5000n,
                kills: 1200000000n,
                deaths: 50000000n,
                accidentals: 50000000n,
                missions: 80000000n,
                shots: 500000000n,
                hits: 115000000n,
                total_unique_players: 100000n,
            },
            {
                enemy: 1,
                players: 4000n,
                kills: 800000000n,
                deaths: 30000000n,
                accidentals: 30000000n,
                missions: 50000000n,
                shots: 300000000n,
                hits: 70000000n,
                total_unique_players: 80000n,
            },
            {
                enemy: 2,
                players: 3000n,
                kills: 400000000n,
                deaths: 20000000n,
                accidentals: 20000000n,
                missions: 26000000n,
                shots: 200000000n,
                hits: 46000000n,
                total_unique_players: 60000n,
            },
        ];

        render(
            <ArchiveStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                live={mockLive}
                data={{ events: mockEvents }}
            />,
        );

        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('MISSIONS')).toBeDefined();
        expect(screen.getByText('PEAK_PLAYERS')).toBeDefined();
        expect(screen.getByText('K/D_RATIO')).toBeDefined();
        expect(screen.getByText('ACCURACY')).toBeDefined();
        expect(screen.getByText('FRIENDLY_FIRE')).toBeDefined();
        expect(screen.getByText('UNIQUE_PLAYERS')).toBeDefined();
    });

    it('does not render h1_live stats when live is empty', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                snapshots={mockSnapshots}
                pointsMax={mockPointsMax}
                live={[]}
                data={{ events: mockEvents }}
            />,
        );
        expect(screen.queryByText('KILLS')).toBeNull();
        expect(screen.queryByText('K/D_RATIO')).toBeNull();
        expect(screen.queryByText('FRIENDLY_FIRE')).toBeNull();
    });
});
