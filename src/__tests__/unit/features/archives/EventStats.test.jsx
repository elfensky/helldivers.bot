// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventStats from '@/features/archives/EventStats';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(() => ({ outcome: 'defeat', reason: 'Super Earth fell' })),
}));

const mockEvents = [
    { enemy: 0, region: 1, start_time: 1000, end_time: 4600, status: 'success' },
    { enemy: 0, region: 1, start_time: 5000, end_time: 19400, status: 'fail' },
    { enemy: 1, region: 2, start_time: 20000, end_time: 27200, status: 'success' },
    { enemy: 1, region: 3, start_time: 30000, end_time: 116200, status: 'success' },
];

const mockData = { events: mockEvents };

describe('EventStats', () => {
    it('renders all six stat cards including outcome', () => {
        render(<EventStats events={mockEvents} data={mockData} />);
        expect(screen.getByText('OUTCOME')).toBeDefined();
        expect(screen.getByText('DEFEAT')).toBeDefined();
        expect(screen.getByText('SEASON_DURATION')).toBeDefined();
        expect(screen.getByText('EVENTS_WON')).toBeDefined();
        expect(screen.getByText('LONGEST_EVENT')).toBeDefined();
        expect(screen.getByText('SHORTEST_EVENT')).toBeDefined();
        expect(screen.getByText('MOST_CONTESTED')).toBeDefined();
    });

    it('identifies most contested region', () => {
        render(<EventStats events={mockEvents} data={mockData} />);
        expect(screen.getByText('Wise Region')).toBeDefined();
    });

    it('computes season duration in days', () => {
        render(<EventStats events={mockEvents} data={mockData} />);
        expect(screen.getByText('1 days')).toBeDefined();
    });

    it('returns null when events is empty', () => {
        const { container } = render(<EventStats events={[]} data={{}} />);
        expect(container.innerHTML).toBe('');
    });

    it('returns null when events is null', () => {
        const { container } = render(<EventStats events={null} data={{}} />);
        expect(container.innerHTML).toBe('');
    });
});
