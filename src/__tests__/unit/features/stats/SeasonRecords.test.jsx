// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeasonRecords from '@/features/stats/SeasonRecords';

// Each record-winning season is distinct so each `Season N` subtitle
// appears exactly once — easier to assert via getByText.
const mockPerSeason = [
    {
        season: 1,
        season_duration: 86400 * 10,
        events: 20,
        defend_wins: 5,
        attack_wins: 3,
        avg_event_duration: 3600,
    },
    {
        season: 2,
        season_duration: 86400 * 5,
        events: 30,
        defend_wins: 3,
        attack_wins: 2,
        avg_event_duration: 4000,
    },
    {
        season: 3,
        season_duration: 86400 * 7,
        events: 15,
        defend_wins: 4,
        attack_wins: 8,
        avg_event_duration: 5000,
    },
    {
        season: 4,
        season_duration: 86400 * 6,
        events: 25,
        defend_wins: 10,
        attack_wins: 1,
        avg_event_duration: 4500,
    },
    {
        season: 5,
        season_duration: 86400 * 4,
        events: 18,
        defend_wins: 2,
        attack_wins: 4,
        avg_event_duration: 9000,
    },
];

describe('SeasonRecords', () => {
    it('renders the all-time records grid', () => {
        render(<SeasonRecords perSeason={mockPerSeason} />);
        expect(screen.getByText('LONGEST_WAR')).toBeDefined();
        expect(screen.getByText('MOST_EVENTS')).toBeDefined();
        expect(screen.getByText('LONGEST_AVG_BATTLE')).toBeDefined();
        expect(screen.getByText('MOST_DEFENDS_WON')).toBeDefined();
        expect(screen.getByText('MOST_ATTACKS_WON')).toBeDefined();
    });

    it('attributes each record to the season that owns the extremum', () => {
        render(<SeasonRecords perSeason={mockPerSeason} />);
        // Longest war (864000s = 10 days) → S1
        expect(screen.getByText('Season 1')).toBeDefined();
        // Most events (30) → S2
        expect(screen.getByText('Season 2')).toBeDefined();
        // Most attacks won (8) → S3
        expect(screen.getByText('Season 3')).toBeDefined();
        // Most defends won (10) → S4
        expect(screen.getByText('Season 4')).toBeDefined();
        // Longest avg battle (9000s) → S5
        expect(screen.getByText('Season 5')).toBeDefined();
    });

    it('returns null for empty input', () => {
        const { container } = render(<SeasonRecords perSeason={[]} />);
        expect(container.innerHTML).toBe('');
    });
});
