// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';

// LiveToasts owns three concerns:
//   1. The Sonner <Toaster> placement (mobile top-center vs desktop bottom-right)
//   2. Catch-up toasts on mount (for active events + dismissed-active events
//      that have since transitioned to success/fail)
//   3. Transition toasts on data update (detectChanges) + Web Notification
//      side effect for the leader tab.
//
// Mocks: sonner Toaster + the helper modules (showEventToast, detectChanges,
// dismissedEvents, computePulseDelays). Tests inspect what was called and with
// which payloads — no need to render real Sonner.

// vi.mock is hoisted; we need vi.hoisted() to share mock fns between the
// hoisted factories and the test body.
const mocks = vi.hoisted(() => ({
    toasterMock: vi.fn(),
    showEventToastMock: vi.fn(),
    toastLabelMock: vi.fn((kind) => ({ title: `Title-${kind}`, subtitle: '' })),
    detectChangesMock: vi.fn(() => []),
    computePulseDelaysMock: vi.fn(() => new Map()),
    getDismissedEventsMock: vi.fn(() => ({})),
    addDismissedEventMock: vi.fn(),
}));

vi.mock('sonner', () => ({
    Toaster: (props) => {
        mocks.toasterMock(props);
        return (
            <div
                data-testid="sonner-toaster"
                data-position={props.position}
                data-theme={props.theme}
            />
        );
    },
}));
vi.mock('@/features/notifications/EventToast', () => ({
    showEventToast: mocks.showEventToastMock,
    toastLabel: mocks.toastLabelMock,
}));
vi.mock('@/shared/utils/game/detectChanges.mjs', () => ({
    detectChanges: mocks.detectChangesMock,
}));
vi.mock('@/shared/utils/game/pulseDelays.mjs', () => ({
    computePulseDelays: mocks.computePulseDelaysMock,
}));
vi.mock('@/features/notifications/dismissedEvents.mjs', () => ({
    getDismissedEvents: mocks.getDismissedEventsMock,
    addDismissedEvent: mocks.addDismissedEventMock,
}));

const {
    toasterMock,
    showEventToastMock,
    toastLabelMock,
    detectChangesMock,
    computePulseDelaysMock,
    getDismissedEventsMock,
    addDismissedEventMock,
} = mocks;

vi.mock('@/shared/enums/factions.mjs', () => ({
    default: {
        0: { icon: '/icons/faction0.webp' },
        1: { icon: '/icons/faction1.webp' },
        2: { icon: '/icons/faction2.webp' },
    },
}));

import LiveToasts from '@/features/notifications/LiveToasts';

const activeEvent = (id, overrides = {}) => ({
    event_id: id,
    enemy: 0,
    region: 5,
    type: 'defend',
    status: 'active',
    ...overrides,
});

beforeEach(() => {
    vi.useFakeTimers();
    toasterMock.mockClear();
    showEventToastMock.mockClear();
    detectChangesMock.mockClear().mockReturnValue([]);
    computePulseDelaysMock.mockClear().mockReturnValue(new Map());
    getDismissedEventsMock.mockClear().mockReturnValue({});
    addDismissedEventMock.mockClear();
    toastLabelMock.mockClear();
    delete window.umami;
    delete globalThis.Notification;
    // Default to desktop viewport.
    window.matchMedia = vi.fn(() => ({ matches: false }));
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

async function flush() {
    for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(60); // catch-up timer is 50ms
    for (let i = 0; i < 5; i += 1) await vi.advanceTimersByTimeAsync(0);
}

describe('LiveToasts — Toaster placement', () => {
    test('desktop viewport → position="bottom-right"', async () => {
        render(<LiveToasts data={{ events: [] }} prevData={null} isLeader={false} />);
        await act(async () => await flush());

        // Latest render reflects the post-effect matchMedia result.
        const lastCallProps = toasterMock.mock.calls.at(-1)[0];
        expect(lastCallProps.position).toBe('bottom-right');
        expect(lastCallProps.theme).toBe('dark');
    });

    test('mobile viewport (matchMedia matches max-width 767px) → position="top-center"', async () => {
        window.matchMedia = vi.fn((query) => ({
            matches: query.includes('767px'),
        }));

        render(<LiveToasts data={{ events: [] }} prevData={null} isLeader={false} />);
        await act(async () => await flush());

        const lastCallProps = toasterMock.mock.calls.at(-1)[0];
        expect(lastCallProps.position).toBe('top-center');
    });
});

describe('LiveToasts — catch-up toasts on mount', () => {
    test('shows catch_up toast for each active event not in the dismissed list', async () => {
        render(
            <LiveToasts
                data={{ events: [activeEvent(1), activeEvent(2, { region: 6 })] }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        expect(showEventToastMock).toHaveBeenCalledTimes(2);
        expect(showEventToastMock.mock.calls[0][1]).toBe('catch_up');
        expect(showEventToastMock.mock.calls[1][1]).toBe('catch_up');
    });

    test('suppresses catch_up toast for events dismissed at status="active" that are still active', async () => {
        getDismissedEventsMock.mockReturnValue({ 1: 'active' });

        render(
            <LiveToasts
                data={{ events: [activeEvent(1)] }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        expect(showEventToastMock).not.toHaveBeenCalled();
    });

    test('shows event_won toast for an event that was dismissed at active but has since succeeded', async () => {
        getDismissedEventsMock.mockReturnValue({ 1: 'active' });

        render(
            <LiveToasts
                data={{
                    events: [activeEvent(1, { status: 'success' })],
                }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        expect(showEventToastMock).toHaveBeenCalledTimes(1);
        const [event, kind, opts] = showEventToastMock.mock.calls[0];
        expect(event.event_id).toBe(1);
        expect(kind).toBe('event_won');
        expect(opts.alertColor).toBe('var(--color-success)');
    });

    test('shows event_lost toast for an event that was dismissed at active but has since failed', async () => {
        getDismissedEventsMock.mockReturnValue({ 1: 'active' });

        render(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'fail' })] }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        expect(showEventToastMock).toHaveBeenCalledTimes(1);
        const [, kind, opts] = showEventToastMock.mock.calls[0];
        expect(kind).toBe('event_lost');
        expect(opts.alertColor).toBe('var(--color-danger)');
    });

    test('does NOT show catch_up toast for completed events that were never dismissed', async () => {
        render(
            <LiveToasts
                data={{
                    events: [
                        activeEvent(1, { status: 'success' }),
                        activeEvent(2, { status: 'fail' }),
                    ],
                }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        // No dismissal record + not active → skip per the source's "else" branch.
        expect(showEventToastMock).not.toHaveBeenCalled();
    });

    test('with empty events array, no catch-up toasts and no umami track', async () => {
        const track = vi.fn();
        window.umami = { track };

        render(<LiveToasts data={{ events: [] }} prevData={null} isLeader={false} />);
        await act(async () => await flush());

        expect(showEventToastMock).not.toHaveBeenCalled();
        expect(track).not.toHaveBeenCalledWith('toast-catch-up', expect.anything());
    });

    test('tracks toast-catch-up with the count when at least one toast was shown', async () => {
        const track = vi.fn();
        window.umami = { track };

        render(
            <LiveToasts
                data={{ events: [activeEvent(1), activeEvent(2)] }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        expect(track).toHaveBeenCalledWith('toast-catch-up', { count: 2 });
    });

    test('onDismiss callback added to each toast persists the dismissal', async () => {
        render(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'active' })] }}
                prevData={null}
                isLeader={false}
            />,
        );
        await act(async () => await flush());

        const opts = showEventToastMock.mock.calls[0][2];
        expect(typeof opts.onDismiss).toBe('function');

        opts.onDismiss();
        expect(addDismissedEventMock).toHaveBeenCalledWith(1, 'active');
    });
});

describe('LiveToasts — transition toasts (detectChanges)', () => {
    test('does NOT fire transition toasts before the catch-up effect has run', async () => {
        // detectChanges returns a change, but hasRendered is still false.
        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'success' }), kind: 'event_won' },
        ]);

        // We render with data + prevData. The transition effect short-circuits
        // on `!hasRendered.current`.
        const { rerender } = render(
            <LiveToasts
                data={{ events: [activeEvent(1)] }}
                prevData={{ events: [] }}
                isLeader={false}
            />,
        );

        // Before catch-up timer fires, no transition toast.
        expect(showEventToastMock).not.toHaveBeenCalled();

        // Flush catch-up.
        await act(async () => await flush());
        showEventToastMock.mockClear();

        // Re-render with new data — transition effect now runs.
        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'success' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={false}
            />,
        );

        expect(showEventToastMock).toHaveBeenCalledTimes(1);
        const [, kind, opts] = showEventToastMock.mock.calls[0];
        expect(kind).toBe('event_won');
        expect(opts.alertColor).toBe('var(--color-success)');
    });

    test('event_lost transitions use var(--color-danger) alertColor', async () => {
        const { rerender } = render(
            <LiveToasts data={{ events: [] }} prevData={null} isLeader={false} />,
        );
        await act(async () => await flush());

        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'fail' }), kind: 'event_lost' },
        ]);

        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'fail' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={false}
            />,
        );

        const [, kind, opts] = showEventToastMock.mock.calls.at(-1);
        expect(kind).toBe('event_lost');
        expect(opts.alertColor).toBe('var(--color-danger)');
    });
});

describe('LiveToasts — Web Notification side effect (leader tab only)', () => {
    test('leader=true + Notification.permission=granted + document.hidden → shows Notification', async () => {
        // Setup browser API.
        const NotificationCtor = vi.fn();
        globalThis.Notification = NotificationCtor;
        globalThis.Notification.permission = 'granted';

        Object.defineProperty(document, 'hidden', {
            configurable: true,
            value: true,
        });

        const { rerender } = render(
            <LiveToasts data={{ events: [] }} prevData={null} isLeader={true} />,
        );
        await act(async () => await flush());

        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'success' }), kind: 'event_won' },
        ]);
        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'success' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={true}
            />,
        );

        expect(NotificationCtor).toHaveBeenCalledTimes(1);
        const [title, options] = NotificationCtor.mock.calls[0];
        expect(title).toBe('Title-event_won'); // from toastLabel mock
        expect(options.icon).toBe('/icons/faction0.webp');
        expect(options.badge).toBe('/icon.svg');
    });

    test('leader=false → no Web Notification even on transition', async () => {
        const NotificationCtor = vi.fn();
        globalThis.Notification = NotificationCtor;
        globalThis.Notification.permission = 'granted';
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });

        const { rerender } = render(
            <LiveToasts data={{ events: [] }} prevData={null} isLeader={false} />,
        );
        await act(async () => await flush());

        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'success' }), kind: 'event_won' },
        ]);
        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'success' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={false}
            />,
        );

        expect(NotificationCtor).not.toHaveBeenCalled();
    });

    test('document.hidden=false → no Web Notification (page is visible, toast is enough)', async () => {
        const NotificationCtor = vi.fn();
        globalThis.Notification = NotificationCtor;
        globalThis.Notification.permission = 'granted';
        Object.defineProperty(document, 'hidden', { configurable: true, value: false });

        const { rerender } = render(
            <LiveToasts data={{ events: [] }} prevData={null} isLeader={true} />,
        );
        await act(async () => await flush());

        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'success' }), kind: 'event_won' },
        ]);
        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'success' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={true}
            />,
        );

        expect(NotificationCtor).not.toHaveBeenCalled();
    });

    test('Notification.permission !== "granted" → no Web Notification', async () => {
        const NotificationCtor = vi.fn();
        globalThis.Notification = NotificationCtor;
        globalThis.Notification.permission = 'denied';
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });

        const { rerender } = render(
            <LiveToasts data={{ events: [] }} prevData={null} isLeader={true} />,
        );
        await act(async () => await flush());

        detectChangesMock.mockReturnValue([
            { event: activeEvent(1, { status: 'success' }), kind: 'event_won' },
        ]);
        rerender(
            <LiveToasts
                data={{ events: [activeEvent(1, { status: 'success' })] }}
                prevData={{ events: [activeEvent(1)] }}
                isLeader={true}
            />,
        );

        expect(NotificationCtor).not.toHaveBeenCalled();
    });
});
