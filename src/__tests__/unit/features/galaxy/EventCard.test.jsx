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

/**
 * Build a mapState[factionIndex] with the given sector statuses.
 * Default: everything lost. Each entry in `overrides` keyed by region 1–11.
 */
function makeSectorMap(overrides = {}) {
    const map = {};
    for (let r = 1; r <= 11; r++) map[r] = { status: 'lost', percent: 0 };
    for (const [key, val] of Object.entries(overrides)) {
        map[Number(key)] = { ...map[Number(key)], ...val };
    }
    return map;
}

describe('EventCard (sector view — default)', () => {
    test('renders capturing state correctly', () => {
        render(<EventCard {...baseProps} />);
        expect(screen.getByText('Capturing')).toBeDefined();
        expect(screen.getByText('Wise Region')).toBeDefined();
        expect(screen.getByText('SECTOR_PROGRESS')).toBeDefined();
        expect(screen.getByText('45.3%')).toBeDefined();
    });

    test('idle card has no flash classes on action or accent', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const action = container.querySelector('.sector-card-action');
        const accent = container.querySelector('.sector-card-accent');
        expect(action.className).not.toContain('sector-card-action-flash');
        expect(accent.className).not.toContain('sector-card-accent-flash');
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
                pace={{ status: 'ahead', delta: 500 }}
            />,
        );
        const labelRow = container.querySelector('.sector-card-bar-label-row');
        expect(labelRow.querySelector('.sector-card-pace')).not.toBeNull();
        expect(labelRow.textContent).toContain('500');
        const meta = container.querySelector('.sector-card-meta');
        expect(meta.querySelector('.sector-card-pace')).toBeNull();
    });

    test('pace appears in meta line when no barLabel', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                barLabel={null}
                pace={{ status: 'ahead', delta: 500 }}
            />,
        );
        expect(container.querySelector('.sector-card-bar-label-row')).toBeNull();
        const meta = container.querySelector('.sector-card-meta');
        expect(meta.querySelector('.sector-card-pace')).not.toBeNull();
        expect(meta.textContent).toContain('500');
    });

    test('pace "ahead" renders ▲ glyph in success color, no "ahead" word', () => {
        const { container } = render(
            <EventCard {...baseProps} pace={{ status: 'ahead', delta: 500 }} />,
        );
        const paceEl = container.querySelector('.sector-card-pace');
        expect(paceEl.textContent).toContain('▲');
        expect(paceEl.textContent).not.toMatch(/ahead/i);
        expect(paceEl.style.color).toBe('var(--color-success)');
    });

    test('pace "behind" renders ▼ glyph in danger color, no "behind" word', () => {
        const { container } = render(
            <EventCard {...baseProps} pace={{ status: 'behind', delta: 1200 }} />,
        );
        const paceEl = container.querySelector('.sector-card-pace');
        expect(paceEl.textContent).toContain('▼');
        expect(paceEl.textContent).not.toMatch(/behind/i);
        expect(paceEl.textContent).toContain('1,200');
        expect(paceEl.style.color).toBe('var(--color-danger)');
    });

    test('pace "on_track" renders ▪ glyph with "On track" label', () => {
        const { container } = render(
            <EventCard {...baseProps} pace={{ status: 'on_track', delta: 0 }} />,
        );
        const paceEl = container.querySelector('.sector-card-pace');
        expect(paceEl.textContent).toContain('▪');
        expect(paceEl.textContent).toContain('On track');
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

    test('sector view: aria-valuenow=safePct, aria-valuemax=100', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-valuenow')).toBe('45.3');
        expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });

    test('progressbar has a descriptive aria-label (a11y)', () => {
        const { container } = render(<EventCard {...baseProps} />);
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-label')).toBe('Wise Region capturing progress');
    });

    test('aria-label reflects the action verb (defending)', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                action="defending"
                region="Super Earth"
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-label')).toBe('Super Earth defending progress');
    });

    test('sector view does NOT render the 11-segment grid', () => {
        const { container } = render(<EventCard {...baseProps} />);
        expect(container.querySelector('.sector-card-segments')).toBeNull();
        expect(container.querySelector('.sector-card-bar-fill')).not.toBeNull();
    });
});

describe('EventCard (campaign view)', () => {
    const campaignProps = {
        ...baseProps,
        view: 'campaign',
        factionMap: makeSectorMap({
            1: { status: 'captured', percent: 100 },
            2: { status: 'captured', percent: 100 },
            3: { status: 'captured', percent: 100 },
            4: { status: 'in_progress', percent: 64 },
        }),
    };

    test('renders .sector-card-segments grid instead of .sector-card-bar-fill', () => {
        const { container } = render(<EventCard {...campaignProps} />);
        expect(container.querySelector('.sector-card-segments')).not.toBeNull();
        expect(container.querySelector('.sector-card-bar-fill')).toBeNull();
    });

    test('grid contains exactly 11 segment children', () => {
        const { container } = render(<EventCard {...campaignProps} />);
        const grid = container.querySelector('.sector-card-segments');
        expect(grid.children).toHaveLength(11);
        for (const child of grid.children) {
            expect(child.className).toContain('sector-card-segment');
        }
    });

    test('segments map status → class suffix correctly', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                view="campaign"
                factionMap={makeSectorMap({
                    1: { status: 'captured', percent: 100 },
                    2: { status: 'captured', percent: 100 },
                    3: { status: 'in_progress', percent: 30 },
                    // 4-10 default to 'lost'
                    11: { status: 'active', percent: 42 },
                })}
            />,
        );
        const segs = container.querySelectorAll('.sector-card-segment');
        expect(segs[0].className).toContain('sector-card-segment--captured');
        expect(segs[1].className).toContain('sector-card-segment--captured');
        expect(segs[2].className).toContain('sector-card-segment--in-progress');
        // lost sectors render as base class with no modifier
        for (let i = 3; i <= 9; i++) {
            expect(segs[i].className).not.toContain('--captured');
            expect(segs[i].className).not.toContain('--in-progress');
            expect(segs[i].className).not.toContain('--active');
        }
        expect(segs[10].className).toContain('sector-card-segment--active');
    });

    test('in-progress segment sets --segment-percent custom property', () => {
        const { container } = render(<EventCard {...campaignProps} />);
        const inProgress = container.querySelector('.sector-card-segment--in-progress');
        expect(inProgress.style.getPropertyValue('--segment-percent')).toBe('64%');
    });

    test('active (homeworld) segment sets --segment-percent custom property', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                view="campaign"
                factionMap={makeSectorMap({
                    11: { status: 'active', percent: 42 },
                })}
            />,
        );
        const active = container.querySelector('.sector-card-segment--active');
        expect(active.style.getPropertyValue('--segment-percent')).toBe('42%');
    });

    test('percent chip shows "N/11" count, not the sector percent', () => {
        const { container } = render(<EventCard {...campaignProps} />);
        const chip = container.querySelector('.sector-card-pct');
        expect(chip.textContent).toBe('3/11');
        // Make sure the sector-percent "45.3%" from props is NOT shown
        expect(chip.textContent).not.toContain('45.3');
    });

    test('aria-valuenow=captured, aria-valuemax=11', () => {
        const { container } = render(<EventCard {...campaignProps} />);
        const bar = container.querySelector('.sector-card-bar');
        expect(bar.getAttribute('aria-valuenow')).toBe('3');
        expect(bar.getAttribute('aria-valuemax')).toBe('11');
    });

    test('card title stays as `region` prop — not overridden in campaign view', () => {
        render(<EventCard {...campaignProps} region="Ross System" />);
        expect(screen.getByText('Ross System')).toBeDefined();
        expect(screen.queryByText(/campaign ·/i)).toBeNull();
        expect(screen.queryByText(/homeworld ·/i)).toBeNull();
    });

    test('points meta displays the points/pointsMax passed by the parent', () => {
        const { container } = render(
            <EventCard
                {...baseProps}
                view="campaign"
                factionMap={makeSectorMap()}
                points={1234567}
                pointsMax={5000000}
            />,
        );
        const points = container.querySelector('.sector-card-points');
        // 1,234,567 and 5,000,000 both clear 1M, so each renders with the M suffix
        expect(points.textContent).toMatch(/1\.2M/);
        expect(points.textContent).toMatch(/5\.0M/);
    });

    test('missing factionMap does not crash, renders all 11 empty segments', () => {
        const { container } = render(
            <EventCard {...baseProps} view="campaign" factionMap={undefined} />,
        );
        const segs = container.querySelectorAll('.sector-card-segment');
        expect(segs).toHaveLength(11);
        for (const s of segs) {
            expect(s.className).not.toContain('--captured');
            expect(s.className).not.toContain('--in-progress');
            expect(s.className).not.toContain('--active');
        }
        expect(container.querySelector('.sector-card-pct').textContent).toBe('0/11');
    });

    test('campaign view still shows pace + countdown when present', () => {
        const { container } = render(
            <EventCard
                {...campaignProps}
                pace={{ status: 'ahead', delta: 500 }}
                endTime={Math.floor(Date.now() / 1000) + 3600}
            />,
        );
        expect(container.querySelector('.sector-card-pace')).not.toBeNull();
        expect(container.querySelector('.sector-card-pace').textContent).toContain('500');
        expect(container.querySelector('.sector-card-countdown')).not.toBeNull();
    });
});

describe('EventCard — assault ETA line', () => {
    const base = {
        action: 'capturing',
        region: 'Fenrir III',
        percent: 71,
        points: 4_100_000,
        pointsMax: 6_700_000,
        factionIndex: 0,
    };

    it('renders nothing when no forecast is supplied', () => {
        render(<EventCard {...base} />);
        expect(screen.queryByText(/assault eta/i)).toBeNull();
    });

    it('renders nothing when the forecast is hidden', () => {
        render(
            <EventCard
                {...base}
                assaultForecast={{ mode: 'hidden', reason: 'stalled' }}
            />,
        );
        expect(screen.queryByText(/assault eta/i)).toBeNull();
    });

    it('renders a range, not a countdown', () => {
        render(
            <EventCard
                {...base}
                assaultForecast={{
                    mode: 'window',
                    p25: 4.2,
                    p50: 9.4,
                    p75: 16.3,
                    imminent: false,
                }}
            />,
        );
        const el = screen.getByText(/assault eta/i);
        expect(el.textContent).toMatch(/4-16h/);
        // The median belongs in the title, not the visible line — showing three
        // numbers in a 12px mono row is a puzzle, and showing one implies a
        // precision the model does not have.
        expect(el.textContent).not.toMatch(/9\.4/);
        expect(el.getAttribute('title')).toMatch(/9\.4h/);
    });

    it('marks an imminent assault with the danger modifier', () => {
        render(
            <EventCard
                {...base}
                assaultForecast={{
                    mode: 'window',
                    p25: 1,
                    p50: 2,
                    p75: 3,
                    imminent: true,
                }}
            />,
        );
        expect(screen.getByText(/assault eta/i).className).toContain(
            'sector-card-assault--imminent',
        );
    });

    it('never shows a negative lower bound', () => {
        render(
            <EventCard
                {...base}
                assaultForecast={{
                    mode: 'window',
                    p25: -3,
                    p50: 1,
                    p75: 5,
                    imminent: true,
                }}
            />,
        );
        expect(screen.getByText(/assault eta/i).textContent).toMatch(/0-5h/);
    });
});
