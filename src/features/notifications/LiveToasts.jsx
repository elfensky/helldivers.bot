'use no memo';
'use client';
import { useEffect, useRef } from 'react';
import { toast, Toaster } from 'sonner';
import factions from '@/shared/enums/factions.mjs';
import map from '@/shared/enums/map.mjs';
import { detectChanges } from '@/shared/utils/game/detectChanges.mjs';

const FACTION_COLORS = {
    0: 'var(--color-faction-bugs)',
    1: 'var(--color-faction-cyborgs)',
    2: 'var(--color-faction-illuminate)',
};

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

/** Style object for transition toasts — flashing accent border. */
const TRANSITION_STYLE = (color) => ({
    borderRight: `4px solid ${color}`,
    animation: 'action-flash var(--duration-pulse-fast) ease-in-out infinite',
});

/** Style object for catch-up toasts — static accent border, no animation. */
const CATCHUP_STYLE = (color) => ({
    borderRight: `4px solid ${color}`,
});

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
 * 1. **Catch-up** — on page load, shows an 8-second toast for each active
 *    event so returning visitors know what's happening.
 * 2. **Transition** — on data updates, fires persistent toasts when events
 *    start, are won, or are lost (via `detectChanges`).
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
            for (const event of activeEvents) {
                const color = FACTION_COLORS[event.enemy];
                toast(
                    <ToastContent event={event} kind="catch_up" />,
                    { duration: 8000, style: CATCHUP_STYLE(color) },
                );
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
            const { title } = toastLabel(change.kind, change.event);
            const color = FACTION_COLORS[change.event.enemy];
            const opts = { duration: Infinity, style: TRANSITION_STYLE(color) };

            if (change.kind === 'event_won') {
                toast.success(
                    <ToastContent event={change.event} kind={change.kind} />,
                    opts,
                );
            } else if (change.kind === 'event_lost') {
                toast.error(
                    <ToastContent event={change.event} kind={change.kind} />,
                    opts,
                );
            } else {
                toast(
                    <ToastContent event={change.event} kind={change.kind} />,
                    opts,
                );
            }

            if (isLeader) {
                showWebNotification(title, change.event);
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
