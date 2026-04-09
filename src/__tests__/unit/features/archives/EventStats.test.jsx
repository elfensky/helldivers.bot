// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EventStats from '@/features/archives/EventStats';

const mockEvents = [
    { enemy: 0, region: 1, start_time: 1000, end_time: 4600, status: 'success' }, // 3600s = 1h
    { enemy: 0, region: 1, start_time: 5000, end_time: 19400, status: 'fail' }, // 14400s = 4h
    { enemy: 1, region: 2, start_time: 20000, end_time: 27200, status: 'success' }, // 7200s = 2h
    { enemy: 1, region: 3, start_time: 30000, end_time: 116200, status: 'success' }, // 86200s ~24h (1d)
];

describe('EventStats', () => {
    it('renders all four stat cards', () => {
        render(<EventStats events={mockEvents} />);
        expect(screen.getByText('LONGEST EVENT')).toBeDefined();
        expect(screen.getByText('SHORTEST EVENT')).toBeDefined();
        expect(screen.getByText('MOST CONTESTED')).toBeDefined();
        expect(screen.getByText('SEASON DURATION')).toBeDefined();
    });

    it('identifies most contested region', () => {
        render(<EventStats events={mockEvents} />);
        // Wise Region (enemy=0, region=1) appears twice
        expect(screen.getByText('Wise Region')).toBeDefined();
    });

    it('computes season duration in days', () => {
        render(<EventStats events={mockEvents} />);
        // (116200 - 1000) / 86400 ≈ 1.3 → rounds to 1
        expect(screen.getByText('1 days')).toBeDefined();
    });

    it('returns null when events is empty', () => {
        const { container } = render(<EventStats events={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('returns null when events is null', () => {
        const { container } = render(<EventStats events={null} />);
        expect(container.innerHTML).toBe('');
    });
});
