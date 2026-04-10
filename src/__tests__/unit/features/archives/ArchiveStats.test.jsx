// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchiveStats from '@/features/archives/ArchiveStats';

import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(() => ({ outcome: 'victory', reason: 'All enemy factions have been defeated.' })),
}));

const noEffects = { outcomeReveal: null, headerScramble: false, watermark: false, statFlickers: false };

const mockEvents = [
    { event_id: 1, type: 'defend', enemy: 0, region: 1, start_time: 1000, end_time: 4600, status: 'success', players_at_start: 200, points: 400, points_max: 500 },
    { event_id: 2, type: 'defend', enemy: 0, region: 1, start_time: 5000, end_time: 19400, status: 'fail', players_at_start: 150, points: 500, points_max: 500 },
    { event_id: 3, type: 'attack', enemy: 1, region: 11, start_time: 20000, end_time: 27200, status: 'success', players_at_start: 300, points: 1000, points_max: 1000 },
];

describe('ArchiveStats', () => {
    it('renders war summary stats', () => {
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
        expect(screen.getByText('WIN_RATE')).toBeDefined();
        expect(screen.getByText('67%')).toBeDefined();
        expect(screen.getByText('2 / 3')).toBeDefined();
    });

    it('renders section headings', () => {
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('War Summary')).toBeDefined();
    });

    it('renders narrowest win when a close defense exists', () => {
        // Event 1: defend success with points 400/500 = 80% (> 50% threshold)
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('NARROWEST_WIN')).toBeDefined();
        expect(screen.getByText('Notable Moments')).toBeDefined();
    });

    it('does not render notable moments when no close calls exist', () => {
        const easyEvents = [
            { event_id: 1, type: 'defend', enemy: 0, region: 1, start_time: 1000, end_time: 4600, status: 'success', players_at_start: 200, points: 10, points_max: 500 },
            { event_id: 2, type: 'defend', enemy: 0, region: 2, start_time: 5000, end_time: 8600, status: 'success', players_at_start: 150, points: 20, points_max: 500 },
        ];
        render(
            <ArchiveStats
                events={easyEvents}
                live={[]}
                data={{ events: easyEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.queryByText('Notable Moments')).toBeNull();
    });

    it('returns null when events is empty', () => {
        const { container } = render(
            <ArchiveStats
                events={[]}
                live={[]}
                data={{}}
                effects={noEffects}
            />,
        );
        expect(container.innerHTML).toBe('');
    });

    it('returns null when events is null', () => {
        const { container } = render(
            <ArchiveStats
                events={null}
                live={[]}
                data={{}}
                effects={noEffects}
            />,
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

        expect(screen.getByText('Combat Record')).toBeDefined();
        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('K/D')).toBeDefined();
        expect(screen.getByText('ACCURACY')).toBeDefined();
        expect(screen.getByText('FRIENDLY_FIRE')).toBeDefined();
        expect(screen.getByText('MISSION_SUCCESS')).toBeDefined();
        expect(screen.getByText('PEAK_ONLINE')).toBeDefined();
        expect(screen.getByText('TOTAL_DIVERS')).toBeDefined();
    });

    it('renders Cyberstani interference subtitle on defeat', () => {
        getWarOutcome.mockReturnValueOnce({ outcome: 'defeat', reason: 'The war was lost.' });
        render(
            <ArchiveStats
                events={mockEvents}
                live={[]}
                data={{ events: mockEvents }}
                effects={noEffects}
            />,
        );
        expect(screen.getByText('DEFEAT')).toBeDefined();
        expect(screen.getByText('Cyberstani interference detected')).toBeDefined();
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
        expect(screen.queryByText('Combat Record')).toBeNull();
    });
});
