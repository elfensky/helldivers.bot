'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTrack } from '@/shared/hooks/useTrack.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

// navigator.serviceWorker.ready gets this long before the mount effect gives
// up and moves to the 'error' state (D-14). Not measured — a chosen constant;
// revisit if it fires for healthy users after release.
const SERVICE_WORKER_READY_TIMEOUT_MS = 5000;

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    const output = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
        output[i] = raw.charCodeAt(i);
    }
    return output;
}

/**
 * Subscribes the current service worker registration to push and POSTs the
 * subscription to our backend.
 *
 * Returns `{ error: null }` for both a successful subscribe AND the
 * legitimate "this browser has no push support" no-op — those two outcomes
 * are indistinguishable to the caller by design (web notifications alone
 * still work). Returns `{ error: Error }` only when push IS supported but
 * the deploy has no VAPID public key configured (D-15) — a misconfiguration
 * the caller must not present as success.
 * @returns {Promise<{error: Error|null}>}
 */
async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window))
        return { error: null };
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) {
        return {
            error: new Error(
                'Push is supported by this browser but NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured',
            ),
        };
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });

    await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
    });

    return { error: null };
}

async function unsubscribeFromPush() {
    if (!('serviceWorker' in navigator)) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;

    const endpoint = subscription.endpoint;
    await subscription.unsubscribe();
    await fetch('/api/notifications/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
    });
}

export default function NotificationToggle() {
    const [state, setState] = useState('loading'); // loading | unsupported | denied | enabled | disabled | error
    const [busy, setBusy] = useState(false);
    const [retryToken, setRetryToken] = useState(0);
    const track = useTrack();

    useEffect(() => {
        // Guards a single init attempt: once this effect is cleaned up
        // (unmount, or a new attempt started via Retry), any in-flight
        // promise resolution from THIS attempt must not touch state.
        let cancelled = false;
        let timerId;

        function guardedSetState(next) {
            if (!cancelled) setState(next);
        }

        function enterError(error) {
            reportError(error, { source: 'NotificationToggle', level: 'warning' });
            track('notification-error');
            guardedSetState('error');
        }

        function init() {
            if (typeof Notification === 'undefined') {
                guardedSetState('unsupported');
                return;
            }
            if (Notification.permission === 'denied') {
                guardedSetState('denied');
                return;
            }
            if (Notification.permission === 'granted') {
                // Check if push is also subscribed
                if ('serviceWorker' in navigator && 'PushManager' in window) {
                    const TIMED_OUT = Symbol('service-worker-ready-timed-out');
                    const timeout = new Promise((resolve) => {
                        timerId = setTimeout(
                            () => resolve(TIMED_OUT),
                            SERVICE_WORKER_READY_TIMEOUT_MS,
                        );
                    });

                    Promise.race([navigator.serviceWorker.ready, timeout])
                        .then((result) => {
                            if (result === TIMED_OUT) {
                                enterError(
                                    new Error(
                                        `navigator.serviceWorker.ready did not resolve within ${SERVICE_WORKER_READY_TIMEOUT_MS}ms`,
                                    ),
                                );
                                return;
                            }
                            clearTimeout(timerId);
                            return result.pushManager.getSubscription().then((sub) => {
                                guardedSetState(sub ? 'enabled' : 'disabled');
                            });
                        })
                        .catch((error) => {
                            enterError(/** @type {Error} */ (error));
                        });
                } else {
                    guardedSetState('enabled'); // web notifications only, no push support
                }
            } else {
                guardedSetState('disabled');
            }
        }

        init();

        return () => {
            cancelled = true;
            clearTimeout(timerId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- track() is a stable useCallback identity
    }, [retryToken]);

    if (state === 'loading') return null;

    if (state === 'unsupported' || state === 'denied') {
        const label =
            state === 'denied' ? 'Notifications blocked' : 'Notifications unavailable';
        return (
            <Link
                href="/docs/faq"
                prefetch={false}
                data-umami-event="notification-faq"
                className="font-mono text-small text-[var(--color-text-muted)] opacity-50 hover:opacity-80"
                title="How to enable notifications"
            >
                {label}
            </Link>
        );
    }

    function retry() {
        track('notification-retry');
        setRetryToken((t) => t + 1);
    }

    if (state === 'error') {
        return (
            <span className="inline-flex items-center gap-2 font-mono text-small text-[var(--color-text-muted)]">
                <span className="opacity-50">Notifications unavailable</span>
                <button
                    type="button"
                    onClick={retry}
                    className="underline decoration-dotted hover:text-[var(--color-text)]"
                >
                    Retry
                </button>
            </span>
        );
    }

    async function enable() {
        setBusy(true);
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            track('notification-enable');
            const { error } = await subscribeToPush();
            if (error) {
                reportError(error, {
                    source: 'NotificationToggle',
                    stage: 'subscribeToPush',
                    level: 'warning',
                });
                track('notification-error');
                setState('error');
            } else {
                track('push-subscribe');
                setState('enabled');
            }
        } else if (permission === 'denied') {
            track('notification-permission-denied');
        }
        setBusy(false);
    }

    async function disable() {
        setBusy(true);
        await unsubscribeFromPush();
        track('notification-disable');
        track('push-unsubscribe');
        setState('disabled');
        setBusy(false);
    }

    if (state === 'enabled') {
        return (
            <button
                onClick={disable}
                disabled={busy}
                className="font-mono text-small text-[var(--color-text-muted)] underline decoration-dotted hover:text-[var(--color-text)] disabled:opacity-50"
            >
                {busy ? '...' : 'Notifications on'}
            </button>
        );
    }

    return (
        <button
            onClick={enable}
            disabled={busy}
            className="font-mono text-small text-[var(--color-text-muted)] underline decoration-dotted hover:text-[var(--color-text)] disabled:opacity-50"
        >
            {busy ? '...' : 'Enable notifications'}
        </button>
    );
}
