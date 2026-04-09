'use no memo';
'use client';
import { useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';
import {
    getDismissedEvents,
    addDismissedEvent,
} from '@/features/notifications/dismissedEvents.mjs';
import { FACTION_COLORS } from '@/shared/enums/colors.mjs';

/** Duration for the 3-blink entrance/update animation (3 × 0.5s). */
const FLASH_DURATION_MS = 1500;

/** Auto-dismiss duration for previously-dismissed toasts that reappear. */
const SOFT_REAPPEAR_MS = 8000;

/** Resolve a human-readable region name from event data. */
function regionName(event) {
    return map[event.enemy]?.[event.region]?.region ?? 'Unknown Region';
}

/**
 * Build title + subtitle for a toast based on event kind and type.
 *
 * @param {'event_started'|'event_won'|'event_lost'|'catch_up'} kind
 * @param {{ enemy: number, region: number, type: string }} event
 * @returns {{ title: string, subtitle: string }}
 */
function toastLabel(kind, event) {
    const region = regionName(event);
    const isDefend = event.type === 'defend';

    const titles = {
        event_started: isDefend ? `${region} under attack` : `Attacking ${region}`,
        event_won: isDefend ? `${region} defended` : `${region} captured`,
        event_lost: isDefend ? `${region} lost` : `${region} held`,
        catch_up: isDefend ? `${region} under attack` : `Attacking ${region}`,
    };

    const subtitles = {
        event_started: `${isDefend ? 'Defend' : 'Attack'} event started`,
        event_won: `${isDefend ? 'Defend' : 'Attack'} event won!`,
        event_lost: `${isDefend ? 'Defend' : 'Attack'} event lost`,
        catch_up: `${isDefend ? 'Defend' : 'Attack'} event in progress`,
    };

    return {
        title: titles[kind] ?? `${region}`,
        subtitle: subtitles[kind] ?? 'Campaign update',
    };
}

/** Build the JSX element passed as Sonner's first argument. */
function ToastContent({ event, kind }) {
    const { title, subtitle } = toastLabel(kind, event);
    const icon = factions[event.enemy]?.icon;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {icon && <img src={icon} alt="" width={24} height={24} />}
            <div>
                <div style={{ fontWeight: 600 }}>{title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    {subtitle}
                </div>
            </div>
        </div>
    );
}

/** Build a stable toast ID from an event. */
function toastId(event) {
    return `event-${event.id}`;
}

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
 * Resting state: solid faction-colored 4px right border, no animation.
 * On appear or status change: border flashes 3 times (1.5s), then settles.
 * Won/lost events flash result color (green/red), then revert to faction.
 *
 * Animation restart trick: Sonner updates toasts in-place (same React key),
 * so a single CSS animation-name wouldn't replay. We toggle between two
 * identical keyframes (`border-flash-a` / `border-flash-b`) via className
 * to force the browser to restart the animation on each update.
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
    /** Alternates between 'a' and 'b' to force CSS animation restart. */
    const flashToggle = useRef(false);
    /** Pending settle/revert timeouts keyed by event ID. */
    const settleTimers = useRef(new Map());

    /** Cancel a pending settle timeout for an event. */
    function cancelSettle(eventId) {
        const id = settleTimers.current.get(eventId);
        if (id != null) {
            clearTimeout(id);
            settleTimers.current.delete(eventId);
        }
    }

    /**
     * Fire (or replace) a toast for the given event.
     *
     * @param {Object}  event
     * @param {string}  kind        - 'event_started'|'event_won'|'event_lost'|'catch_up'
     * @param {Object}  [opts]
     * @param {number}  [opts.duration]    - Sonner duration (Infinity = persistent)
     * @param {string}  [opts.alertColor]  - Color for the flash overlay (defaults to faction)
     * @param {boolean} [opts.animate]     - Whether to play the 3-blink entrance flash
     */
    function fireToast(event, kind, { duration = Infinity, alertColor, animate = true } = {}) {
        const factionColor = FACTION_COLORS[event.enemy];
        flashToggle.current = !flashToggle.current;
        const suffix = flashToggle.current ? 'a' : 'b';
        const className = animate
            ? `toast-flash toast-flash--${suffix}`
            : 'toast-flash';

        toast(<ToastContent event={event} kind={kind} />, {
            id: toastId(event),
            duration,
            className,
            style: {
                '--faction-color': factionColor,
                '--alert-color': alertColor ?? factionColor,
            },
            onDismiss: () => {
                addDismissedEvent(event.id);
                cancelSettle(event.id);
            },
        });
    }

    /**
     * Fire a toast with a flash, then settle to solid faction color after
     * the animation finishes (1.5s). For won/lost, the flash overlay uses
     * the result color (green/red) against the faction-colored base.
     */
    function fireAndSettle(event, kind, { duration = Infinity, alertColor } = {}) {
        cancelSettle(event.id);
        fireToast(event, kind, { duration, alertColor });

        const settleId = setTimeout(() => {
            settleTimers.current.delete(event.id);
            // Re-fire with no animation — solid faction color resting state
            fireToast(event, kind, { duration, animate: false });
        }, FLASH_DURATION_MS);
        settleTimers.current.set(event.id, settleId);
    }

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

            for (const event of activeEvents) {
                const wasDismissed = dismissed.has(String(event.id));
                fireAndSettle(event, 'catch_up', {
                    duration: wasDismissed ? SOFT_REAPPEAR_MS : Infinity,
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

        for (const change of changes) {
            const { event, kind } = change;

            const alertColor =
                kind === 'event_won'
                    ? 'var(--color-success)'
                    : kind === 'event_lost'
                      ? 'var(--color-danger)'
                      : undefined;

            // Flash alert color overlay (or faction color), then settle to solid faction
            fireAndSettle(event, kind, { alertColor });

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
