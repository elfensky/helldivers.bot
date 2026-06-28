// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CascadeLogCard from '@/features/timeline/CascadeLogCard';

const cascade = (overrides) => ({
    season: 155,
    length: 9,
    factionIndex: 2,
    faction: 'The Illuminate',
    regions: [8, 7, 6, 5, 4, 3, 2, 1, 0],
    startTime: 1709555520, // Mar 4, 2024 (UTC)
    endTime: 1709555520 + 14 * 3600 + 32 * 60,
    durationSec: 14 * 3600 + 32 * 60,
    firstEvent: {},
    lastEvent: { type: 'defend', event_id: 4242 },
    events: [],
    ...overrides,
});

describe('CascadeLogCard', () => {
    it('renders the title with length', () => {
        render(<CascadeLogCard cascade={cascade()} />);
        expect(screen.getByText(/9 regions/i)).toBeInTheDocument();
    });

    it('renders the chain joined by arrows', () => {
        const { container } = render(<CascadeLogCard cascade={cascade()} />);
        const chain = container.querySelector('.event-log-card-chain');
        expect(chain).toBeInTheDocument();
        expect(chain.textContent).toContain('8 → 7 → 6');
    });

    it('tags the chain with the faction index', () => {
        const { container } = render(<CascadeLogCard cascade={cascade()} />);
        const chain = container.querySelector('.event-log-card-chain');
        expect(chain.getAttribute('data-faction')).toBe('2');
    });

    it("links to the cascade's last event and fires onSelectCascade on click", () => {
        const onSelectCascade = vi.fn();
        const c = cascade();
        render(<CascadeLogCard cascade={c} onSelectCascade={onSelectCascade} />);
        const link = screen.getByRole('link');
        expect(link.getAttribute('href')).toBe('/archives?season=155#defend-4242');
        expect(link.getAttribute('data-umami-event')).toBe('cascade-card-click');
        fireEvent.click(link);
        expect(onSelectCascade).toHaveBeenCalledWith(c);
    });

    it('renders a duration pill with formatted duration', () => {
        render(<CascadeLogCard cascade={cascade()} />);
        // 14h 32m → '14h32m' per formatCompactDuration (largest:2, no spacer)
        expect(screen.getByText(/14h32m/)).toBeInTheDocument();
    });
});
