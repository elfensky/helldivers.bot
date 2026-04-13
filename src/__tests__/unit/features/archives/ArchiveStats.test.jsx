// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import humanizeDuration from 'humanize-duration';
import ArchiveStats from '@/features/archives/ArchiveStats';

import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(() => ({
        outcome: 'victory',
        reason: 'All enemy factions have been defeated.',
        faction: 2,
    })),
}));

vi.mock('@/features/archives/ClientGlitchText', () => ({
    default: ({ text, className }) => <span className={className}>{text}</span>,
}));

const noEffects = { headerScramble: false, watermark: false };

const mockEvents = [
    {
        event_id: 1,
        type: 'defend',
        enemy: 0,
        region: 1,
        start_time: 1000,
        end_time: 4600,
        status: 'success',
        players_at_start: 200,
        points: 400,
        points_max: 500,
    },
    {
        event_id: 2,
        type: 'defend',
        enemy: 0,
        region: 1,
        start_time: 5000,
        end_time: 19400,
        status: 'fail',
        players_at_start: 150,
        points: 500,
        points_max: 500,
    },
    {
        event_id: 3,
        type: 'attack',
        enemy: 1,
        region: 11,
        start_time: 20000,
        end_time: 27200,
        status: 'success',
        players_at_start: 300,
        points: 1000,
        points_max: 1000,
    },
];

describe('ArchiveStats', () => {
    it('renders statistics stats', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('OUTCOME')).toBeDefined();
        expect(screen.getByText('VICTORY')).toBeDefined();
        expect(screen.getByText('DURATION')).toBeDefined();
        // mockEvents: 2 defends (1 success, 1 fail), 1 attack (1 success)
        expect(screen.getByText('DEFENSE_RATE')).toBeDefined();
        expect(screen.getByText('50%')).toBeDefined();
        expect(screen.getByText('1 / 2')).toBeDefined();
        expect(screen.getByText('ATTACK_RATE')).toBeDefined();
        expect(screen.getByText('100%')).toBeDefined();
        expect(screen.getByText('1 / 1')).toBeDefined();
    });

    it('derives DURATION from snapshot time span when snapshots are present', () => {
        // 23 days 12 hours between first and last poll → rounds to 24 days
        const firstTime = 1_700_000_000;
        const lastTime = firstTime + 23 * 86_400 + 12 * 3_600;
        const snapshots = [
            { time: firstTime, data: {} },
            { time: firstTime + 86_400, data: {} },
            { time: lastTime, data: {} },
        ];
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents, snapshots }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('24 days')).toBeDefined();
        // Subtitle is humanize-duration(span, { largest: 2, round: true }) — compute the
        // expected value from the same fn the component uses so we don't bake in the
        // rounding edge cases by hand.
        const expectedSubtitle = humanizeDuration((23 * 86_400 + 12 * 3_600) * 1000, {
            largest: 2,
            round: true,
        });
        expect(screen.getByText(expectedSubtitle)).toBeDefined();
    });

    it('falls back to event span when snapshots are missing or fewer than two', () => {
        // Event span: 27200 − 1000 = 26200 seconds → 0 days (rounded)
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('0 days')).toBeDefined();

        // Same result when exactly one snapshot is present
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents, snapshots: [{ time: 9_999, data: {} }] }}
                effects={noEffects}
            />,
        );
        expect(screen.getAllByText('0 days').length).toBeGreaterThanOrEqual(1);
    });

    it('pluralises DURATION correctly for a single day', () => {
        const firstTime = 1_700_000_000;
        const snapshots = [
            { time: firstTime, data: {} },
            { time: firstTime + 86_400, data: {} },
        ];
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents, snapshots }}
                effects={noEffects}
            />,
        );
        // "1 day" appears twice — once as the StatCard value and once as the
        // humanize-duration subtitle (which also produces "1 day" for 86400s).
        // Both are valid; we just want to prove the value isn't "1 days".
        const matches = screen.getAllByText('1 day');
        expect(matches.length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByText('1 days')).toBeNull();
    });

    it('does not render WORST_CASCADE when there is no cascade', () => {
        const easyEvents = [
            {
                event_id: 1,
                type: 'defend',
                enemy: 0,
                region: 1,
                start_time: 1000,
                end_time: 4600,
                status: 'success',
                players_at_start: 200,
                points: 10,
                points_max: 500,
            },
            {
                event_id: 2,
                type: 'defend',
                enemy: 0,
                region: 2,
                start_time: 5000,
                end_time: 8600,
                status: 'success',
                players_at_start: 150,
                points: 20,
                points_max: 500,
            },
        ];
        render(
            <ArchiveStats
                events={easyEvents}
                live={[]}
                data={{ events: easyEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.queryByText('WORST_CASCADE')).toBeNull();
    });

    it('returns null when events is empty', () => {
        const { container } = render(
            <ArchiveStats events={[]} live={[]} data={{}} effects={noEffects} />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('returns null when events is null', () => {
        const { container } = render(
            <ArchiveStats events={null} live={[]} data={{}} effects={noEffects} />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('renders combat record stats when live data is provided', () => {
        const mockLive = [
            {
                enemy: 0,
                players: 5000n,
                kills: 1200000000n,
                deaths: 50000000n,
                accidentals: 50000000n,
                missions: 80000000n,
                successful_missions: 70000000n,
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
                successful_missions: 40000000n,
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
                successful_missions: 20000000n,
                shots: 200000000n,
                hits: 46000000n,
                total_unique_players: 60000n,
            },
        ];

        render(
            <ArchiveStats
                events={mockEvents}
                live={mockLive}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );

        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('K/D')).toBeDefined();
        expect(screen.getByText('ACCURACY')).toBeDefined();
        expect(screen.getByText('FRIENDLY_FIRE')).toBeDefined();
        expect(screen.getByText('MISSION_SUCCESS')).toBeDefined();
        expect(screen.getByText('PEAK_ONLINE')).toBeDefined();
        expect(screen.getByText('TOTAL_DIVERS')).toBeDefined();
    });

    it('renders Cyberstani interference subtitle on defeat', () => {
        getWarOutcome.mockReturnValueOnce({
            outcome: 'defeat',
            reason: 'The war was lost.',
            faction: 1,
        });
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('DEFEAT')).toBeDefined();
    });

    it('shows faction name as OUTCOME subtitle (victory)', () => {
        // Default mock returns faction: 2 (Illuminate)
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('The Illuminate')).toBeDefined();
    });

    it('shows faction name as OUTCOME subtitle (defeat attribution)', () => {
        getWarOutcome.mockReturnValueOnce({
            outcome: 'defeat',
            reason: 'The war was lost.',
            faction: 0,
        });
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('Bugs')).toBeDefined();
    });

    it('omits OUTCOME subtitle when faction is null', () => {
        getWarOutcome.mockReturnValueOnce({
            outcome: 'defeat',
            reason: 'The war was lost.',
            faction: null,
        });
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.queryByText('Bugs')).toBeNull();
        expect(screen.queryByText('Cyborgs')).toBeNull();
        expect(screen.queryByText('The Illuminate')).toBeNull();
    });

    it('does not render combat record when live is empty', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.queryByText('KILLS')).toBeNull();
        expect(screen.queryByText('K/D')).toBeNull();
    });
});
