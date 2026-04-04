'use client';
import { useState, useEffect } from 'react';

export default function PushToggle() {
    const [state, setState] = useState('loading'); // loading | unsupported | enabled | disabled
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            setState('unsupported');
            return;
        }

        navigator.serviceWorker.ready.then((registration) => {
            registration.pushManager.getSubscription().then((sub) => {
                setState(sub ? 'enabled' : 'disabled');
            });
        });
    }, []);

    async function subscribe() {
        setBusy(true);
        const registration = await navigator.serviceWorker.ready;
        const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!vapidKey) {
            console.error('NEXT_PUBLIC_VAPID_PUBLIC_KEY not set');
            setBusy(false);
            return;
        }

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });

        const response = await fetch('/api/notifications/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(subscription.toJSON()),
        });

        if (response.ok) {
            setState('enabled');
        }
        setBusy(false);
    }

    async function unsubscribe() {
        setBusy(true);
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            const endpoint = subscription.endpoint;
            await subscription.unsubscribe();
            await fetch('/api/notifications/subscribe', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint }),
            });
        }

        setState('disabled');
        setBusy(false);
    }

    if (state === 'loading' || state === 'unsupported') return null;

    return (
        <button
            onClick={state === 'enabled' ? unsubscribe : subscribe}
            disabled={busy}
            className="font-mono text-xs text-[var(--color-text-muted)] underline decoration-dotted hover:text-[var(--color-text)] disabled:opacity-50"
        >
            {busy ?
                '...'
            : state === 'enabled' ?
                'Push on'
            :   'Enable push'}
        </button>
    );
}

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
