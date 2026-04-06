'use client';
import { useLiveDataContext } from '@/shared/providers/LiveDataContext.mjs';

const DOT_STYLES = {
    live: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    reconnecting: 'bg-yellow-500 animate-pulse',
    offline: 'bg-red-500',
};

const DOT_LABELS = {
    live: 'Connected',
    connecting: 'Connecting',
    reconnecting: 'Reconnecting',
    offline: 'Offline',
};

/**
 * Small connection-status dot that reads SSE status from LiveDataContext.
 * Used by HeaderNav and BottomNav to show real connection state.
 */
export default function StatusDot() {
    const { status } = useLiveDataContext();
    const style = DOT_STYLES[status] || DOT_STYLES.offline;
    const label = DOT_LABELS[status] || 'Offline';

    return (
        <span
            className={`inline-block h-1.5 w-1.5 rounded-full ${style}`}
            role="status"
            aria-label={`Connection: ${label}`}
        />
    );
}
