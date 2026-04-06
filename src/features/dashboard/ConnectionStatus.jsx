'use client';

const STATUS_CONFIG = {
    live: { label: 'Live', color: 'bg-green-500', pulse: false },
    connecting: { label: 'Connecting', color: 'bg-yellow-500', pulse: true },
    reconnecting: { label: 'Reconnecting', color: 'bg-yellow-500', pulse: true },
    offline: { label: 'Offline', color: 'bg-red-500', pulse: false },
};

export default function ConnectionStatus({ status, timeAgo }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.offline;
    const label = timeAgo || config.label;

    return (
        <span
            className="inline-flex items-center gap-1.5 font-mono text-small text-[var(--color-text-muted)]"
            suppressHydrationWarning
        >
            <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
            />
            {label}
        </span>
    );
}
