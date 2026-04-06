'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

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

async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return;

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
    const [state, setState] = useState('loading'); // loading | unsupported | denied | enabled | disabled
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (typeof Notification === 'undefined') {
            setState('unsupported');
            return;
        }
        if (Notification.permission === 'denied') {
            setState('denied');
            return;
        }
        if (Notification.permission === 'granted') {
            // Check if push is also subscribed
            if ('serviceWorker' in navigator && 'PushManager' in window) {
                navigator.serviceWorker.ready.then((reg) => {
                    reg.pushManager.getSubscription().then((sub) => {
                        setState(sub ? 'enabled' : 'disabled');
                    });
                });
            } else {
                setState('enabled'); // web notifications only, no push support
            }
        } else {
            setState('disabled');
        }
    }, []);

    if (state === 'loading') return null;

    if (state === 'unsupported' || state === 'denied') {
        const label =
            state === 'denied' ? 'Notifications blocked' : 'Notifications unavailable';
        return (
            <Link
                href="/docs/faq"
                prefetch={false}
                className="font-mono text-small text-[var(--color-text-muted)] opacity-50 hover:opacity-80"
                title="How to enable notifications"
            >
                {label}
            </Link>
        );
    }

    async function enable() {
        setBusy(true);
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            await subscribeToPush();
            setState('enabled');
        }
        setBusy(false);
    }

    async function disable() {
        setBusy(true);
        await unsubscribeFromPush();
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
