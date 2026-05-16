/**
 * Group events by calendar day (UTC).
 *
 * @param {Array<{ start_time: number }>} events - Events with Unix timestamps (seconds)
 * @param {object} [opts]
 * @param {boolean} [opts.includeToday=true] - If true, prepend an empty TODAY group when no events exist for today (only applies to the default newest-first sort).
 * @param {'desc' | 'asc'} [opts.sortOrder='desc'] - `'desc'` = newest first (days and events-within-day). `'asc'` = oldest first.
 * @returns {Array<{ date: string, label: string, events: Array }>}
 */
export function groupEventsByDay(
    events,
    { includeToday = true, sortOrder = 'desc' } = {},
) {
    if (!events || events.length === 0) return [];

    const groups = new Map();

    for (const event of events) {
        const date = new Date(event.start_time * 1000).toISOString().slice(0, 10);
        if (!groups.has(date)) {
            groups.set(date, []);
        }
        groups.get(date).push(event);
    }

    const cmpDate =
        sortOrder === 'asc' ?
            ([a], [b]) => a.localeCompare(b)
        :   ([a], [b]) => b.localeCompare(a);
    const cmpEvent =
        sortOrder === 'asc' ?
            (a, b) => a.start_time - b.start_time
        :   (a, b) => b.start_time - a.start_time;

    const sorted = Array.from(groups.entries())
        .sort(cmpDate)
        .map(([date, dayEvents]) => ({
            date,
            label: formatDayLabel(date),
            events: dayEvents.sort(cmpEvent),
        }));

    // Only show the empty TODAY placeholder on the default descending view —
    // on ascending (oldest first) TODAY would be at the bottom and looks odd empty.
    if (includeToday && sortOrder === 'desc') {
        const today = new Date().toISOString().slice(0, 10);
        if (sorted.length === 0 || sorted[0].date !== today) {
            sorted.unshift({ date: today, label: 'TODAY', events: [] });
        }
    }

    return sorted;
}

export function formatDayLabel(dateStr) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (dateStr === today) return 'TODAY';
    if (dateStr === yesterday) return 'YESTERDAY';

    const [, , day] = dateStr.split('-');
    const monthName = new Date(dateStr + 'T00:00:00Z').toLocaleString('en-US', {
        month: 'long',
        timeZone: 'UTC',
    });
    return `${monthName.toUpperCase()} ${parseInt(day, 10)}`;
}
