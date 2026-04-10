/**
 * Group events by calendar day (UTC) and sort newest-first.
 * Within each day, events are sorted by start_time descending (most recent first).
 *
 * @param {Array<{ start_time: number }>} events - Events with Unix timestamps (seconds)
 * @returns {Array<{ date: string, label: string, events: Array }>}
 */
export function groupEventsByDay(events, { includeToday = true } = {}) {
    if (!events || events.length === 0) return [];

    const groups = new Map();

    for (const event of events) {
        const date = new Date(event.start_time * 1000).toISOString().slice(0, 10);
        if (!groups.has(date)) {
            groups.set(date, []);
        }
        groups.get(date).push(event);
    }

    const sorted = Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEvents]) => ({
            date,
            label: formatDayLabel(date),
            events: dayEvents.sort((a, b) => b.start_time - a.start_time),
        }));

    if (includeToday) {
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
