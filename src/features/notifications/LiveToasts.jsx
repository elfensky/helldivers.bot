'use no memo';
'use client';
import { useEffect, useRef } from 'react';
import { Toaster } from 'sonner';
import factions from '@/shared/enums/factions.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';
import {
    getDismissedEvents,
    addDismissedEvent,
} from '@/features/notifications/dismissedEvents.mjs';
import { computePulseDelays } from '@/shared/utils/game/pulseDelays.mjs';
import { showEventToast, toastLabel } from '@/features/notifications/eventToast';

/** Auto-dismiss duration for previously-dismissed toasts that reappear. */
const SOFT_REAPPEAR_MS = 8000;

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
 * Right border continuously blinks between faction color and an alert color
 * (danger red for started/lost/catch-up, success green for won), matching the
 * sector-card-action-flash animation timing.
 *
 * Architecture notes:
 * - `'use no memo'` opts out of the React Compiler, which otherwise merges
 *   the two `useEffect` hooks and breaks the catch-up toast.
 * - The `<Toaster>` is co-located here (not in the root layout) so that
 *   `toast()` and `<Toaster>` share the same Sonner module instance.
 *
 * @param {{ prevData: Object, data: Object, isLeader: boolean }} props
 */
export default function LiveToasts({ prevData, data, isLeader }) {
    const hasRendered = useRef(false);

    // Catch-up toasts: show active events already in progress on page load.
    useEffect(() => {
        if (hasRendered.current) return;

        const activeEvents = data?.events?.filter((e) => e.status === 'active');
        if (!activeEvents?.length) {
            hasRendered.current = true;
            return;
        }

        const timer = setTimeout(() => {
            hasRendered.current = true;
            const dismissed = getDismissedEvents();
            const delays = computePulseDelays(data?.events);

            for (const event of activeEvents) {
                const wasDismissed = dismissed.has(String(event.id));
                showEventToast(event, 'catch_up', {
                    duration: wasDismissed ? SOFT_REAPPEAR_MS : Infinity,
                    pulseDelay: delays.get(`${event.enemy}-${event.region}`),
                    onDismiss: () => addDismissedEvent(event.id),
                });
            }
            if (window.umami) {
                window.umami.track('toast-catch-up', { count: activeEvents.length });
            }
        }, 50);

        return () => clearTimeout(timer);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Transition toasts: detect event state changes between data updates
    useEffect(() => {
        if (!hasRendered.current) return;
        if (!prevData || !data) return;

        const changes = detectChanges(prevData.events, data.events);
        const delays = computePulseDelays(data?.events);

        for (const change of changes) {
            const { event, kind } = change;

            const alertColor =
                kind === 'event_won'
                    ? 'var(--color-success)'
                    : 'var(--color-danger)';

            showEventToast(event, kind, {
                alertColor,
                pulseDelay: delays.get(`${event.enemy}-${event.region}`),
                onDismiss: () => addDismissedEvent(event.id),
            });

            if (isLeader) {
                const { title } = toastLabel(kind, event);
                showWebNotification(title, event);
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
