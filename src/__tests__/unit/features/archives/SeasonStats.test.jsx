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
    },
];

describe('SeasonStats', () => {
    it('renders stat cards for aggregated data', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        expect(screen.getByText('KILLS')).toBeDefined();
        expect(screen.getByText('MISSIONS')).toBeDefined();
        expect(screen.getByText('PEAK PLAYERS')).toBeDefined();
    });

    it('formats accuracy as percentage', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        // (115M + 70M + 46M) / (500M + 300M + 200M) = 231M/1000M = 23.1%
        expect(screen.getByText('23.1%')).toBeDefined();
    });

    it('formats friendly fire as percentage', () => {
        render(<SeasonStats live={mockLive} events={[]} />);
        // (50M + 30M + 20M) / (1.2B + 800M + 400M) = 100M/2.4B ≈ 4.2%
        expect(screen.getByText('4.2%')).toBeDefined();
    });

    it('returns null when live is empty', () => {
        const { container } = render(<SeasonStats live={[]} events={[]} />);
        expect(container.innerHTML).toBe('');
    });
});
