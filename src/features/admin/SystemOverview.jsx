import { format } from 'timeago.js';
import { getSystemStats } from '@/features/admin/actions.mjs';
import { formatUptime } from '@/shared/utils/format/formatUptime.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import RefreshButton from '@/features/admin/RefreshButton';

const ROLE_LABEL = { poller: 'Poller', standby: 'Standby', web: 'Web only' };
const HEALTH_COLOR = {
    healthy: 'text-success',
    degraded: 'text-warning',
    down: 'text-danger',
};

export default async function SystemOverview() {
    const result = await getSystemStats();

    if (result.errors) {
        return <div className="text-body text-danger">Failed to load system stats.</div>;
    }

    const {
        heartbeat,
        workerHealth,
        currentSeason,
        activeFactions,
        totalEvents,
        seasonsStored,
        totalUsers,
        totalApiKeys,
        pushSubscribers,
        replicas,
        gone,
        liveVersions,
        skew,
        hasPoller,
    } = result.data;
    const versions = liveVersions.map((v) => `v${v}`).join(', ');

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="font-mono text-small text-text-muted uppercase">
                    System Overview
                </h3>
                <RefreshButton />
            </div>

            <h4 className="font-mono text-small text-text-muted uppercase">
                Replicas · {replicas.length}
            </h4>
            {replicas.length === 0 ?
                <p className="text-small text-text-muted">
                    No replica has reported in the last 5 minutes.
                </p>
            :   <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3">
                    {replicas.map((replica) => (
                        <ReplicaCard key={replica.id} replica={replica} />
                    ))}
                </div>
            }

            {gone.length > 0 && (
                <details className="border border-dashed border-ghost">
                    <summary
                        data-umami-event="debug-replicas-gone-toggle"
                        className="cursor-pointer px-3 py-2 font-mono text-small text-text-muted uppercase"
                    >
                        Gone in the last 24 h ({gone.length})
                    </summary>
                    <ul className="flex flex-col gap-1 px-3 pb-3 font-mono text-small text-text-muted">
                        {gone.map((row) => (
                            <li key={row.id} className="break-words">
                                {row.host} · v{row.version} · last seen{' '}
                                {format(row.last_seen)}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {skew?.alert && (
                <div className="border border-warning bg-surface-1 p-3 text-body text-warning">
                    Version skew for {formatUptime(skew.since)}: {versions}
                </div>
            )}
            {skew && !skew.alert && (
                <div className="border border-ghost bg-surface-1 p-3 text-small text-text-muted">
                    Rollout in progress: {versions} live.
                </div>
            )}
            {!hasPoller && (
                <div className="border border-warning bg-surface-1 p-3 text-body text-warning">
                    No poller: no live replica holds the poller lease.
                </div>
            )}
            {heartbeat?.last_error && (
                <div className="border border-danger bg-surface-1 p-3 text-body text-danger">
                    <span className="font-mono text-small text-text-muted uppercase">
                        Last Error:{' '}
                    </span>
                    {heartbeat.last_error}
                </div>
            )}

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                <Section title="Health" className="md:col-span-2 lg:col-span-1">
                    <KvTable
                        rows={[
                            [
                                'Worker status',
                                workerHealth.label,
                                HEALTH_COLOR[workerHealth.status],
                            ],
                            ['Last poll', heartbeat ? format(heartbeat.last_beat) : '—'],
                            [
                                'Poll duration',
                                heartbeat?.poll_duration_ms != null ?
                                    `${heartbeat.poll_duration_ms}ms`
                                :   '—',
                            ],
                            // Lease tenure, not process uptime: resets when the holder changes.
                            [
                                'Polling since',
                                heartbeat ? formatUptime(heartbeat.started_at) : '—',
                            ],
                        ]}
                    />
                </Section>
                <Section title="Game data">
                    <KvTable
                        rows={[
                            [
                                'Current season',
                                currentSeason != null ? `#${currentSeason}` : '—',
                            ],
                            ['Active factions', activeFactions],
                            ['Total events', formatNumber(totalEvents)],
                            ['Seasons stored', seasonsStored],
                        ]}
                    />
                </Section>
                <Section title="Community">
                    <KvTable
                        rows={[
                            ['Users', totalUsers],
                            ['API keys', totalApiKeys],
                            ['Push subscribers', pushSubscribers],
                        ]}
                    />
                </Section>
            </div>
        </div>
    );
}

function ReplicaCard({ replica }) {
    const { role, state, host, version, started_at, last_seen } = replica;
    const late = state === 'late';
    const rail =
        late ? 'bg-warning'
        : role === 'poller' ? 'bg-primary'
        : 'bg-ghost';
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_var(--card-accent-width)] border border-ghost bg-surface-1">
            <div className="min-w-0 p-3">
                <p className="mb-0! font-mono text-small uppercase">
                    <span
                        className={role === 'poller' ? 'text-primary' : 'text-text-muted'}
                    >
                        {ROLE_LABEL[role]}
                    </span>
                    {late && <span className="text-warning"> · Late</span>}
                </p>
                <p
                    title={host}
                    className="mt-1 mb-0! truncate font-display text-h3 text-text uppercase"
                >
                    {host}
                </p>
                <p className="mt-1 mb-0! flex flex-wrap gap-x-3 font-mono text-small text-text-muted">
                    <span className="whitespace-nowrap">v{version}</span>
                    <span className="whitespace-nowrap">
                        up {formatUptime(started_at)}
                    </span>
                    <span className="whitespace-nowrap">seen {format(last_seen)}</span>
                </p>
            </div>
            <div className={rail} />
        </div>
    );
}

function Section({ title, className = '', children }) {
    return (
        <section className={`flex min-w-0 flex-col gap-2 ${className}`}>
            <h4 className="font-mono text-small text-text-muted uppercase">{title}</h4>
            {children}
        </section>
    );
}

function KvTable({ rows }) {
    return (
        <div className="overflow-x-auto border border-ghost bg-surface-1">
            <table className="w-full">
                <tbody>
                    {rows.map(([label, value, valueClass = 'text-primary']) => (
                        <tr
                            key={label}
                            className="border-t border-ghost/30 first:border-t-0"
                        >
                            <th
                                scope="row"
                                className="p-3 text-left font-mono text-small font-normal whitespace-nowrap text-text-muted uppercase"
                            >
                                {label}
                            </th>
                            <td
                                className={`p-3 text-right font-display text-h3 uppercase ${valueClass}`}
                            >
                                {value}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
