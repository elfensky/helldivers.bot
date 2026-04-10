import humanizeDuration from 'humanize-duration';

const shortEnglish = {
    y: () => 'y',
    mo: () => 'mo',
    w: () => 'w',
    d: () => 'd',
    h: () => 'h',
    m: () => 'm',
    s: () => 's',
    ms: () => 'ms',
};

export function formatCompactDuration(seconds) {
    return humanizeDuration(seconds * 1000, {
        largest: 2,
        round: true,
        spacer: '',
        language: 'shortEn',
        languages: { shortEn: shortEnglish },
    });
}
