// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// ArchivesClient mirrors HomeClient's pin-state machine + adds a faction
// switch (global vs per-faction), an admin-only refresh button, and
// defeat-state color logic for ArchiveStats.
// Children + hooks are stubbed at the boundary; tests assert what
// ArchivesClient itself wires.

const mocks = vi.hoisted(() => ({
    useFactionPreferenceMock: vi.fn(),
    useScrollEventMock: vi.fn(),
    useHeaderGlassFilterMock: vi.fn(),
    getWarOutcomeMock: vi.fn(),
}));

vi.mock('@/features/archives/ArchivesLayout.css', () => ({}));

// Capture-style child stubs: data-attrs carry props so tests can inspect.
vi.mock('@/features/archives/ArchiveStats', () => ({
    default: (props) => (
        <div
            data-testid="archive-stats-stub"
            data-events={props.events?.length ?? 0}
            data-faction={props.faction ?? ''}
        />
    ),
}));
vi.mock('@/features/archives/ArchivesHeader', () => ({
    default: () => <div data-testid="archives-header-stub" />,
    // EffectsToggle export removed in Task 12
}));
// ArchivesClient imports the lazy-load wrapper (next/dynamic) — mock that,
// not the underlying chart, so the stub is what actually renders.
vi.mock('@/features/archives/FactionHealthChartLoader', () => ({
    default: ({ snapshots, pointsMax }) => (
        <div
            data-testid="faction-health-chart-stub"
            data-snapshots={snapshots ? 'set' : 'unset'}
            data-points-max={pointsMax ? 'set' : 'unset'}
        />
    ),
}));
vi.mock('@/shared/components/FactionTabs', () => ({
    default: ({ active, onChange }) => (
        <button
            data-testid="faction-tabs-stub"
            data-active={active}
            onClick={() => onChange?.('bugs')}
        />
    ),
}));
vi.mock('@/features/stats/StatGrid', () => ({
    default: (props) => (
        <div
            data-testid="stat-grid-stub"
            data-faction={props.faction ?? ''}
            data-archived={String(!!props.archived)}
        />
    ),
}));
vi.mock('@/features/timeline/EventLog', () => ({
    default: ({ events, timeFormat, selectedEventKey, id, includeToday }) => (
        <div
            data-testid="event-log-stub"
            data-events={events?.length ?? 0}
            data-time-format={timeFormat}
            data-selected-key={selectedEventKey ?? ''}
            data-id={id}
            data-include-today={String(!!includeToday)}
        />
    ),
}));
vi.mock('@/features/archives/ArchiveMap', () => ({
    default: ({ data, selectedEvent }) => (
        <div
            data-testid="archive-map-stub"
            data-has-data={data ? 'true' : 'false'}
            data-selected-id={selectedEvent?.event_id ?? ''}
        />
    ),
}));
vi.mock('@/features/archives/SeasonSelector', () => ({
    default: ({ currentSeason }) => (
        <div data-testid="season-selector-stub" data-current={currentSeason ?? ''} />
    ),
}));
vi.mock('@/features/archives/RefreshSeasonButton', () => ({
    default: ({ season }) => (
        <button data-testid="refresh-season-button-stub" data-season={season ?? ''} />
    ),
}));

vi.mock('@/shared/utils/game/eventKey.mjs', () => ({
    eventKey: (e) => `evt-${e.event_id}`,
}));
vi.mock('@/features/archives/getWarOutcome.mjs', () => ({
    getWarOutcome: mocks.getWarOutcomeMock,
}));
vi.mock('@/shared/hooks/useScrollEvent.mjs', () => ({
    useScrollEvent: mocks.useScrollEventMock,
}));
vi.mock('@/shared/hooks/useHeaderGlassFilter.mjs', () => ({
    useHeaderGlassFilter: mocks.useHeaderGlassFilterMock,
}));
vi.mock('@/shared/hooks/usePersistedState.mjs', () => ({
    usePersistedState: mocks.useFactionPreferenceMock,
}));

import ArchivesClient from '@/features/archives/ArchivesClient';

const {
    useFactionPreferenceMock,
    useScrollEventMock,
    useHeaderGlassFilterMock,
    getWarOutcomeMock,
} = mocks;

const baseData = {
    events: [
        { event_id: 1, enemy: 0, region: 5, type: 'defend' },
        { event_id: 2, enemy: 1, region: 6, type: 'attack' },
    ],
    snapshots: [{ time: 0, data: [{ points: 50, status: 'active' }] }],
    points_max: { points: [100, 100, 100] },
    status: { season: 157 },
    last_updated: 1700000000,
};

beforeEach(() => {
    const setFaction = vi.fn();
    useFactionPreferenceMock.mockReturnValue(['global', setFaction]);
    useScrollEventMock.mockReturnValue({
        selectedEvent: null,
        railRef: { current: null },
    });
    useHeaderGlassFilterMock.mockReturnValue('');
    getWarOutcomeMock.mockReturnValue({ outcome: 'victory' });
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('ArchivesClient — layout + default render', () => {
    test('renders header, ArchiveStats (global default), Conquest Progress chart, event log, archive map', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);

        expect(screen.getByTestId('archives-header-stub')).toBeInTheDocument();
        expect(screen.getByTestId('archive-stats-stub')).toBeInTheDocument();
        expect(screen.getByTestId('faction-health-chart-stub')).toBeInTheDocument();
        expect(screen.getByTestId('event-log-stub')).toBeInTheDocument();
        expect(screen.getByTestId('archive-map-stub')).toBeInTheDocument();
        expect(
            screen.getByTestId('season-selector-stub').getAttribute('data-current'),
        ).toBe('157');
    });

    test('EventLog config: timeFormat="absolute", id="archives-event-log", includeToday=false, layout from props', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        const log = screen.getByTestId('event-log-stub');
        expect(log.getAttribute('data-time-format')).toBe('absolute');
        expect(log.getAttribute('data-id')).toBe('archives-event-log');
        expect(log.getAttribute('data-include-today')).toBe('false');
        expect(log.getAttribute('data-events')).toBe('2');
    });

    test('ArchiveMap receives the full data object and current selectedEvent', () => {
        useScrollEventMock.mockReturnValue({
            selectedEvent: { event_id: 42, enemy: 0, region: 1, type: 'defend' },
            railRef: {},
        });
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        const map = screen.getByTestId('archive-map-stub');
        expect(map.getAttribute('data-has-data')).toBe('true');
        expect(map.getAttribute('data-selected-id')).toBe('42');
    });

    test('selected scroll event flows to EventLog as the highlight key', () => {
        useScrollEventMock.mockReturnValue({
            selectedEvent: { event_id: 7, enemy: 0, region: 1, type: 'defend' },
            railRef: {},
        });
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        expect(
            screen.getByTestId('event-log-stub').getAttribute('data-selected-key'),
        ).toBe('evt-7');
    });

    test('FactionHealthChart receives snapshots + pointsMax from data', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        const chart = screen.getByTestId('faction-health-chart-stub');
        expect(chart.getAttribute('data-snapshots')).toBe('set');
        expect(chart.getAttribute('data-points-max')).toBe('set');
    });

    test('falls back to empty events when data is null (does NOT crash)', () => {
        render(<ArchivesClient data={null} seasons={[]} currentSeason={157} />);
        expect(screen.getByTestId('event-log-stub').getAttribute('data-events')).toBe(
            '0',
        );
    });
});

describe('ArchivesClient — stats section (StatGrid + ArchiveStats)', () => {
    test('renders both StatGrid and ArchiveStats on the global tab', () => {
        useFactionPreferenceMock.mockReturnValue(['global', vi.fn()]);
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        expect(screen.getByTestId('stat-grid-stub')).toBeInTheDocument();
        expect(screen.getByTestId('archive-stats-stub')).toBeInTheDocument();
    });

    test('passes the active faction to both StatGrid and ArchiveStats', () => {
        useFactionPreferenceMock.mockReturnValue(['bugs', vi.fn()]);
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        expect(screen.getByTestId('stat-grid-stub').getAttribute('data-faction')).toBe(
            'bugs',
        );
        expect(
            screen.getByTestId('archive-stats-stub').getAttribute('data-faction'),
        ).toBe('bugs');
    });

    test('renders the StatGrid in archived mode', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        expect(screen.getByTestId('stat-grid-stub').getAttribute('data-archived')).toBe(
            'true',
        );
    });

    test('clicking FactionTabs invokes the setter from useFactionPreference', () => {
        const setFaction = vi.fn();
        useFactionPreferenceMock.mockReturnValue(['global', setFaction]);
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);

        fireEvent.click(screen.getByTestId('faction-tabs-stub'));
        expect(setFaction).toHaveBeenCalledWith('bugs');
    });
});

describe('ArchivesClient — admin gate (RefreshSeasonButton)', () => {
    test('isAdmin=false → no RefreshSeasonButton in the DOM', () => {
        render(
            <ArchivesClient
                data={baseData}
                seasons={[]}
                currentSeason={157}
                isAdmin={false}
            />,
        );
        expect(
            screen.queryByTestId('refresh-season-button-stub'),
        ).not.toBeInTheDocument();
    });

    test('isAdmin=true → RefreshSeasonButton rendered with the current season', () => {
        render(
            <ArchivesClient
                data={baseData}
                seasons={[]}
                currentSeason={157}
                isAdmin={true}
            />,
        );
        const btn = screen.getByTestId('refresh-season-button-stub');
        expect(btn).toBeInTheDocument();
        expect(btn.getAttribute('data-season')).toBe('157');
    });

    test('isAdmin defaults to false when not provided', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        expect(
            screen.queryByTestId('refresh-season-button-stub'),
        ).not.toBeInTheDocument();
    });
});

describe('ArchivesClient — defeat state', () => {
    test('victory: no cyberstan-defeat class, ArchivesHeader renders without props', () => {
        getWarOutcomeMock.mockReturnValue({ outcome: 'victory' });
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );
        expect(container.querySelector('.cyberstan-defeat')).not.toBeInTheDocument();
        expect(screen.getByTestId('archives-header-stub')).toBeInTheDocument();
    });

    test('defeat: no cyberstan-defeat class (removed), ArchivesHeader still renders', () => {
        getWarOutcomeMock.mockReturnValue({ outcome: 'defeat' });
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );
        // Cyberstan classes removed — the section no longer receives defeat styling via className
        expect(container.querySelector('.cyberstan-defeat')).not.toBeInTheDocument();
        expect(
            container.querySelector('.cyberstan-watermark-active'),
        ).not.toBeInTheDocument();
        expect(screen.getByTestId('archives-header-stub')).toBeInTheDocument();
    });
});

describe('ArchivesClient — pin state machine (defaults to pinned, unlike HomeClient)', () => {
    test('first render: sticky class IS present, pinning class is NOT (no slide on mount)', () => {
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );
        const mapCol = container.querySelector('.archives-map-col');
        expect(mapCol).toBeInTheDocument();
        expect(mapCol.className).toContain('archives-map-col--sticky');
        expect(mapCol.className).not.toContain('archives-map-col--pinning');
    });

    test('FAB label and emoji reflect the default pinned state ("Unpin map" / ✕)', () => {
        render(<ArchivesClient data={baseData} seasons={[]} currentSeason={157} />);
        const fab = screen.getByLabelText('Unpin map');
        expect(fab.textContent).toBe('✕');
        expect(fab.getAttribute('data-umami-event')).toBe('archive-map-toggle');
    });

    test('clicking the FAB unpins: removes both sticky and pinning classes (no animation on unpin)', () => {
        vi.useFakeTimers();
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );

        act(() => {
            fireEvent.click(screen.getByLabelText('Unpin map'));
        });

        const mapCol = container.querySelector('.archives-map-col');
        expect(mapCol.className).not.toContain('archives-map-col--sticky');
        expect(mapCol.className).not.toContain('archives-map-col--pinning');
        // Label flipped.
        expect(screen.getByLabelText('Pin map to top').textContent).toBe('📌');
    });

    test('re-pinning after an unpin triggers the slide animation for 400ms', () => {
        vi.useFakeTimers();
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );

        // Unpin first.
        act(() => {
            fireEvent.click(screen.getByLabelText('Unpin map'));
        });

        // Re-pin.
        act(() => {
            fireEvent.click(screen.getByLabelText('Pin map to top'));
        });

        let mapCol = container.querySelector('.archives-map-col');
        expect(mapCol.className).toContain('archives-map-col--sticky');
        expect(mapCol.className).toContain('archives-map-col--pinning');

        // After 400ms, pinning class clears, sticky remains.
        act(() => {
            vi.advanceTimersByTime(401);
        });
        mapCol = container.querySelector('.archives-map-col');
        expect(mapCol.className).not.toContain('archives-map-col--pinning');
        expect(mapCol.className).toContain('archives-map-col--sticky');
    });

    test('unmount calls clearTimeout on the pending animation timer (verifies the cleanup effect runs)', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );

        // Unpin then re-pin to schedule the animation timer.
        act(() => {
            fireEvent.click(screen.getByLabelText('Unpin map'));
        });
        act(() => {
            fireEvent.click(screen.getByLabelText('Pin map to top'));
        });
        const callsBeforeUnmount = clearSpy.mock.calls.length;

        unmount();

        // Cleanup effect from useEffect's return invoked clearTimeout.
        expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);

        expect(() => {
            vi.advanceTimersByTime(1000);
        }).not.toThrow();
    });
});

describe('ArchivesClient — header glass filter wiring', () => {
    test('inline backdrop-filter style reflects useHeaderGlassFilter return value', () => {
        useHeaderGlassFilterMock.mockReturnValue('blur(8.8px)');
        const { container } = render(
            <ArchivesClient data={baseData} seasons={[]} currentSeason={157} />,
        );
        const mapCol = container.querySelector('.archives-map-col');
        expect(mapCol.style.backdropFilter).toBe('blur(8.8px)');
        expect(mapCol.style.WebkitBackdropFilter).toBe('blur(8.8px)');
    });
});
