// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SeasonOverview from '@/features/archives/SeasonOverview';

vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: vi.fn(),
}));

import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

const mockData = {
    events: [
        { id: 1, start_time: 1700000000, end_time: 1700500000, status: 'success' },
        { id: 2, start_time: 1700500000, end_time: 1701000000, status: 'success' },
        { id: 3, start_time: 1701000000, end_time: 1704000000, status: 'fail' },
    ],
};

describe('SeasonOverview', () => {
    it('displays VICTORY when outcome is victory', () => {
        getWarOutcome.mockReturnValue({ outcome: 'victory', reason: 'All factions defeated' });
        render(<SeasonOverview data={mockData} />);
        expect(screen.getByText('VICTORY')).toBeDefined();
    });

    it('displays DEFEAT when outcome is defeat', () => {
        getWarOutcome.mockReturnValue({ outcome: 'defeat', reason: 'Super Earth fell' });
        render(<SeasonOverview data={mockData} />);
        expect(screen.getByText('DEFEAT')).toBeDefined();
    });

    it('displays UNKNOWN when outcome is null', () => {
        getWarOutcome.mockReturnValue(null);
        render(<SeasonOverview data={mockData} />);
        expect(screen.getByText('UNKNOWN')).toBeDefined();
    });

    it('shows event win count', () => {
        getWarOutcome.mockReturnValue({ outcome: 'victory', reason: '' });
        render(<SeasonOverview data={mockData} />);
        expect(screen.getByText(/2 of 3 events won/)).toBeDefined();
    });

    it('shows season duration', () => {
        getWarOutcome.mockReturnValue({ outcome: 'victory', reason: '' });
        render(<SeasonOverview data={mockData} />);
        // 1704000000 - 1700000000 = 4000000 seconds ≈ 46 days
        expect(screen.getByText(/46 days/)).toBeDefined();
    });
});
