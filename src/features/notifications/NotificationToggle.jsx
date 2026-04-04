'use client';
import { useState, useEffect } from 'react';

export default function NotificationToggle() {
    const [permission, setPermission] = useState('default');
    const [supported, setSupported] = useState(false);

    useEffect(() => {
        if (typeof Notification !== 'undefined') {
            setSupported(true);
            setPermission(Notification.permission);
        }
    }, []);

    if (!supported || permission === 'denied') return null;

    async function requestPermission() {
        const result = await Notification.requestPermission();
        setPermission(result);
    }

    if (permission === 'granted') {
        return (
            <span className="font-mono text-xs text-[var(--color-text-muted)]">
                Notifications on
            </span>
        );
    }

    return (
        <button
            onClick={requestPermission}
            className="font-mono text-xs text-[var(--color-text-muted)] underline decoration-dotted hover:text-[var(--color-text)]"
        >
            Enable notifications
        </button>
    );
}
