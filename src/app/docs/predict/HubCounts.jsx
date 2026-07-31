import { getEventCounts } from './defend/liveStats.mjs';

/**
 * One-sentence live tally for the /docs/predict hub — event counts pulled
 * hourly (ISR, `revalidate = 3600` on the page) from the same query the
 * defend page's live stats use. Async server component; no 'use client'.
 *
 * @returns {Promise<import('react').JSX.Element>} the tally markup
 */
export default async function HubCounts() {
    const { defends, attacks, seasons } = await getEventCounts();

    return (
        <p className="text-text-muted">
            Tracking{' '}
            <b className="font-mono text-text">{defends.toLocaleString('en-US')}</b>{' '}
            defends and{' '}
            <b className="font-mono text-text">{attacks.toLocaleString('en-US')}</b>{' '}
            attacks across{' '}
            <b className="font-mono text-text">{seasons.toLocaleString('en-US')}</b>{' '}
            seasons ·{' '}
            <span className="font-mono text-small">live · refreshes hourly</span>
        </p>
    );
}
