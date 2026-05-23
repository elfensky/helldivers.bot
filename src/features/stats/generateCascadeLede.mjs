import { formatCompactDuration } from '@/shared/utils/format/formatCompactDuration.mjs';

/**
 * Build the lede sentence shown above the cascade log on /stats.
 *
 * @param {Array<object>} cascades - Sorted leaderboard (worst-first).
 * @param {number} seasonsCount - Total seasons in the dataset.
 * @returns {string | null}
 */
export function generateCascadeLede(cascades, seasonsCount) {
    if (!cascades?.length) return null;
    const worst = cascades[0];
    const last = worst.regions[worst.regions.length - 1];
    const reachedHome = last === 0 || last === 11;
    const verb =
        reachedHome ?
            'pushed all the way home'
        :   `swept ${worst.length} regions in ${formatCompactDuration(worst.durationSec)}`;
    return (
        `${cascades.length} cascade${cascades.length === 1 ? '' : 's'} ` +
        `across ${seasonsCount} war${seasonsCount === 1 ? '' : 's'}. ` +
        `Worst: season ${worst.season}, where the ${worst.faction} ${verb}.`
    );
}
