import { StatCard } from '@/features/stats/StatGrid';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';

function sumBigInt(live, field) {
    return live.reduce((acc, f) => acc + (f[field] ?? 0n), 0n);
}

function formatPercent(numerator, denominator) {
    if (denominator === 0n) return '—';
    return ((Number(numerator) / Number(denominator)) * 100).toFixed(1) + '%';
}

export default function SeasonStats({ live, events }) {
    if (!live?.length) return null;

    const kills = sumBigInt(live, 'kills');
    const missions = sumBigInt(live, 'missions');
    const players = Math.max(...live.map((f) => Number(f.players ?? 0n)));
    const shots = sumBigInt(live, 'shots');
    const hits = sumBigInt(live, 'hits');
    const accidentals = sumBigInt(live, 'accidentals');
    const wonEvents = events?.filter((e) => e.status === 'success').length ?? 0;
    const totalEvents = events?.length ?? 0;

    return (
        <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                By the Numbers
            </div>
            <div className="grid grid-cols-2 gap-1">
                <StatCard label="KILLS" value={formatNumber(kills)} />
                <StatCard label="MISSIONS" value={formatNumber(missions)} />
                <StatCard label="PEAK PLAYERS" value={formatNumber(players)} />
                <StatCard label="ACCURACY" value={formatPercent(hits, shots)} />
                <StatCard label="FRIENDLY FIRE" value={formatPercent(accidentals, kills)} />
                <StatCard label="EVENTS WON" value={`${wonEvents}/${totalEvents}`} />
            </div>
        </div>
    );
}
