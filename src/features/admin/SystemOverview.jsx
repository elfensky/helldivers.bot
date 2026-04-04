import { getSystemStats } from '@/db/queries/admin';
import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo';
import { formatUptime } from '@/shared/utils/format/formatUptime';
import { formatNumber } from '@/shared/utils/format/formatNumber';
import RefreshButton from '@/features/admin/RefreshButton';

export default async function SystemOverview() {
    const result = await getSystemStats();

    if (result.errors) {
        return <div className="text-sm text-danger">Failed to load system stats.</div>;
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
    } = result.data;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h2>System Overview</h2>
                <RefreshButton />
            </div>

            {/* Row 1 — Infrastructure */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Worker Status"
                    value={workerHealth.label}
                    accentColor={
                        workerHealth.status === 'healthy'
                            ? 'bg-green-400'
                            : workerHealth.status === 'degraded'
                              ? 'bg-yellow-400'
                              : 'bg-danger'
                    }
                />
                <StatCard
                    label="Last Poll"
                    value={heartbeat ? formatTimeAgo(heartbeat.last_beat) : '—'}
                />
                <StatCard
                    label="Poll Duration"
                    value={
                        heartbeat?.poll_duration_ms != null
                            ? `${heartbeat.poll_duration_ms}ms`
                            : '—'
                    }
                />
                <StatCard
                    label="Uptime"
                    value={heartbeat ? formatUptime(heartbeat.started_at) : '—'}
                />
            </div>

            {heartbeat?.last_error && (
                <div className="border border-danger bg-surface-1 p-3 text-sm text-danger">
                    <span className="font-mono text-xs uppercase text-text-muted">
                        Last Error:{' '}
                    </span>
                    {heartbeat.last_error}
                </div>
            )}

            {/* Row 2 — Game Data */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Current Season"
                    value={currentSeason != null ? `#${currentSeason}` : '—'}
                />
                <StatCard label="Active Factions" value={activeFactions} />
                <StatCard label="Total Events" value={formatNumber(totalEvents)} />
                <StatCard label="Seasons Stored" value={seasonsStored} />
            </div>

            {/* Row 3 — Users */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <StatCard label="Users" value={totalUsers} />
                <StatCard label="API Keys" value={totalApiKeys} />
                <StatCard label="Push Subscribers" value={pushSubscribers} />
            </div>
        </div>
    );
}

function StatCard({ label, value, accentColor = 'bg-primary' }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
            <div className="p-3">
                <p className="font-mono text-xs uppercase text-text-muted">{label}</p>
                <p className="font-display text-2xl font-black leading-none text-primary uppercase">
                    {value}
                </p>
            </div>
            <div className={accentColor} />
        </div>
    );
}
