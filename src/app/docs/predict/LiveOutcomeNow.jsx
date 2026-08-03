import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { getCampaign } from '@/db/queries/getCampaign.mjs';
import { eventForecast } from '@/features/dashboard/eventForecast.mjs';
import { sectorForecast } from '@/features/dashboard/attackForecast.mjs';
import { counterattackForecast } from '@/features/dashboard/counterattackForecast.mjs';
import { EVENT_TYPE, EVENT_STATUS } from '@/shared/enums/events.mjs';
import factions from '@/shared/enums/factions.mjs';

const ENEMIES = [0, 1, 2];

/**
 * @param {number} hours
 * @returns {string} `~37h` / `~45min` style label
 */
function fmtHours(hours) {
    if (hours < 1) return `~${Math.max(1, Math.round(hours * 60))}min`;
    return `~${Math.round(hours)}h`;
}

/**
 * One line of what the shipped forecast functions say for a faction RIGHT
 * NOW — the live worked example for the verdict and sector-ETA sections.
 *
 * @param {object} data the live campaign payload
 * @param {number} enemy faction id
 * @param {number} now unix seconds
 * @returns {string} human-readable status line
 */
function factionLine(data, enemy, now) {
    const active = (data.events ?? []).find(
        (e) => e.enemy === enemy && e.status === EVENT_STATUS.ACTIVE,
    );
    if (active) {
        const kind =
            active.type === EVENT_TYPE.ATTACK ? 'homeworld assault' : 'defend event';
        const elapsedPct = Math.round(
            ((now - active.start_time) / (active.end_time - active.start_time)) * 100,
        );
        const v = eventForecast(active, now);
        if (v.mode !== 'verdict') {
            return `${kind} running (${elapsedPct}% elapsed) — verdict hidden: ${v.reason === 'too-early' ? 'below the 25% gate' : v.reason}`;
        }
        if (v.stalled || v.etaHours === null)
            return `${kind} running (${elapsedPct}% elapsed) — stalled, heading for the timer`;
        if (!v.onTrack) {
            return `${kind} running (${elapsedPct}% elapsed) — behind pace, projected to fail in ${fmtHours(v.remainingHours)}`;
        }
        const win = active.type === EVENT_TYPE.ATTACK ? 'homeworld taken' : 'holds';
        return `${kind} running (${elapsedPct}% elapsed) — on track, ${win} in ${fmtHours(v.etaHours)}`;
    }

    const s = sectorForecast(data, enemy, now);
    if (s.mode === 'median')
        return `campaign — next sector boundary in ${fmtHours(s.p50)}`;
    if (s.mode === 'window') {
        return `last sector — assault window ${fmtHours(s.p50)} (${fmtHours(s.p25)}–${fmtHours(s.p75)})`;
    }
    return `campaign quiet — no ETA (${s.reason})`;
}

/**
 * Live readout of every shipped in-flight prediction: per-faction event
 * verdicts / sector ETAs, plus the counterattack clock when an assault
 * runs. Async server component in the HubCounts mold; the page's hourly ISR
 * (`revalidate = 3600`) is the refresh cadence.
 *
 * @returns {Promise<import('react').JSX.Element>} the readout markup
 */
export default async function LiveOutcomeNow() {
    const { data, error } = await tryCatch(getCampaign());
    if (error || !data) {
        return (
            <p className="text-text-muted">
                Live example unavailable right now — the functions below still describe
                exactly what the dashboard cards compute.
            </p>
        );
    }

    const now = Math.floor(Date.now() / 1000);
    const counter = counterattackForecast(data, now);

    return (
        <div className="border border-ghost bg-surface-1 p-4">
            <ul className="m-0 list-none space-y-1 p-0">
                {ENEMIES.map((enemy) => (
                    <li key={enemy} className="font-mono text-small">
                        <b className="text-text">{factions[enemy].name}</b>{' '}
                        <span className="text-text-muted">
                            — {factionLine(data, enemy, now)}
                        </span>
                    </li>
                ))}
                {counter.mode === 'clock' && (
                    <li className="font-mono text-small">
                        <b className="text-text">Counterattack clock</b>{' '}
                        <span className="text-text-muted">
                            — if the assault fails, the counterattack lands in{' '}
                            {fmtHours((counter.at - now) / 3600)}
                            {counter.pace ?
                                ` (pace: ${counter.pace.replace('_', ' ')})`
                            :   ''}
                        </span>
                    </li>
                )}
            </ul>
            <p className="mt-2 mb-0 font-mono text-small text-text-muted">
                live · refreshes hourly · computed by the same functions the dashboard
                cards run
            </p>
        </div>
    );
}
