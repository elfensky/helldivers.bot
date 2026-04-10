// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/galaxy/EventCard.css', () => ({}));
vi.mock('humanize-duration', () => ({
    default: () => '2 hours',
}));

import EventCard from '@/features/galaxy/EventCard';

const baseProps = {
    action: 'capturing',
    region: 'Wise Region',
    percent: 45.3,
    points: 123456,
    pointsMax: 272700,
    factionIndex: 0,
    pace: null,
    endTime: null,
    barLabel: 'SECTOR_PROGRESS',
};

describe('EventCard', () => {
    test('renders capturing state correctly', () => {
        render(<EventCard {...baseProps} />);
        expect(screen.getByText('Capturing')).toBeDefined();
        expect(screen.getByText('Wise Region')).toBeDefined();
        expect(screen.getByText('SECTOR_PROGRESS')).toBeDefined();
        expect(screen.getByText('45.3%')).toBeDefined();
    });

    test('idle card does not have event class', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const card = container.querySelector('.sector-card');
        expect(card.className).not.toContain('sector-card-event');
    });

    test('renders defending state with event class', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                barLabel="CAPITAL_DEFENSE"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        expect(screen.getByText('Defending')).toBeDefined();
        expect(screen.getByText('CAPITAL_DEFENSE')).toBeDefined();
        const accent = container.querySelector('.sector-card-accent');
        expect(accent.className).toContain('sector-card-accent-flash');
    });

    test('renders homeworld assault state', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="capturing"
                barLabel="HOMEWORLD_ASSAULT"
                endTime={Math.floor(Date.now() / 1000) + 7200}
            />,
        );
        expect(screen.getByText('Capturing')).toBeDefined();
        expect(screen.getByText('HOMEWORLD_ASSAULT')).toBeDefined();
        const accent = container.querySelector('.sector-card-accent');
        expect(accent.className).toContain('sector-card-accent-flash');
    });

    test('no alert icon in any state', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        expect(container.querySelector('.sector-card-alert')).toBeNull();
        expect(screen.queryByText('\u26A0')).toBeNull();
    });

    test('pace appears in bar-label row when barLabel is set', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                barLabel="CAPITAL_DEFENSE"
                endTime={Math.floor(Date.now() / 1000) + 3600}
                pace={{ status: 'ahead', label: '500 ahead' }}
            />,
        );
        const labelRow = container.querySelector('.sector-card-bar-label-row');
        expect(labelRow.textContent).toContain('500 ahead');
        const meta = container.querySelector('.sector-card-meta');
        expect(meta.textContent).not.toContain('500 ahead');
    });

    test('pace appears in meta line when no barLabel', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                barLabel={null}
                pace={{ status: 'ahead', label: '500 ahead' }}
            />,
        );
        expect(container.querySelector('.sector-card-bar-label-row')).toBeNull();
        const meta = container.querySelector('.sector-card-meta');
        expect(meta.textContent).toContain('500 ahead');
    });

    test('meta line always visible with points', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const meta = container.querySelector('.sector-card-meta');
        expect(meta).not.toBeNull();
        const points = container.querySelector('.sector-card-points');
        expect(points).not.toBeNull();
    });

    test('defend bar fill uses danger color', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                barLabel="CAPITAL_DEFENSE"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        const fill = container.querySelector('.sector-card-bar-fill');
        expect(fill.style.background).toBe('var(--color-danger)');
    });

    test('capturing bar fill uses faction color', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const fill = container.querySelector('.sector-card-bar-fill');
        expect(fill.style.background).toBe('var(--color-faction-bugs)');
    });

    test('idle title uses default text color', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const action = container.querySelector('.sector-card-action');
        const title = container.querySelector('.sector-card-title');
        expect(action.style.color).toBe('');
        expect(title.style.color).toBe('');
    });

    test('event action uses danger color, region stays default', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        const action = container.querySelector('.sector-card-action');
        const title = container.querySelector('.sector-card-title');
        expect(action.style.color).toBe('var(--color-danger)');
        expect(title.style.color).toBe('');
    });

    test('action word flashes during events', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        const action = container.querySelector('.sector-card-action');
        expect(action.className).toContain('sector-card-action-flash');
    });

    test('action word does not flash when idle', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const action = container.querySelector('.sector-card-action');
        expect(action.className).not.toContain('sector-card-action-flash');
    });
});
