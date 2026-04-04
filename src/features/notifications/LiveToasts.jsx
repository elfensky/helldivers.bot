'use client';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
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

export default function LiveToasts({ prevData, data, isLeader }) {
    const hasRendered = useRef(false);

    useEffect(() => {
        // Skip the initial render to avoid toasts from SSR→hydration
        if (!hasRendered.current) {
            hasRendered.current = true;
            return;
        }

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

    // DEV ONLY — remove before merging
    if (process.env.NODE_ENV === 'development') {
        return (
            <button
                onClick={() => {
                    const fakeStarted = { enemy: 2, type: 'attack', event_id: 999 };
                    const fakeWon = { enemy: 0, type: 'defend', event_id: 998 };
                    const fakeLost = { enemy: 1, type: 'defend', event_id: 997 };

                    toast(EVENT_LABELS.event_started(fakeStarted), {
                        duration: Infinity,
                        style: TOAST_STYLE(FACTION_COLORS[2]),
                    });
                    toast.success(EVENT_LABELS.event_won(fakeWon), {
                        duration: Infinity,
                        style: TOAST_STYLE(FACTION_COLORS[0]),
                    });
                    toast.error(EVENT_LABELS.event_lost(fakeLost), {
                        duration: Infinity,
                        style: TOAST_STYLE(FACTION_COLORS[1]),
                    });
                }}
                className="fixed bottom-4 left-4 z-50 bg-surface-2 px-3 py-1 font-mono text-xs text-text-muted border border-ghost hover:text-text"
            >
                Test Toasts
            </button>
        );
    }

    return null;
}
