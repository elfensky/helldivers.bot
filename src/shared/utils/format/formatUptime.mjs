export function formatUptime(startedAt) {
    if (!startedAt) return '—';
    const ms = Date.now() - new Date(startedAt).getTime();
    const totalMinutes = Math.floor(ms / 60_000);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);

    if (days > 0) return `${days}d ${totalHours % 24}h`;
    if (totalHours > 0) return `${totalHours}h ${totalMinutes % 60}m`;
    return `${totalMinutes}m`;
}
