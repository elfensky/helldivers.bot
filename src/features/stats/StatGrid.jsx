import Image from 'next/image';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import { countOutcomes } from '@/shared/utils/game/eventFilters.mjs';
import { EVENT_STATUS } from '@/shared/enums/events.mjs';
import { FACTION_INDEX } from '@/shared/enums/factions.mjs';
import AnimatedStat from '@/shared/components/AnimatedStat/AnimatedStat';
import './StatGrid.css';

/**
 * Format a Unix-seconds timestamp as a "DD MONTH" label (e.g. "25 JANUARY",
 * "01 MARCH"). Day is zero-padded; month is the full English name uppercased.
 * Fixed to UTC so the server-rendered output and client hydration agree
 * regardless of the viewer's timezone.
 */
function formatStartDate(unixSeconds) {
    const d = new Date(unixSeconds * 1000);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = d
        .toLocaleString('en-US', { month: 'long', timeZone: 'UTC' })
        .toUpperCase();
    return `${day} ${month}`;
}

function accidentalRateTooltip(accidentals, deaths) {
    const a = Number(accidentals || 0);
    const d = Number(deaths || 0);
    return `${formatNumber(a)} accidental / ${formatNumber(d)} total deaths`;
}

/**
 * The ▲ / ▼ / ▪ trend arrow shared by the delta-style stat subtitles.
 * `n` is a signed delta: positive → green ▲, negative → red ▼, zero → a
 * neutral, un-tinted ▪. The ▲/▼ triangles sit below their optical centre
 * so they're lifted 1.5px; ▪ is already centred in its em box and isn't
 * nudged.
 */
function deltaArrow(n) {
    const glyph =
        n > 0 ? '▲'
        : n < 0 ? '▼'
        : '▪';
    const colorClass =
        n > 0 ? 'text-success'
        : n < 0 ? 'text-danger'
        : '';
    const nudgeClass = n !== 0 ? '-translate-y-[1.5px]' : '';
    return <span className={`${nudgeClass} ${colorClass}`}>{glyph}</span>;
}

/**
 * Format the "LAST 24H" delta subtitle for the ONLINE card. Compares the
 * current player count to the 24h rolling-average baseline and shows the
 * gap with a ▲/▼/▪ arrow. Returns null only when there's no baseline yet
 * (new season).
 */
function playersDeltaSubtitle(currentPlayers, avgPlayers) {
    if (avgPlayers == null) return null;
    const delta = currentPlayers - avgPlayers;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            {deltaArrow(delta)}
            <span>
                <AnimatedStat value={Math.abs(delta)} />
            </span>
            <span>Last 24h</span>
        </span>
    );
}

/**
 * Subtitle for the ENEMIES_KILLED card. From the live cumulative kill total
 * and two historical baselines it derives two consecutive 24h kill volumes —
 * last24h = current − kills(24h ago), prev24h = kills(24h ago) − kills(48h
 * ago) — and shows the last-24h volume with a ▲/▼/▪ arrow marking whether the
 * killing pace rose, fell, or held versus the previous 24h. With no 48h
 * baseline yet (season 24–48h old) the pace can't be compared, so the arrow
 * is a neutral ▪. Returns null with no 24h baseline, or when nothing was
 * killed in the last 24h.
 */
function killsTrendSubtitle(current, baseline) {
    if (baseline?.ago24h == null) return null;
    // `current` may be a Prisma BigInt (kills are BIGINT in schema) while the
    // baselines are plain numbers — coerce before subtracting to avoid the
    // "Cannot mix BigInt and other types" runtime error during SSR.
    const last24h = Number(current) - Number(baseline.ago24h);
    if (last24h <= 0) return null;
    const prev24h =
        baseline.ago48h != null ?
            Number(baseline.ago24h) - Number(baseline.ago48h)
        :   null;
    const trend = prev24h == null ? 0 : last24h - prev24h;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            {deltaArrow(trend)}
            <span>
                <AnimatedStat value={last24h} />
            </span>
            <span>Last 24h</span>
        </span>
    );
}

/**
 * Subtitle for the HELLDIVERS_LOST card — shows the absolute number of
 * accidental ("teamkill") deaths, marked with a small `backstab` icon and
 * a `MARTYRS` label (these are the divers who were teamkilled). Returns
 * null when there are no accidentals to report (either deaths or
 * accidentals is 0). The accidental + total death counts are also
 * surfaced via the card's tooltip.
 */
function accidentalSubtitle(accidentals, deaths) {
    const count = Number(accidentals || 0);
    if (!(Number(deaths) > 0) || count <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <Image src="/icons/backstab.png" alt="" width={14} height={14} />
            <span>
                <AnimatedStat value={count} />
            </span>
            <span>Martyrs</span>
        </span>
    );
}

function missionTotalSubtitle(total) {
    const n = Number(total || 0);
    if (n <= 0) return null;
    return (
        <span className="inline-flex items-center gap-1.5 tracking-wide text-ghost uppercase">
            <span>
                <AnimatedStat value={n} />
            </span>
            <span>Total</span>
        </span>
    );
}

/**
 * Value for the merged EVENTS card — renders `W : L` with the wins
 * tinted success-green and the losses tinted danger-red. Reads as a
 * scoreline (Super Earth vs the enemy) rather than a fraction.
 */
function eventsScoreValue(wins, losses) {
    return (
        <>
            <span className="text-success">
                <AnimatedStat value={wins} />
            </span>
            <span className="mx-1 text-ghost">:</span>
            <span className="text-danger">
                <AnimatedStat value={losses} />
            </span>
        </>
    );
}

/**
 * WAR_DURATION stat card. `seconds` is the elapsed time to display — total
 * war duration on the global tab, or how long a faction has been deployed on
 * a faction tab. `startUnix` is the Unix-seconds timestamp that span began —
 * war start on the global tab, faction introduction on a faction tab — shown
 * as a "DD MONTH" subtitle so the value and subtitle read as a coherent pair.
 * Null/invalid `seconds` (a faction not yet introduced) renders an em-dash
 * with no subtitle.
 *
 * @param {number | null} seconds - Elapsed war/deployment time in seconds
 * @param {number | null} startUnix - Unix-seconds timestamp the span began
 */
function warDurationCard(seconds, startUnix) {
    const valid = Number.isFinite(seconds) && seconds > 0;
    const days = valid ? Math.round(seconds / 86400) : null;
    const startValid = Number.isFinite(startUnix) && startUnix > 0;
    return (
        <StatCard
            label="WAR_DURATION"
            value={days != null ? `${days} ${days === 1 ? 'day' : 'days'}` : '—'}
            subtitle={
                valid && startValid ?
                    <span className="tracking-wide text-ghost uppercase">
                        {formatStartDate(startUnix)}
                    </span>
                :   undefined
            }
        />
    );
}

/**
 * A telemetry card for an archived season that predates stat collection.
 * Rather than a misleading zero, the value is censored and the subtitle
 * plays the gap as a Ministry of Truth redaction.
 */
function redactedCard(label) {
    return (
        <StatCard
            label={label}
            value={<span className="text-ghost">████████</span>}
            subtitle={
                <span className="tracking-wide text-ghost uppercase">
                    Data redacted — Ministry of Truth
                </span>
            }
        />
    );
}

/**
 * Render a telemetry card, or its redacted stand-in when `redacted` is set —
 * an archived season with no h1_statistic data behind it.
 *
 * @param {boolean} redacted - Whether to censor the card
 * @param {string} label - The card label
 * @param {object} cardProps - Props for the real StatCard when not redacted
 */
function telemetryCard(redacted, label, cardProps) {
    return redacted ? redactedCard(label) : <StatCard label={label} {...cardProps} />;
}

export default function StatGrid({
    live,
    faction,
    events,
    playersAvg24h = null,
    killsTrend = null,
    seasonDuration = 0,
    warStart = null,
    archived = false,
}) {
    if (!live?.length) return null;

    const factionIndex = faction !== 'global' ? FACTION_INDEX[faction] : null;

    const resolved =
        events?.filter((e) => {
            if (factionIndex !== null && e.enemy !== factionIndex) return false;
            return e.status === EVENT_STATUS.SUCCESS || e.status === EVENT_STATUS.FAIL;
        }) ?? [];

    const { wins, losses } = countOutcomes(resolved);
    const totalEvents = wins + losses;
    const eventsSubtitle = totalEvents > 0 ? missionTotalSubtitle(totalEvents) : null;

    if (faction === 'global') {
        // Per-faction `players`, `kills`, `deaths`, and `accidentals` are disjoint
        // (a helldiver engages one faction at a time), so summing them is correct.
        // `total_unique_players` is a season-wide count replicated across all three
        // rows — never sum it; use live[0] if you ever display it.
        const totals = live.reduce(
            (acc, s) => ({
                players: acc.players + Number(s.players || 0),
                kills: acc.kills + Number(s.kills || 0),
                deaths: acc.deaths + Number(s.deaths || 0),
                accidentals: acc.accidentals + Number(s.accidentals || 0),
                won: acc.won + Number(s.successful_missions || 0),
                allMissions: acc.allMissions + Number(s.missions || 0),
            }),
            { players: 0, kills: 0, deaths: 0, accidentals: 0, won: 0, allMissions: 0 },
        );
        const onlineSubtitle = playersDeltaSubtitle(
            totals.players,
            playersAvg24h?.global,
        );
        const killsSubtitle = killsTrendSubtitle(totals.kills, killsTrend?.global);
        // An archived season with no missions logged predates stat collection —
        // redact its telemetry cards rather than render misleading zeros.
        const redacted = archived && totals.allMissions <= 0;
        return (
            <div className="stat-grid">
                {telemetryCard(redacted, 'HELLDIVERS_ONLINE', {
                    value: <AnimatedStat value={totals.players} />,
                    subtitle: onlineSubtitle,
                })}
                {telemetryCard(redacted, 'ENEMIES_KILLED', {
                    value: <AnimatedStat value={totals.kills} />,
                    subtitle: killsSubtitle,
                })}
                {telemetryCard(redacted, 'HELLDIVERS_LOST', {
                    value: <AnimatedStat value={totals.deaths} />,
                    subtitle: accidentalSubtitle(totals.accidentals, totals.deaths),
                    title: accidentalRateTooltip(totals.accidentals, totals.deaths),
                })}
                {telemetryCard(redacted, 'MISSIONS_WON', {
                    value: <AnimatedStat value={totals.won} />,
                    subtitle: missionTotalSubtitle(totals.allMissions),
                })}
                <StatCard
                    label="EVENTS"
                    value={eventsScoreValue(wins, losses)}
                    subtitle={eventsSubtitle}
                />
                {warDurationCard(seasonDuration, warStart)}
            </div>
        );
    }

    const stats = live.find((s) => s.enemy === factionIndex);
    if (!stats) return null;

    const onlineSubtitle = playersDeltaSubtitle(stats.players, playersAvg24h?.[faction]);
    const killsSubtitle = killsTrendSubtitle(stats.kills, killsTrend?.[faction]);
    // No missions logged for this faction on an archived season → redact.
    const redacted = archived && Number(stats.missions) <= 0;

    // How long this faction has been in the war: total war duration minus the
    // span it spent 'hidden' before introduction. Null `first_seen` → the
    // faction has not been deployed yet.
    const factionSeconds =
        stats.first_seen != null && Number.isFinite(warStart) ?
            seasonDuration - (stats.first_seen - warStart)
        :   null;

    return (
        <div className="stat-grid">
            {telemetryCard(redacted, 'HELLDIVERS_ONLINE', {
                value: <AnimatedStat value={stats.players} />,
                subtitle: onlineSubtitle,
            })}
            {telemetryCard(redacted, 'ENEMIES_KILLED', {
                value: <AnimatedStat value={stats.kills} />,
                subtitle: killsSubtitle,
            })}
            {telemetryCard(redacted, 'HELLDIVERS_LOST', {
                value: <AnimatedStat value={stats.deaths} />,
                subtitle: accidentalSubtitle(stats.accidentals, stats.deaths),
                title: accidentalRateTooltip(stats.accidentals, stats.deaths),
            })}
            {telemetryCard(redacted, 'MISSIONS_WON', {
                value: <AnimatedStat value={stats.successful_missions} />,
                subtitle: missionTotalSubtitle(stats.missions),
            })}
            <StatCard
                label="EVENTS"
                value={eventsScoreValue(wins, losses)}
                subtitle={eventsSubtitle}
            />
            {warDurationCard(factionSeconds, stats.first_seen)}
        </div>
    );
}

export function StatCard({
    label,
    value,
    subtitle,
    accentColor,
    valueColor,
    onClick,
    title,
}) {
    const accentClass =
        accentColor === 'success' ? 'stat-card-accent-success'
        : accentColor === 'danger' ? 'stat-card-accent-danger'
        : 'stat-card-accent';

    const valueColorClass =
        valueColor === 'success' ? 'text-success'
        : valueColor === 'danger' ? 'text-danger'
        : '';

    return (
        <div
            className={`stat-card${onClick ? ' stat-card-clickable' : ''}`}
            onClick={onClick}
            title={title}
        >
            <div className="stat-card-content">
                <span className="stat-card-label">{label}</span>
                <span className={`stat-card-value ${valueColorClass}`}>{value}</span>
                {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
            </div>
            <div className={accentClass} />
        </div>
    );
}
