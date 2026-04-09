// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import CombatStats from '@/features/archives/CombatStats';

const mockLive = [
    {
        enemy: 0,
        kills: 1200000000n,
        deaths: 50000000n,
        accidentals: 50000000n,
        missions: 80000000n,
        shots: 500000000n,
        hits: 115000000n,
    },
    {
        enemy: 1,
        kills: 800000000n,
        deaths: 30000000n,
        accidentals: 30000000n,
        missions: 50000000n,
        shots: 300000000n,
        hits: 70000000n,
    },
    {
        enemy: 2,
        kills: 400000000n,
        deaths: 20000000n,
        accidentals: 20000000n,
        missions: 26000000n,
        shots: 200000000n,
        hits: 46000000n,
    },
];

const mockEvents = [
    { status: 'success' },
    { status: 'fail' },
    { status: 'success' },
    { status: 'success' },
];

describe('CombatStats', () => {
    it('renders all four stat cards', () => {
        render(<CombatStats live={mockLive} events={mockEvents} />);
        expect(screen.getByText('FRIENDLY_FIRE')).toBeDefined();
        expect(screen.getByText('ACCURACY')).toBeDefined();
        expect(screen.getByText('KILLS/MISSION')).toBeDefined();
        expect(screen.getByText('DEATHS/EVENT')).toBeDefined();
    });

    it('computes friendly fire percentage', () => {
        render(<CombatStats live={mockLive} events={mockEvents} />);
        // (50M + 30M + 20M) / (1.2B + 800M + 400M) = 100M / 2.4B ≈ 4.2%
        expect(screen.getByText('4.2%')).toBeDefined();
    });

    it('computes accuracy percentage', () => {
        render(<CombatStats live={mockLive} events={mockEvents} />);
        // (115M + 70M + 46M) / (500M + 300M + 200M) = 231M / 1B = 23.1%
        expect(screen.getByText('23.1%')).toBeDefined();
    });

    it('returns null when live is empty', () => {
        const { container } = render(<CombatStats live={[]} events={mockEvents} />);
        expect(container.innerHTML).toBe('');
    });

    it('returns null when live is null', () => {
        const { container } = render(<CombatStats live={null} events={mockEvents} />);
        expect(container.innerHTML).toBe('');
    });
});
