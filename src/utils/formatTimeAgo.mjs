export function formatTimeAgo(date, now = new Date()) {
    if (!date) return null;
    const seconds = Math.floor((now - new Date(date)) / 1000);
    if (seconds < 60) return `Updated ${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Updated ${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `Updated ${hours}h ago`;
}
