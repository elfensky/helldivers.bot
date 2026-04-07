'use client';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

/**
 * Small connection-status dot that reads poll status from LiveDataContext.
 * Used by HeaderNav and BottomNav to show real connection state.
 *
 * Two states: green (live — last poll succeeded) or red (offline — last poll failed).
 */
export default function StatusDot() {
    const { status } = useLiveDataContext();
    const isLive = status === 'live';

    return (
        <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'}`}
            role="status"
            aria-label={isLive ? 'Connection: live' : 'Connection: disconnected'}
        />
    );
}
