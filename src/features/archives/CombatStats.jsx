import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

function sumBigInt(live, field) {
    return live.reduce((acc, f) => acc + (f[field] ?? 0n), 0n);
}

function formatPercent(numerator, denominator) {
    if (denominator === 0n) return '—';
    return ((Number(numerator) / Number(denominator)) * 100).toFixed(1) + '%';
}

export default function CombatStats({ live, events }) {
    if (!live?.length) return null;

    const kills = sumBigInt(live, 'kills');
    const deaths = sumBigInt(live, 'deaths');
    const accidentals = sumBigInt(live, 'accidentals');
    const shots = sumBigInt(live, 'shots');
    const hits = sumBigInt(live, 'hits');
    const missions = sumBigInt(live, 'missions');
    const eventCount = events?.length ?? 0;

    return (
        <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Combat Performance
            </div>
            <div className="grid grid-cols-2 gap-1">
                <StatCard
                    label="FRIENDLY FIRE"
                    value={formatPercent(accidentals, kills)}
                    accentColor="danger"
                />
                <StatCard label="ACCURACY" value={formatPercent(hits, shots)} />
                <StatCard
                    label="KILLS/MISSION"
                    value={missions > 0n ? formatNumber(Number(kills) / Number(missions)) : '—'}
                />
                <StatCard
                    label="DEATHS/EVENT"
                    value={eventCount > 0 ? formatNumber(Number(deaths) / eventCount) : '—'}
                />
            </div>
        </div>
    );
}
