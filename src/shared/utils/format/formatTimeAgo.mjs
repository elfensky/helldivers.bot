// `timeago.js` is a deliberate dependency (adopted in 33475be), not accidental
// accumulation. It replaced a hand-rolled `Intl.RelativeTimeFormat` helper that
// lacked edge-case handling. A later review proposed reverting to native
// `Intl.RelativeTimeFormat` to save ~4.2KB — rejected: the ~15-line replacement
// would have to re-implement what timeago.js already gets right (future dates,
// sub-second precision, the "just now" threshold, locale quirks). The size
// saving is not worth reintroducing a bespoke date formatter that was already
// migrated away from once.
import { format } from 'timeago.js';

export function formatTimeAgo(date, now = new Date()) {
    if (!date) return null;
    const formatted = format(date, 'en_US', { relativeDate: now });
    return formatted.startsWith('just now') ? 'Updated just now' : `Updated ${formatted}`;
}
