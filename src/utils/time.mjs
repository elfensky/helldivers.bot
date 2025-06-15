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
 * @returns {number} The elapsed time rounded up to the nearest hundred.
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

export function elapsedDateTime(past) {
    const now = new Date();
    const elapsed = now - past;
    return elapsed;
}

export function elapsedSeasonTime(season_duration) {
    // console.log(season_duration);
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

//human time

// export function timeAgo(from, to = new Date()) {
//     // Convert to Date objects if needed
//     from = new Date(from);
//     to = new Date(to);

//     const sign = Math.floor((to - from) / 1000);
//     const seconds = Math.abs(sign);

//     if (seconds < 60) {
//         return `${seconds} second${seconds !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
//     }
//     const minutes = Math.floor(seconds / 60);
//     if (minutes < 60) {
//         return `${minutes} minute${minutes !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
//     }
//     const hours = Math.floor(minutes / 60);
//     if (hours < 24) {
//         return `${hours} hour${hours !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
//     }
//     const days = Math.floor(hours / 24);
//     if (days < 30) {
//         return `${days} day${days !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
//     }
//     const months = Math.floor(days / 30);
//     if (months < 12) {
//         return `${months} month${months !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
//     }
//     const years = Math.floor(days / 365);
//     return `${years} year${years !== 1 ? 's' : ''} ${sign > 0 ? 'ago' : ''}`;
// }

// export function timeUntil(from, to = new Date()) {
//     from = new Date(from);
//     to = new Date(to);

//     const seconds = Math.floor((to - from) / 1000);

//     if (seconds < 60) {
//         return `${seconds} second${seconds !== 1 ? 's' : ''} `;
//     }
//     const minutes = Math.floor(seconds / 60);
//     if (minutes < 60) {
//         return `${minutes} minute${minutes !== 1 ? 's' : ''} `;
//     }
//     const hours = Math.floor(minutes / 60);
//     if (hours < 24) {
//         return `${hours} hour${hours !== 1 ? 's' : ''} `;
//     }
//     const days = Math.floor(hours / 24);
//     if (days < 30) {
//         return `${days} day${days !== 1 ? 's' : ''} `;
//     }
//     const months = Math.floor(days / 30);
//     if (months < 12) {
//         return `${months} month${months !== 1 ? 's' : ''} `;
//     }
//     const years = Math.floor(days / 365);
//     return `${years} year${years !== 1 ? 's' : ''} `;
// }
