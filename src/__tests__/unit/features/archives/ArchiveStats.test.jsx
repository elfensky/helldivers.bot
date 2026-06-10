// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchiveStats from '@/features/archives/ArchiveStats';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(() => ({ outcome: 'victory', reason: 'won', faction: 2 })),
}));
vi.mock('@/features/ministry/Hijackable', () => ({
    default: ({ text }) => <span data-testid="outcome-hijackable">{text}</span>,
}));

const mockEvents = [
    {
        type: 'defend',
        enemy: 0,
        region: 1,
        start_time: 1000,
        end_time: 4600,
        status: 'success',
    },
    {
        type: 'defend',
        enemy: 0,
        region: 1,
        start_time: 5000,
        end_time: 12200,
        status: 'fail',
    },
    {
        type: 'attack',
        enemy: 0,
        region: 2,
        start_time: 13000,
        end_time: 20200,
        status: 'success',
    },
    {
        type: 'defend',
        enemy: 1,
        region: 1,
        start_time: 1000,
        end_time: 4600,
        status: 'success',
    },
];

const mockData = {
    snapshots: [
        {
            time: 100,
            data: [
                { enemy: 0, points: 300 },
                { enemy: 1, points: 200 },
                { enemy: 2, points: 100 },
            ],
        },
    ],
    points_max: { points: [1000, 1000, 1000] },
};

// Per-faction h1_statistic rows merged into data.status by getCampaign.
const mockLive = [
    { enemy: 0, total_mission_difficulty: 6000, successful_missions: 800 },
    { enemy: 1, total_mission_difficulty: 2800, successful_missions: 400 },
    { enemy: 2, total_mission_difficulty: 900, successful_missions: 150 },
];

// A season predating stat collection — getCampaign zero-fills the stats.
const noTelemetryLive = [0, 1, 2].map((enemy) => ({
    enemy,
    total_mission_difficulty: 0,
    successful_missions: 0,
}));

describe('ArchiveStats', () => {
    it('returns null when there are no events', () => {
        const { container } = render(
            <ArchiveStats faction="global" events={[]} data={mockData} live={mockLive} />,
        );
        expect(container.innerHTML).toBe('');
    });

    describe('global view', () => {
        it('renders outcome, rates, and difficulty', () => {
            render(
                <ArchiveStats
                    faction="global"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            expect(screen.getByText('OUTCOME')).toBeDefined();
            expect(screen.getByText('VICTORY')).toBeDefined();
            expect(screen.getByText('DEFENSE_RATE')).toBeDefined();
            expect(screen.getByText('ATTACK_RATE')).toBeDefined();
            expect(screen.getByText('AVG_DIFFICULTY')).toBeDefined();
        });

        it('does not render cards now owned by StatGrid', () => {
            render(
                <ArchiveStats
                    faction="global"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            for (const dropped of [
                'DURATION',
                'KILLS',
                'K/D',
                'BATTLES',
                'PEAK_ONLINE',
                'TOTAL_DIVERS',
            ]) {
                expect(screen.queryByText(dropped)).toBeNull();
            }
        });

        it('hides AVG_DIFFICULTY when the season has no telemetry', () => {
            render(
                <ArchiveStats
                    faction="global"
                    events={mockEvents}
                    data={mockData}
                    live={noTelemetryLive}
                />,
            );
            expect(screen.queryByText('AVG_DIFFICULTY')).toBeNull();
        });
    });

    describe('faction view', () => {
        it('renders rates, battle, hotspot, conquest, and difficulty', () => {
            render(
                <ArchiveStats
                    faction="bugs"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            expect(screen.getByText('DEFENSE_RATE')).toBeDefined();
            expect(screen.getByText('ATTACK_RATE')).toBeDefined();
            expect(screen.getByText('AVG_BATTLE')).toBeDefined();
            expect(screen.getByText('HOTSPOT')).toBeDefined();
            expect(screen.getByText('CONQUEST')).toBeDefined();
            expect(screen.getByText('AVG_DIFFICULTY')).toBeDefined();
        });

        it('computes the bug defense rate, conquest, and difficulty', () => {
            render(
                <ArchiveStats
                    faction="bugs"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            expect(screen.getByText('50%')).toBeDefined(); // 1 of 2 defends won
            expect(screen.getByText('30.0%')).toBeDefined(); // conquest 300 / 1000
            expect(screen.getByText('7.5')).toBeDefined(); // difficulty 6000 / 800
        });

        it('does not render the OUTCOME card on a faction tab', () => {
            render(
                <ArchiveStats
                    faction="bugs"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            expect(screen.queryByText('OUTCOME')).toBeNull();
        });

        it('returns null for a faction with no events', () => {
            const { container } = render(
                <ArchiveStats
                    faction="illuminate"
                    events={mockEvents}
                    data={mockData}
                    live={mockLive}
                />,
            );
            expect(container.innerHTML).toBe('');
        });
    });
});
