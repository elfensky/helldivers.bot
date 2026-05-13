import { format } from 'timeago.js';

export function formatTimeAgo(date, now = new Date()) {
    if (!date) return null;
    const formatted = format(date, 'en_US', { relativeDate: now });
    return formatted.startsWith('just now')
        ? 'Updated just now'
        : `Updated ${formatted}`;
}
