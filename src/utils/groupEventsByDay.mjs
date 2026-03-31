// src/utils/groupEventsByDay.mjs

export function groupEventsByDay(events) {
    if (!events || events.length === 0) return [];

    const groups = new Map();

    for (const event of events) {
        const date = new Date(event.start_time * 1000).toISOString().slice(0, 10);
        if (!groups.has(date)) {
            groups.set(date, []);
        }
        groups.get(date).push(event);
    }

    return Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, dayEvents]) => ({
            date,
            label: formatDayLabel(date),
            events: dayEvents.sort((a, b) => b.start_time - a.start_time),
        }));
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
