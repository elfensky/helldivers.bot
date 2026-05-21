/**
 * Formats a start timestamp into human-readable uptime (e.g. "3d 5h", "2h 14m", "7m").
 * Returns '—' if no start time is provided.
 * @param {string|Date|null} startedAt - When the process or worker started
 * @returns {string}
 */
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
