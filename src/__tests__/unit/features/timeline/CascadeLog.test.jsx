// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('@/shared/utils/cookies.mjs', () => ({
    setPreferenceCookie: vi.fn(),
}));

import CascadeLog from '@/features/timeline/CascadeLog';

const c = (overrides) => ({
    season: 155,
    length: 9,
    factionIndex: 2,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    startTime: 0,
    endTime: 1000,
    durationSec: 1000,
    firstEvent: {},
    lastEvent: {},
    events: [],
    ...overrides,
});

describe('CascadeLog', () => {
    it('renders nothing for empty cascades', () => {
        const { container } = render(<CascadeLog cascades={[]} />);
        expect(container.firstChild).toBeNull();
    });

    it('renders the heading', () => {
        render(<CascadeLog cascades={[c()]} />);
        expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
            /Cascade Failures/i,
        );
    });

    it('renders the optional lede when provided', () => {
        render(<CascadeLog cascades={[c()]} lede="Test lede sentence." />);
        expect(screen.getByText('Test lede sentence.')).toBeInTheDocument();
    });

    it('omits the lede paragraph when not provided', () => {
        const { container } = render(<CascadeLog cascades={[c()]} />);
        expect(container.querySelector('.event-log-lede')).toBeNull();
    });

    it('renders one group header per distinct season', () => {
        render(
            <CascadeLog cascades={[c({ season: 155 }), c({ season: 142, length: 4 })]} />,
        );
        expect(screen.getByText(/Season 155/)).toBeInTheDocument();
        expect(screen.getByText(/Season 142/)).toBeInTheDocument();
    });

    it('toggles sort order when the toggle is clicked', () => {
        const { container } = render(
            <CascadeLog
                initialSortOrder="worst"
                cascades={[c({ season: 100, length: 9 }), c({ season: 200, length: 4 })]}
            />,
        );
        // worst-first: 100 (length 9) first, then 200 (length 4)
        let labels = container.querySelectorAll('.event-log-day-label');
        expect(labels[0].textContent).toContain('100');
        // Toggle
        fireEvent.click(screen.getByRole('button', { name: /sort/i }));
        labels = container.querySelectorAll('.event-log-day-label');
        // recent-first: 200 first, then 100
        expect(labels[0].textContent).toContain('200');
    });
});
