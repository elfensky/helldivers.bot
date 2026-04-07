'use client';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

/**
 * Small connection-status dot that reads poll status from LiveDataContext.
 * Used by HeaderNav and BottomNav to show real connection state.
 *
 * Three states: green (live — last poll succeeded), yellow (polling — request
 * in flight), red (offline — last poll failed or loaded from PWA cache).
 */
export default function StatusDot() {
    const { status } = useLiveDataContext();

    const color =
        {
            live: 'bg-success',
            polling: 'bg-warning',
            offline: 'bg-danger',
        }[status] ?? 'bg-warning';

    const label =
        {
            live: 'Connection: live',
            polling: 'Connection: polling',
            offline: 'Connection: offline',
        }[status] ?? 'Connection: polling';

    return (
        <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${color}`}
            role="status"
            aria-label={label}
        />
    );
}
