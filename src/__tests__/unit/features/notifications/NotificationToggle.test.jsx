// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// NotificationToggle is a permission-flow state machine:
//   loading → { unsupported | denied | enabled | disabled }
// Plus an enable() / disable() flow that calls Notification.requestPermission,
// navigator.serviceWorker, pushManager, and POST/DELETE /api/notifications/subscribe.
// Tests mock every global it touches and assert state transitions + tracking
// calls + outgoing fetches.

const trackMock = vi.fn();
vi.mock('@/shared/hooks/useTrack.mjs', () => ({
    useTrack: () => trackMock,
}));

import NotificationToggle from '@/features/notifications/NotificationToggle';

// Helper: set up a complete browser-API environment for one scenario.
function installBrowserAPIs({
    permission = 'default',
    requestPermissionResult = 'granted',
    hasSubscription = false,
    fetchOk = true,
    getSubscriptionRejection = null,
} = {}) {
    // Notification
    globalThis.Notification = function () {};
    globalThis.Notification.permission = permission;
    globalThis.Notification.requestPermission = vi.fn(() =>
        Promise.resolve(requestPermissionResult),
    );

    // navigator.serviceWorker.ready -> { pushManager: { getSubscription, subscribe } }
    const subscription =
        hasSubscription ?
            {
                endpoint: 'https://example.com/push/abc',
                toJSON: () => ({
                    endpoint: 'https://example.com/push/abc',
                    keys: { p256dh: 'p', auth: 'a' },
                }),
                unsubscribe: vi.fn(() => Promise.resolve()),
            }
        :   null;

    const subscribeMock = vi.fn(() =>
        Promise.resolve({
            endpoint: 'https://example.com/push/new',
            toJSON: () => ({
                endpoint: 'https://example.com/push/new',
                keys: { p256dh: 'p', auth: 'a' },
            }),
        }),
    );

    const pushManager = {
        getSubscription: vi.fn(() =>
            getSubscriptionRejection ?
                Promise.reject(getSubscriptionRejection)
            :   Promise.resolve(subscription),
        ),
        subscribe: subscribeMock,
    };

    Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
            ready: Promise.resolve({ pushManager }),
        },
    });

    // PushManager presence is detected via `'PushManager' in window`.
    // Defining the mock, not calling the API — this test simulates a browser that has it.
    // eslint-disable-next-line compat/compat
    globalThis.PushManager = function () {};

    // fetch
    globalThis.fetch = vi.fn(() =>
        Promise.resolve({ ok: fetchOk, status: fetchOk ? 200 : 500 }),
    );

    // VAPID key for subscribeToPush
    vi.stubEnv('NEXT_PUBLIC_VAPID_PUBLIC_KEY', 'BAxyz-_=');

    return { subscription, subscribeMock, pushManager };
}

beforeEach(() => {
    trackMock.mockClear();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    delete globalThis.Notification;
    // Tearing down the mock defined above.
    // eslint-disable-next-line compat/compat
    delete globalThis.PushManager;
    delete globalThis.fetch;
    delete navigator.serviceWorker;
});

describe('NotificationToggle — render gates', () => {
    test('renders null while loading (before the mount effect resolves)', () => {
        installBrowserAPIs({
            permission: 'granted',
            // Block the effect: serviceWorker.ready never resolves.
        });
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { ready: new Promise(() => {}) },
        });

        const { container } = render(<NotificationToggle />);
        // Initial render: state === 'loading' → null.
        expect(container.firstChild).toBeNull();
    });

    test('renders "Notifications unavailable" link when Notification API is missing', async () => {
        // Notification global NOT defined.
        const { container: _container } = render(<NotificationToggle />);

        await waitFor(() => {
            expect(screen.getByText('Notifications unavailable')).toBeInTheDocument();
        });
        const link = screen.getByText('Notifications unavailable');
        expect(link.tagName).toBe('A');
        expect(link.getAttribute('href')).toBe('/docs/faq');
        expect(link.getAttribute('data-umami-event')).toBe('notification-faq');
    });

    test('renders "Notifications blocked" link when permission is "denied"', async () => {
        installBrowserAPIs({ permission: 'denied' });

        render(<NotificationToggle />);

        await waitFor(() => {
            expect(screen.getByText('Notifications blocked')).toBeInTheDocument();
        });
        const link = screen.getByText('Notifications blocked');
        expect(link.getAttribute('href')).toBe('/docs/faq');
    });

    test('renders "Notifications on" button when permission is granted AND push subscription exists', async () => {
        installBrowserAPIs({ permission: 'granted', hasSubscription: true });

        render(<NotificationToggle />);

        await waitFor(() => {
            expect(screen.getByText('Notifications on')).toBeInTheDocument();
        });
    });

    test('renders "Enable notifications" button when permission is granted BUT no push subscription', async () => {
        installBrowserAPIs({ permission: 'granted', hasSubscription: false });

        render(<NotificationToggle />);

        await waitFor(() => {
            expect(screen.getByText('Enable notifications')).toBeInTheDocument();
        });
    });

    test('renders "Enable notifications" button when permission is "default"', async () => {
        installBrowserAPIs({ permission: 'default' });

        render(<NotificationToggle />);

        await waitFor(() => {
            expect(screen.getByText('Enable notifications')).toBeInTheDocument();
        });
    });
});

describe('NotificationToggle — enable flow (granted)', () => {
    test('clicking "Enable notifications" → requests permission → subscribes → tracks → flips to "Notifications on"', async () => {
        const { subscribeMock } = installBrowserAPIs({
            permission: 'default',
            requestPermissionResult: 'granted',
        });

        render(<NotificationToggle />);
        const button = await screen.findByText('Enable notifications');

        fireEvent.click(button);

        await waitFor(() => {
            expect(Notification.requestPermission).toHaveBeenCalledTimes(1);
        });

        // Push subscribe was called with the correct VAPID-derived applicationServerKey.
        await waitFor(() => {
            expect(subscribeMock).toHaveBeenCalledTimes(1);
        });
        const subscribeArg = subscribeMock.mock.calls[0][0];
        expect(subscribeArg.userVisibleOnly).toBe(true);
        expect(subscribeArg.applicationServerKey).toBeInstanceOf(Uint8Array);

        // POSTed the subscription to our backend.
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                '/api/notifications/subscribe',
                expect.objectContaining({
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: 'https://example.com/push/new',
                        keys: { p256dh: 'p', auth: 'a' },
                    }),
                }),
            );
        });

        // Tracked both events in order.
        expect(trackMock).toHaveBeenCalledWith('notification-enable');
        expect(trackMock).toHaveBeenCalledWith('push-subscribe');

        // UI flipped.
        await waitFor(() => {
            expect(screen.getByText('Notifications on')).toBeInTheDocument();
        });
    });
});

describe('NotificationToggle — enable flow (denied)', () => {
    test('user denies permission → tracks "notification-permission-denied", stays on "Enable notifications"', async () => {
        installBrowserAPIs({
            permission: 'default',
            requestPermissionResult: 'denied',
        });

        render(<NotificationToggle />);
        const button = await screen.findByText('Enable notifications');

        fireEvent.click(button);

        await waitFor(() => {
            expect(trackMock).toHaveBeenCalledWith('notification-permission-denied');
        });
        // Did NOT track the success path.
        expect(trackMock).not.toHaveBeenCalledWith('notification-enable');
        expect(trackMock).not.toHaveBeenCalledWith('push-subscribe');

        // Button label still "Enable notifications" — state did not flip.
        expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });
});

describe('NotificationToggle — disable flow', () => {
    test('clicking "Notifications on" → unsubscribes push + DELETEs the subscription + tracks → flips to "Enable notifications"', async () => {
        const { subscription } = installBrowserAPIs({
            permission: 'granted',
            hasSubscription: true,
        });

        render(<NotificationToggle />);
        const button = await screen.findByText('Notifications on');

        fireEvent.click(button);

        // pushManager subscription was unsubscribed.
        await waitFor(() => {
            expect(subscription.unsubscribe).toHaveBeenCalledTimes(1);
        });

        // Backend DELETE called with the endpoint.
        await waitFor(() => {
            expect(globalThis.fetch).toHaveBeenCalledWith(
                '/api/notifications/subscribe',
                expect.objectContaining({
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        endpoint: 'https://example.com/push/abc',
                    }),
                }),
            );
        });

        // Tracked both events.
        expect(trackMock).toHaveBeenCalledWith('notification-disable');
        expect(trackMock).toHaveBeenCalledWith('push-unsubscribe');

        // UI flipped back.
        await waitFor(() => {
            expect(screen.getByText('Enable notifications')).toBeInTheDocument();
        });
    });
});

describe('NotificationToggle — busy state', () => {
    test('the button is disabled and shows "..." while async work is in flight', async () => {
        // Make Notification.requestPermission hang so we observe the busy state.
        installBrowserAPIs({ permission: 'default' });
        let resolvePermission;
        Notification.requestPermission = vi.fn(
            () =>
                new Promise((res) => {
                    resolvePermission = res;
                }),
        );

        render(<NotificationToggle />);
        const button = await screen.findByText('Enable notifications');

        fireEvent.click(button);

        await waitFor(() => {
            expect(screen.getByText('...')).toBeInTheDocument();
        });
        // Button (now the "..." one) is disabled while busy.
        const busyBtn = screen.getByText('...').closest('button');
        expect(busyBtn.disabled).toBe(true);

        // Resolve so the test cleans up.
        resolvePermission('denied');
        await waitFor(() => {
            expect(screen.getByText('Enable notifications')).toBeInTheDocument();
        });
    });
});

describe('NotificationToggle — error state (hung/rejecting service worker)', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test('serviceWorker.ready never resolves -> after 5s renders error copy + Retry', async () => {
        installBrowserAPIs({ permission: 'granted' });
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { ready: new Promise(() => {}) },
        });

        render(<NotificationToggle />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });

        expect(screen.getByText('Notifications unavailable')).toBeInTheDocument();
        const retryButton = screen.getByRole('button', { name: /Retry/i });
        expect(retryButton).toBeInTheDocument();
    });

    test('getSubscription() rejects -> renders error copy + Retry without waiting for the timeout', async () => {
        installBrowserAPIs({
            permission: 'granted',
            getSubscriptionRejection: new Error('getSubscription boom'),
        });

        render(<NotificationToggle />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByText('Notifications unavailable')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
    });

    test('clicking Retry re-runs init against a now-healthy environment and reaches a terminal state', async () => {
        installBrowserAPIs({ permission: 'granted' });
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { ready: new Promise(() => {}) },
        });

        render(<NotificationToggle />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        const retryButton = screen.getByRole('button', { name: /Retry/i });

        // Repair the environment before retrying.
        installBrowserAPIs({ permission: 'granted', hasSubscription: false });

        fireEvent.click(retryButton);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByText('Enable notifications')).toBeInTheDocument();
    });

    test('timeout fires, then a late serviceWorker.ready resolution does not overwrite the error state', async () => {
        installBrowserAPIs({ permission: 'granted' });
        let resolveReady;
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: {
                ready: new Promise((resolve) => {
                    resolveReady = resolve;
                }),
            },
        });

        render(<NotificationToggle />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();

        // Late resolution arrives after the timeout already won the race.
        await act(async () => {
            resolveReady({
                pushManager: { getSubscription: () => Promise.resolve(null) },
            });
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument();
        expect(screen.queryByText('Enable notifications')).not.toBeInTheDocument();
    });

    test('clicking Retry twice in quick succession leaves exactly one terminal state', async () => {
        installBrowserAPIs({ permission: 'granted' });
        Object.defineProperty(navigator, 'serviceWorker', {
            configurable: true,
            value: { ready: new Promise(() => {}) },
        });

        render(<NotificationToggle />);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(5000);
        });
        const retryButton = screen.getByRole('button', { name: /Retry/i });

        installBrowserAPIs({ permission: 'granted', hasSubscription: false });
        fireEvent.click(retryButton);
        fireEvent.click(retryButton);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
        });

        expect(screen.getByText('Enable notifications')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Retry/i })).not.toBeInTheDocument();
    });
});
