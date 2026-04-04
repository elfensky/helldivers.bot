export function getActiveEvents(events) {
    return events?.filter((e) => e.status === 'active') ?? [];
}

export function sortEventsByRecent(events) {
    return [...(events ?? [])].sort((a, b) => b.start_time - a.start_time);
}

export function countOutcomes(events) {
    let wins = 0;
    let losses = 0;
    for (const e of events) {
        if (e.status === 'success') wins++;
        else if (e.status === 'fail') losses++;
    }
    return { wins, losses };
}
