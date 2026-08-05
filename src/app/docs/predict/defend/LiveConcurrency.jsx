import { getConcurrencyStats } from './liveStats.mjs';

/**
 * Live event-concurrency census — the "what actually happened" proof block
 * behind the concurrency rules, recomputed hourly from `h1_event` so future
 * research can cite current numbers instead of frozen claims.
 */
export default async function LiveConcurrency() {
    const s = await getConcurrencyStats();
    const fmt = (n) => n.toLocaleString('en-US');
    const topComps = s.compositions.filter((c) => c.key.split(' + ').length >= 3);

    return (
        <div className="mb-4 border border-ghost bg-surface-1 p-3 font-mono text-small">
            <p className="mb-2! text-text-muted">
                CONCURRENCY, MEASURED · every same-season event pair in the database:
            </p>
            <ul className="mb-2! list-none pl-0 text-text">
                <li>
                    defend ↔ defend: <b>{fmt(s.defendDefend.overlaps)}</b> overlaps in{' '}
                    {fmt(s.defendDefend.checked)} pairs — never observed
                </li>
                <li>
                    defend ↔ attack (same faction):{' '}
                    <b>{fmt(s.defendAttackSame.overlaps)}</b> in{' '}
                    {fmt(s.defendAttackSame.checked)} pairs — never observed
                </li>
                <li>
                    defend ↔ attack (different factions):{' '}
                    <b>{fmt(s.defendAttackCross.overlaps)}</b> in{' '}
                    {fmt(s.defendAttackCross.checked)} pairs — allowed and common
                </li>
                <li>
                    attack ↔ attack: <b>{fmt(s.attackAttack.overlaps)}</b> in{' '}
                    {fmt(s.attackAttack.checked)} pairs — allowed and common
                </li>
                <li>
                    most simultaneous events ever: <b>{s.maxSimultaneous}</b>
                    {topComps.length > 0 &&
                        ` (${topComps
                            .map(
                                (c) =>
                                    `${c.key}: ${fmt(c.moments)} moments, first S${c.firstSeason}`,
                            )
                            .join('; ')})`}
                </li>
            </ul>
            <p className="mb-0! text-text-muted">live · refreshes hourly</p>
        </div>
    );
}
