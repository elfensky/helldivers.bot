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

    // Catch-up toasts: show active events on page load, plus events that
    // transitioned to a terminal state since the user last dismissed them.
    //
    // Dismissal is tracked per (eventId, status) pair. If the user dismissed
    // an event at status='active' and the event is still active, we skip it
    // entirely. If the event has since transitioned to success/fail, we show
    // the completion toast because the status has meaningfully changed.
    useEffect(() => {
        if (hasRendered.current) return;

        const allEvents = data?.events ?? [];
        if (!allEvents.length) {
            hasRendered.current = true;
            return;
        }

        const timer = setTimeout(() => {
            hasRendered.current = true;
            const dismissed = getDismissedEvents();
            const delays = computePulseDelays(allEvents);
            let shownCount = 0;

            for (const event of allEvents) {
                const dismissedAt = dismissed[String(event.event_id)];
                const dismissedAtCurrent = dismissedAt === event.status;

                if (dismissedAtCurrent) continue; // fully suppressed

                if (event.status === 'active') {
                    showEventToast(event, 'catch_up', {
                        pulseDelay: delays.get(`${event.enemy}-${event.region}`),
                        onDismiss: () => addDismissedEvent(event.event_id, event.status),
                    });
                    shownCount++;
                } else if (dismissedAt === 'active') {
                    // User dismissed the active toast; event has since
                    // transitioned. Show the terminal outcome so the user
                    // doesn't silently miss a status change.
                    const kind = event.status === 'success' ? 'event_won' : 'event_lost';
                    const alertColor =
                        kind === 'event_won' ? 'var(--color-success)' : (
                            'var(--color-danger)'
                        );
                    showEventToast(event, kind, {
                        alertColor,
                        pulseDelay: delays.get(`${event.enemy}-${event.region}`),
                        onDismiss: () => addDismissedEvent(event.event_id, event.status),
                    });
                    shownCount++;
                }
                // else: completed event never dismissed — skip on catch-up
            }
            if (shownCount && window.umami) {
                window.umami.track('toast-catch-up', { count: shownCount });
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
                kind === 'event_won' ? 'var(--color-success)' : 'var(--color-danger)';

            showEventToast(event, kind, {
                alertColor,
                pulseDelay: delays.get(`${event.enemy}-${event.region}`),
                onDismiss: () => addDismissedEvent(event.event_id, event.status),
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
            closeButton
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
