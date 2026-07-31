import { getDefendLiveStats } from './liveStats.mjs';

/**
 * "Right now" status chip for the defend explainer page. Async server
 * component; `getDefendLiveStats()` is `cache()`-wrapped so sharing a render
 * with `GammaExplorerSection` costs one query, not two. Rendered at ISR time
 * (hourly), hence the literal affordance text.
 *
 * @returns {Promise<import('react').JSX.Element>} the chip markup
 */
export default async function LiveNowChip() {
    const stats = await getDefendLiveStats();
    const { forecast } = stats.now;

    if (forecast.mode !== 'window') {
        return (
            <p className="border border-ghost bg-surface-1 px-3 py-2 font-mono text-small text-text-muted">
                Right now: the window isn&apos;t available — most likely a wave is in
                progress; it returns when the lull begins.{' '}
                <span className="text-primary">live · refreshes hourly</span>
            </p>
        );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const elapsedH = Math.max(
        0,
        Math.round((nowSeconds - forecast.lastTrainStart) / 3600),
    );

    return (
        <p className="border border-ghost bg-surface-1 px-3 py-2 font-mono text-small text-text-muted">
            Right now: state {forecast.state} · {elapsedH}h since the last wave ·{' '}
            <span className="text-primary">
                likely in {Math.round(forecast.p25)}–{Math.round(forecast.p75)}h
            </span>{' '}
            · {Math.round(forecast.p24 * 100)}% within 24h ·{' '}
            <span className="text-primary">live · refreshes hourly</span>
        </p>
    );
}
