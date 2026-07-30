// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// HomeClient is the homepage orchestrator. It wires live data + selected
// scroll-event → galaxy map state, and owns a pin/unpin animation state
// machine. Children (DashboardClient, Galaxy, EventLog, ErrorBoundary) and
// dependent hooks/utils are stubbed at the boundary; tests assert what
// HomeClient itself wires.

// --- Mocks for children + hooks + utils (boundary-scoped) ---
// vi.mock is hoisted; use vi.hoisted() to share mock fns with test body.

const mocks = vi.hoisted(() => ({
    computeMapStateAtEventMock: vi.fn(() => ({ fromCompute: true })),
    computePulseDelaysMock: vi.fn(() => new Map([['0-1', 0.5]])),
    useScrollEventMock: vi.fn(() => ({
        selectedEvent: null,
        railRef: { current: null },
    })),
    useHeaderGlassFilterMock: vi.fn(() => ''),
}));

vi.mock('@/features/dashboard/HomeClient.css', () => ({}));
vi.mock('@/shared/components/ComponentErrorBoundary', () => ({
    default: ({ children, name }) => (
        <div data-testid={`error-boundary-${name}`}>{children}</div>
    ),
}));
vi.mock('@/features/dashboard/DashboardClient', () => ({
    default: () => <div data-testid="dashboard-client-stub" />,
}));
vi.mock('@/features/timeline/EventLog', () => ({
    default: ({
        events,
        timeFormat,
        layout,
        selectedEventKey,
        id,
        title,
        futureSlot,
    }) => (
        <div
            data-testid="event-log-stub"
            data-events-count={events?.length ?? 0}
            data-time-format={timeFormat}
            data-layout={layout}
            data-selected-key={selectedEventKey ?? ''}
            data-id={id}
            data-title={title}
        >
            {futureSlot}
        </div>
    ),
}));
vi.mock('@/features/galaxy/Galaxy', () => ({
    default: ({ mapState, pulseDelays }) => (
        <div
            data-testid="galaxy-stub"
            data-map-state={JSON.stringify(mapState)}
            data-has-pulse-delays={pulseDelays ? 'true' : 'false'}
        />
    ),
}));

vi.mock('@/shared/utils/game/computeMapStateAtEvent.mjs', () => ({
    computeMapStateAtEvent: mocks.computeMapStateAtEventMock,
}));
vi.mock('@/shared/utils/game/pulseDelays.mjs', () => ({
    computePulseDelays: mocks.computePulseDelaysMock,
}));
vi.mock('@/shared/hooks/useScrollEvent.mjs', () => ({
    useScrollEvent: mocks.useScrollEventMock,
}));
vi.mock('@/shared/hooks/useHeaderGlassFilter.mjs', () => ({
    useHeaderGlassFilter: mocks.useHeaderGlassFilterMock,
}));
vi.mock('@/shared/utils/game/eventKey.mjs', () => ({
    eventKey: (e) => `evt-${e.event_id}`,
}));

const {
    computeMapStateAtEventMock,
    computePulseDelaysMock,
    useScrollEventMock,
    useHeaderGlassFilterMock,
} = mocks;

// useLiveDataContext is mocked globally in vitest.setup.mjs; override
// per-test to drive the data + mapState the orchestrator sees.
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';
import HomeClient from '@/features/dashboard/HomeClient';

const defaultEvents = [
    { event_id: 1, enemy: 0, region: 5, type: 'defend', status: 'active' },
    { event_id: 2, enemy: 1, region: 6, type: 'attack', status: 'active' },
];

beforeEach(() => {
    vi.mocked(useLiveDataContext).mockReturnValue({
        data: { events: defaultEvents },
        mapState: { fromLive: true },
        status: 'live',
        prevData: null,
        isLeader: false,
    });
    computeMapStateAtEventMock.mockClear().mockReturnValue({ fromCompute: true });
    computePulseDelaysMock.mockClear().mockReturnValue(new Map([['0-1', 0.5]]));
    useScrollEventMock
        .mockClear()
        .mockReturnValue({ selectedEvent: null, railRef: { current: null } });
    useHeaderGlassFilterMock.mockClear().mockReturnValue('');
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('HomeClient — layout + child wiring', () => {
    test('renders all four named ErrorBoundary-wrapped children + the FAB', () => {
        render(<HomeClient />);
        expect(screen.getByTestId('error-boundary-Dashboard')).toBeInTheDocument();
        expect(screen.getByTestId('dashboard-client-stub')).toBeInTheDocument();
        expect(screen.getByTestId('error-boundary-Galaxy Map')).toBeInTheDocument();
        expect(screen.getByTestId('error-boundary-Event Log')).toBeInTheDocument();
        expect(screen.getByTestId('event-log-stub')).toBeInTheDocument();
        expect(screen.getByLabelText('Pin map to top')).toBeInTheDocument();
    });

    test('passes events array and the right EventLog config props', () => {
        render(<HomeClient />);
        const eventLog = screen.getByTestId('event-log-stub');
        expect(eventLog.getAttribute('data-events-count')).toBe('2');
        expect(eventLog.getAttribute('data-time-format')).toBe('live');
        expect(eventLog.getAttribute('data-layout')).toBe('stack');
        expect(eventLog.getAttribute('data-id')).toBe('event-log');
        expect(eventLog.getAttribute('data-title')).toBe('Event Log');
        // No selected event → no key.
        expect(eventLog.getAttribute('data-selected-key')).toBe('');
    });

    test('passes selectedEventKey from useScrollEvent to EventLog', () => {
        useScrollEventMock.mockReturnValue({
            selectedEvent: { event_id: 42, enemy: 0, region: 1, type: 'attack' },
            railRef: { current: null },
        });
        render(<HomeClient />);
        const eventLog = screen.getByTestId('event-log-stub');
        expect(eventLog.getAttribute('data-selected-key')).toBe('evt-42');
    });

    test('falls back to empty events list when data is undefined (does NOT crash)', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: undefined,
            mapState: null,
            status: 'offline',
        });
        render(<HomeClient />);
        // No selected event possible with no events; no Galaxy rendered.
        expect(screen.queryByTestId('galaxy-stub')).not.toBeInTheDocument();
        expect(
            screen.getByTestId('event-log-stub').getAttribute('data-events-count'),
        ).toBe('0');
    });
});

describe('HomeClient — mapState source selection', () => {
    test('with no selected event, Galaxy receives the LIVE mapState (not computed)', () => {
        useScrollEventMock.mockReturnValue({ selectedEvent: null, railRef: {} });

        render(<HomeClient />);
        const galaxy = screen.getByTestId('galaxy-stub');
        expect(galaxy.getAttribute('data-map-state')).toBe(
            JSON.stringify({ fromLive: true }),
        );
        // computeMapStateAtEvent was NOT called in live mode.
        expect(computeMapStateAtEventMock).not.toHaveBeenCalled();
    });

    test('with a selected event, Galaxy receives computeMapStateAtEvent(selectedEvent, data) — NOT the live mapState', () => {
        const selectedEvent = { event_id: 99, enemy: 2, region: 7, type: 'defend' };
        useScrollEventMock.mockReturnValue({ selectedEvent, railRef: {} });

        render(<HomeClient />);

        // computeMapStateAtEvent called with the selected event AND the live data.
        expect(computeMapStateAtEventMock).toHaveBeenCalledTimes(1);
        expect(computeMapStateAtEventMock).toHaveBeenCalledWith(selectedEvent, {
            events: defaultEvents,
        });
        // Galaxy got the computed map state, not the live one.
        const galaxy = screen.getByTestId('galaxy-stub');
        expect(galaxy.getAttribute('data-map-state')).toBe(
            JSON.stringify({ fromCompute: true }),
        );
    });

    test('Galaxy is NOT rendered when both selectedEvent path and liveMapState yield null', () => {
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: { events: [] },
            mapState: null,
            status: 'offline',
        });
        useScrollEventMock.mockReturnValue({ selectedEvent: null, railRef: {} });

        render(<HomeClient />);
        expect(screen.queryByTestId('galaxy-stub')).not.toBeInTheDocument();
    });

    test('pulseDelays from computePulseDelays(events) is passed to Galaxy', () => {
        render(<HomeClient />);
        expect(computePulseDelaysMock).toHaveBeenCalledWith(defaultEvents);
        const galaxy = screen.getByTestId('galaxy-stub');
        expect(galaxy.getAttribute('data-has-pulse-delays')).toBe('true');
    });
});

describe('HomeClient — pin/unpin state machine', () => {
    test('FAB starts unpinned: 📌 emoji, "Pin map to top" label, no sticky/pinning classes', () => {
        const { container } = render(<HomeClient />);
        const fab = screen.getByLabelText('Pin map to top');
        expect(fab.textContent).toBe('📌');
        expect(fab.getAttribute('title')).toBe('Pin map to top');
        expect(fab.getAttribute('data-umami-event')).toBe('home-map-toggle');

        const homeMap = container.querySelector('.home-map');
        expect(homeMap.className).not.toContain('home-map--sticky');
        expect(homeMap.className).not.toContain('home-map--pinning');
    });

    test('clicking the FAB pins the map: sticky AND pinning classes, ✕ label flips', () => {
        vi.useFakeTimers();
        const { container } = render(<HomeClient />);
        const fab = screen.getByLabelText('Pin map to top');

        act(() => {
            fireEvent.click(fab);
        });

        const homeMap = container.querySelector('.home-map');
        expect(homeMap.className).toContain('home-map--sticky');
        // Animation class is on immediately after the pin click.
        expect(homeMap.className).toContain('home-map--pinning');

        // Label flipped.
        const unpinFab = screen.getByLabelText('Unpin map');
        expect(unpinFab.textContent).toBe('✕');
        expect(unpinFab.getAttribute('title')).toBe('Unpin map');
    });

    test('after 400ms, the .home-map--pinning class is removed but --sticky stays', () => {
        vi.useFakeTimers();
        const { container } = render(<HomeClient />);
        const fab = screen.getByLabelText('Pin map to top');

        act(() => {
            fireEvent.click(fab);
        });
        // Immediately after click, both classes present.
        let homeMap = container.querySelector('.home-map');
        expect(homeMap.className).toContain('home-map--pinning');

        // Just under 400ms — still pinning.
        act(() => {
            vi.advanceTimersByTime(399);
        });
        homeMap = container.querySelector('.home-map');
        expect(homeMap.className).toContain('home-map--pinning');

        // Cross 400ms — pinning class drops, sticky remains.
        act(() => {
            vi.advanceTimersByTime(2);
        });
        homeMap = container.querySelector('.home-map');
        expect(homeMap.className).not.toContain('home-map--pinning');
        expect(homeMap.className).toContain('home-map--sticky');
    });

    test('unpinning (sticky=true → false) does NOT add the pinning animation class', () => {
        vi.useFakeTimers();
        const { container } = render(<HomeClient />);

        // First pin.
        act(() => {
            fireEvent.click(screen.getByLabelText('Pin map to top'));
        });
        // Wait for animation timer to clear.
        act(() => {
            vi.advanceTimersByTime(400);
        });

        // Now unpin.
        act(() => {
            fireEvent.click(screen.getByLabelText('Unpin map'));
        });

        const homeMap = container.querySelector('.home-map');
        // Sticky class gone.
        expect(homeMap.className).not.toContain('home-map--sticky');
        // Pinning animation NOT triggered on unpin.
        expect(homeMap.className).not.toContain('home-map--pinning');
        // FAB shows pin icon again.
        expect(screen.getByLabelText('Pin map to top').textContent).toBe('📌');
    });

    test('rapid pin/unpin clears the previous animation timer (no stale --pinning class re-applies)', () => {
        vi.useFakeTimers();
        const { container } = render(<HomeClient />);

        // Pin.
        act(() => {
            fireEvent.click(screen.getByLabelText('Pin map to top'));
        });
        // Mid-animation — unpin.
        act(() => {
            vi.advanceTimersByTime(100);
            fireEvent.click(screen.getByLabelText('Unpin map'));
        });

        // Pinning class cleared synchronously on unpin (the setState in the
        // toggle path's `else` runs setIsAnimating(false)).
        let homeMap = container.querySelector('.home-map');
        expect(homeMap.className).not.toContain('home-map--pinning');

        // Run the rest of what would have been the pin-animation duration —
        // no stale callback should re-apply the class.
        act(() => {
            vi.advanceTimersByTime(500);
        });
        homeMap = container.querySelector('.home-map');
        expect(homeMap.className).not.toContain('home-map--pinning');
    });

    test('unmount calls clearTimeout on the pending animation timer (verifies the cleanup effect runs)', () => {
        vi.useFakeTimers();
        const clearSpy = vi.spyOn(globalThis, 'clearTimeout');
        const { unmount } = render(<HomeClient />);

        // Pin to schedule the animation timer.
        act(() => {
            fireEvent.click(screen.getByLabelText('Pin map to top'));
        });
        const callsBeforeUnmount = clearSpy.mock.calls.length;

        // Unmount before the timer fires.
        unmount();

        // Cleanup effect must have invoked clearTimeout AFTER unmount, beyond
        // any earlier internal clears (the togglePin's own clearTimeout fires
        // first; the cleanup is in the dedicated useEffect return).
        expect(clearSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);

        // Sanity check: advancing past the animation interval after unmount
        // produces no setState/warn — there's no more pending timer to fire.
        expect(() => {
            vi.advanceTimersByTime(1000);
        }).not.toThrow();
    });
});

describe('HomeClient — header glass filter wiring', () => {
    test('applies the value returned by useHeaderGlassFilter as inline backdrop-filter (and -webkit-)', () => {
        useHeaderGlassFilterMock.mockReturnValue('blur(8.8px)');

        const { container } = render(<HomeClient />);
        const homeMap = container.querySelector('.home-map');
        expect(homeMap.style.backdropFilter).toBe('blur(8.8px)');
        expect(homeMap.style.WebkitBackdropFilter).toBe('blur(8.8px)');
    });

    test('empty filter string is forwarded unchanged (no glass applied)', () => {
        useHeaderGlassFilterMock.mockReturnValue('');

        const { container } = render(<HomeClient />);
        const homeMap = container.querySelector('.home-map');
        expect(homeMap.style.backdropFilter).toBe('');
    });
});

describe('HomeClient — next-wave forecast wiring', () => {
    test('passes a NextWaveCard into EventLog futureSlot during a lull', () => {
        const now = Math.floor(Date.now() / 1000);
        vi.mocked(useLiveDataContext).mockReturnValue({
            data: {
                status: [
                    {
                        enemy: 0,
                        points: 1_000_000,
                        points_max: 5_000_000,
                        status: 'active',
                    },
                    { enemy: 1, points: 0, points_max: 5_000_000, status: 'active' },
                    { enemy: 2, points: 0, points_max: 5_000_000, status: 'active' },
                ],
                // One completed defend 30h ago -> waveForecast returns
                // window mode, so HomeClient must hand EventLog a card.
                events: [
                    {
                        event_id: 9,
                        type: 'defend',
                        region: 3,
                        enemy: 0,
                        status: 'fail',
                        start_time: now - 40 * 3600,
                        end_time: now - 30 * 3600,
                        points: 400,
                        points_max: 1000,
                    },
                ],
                war_start: now - 100 * 24 * 3600,
            },
            mapState: { fromLive: true },
            status: 'live',
            prevData: null,
            isLeader: false,
        });
        render(<HomeClient />);
        expect(screen.getByText('Predicted')).toBeInTheDocument();
        expect(screen.getByText('LIKELIHOOD_WINDOW')).toBeInTheDocument();
    });

    test('passes no card while a wave is active', () => {
        // defaultEvents (beforeEach) include an active defend -> hidden mode.
        render(<HomeClient />);
        expect(screen.queryByText('Predicted')).not.toBeInTheDocument();
    });
});
