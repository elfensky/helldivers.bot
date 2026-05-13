import { format } from 'timeago.js';

export function formatTimeAgo(date, now = new Date()) {
    if (!date) return null;
    try {
        // Use timeago.js for comprehensive time formatting
        // Note: timeago.js uses relativeDate option for custom reference time
        const formatted = format(date, 'en_US', { relativeDate: now });
        return formatted.startsWith('just now')
            ? 'Updated just now'
            : `Updated ${formatted}`;
    } catch (error) {
        // Fallback to original implementation for robustness
        const seconds = Math.floor((now - new Date(date)) / 1000);
        if (!Number.isFinite(seconds) || seconds < 0) return 'Updated just now';
        if (seconds < 60) return `Updated ${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `Updated ${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `Updated ${hours}h ago`;
    }
}
