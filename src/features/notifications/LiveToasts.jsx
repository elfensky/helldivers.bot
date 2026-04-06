'use no memo';
'use client';
import { useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import factions from '@/shared/enums/factions.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';

const FACTION_COLORS = {
    0: 'var(--color-faction-bugs)',
    1: 'var(--color-faction-cyborgs)',
    2: 'var(--color-faction-illuminate)',
};

const TOAST_STYLE = (color) => ({
    borderRight: `4px solid ${color}`,
    animation: 'toast-glow 3s ease-in-out infinite',
});

const EVENT_LABELS = {
    event_started: (event) =>
        `${factions[event.enemy]?.name ?? 'Unknown'} ${event.type} event started`,
    event_won: (event) =>
        `${factions[event.enemy]?.name ?? 'Unknown'} ${event.type} event won!`,
    event_lost: (event) =>
        `${factions[event.enemy]?.name ?? 'Unknown'} ${event.type} event lost`,
};

function showWebNotification(message, event) {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    if (!document.hidden) return;

    new Notification(message, {
        icon: factions[event.enemy]?.icon || '/icon.svg',
        badge: '/icon.svg',
    });
}

/**
 * Toast notification layer and Sonner `<Toaster>` host.
 *
 * Two notification modes:
 * 1. **Catch-up** — on page load, shows an 8-second "in progress" toast for
 *    each active event so returning visitors know what's happening.
 * 2. **Transition** — on SSE updates, fires persistent toasts when events
 *    start, are won, or are lost (via `detectChanges`).
 *
 * Architecture notes:
 * - `'use no memo'` opts out of the React Compiler, which otherwise merges
 *   the two `useEffect` hooks and breaks the catch-up toast.
 * - The `<Toaster>` is co-located here (not in the root layout) so that
 *   `toast()` and `<Toaster>` share the same Sonner module instance.
 *   Rendering `<Toaster>` from a server component (layout.jsx) creates a
 *   separate client chunk with its own `ToastState` singleton — toasts
 *   dispatched from other client components never reach it.
 * - Catch-up toasts use `setTimeout(…, 50)` to survive React strict mode's
 *   setup→cleanup→setup cycle (a synchronous toast in the first setup gets
 *   lost when Sonner's subscriber is cleaned up between cycles).
 *
 * @param {{ prevData: Object, data: Object, isLeader: boolean }} props
 */
export default function LiveToasts({ prevData, data, isLeader }) {
    const hasRendered = useRef(false);

    // Catch-up toasts: show active events already in progress on page load.
    // Fires after a short delay so the Toaster's subscriber is ready
    // (React strict mode runs setup→cleanup→setup; a synchronous toast
    //  in the first setup gets lost when the subscriber is cleaned up).
    useEffect(() => {
        if (hasRendered.current) return;

        const activeEvents = data?.events?.filter(
            (e) => e.status === 'active',
        );
        if (!activeEvents?.length) {
            hasRendered.current = true;
            return;
        }

        const timer = setTimeout(() => {
            hasRendered.current = true;
            for (const event of activeEvents) {
                const faction = factions[event.enemy]?.name ?? 'Unknown';
                const label = `${faction} ${event.type} event in progress`;
                const color = FACTION_COLORS[event.enemy];
                toast(label, { duration: 8000, style: TOAST_STYLE(color) });
            }
        }, 50);

        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Transition toasts: detect event state changes between SSE updates
    useEffect(() => {
        if (!hasRendered.current) return;
        if (!prevData || !data) return;

        const changes = detectChanges(prevData.events, data.events);

        for (const change of changes) {
            const label = EVENT_LABELS[change.kind]?.(change.event);
            if (!label) continue;

            const color = FACTION_COLORS[change.event.enemy];

            const opts = { duration: Infinity, style: TOAST_STYLE(color) };

            if (change.kind === 'event_won') {
                toast.success(label, opts);
            } else if (change.kind === 'event_lost') {
                toast.error(label, opts);
            } else {
                toast(label, opts);
            }

            // Web Notification only from leader tab
            if (isLeader) {
                showWebNotification(label, change.event);
            }
        }
    }, [data, prevData, isLeader]);

    return (
        <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
                style: {
                    borderRadius: '0px',
                    background: 'var(--color-surface-1)',
                    color: 'var(--color-text)',
                    border: '1px solid var(--color-ghost)',
                    fontFamily: 'var(--font-body)',
                },
            }}
        />
    );
}
