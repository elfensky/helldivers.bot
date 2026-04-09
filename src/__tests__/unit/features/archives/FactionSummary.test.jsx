// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FactionSummary from '@/features/archives/FactionSummary';

const mockLive = [
    {
        enemy: 0,
        defend_events: 8n,
        successful_defend_events: 6n,
        attack_events: 4n,
        successful_attack_events: 3n,
    },
    {
        enemy: 1,
        defend_events: 6n,
        successful_defend_events: 4n,
        attack_events: 3n,
        successful_attack_events: 2n,
    },
    {
        enemy: 2,
        defend_events: 5n,
        successful_defend_events: 5n,
        attack_events: 3n,
        successful_attack_events: 3n,
    },
];

describe('FactionSummary', () => {
    it('renders all three factions', () => {
        render(<FactionSummary live={mockLive} />);
        expect(screen.getByText('BUGS')).toBeDefined();
        expect(screen.getByText('CYBORGS')).toBeDefined();
        expect(screen.getByText('ILLUMINATE')).toBeDefined();
    });

    it('shows correct win/loss record', () => {
        render(<FactionSummary live={mockLive} />);
        // Bugs: 6+3=9 wins, (8-6)+(4-3)=3 losses
        expect(screen.getByText('9W / 3L')).toBeDefined();
    });

    it('returns null when live is empty', () => {
        const { container } = render(<FactionSummary live={[]} />);
        expect(container.innerHTML).toBe('');
    });
});
