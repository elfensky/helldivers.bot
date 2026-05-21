// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/galaxy/EventCard.css', () => ({}));
vi.mock('humanize-duration', () => ({
    default: () => '2d 3h',
}));

import DefeatedCard from '@/features/galaxy/DefeatedCard';

const START = Math.floor(new Date('2025-01-01T00:00:00Z').getTime() / 1000);
const END = Math.floor(new Date('2025-01-03T03:00:00Z').getTime() / 1000);

describe('DefeatedCard — shared behaviour', () => {
    test('renders "Defeated" action in gold-muted color', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        const action = container.querySelector('.sector-card-action');
        expect(action.textContent).toBe('Defeated');
        expect(action.style.color).toBe('var(--color-gold-muted)');
    });

    test('shows the faction name as the title', () => {
        render(<DefeatedCard factionIndex={0} startTime={START} endTime={END} />);
        expect(screen.getByText('Bugs')).toBeDefined();
    });

    test('uses faction color for the accent bar', () => {
        const { container } = render(
            <DefeatedCard factionIndex={2} startTime={START} endTime={END} />,
        );
        const card = container.querySelector('.sector-card');
        expect(card.style.getPropertyValue('--accent-color')).toBe(
            'var(--color-faction-illuminate)',
        );
    });

    test('has the defeated opacity class on the card wrapper', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        const card = container.querySelector('.sector-card');
        expect(card.className).toContain('sector-card-defeated');
    });

    test('always shows ALL_SECTORS_CAPTURED bar label', () => {
        render(<DefeatedCard factionIndex={0} startTime={START} endTime={END} />);
        expect(screen.getByText('ALL_SECTORS_CAPTURED')).toBeDefined();
    });

    test('progressbar has a descriptive aria-label (a11y)', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-label')).toBe('Bugs defeat progress');
    });

    test('renders duration · date when start/end times are provided', () => {
        render(<DefeatedCard factionIndex={0} startTime={START} endTime={END} />);
        // humanize-duration is mocked to return '2d 3h'
        expect(screen.getByText(/2d 3h/)).toBeDefined();
        // date rendering depends on locale — just confirm the separator is there
        expect(screen.getByText(/2d 3h.*·/)).toBeDefined();
    });

    test('falls back to em-dash when startTime is missing', () => {
        render(<DefeatedCard factionIndex={0} startTime={null} endTime={END} />);
        expect(screen.getByText('—')).toBeDefined();
    });

    test('falls back to em-dash when endTime is missing', () => {
        render(<DefeatedCard factionIndex={0} startTime={START} endTime={null} />);
        expect(screen.getByText('—')).toBeDefined();
    });

    test('falls back to em-dash when both times are missing', () => {
        render(<DefeatedCard factionIndex={0} />);
        expect(screen.getByText('—')).toBeDefined();
    });
});

describe('DefeatedCard — sector view (default)', () => {
    test('renders a single full-width .sector-card-bar-fill', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        const fill = container.querySelector('.sector-card-bar-fill');
        expect(fill).not.toBeNull();
        expect(fill.style.width).toBe('100%');
        expect(fill.style.background).toBe('var(--color-faction-bugs)');
        expect(container.querySelector('.sector-card-segments')).toBeNull();
    });

    test('percent chip shows "100%"', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        expect(container.querySelector('.sector-card-pct').textContent).toBe('100%');
    });

    test('aria-valuenow=100 / aria-valuemax=100', () => {
        const { container } = render(
            <DefeatedCard factionIndex={0} startTime={START} endTime={END} />,
        );
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-valuenow')).toBe('100');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });
});

describe('DefeatedCard — campaign view', () => {
    test('renders 11 captured segments in the grid', () => {
        const { container } = render(
            <DefeatedCard
                factionIndex={0}
                startTime={START}
                endTime={END}
                view="campaign"
            />,
        );
        const grid = container.querySelector('.sector-card-segments');
        expect(grid).not.toBeNull();
        expect(grid.children).toHaveLength(11);
        for (const child of grid.children) {
            expect(child.className).toContain('sector-card-segment--captured');
        }
        expect(container.querySelector('.sector-card-bar-fill')).toBeNull();
    });

    test('percent chip shows "11/11"', () => {
        const { container } = render(
            <DefeatedCard
                factionIndex={0}
                startTime={START}
                endTime={END}
                view="campaign"
            />,
        );
        expect(container.querySelector('.sector-card-pct').textContent).toBe('11/11');
    });

    test('aria-valuenow=11 / aria-valuemax=11', () => {
        const { container } = render(
            <DefeatedCard
                factionIndex={0}
                startTime={START}
                endTime={END}
                view="campaign"
            />,
        );
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-valuenow')).toBe('11');
        expect(bar.getAttribute('aria-valuemax')).toBe('11');
    });

    test('sets --faction-color for the segment gradient', () => {
        const { container } = render(
            <DefeatedCard
                factionIndex={1}
                startTime={START}
                endTime={END}
                view="campaign"
            />,
        );
        const card = container.querySelector('.sector-card');
        expect(card.style.getPropertyValue('--faction-color')).toBe(
            'var(--color-faction-cyborgs)',
        );
    });

    test('still carries the defeated opacity class', () => {
        const { container } = render(
            <DefeatedCard
                factionIndex={0}
                startTime={START}
                endTime={END}
                view="campaign"
            />,
        );
        expect(container.querySelector('.sector-card').className).toContain(
            'sector-card-defeated',
        );
    });
});
