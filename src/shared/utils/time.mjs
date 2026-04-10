//region Performance
export function performanceTime(start) {
    return performance.now() - start;
}

/**
 * Calculates the elapsed performance time from the given start value,
 * rounds it up to the nearest 50 and returns it. eg: 33 => 50, 60 => 100, 111 => 150, etc...
 * Used to track overall performance metrics using umami events
 *
 * @param {number} start - The starting time value to calculate elapsed time from.
 * @returns {number} The elapsed time rounded up to the nearest 50.
 */
export function roundedPerformanceTime(start) {
    const elapsed = performanceTime(start);
    // const rounded = Math.ceil(elapsed / 100) * 100;
    const rounded = Math.ceil(elapsed / 50) * 50;
    return rounded;
}
//endregion

//region userTime
export function timeSince(date) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
}

export function formatDate(date) {
    const pad = (n) => n.toString().padStart(2, '0');
    return (
        date.getFullYear() +
        '-' +
        pad(date.getMonth() + 1) +
        '-' +
        pad(date.getDate()) +
        ' ' +
        pad(date.getHours()) +
        ':' +
        pad(date.getMinutes()) +
        ':' +
        pad(date.getSeconds())
    );
}

export function elapsedSeconds(past) {
    const now = new Date();
    const elapsed = now - past;
    return Math.floor(elapsed / 1000);
}

export function elapsedMilliseconds(past) {
    const now = new Date();
    const elapsed = now - past;
    return elapsed;
}

export function elapsedSeasonTime(season_duration) {
    const days = Math.floor(season_duration / 86400);
    const hours = Math.floor((season_duration % 86400) / 3600);
    const minutes = Math.floor((season_duration % 3600) / 60);
    const seconds = season_duration % 60;

    const time = {
        days,
        hours,
        minutes,
        seconds,
    };
    return time;
}

//endregion
