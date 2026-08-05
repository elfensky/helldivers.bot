import { getDefendLiveStats } from './liveStats.mjs';
import GammaExplorerLoader from './GammaExplorerLoader';

/**
 * Live-histogram wrapper for the interactive gamma explorer. Async server
 * component; `getDefendLiveStats()` is `cache()`-wrapped so sharing a render
 * with `LiveNowChip` costs one query, not two.
 *
 * @returns {Promise<import('react').JSX.Element | null>} the explorer + live footer, or null before any lull data exists
 */
export default async function GammaExplorerSection() {
    const { histogram, lull, counts } = await getDefendLiveStats();

    // fittedK/meanH are null below 2 usable lull observations — no fit to plot.
    if (lull.meanH == null || lull.fittedK == null) return null;

    return (
        <div>
            <GammaExplorerLoader
                bins={histogram.bins}
                binWidthH={histogram.binWidthH}
                n={lull.n}
                meanH={lull.meanH}
                fittedK={lull.fittedK}
            />
            <p className="mt-2 font-mono text-small text-text-muted">
                {lull.n} lulls from {counts.trainStarts} train starts across{' '}
                {counts.seasons} seasons · reproduce: <code>13-scheduler-shape.mjs</code>{' '}
                · histogram <span className="text-primary">live · refreshes hourly</span>
            </p>
        </div>
    );
}
