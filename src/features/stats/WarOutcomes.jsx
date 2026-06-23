import { StatCard } from '@/features/stats/StatGrid';

/**
 * Walk `perSeason` (assumed season-ascending) and return the longest victory
 * and defeat runs. Each run records its length and the [start, end] season
 * range so the UI can attribute it back to the wars that own the streak.
 *
 * @param {Array<{season:number, outcome:string}>} perSeason - Season-ascending per-season rows
 * @returns {{ longestWin: {length:number, start:number|null, end:number|null}, longestLoss: {length:number, start:number|null, end:number|null} }}
 */
function computeStreaks(perSeason) {
    /** @type {{ length: number, start: number | null, end: number | null }} */
    let longestWin = { length: 0, start: null, end: null };
    /** @type {{ length: number, start: number | null, end: number | null }} */
    let longestLoss = { length: 0, start: null, end: null };
    /** @type {{ kind: string | null, length: number, start: number | null, end: number | null }} */
    let cur = { kind: null, length: 0, start: null, end: null };

    const flush = () => {
        if (cur.kind === 'victory' && cur.length > longestWin.length) {
            longestWin = { length: cur.length, start: cur.start, end: cur.end };
        } else if (cur.kind === 'defeat' && cur.length > longestLoss.length) {
            longestLoss = { length: cur.length, start: cur.start, end: cur.end };
        }
    };

    for (const row of perSeason) {
        if (row.outcome === cur.kind) {
            cur.length += 1;
            cur.end = row.season;
        } else {
            flush();
            cur = {
                kind: row.outcome,
                length: 1,
                start: row.season,
                end: row.season,
            };
        }
    }
    flush();

    return { longestWin, longestLoss };
}

function streakSubtitle(streak) {
    if (streak.start == null) return undefined;
    return streak.start === streak.end ?
            `Season ${streak.start}`
        :   `Seasons ${streak.start}–${streak.end}`;
}

/**
 * War Outcomes & Streaks — total wars, win/loss counts, win rate, longest
 * win and loss streaks (with season range), and a wrapping timeline of
 * outcome pills (one per season, faction-style success/danger color, neutral
 * for `outcome: 'unknown'`).
 */
export default function WarOutcomes({ perSeason }) {
    if (!perSeason?.length) return null;

    const total = perSeason.length;
    const victories = perSeason.filter((r) => r.outcome === 'victory').length;
    const defeats = perSeason.filter((r) => r.outcome === 'defeat').length;
    const winRate = total > 0 ? Math.round((victories / total) * 100) : 0;

    const { longestWin, longestLoss } = computeStreaks(perSeason);

    return (
        <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-1 lg:grid-cols-3">
                <StatCard label="TOTAL_WARS" value={total} />
                <StatCard
                    label="VICTORIES"
                    value={victories}
                    subtitle={`${winRate}%`}
                    accentColor="success"
                />
                <StatCard label="DEFEATS" value={defeats} accentColor="danger" />
                {longestWin.length > 0 && (
                    <StatCard
                        label="LONGEST_WIN_STREAK"
                        value={longestWin.length}
                        subtitle={streakSubtitle(longestWin)}
                        accentColor="success"
                    />
                )}
                {longestLoss.length > 0 && (
                    <StatCard
                        label="LONGEST_LOSS_STREAK"
                        value={longestLoss.length}
                        subtitle={streakSubtitle(longestLoss)}
                        accentColor="danger"
                    />
                )}
            </div>
            <div
                className="flex flex-wrap gap-0.5"
                role="list"
                aria-label="War outcomes timeline"
            >
                {perSeason.map((row) => (
                    <span
                        key={row.season}
                        role="listitem"
                        title={`Season ${row.season} — ${row.outcome ?? 'unknown'}`}
                        className={
                            'inline-block h-3 w-3 ' +
                            (row.outcome === 'victory' ? 'bg-success'
                            : row.outcome === 'defeat' ? 'bg-danger'
                            : 'bg-text-muted opacity-30')
                        }
                    />
                ))}
            </div>
        </div>
    );
}
