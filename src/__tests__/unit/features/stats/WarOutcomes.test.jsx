// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import WarOutcomes from '@/features/stats/WarOutcomes';

// V V V V V D V D D D — total 10, victories 6, defeats 4
// Longest win streak: 5 (S1-S5). Longest loss streak: 3 (S8-S10).
// All distinct values so we can assert via getByText.
const mockPerSeason = [
    { season: 1, outcome: 'victory' },
    { season: 2, outcome: 'victory' },
    { season: 3, outcome: 'victory' },
    { season: 4, outcome: 'victory' },
    { season: 5, outcome: 'victory' },
    { season: 6, outcome: 'defeat' },
    { season: 7, outcome: 'victory' },
    { season: 8, outcome: 'defeat' },
    { season: 9, outcome: 'defeat' },
    { season: 10, outcome: 'defeat' },
];

describe('WarOutcomes', () => {
    it('renders the summary cards', () => {
        render(<WarOutcomes perSeason={mockPerSeason} />);
        expect(screen.getByText('TOTAL_WARS')).toBeDefined();
        expect(screen.getByText('VICTORIES')).toBeDefined();
        expect(screen.getByText('DEFEATS')).toBeDefined();
        expect(screen.getByText('LONGEST_WIN_STREAK')).toBeDefined();
        expect(screen.getByText('LONGEST_LOSS_STREAK')).toBeDefined();
    });

    it('counts total wars, victories, defeats, and the win rate', () => {
        render(<WarOutcomes perSeason={mockPerSeason} />);
        expect(screen.getByText('10')).toBeDefined();
        expect(screen.getByText('6')).toBeDefined();
        expect(screen.getByText('4')).toBeDefined();
        expect(screen.getByText('60%')).toBeDefined();
    });

    it('finds the longest win and loss streaks with their season ranges', () => {
        render(<WarOutcomes perSeason={mockPerSeason} />);
        expect(screen.getByText('5')).toBeDefined();
        expect(screen.getByText('Seasons 1–5')).toBeDefined();
        expect(screen.getByText('3')).toBeDefined();
        expect(screen.getByText('Seasons 8–10')).toBeDefined();
    });

    it('renders a timeline pill per season', () => {
        const { container } = render(<WarOutcomes perSeason={mockPerSeason} />);
        const pills = container.querySelectorAll('[role="listitem"]');
        expect(pills.length).toBe(10);
    });

    it('returns null for empty input', () => {
        const { container } = render(<WarOutcomes perSeason={[]} />);
        expect(container.innerHTML).toBe('');
    });
});
