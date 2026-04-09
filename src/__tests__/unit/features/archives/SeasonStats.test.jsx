// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeasonStats from '@/features/archives/SeasonStats';

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
        completed_planets: 5,
    },
    {
        enemy: 1,
        players: 4000n,
        kills: 800000000n,
        deaths: 30000000n,
        accidentals: 30000000n,
        missions: 50000000n,
        successful_missions: 45000000n,
        shots: 300000000n,
        hits: 70000000n,
        total_unique_players: 80000n,
        completed_planets: 3,
    },
    {
        enemy: 2,
        players: 3000n,
        kills: 400000000n,
        deaths: 20000000n,
        accidentals: 20000000n,
        missions: 26000000n,
        successful_missions: 23000000n,
        shots: 200000000n,
        hits: 46000000n,
        total_unique_players: 60000n,
        completed_planets: 2,
    },
];

describe('SeasonStats', () => {
    it('renders stat cards for aggregated data', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('MISSIONS')).toBeDefined();
        expect(screen.getByText('PEAK PLAYERS')).toBeDefined();
    });

    it('computes K/D ratio', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        // (1.2B + 800M + 400M) / (50M + 30M + 20M) = 2.4B / 100M = 24.0
        expect(screen.getByText('24.0')).toBeDefined();
    });

    it('computes mission success percentage', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        // (70M + 45M + 23M) / (80M + 50M + 26M) = 138M / 156M ≈ 88.5%
        expect(screen.getByText('88.5%')).toBeDefined();
    });

    it('computes unique players', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        // 100K + 80K + 60K = 240,000
        expect(screen.getByText('240,000')).toBeDefined();
    });

    it('returns null when live is empty', () => {
        const { container } = render(<SeasonStats live={[]} events={[]} />);
        expect(container.innerHTML).toBe('');
    });
});
