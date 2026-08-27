import { getSystemStats } from '@/features/admin/actions.mjs';
import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo.mjs';
import { formatUptime } from '@/shared/utils/format/formatUptime.mjs';
import { formatNumber } from '@/shared/utils/format/formatNumber.mjs';
import RefreshButton from '@/features/admin/RefreshButton';

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
    } = result.data;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <h3 className="font-mono text-small text-text-muted uppercase">
                    System Overview
                </h3>
                <RefreshButton />
            </div>

            {/* Row 1 — Infrastructure */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStatCard
                    label="Worker Status"
                    value={workerHealth.label}
                    accentColor={
                        workerHealth.status === 'healthy' ? 'bg-success'
                        : workerHealth.status === 'degraded' ?
                            'bg-warning'
                        :   'bg-danger'
                    }
                />
                <AdminStatCard
                    label="Last Poll"
                    value={heartbeat ? formatTimeAgo(heartbeat.last_beat) : '—'}
                />
                <AdminStatCard
                    label="Poll Duration"
                    value={
                        heartbeat?.poll_duration_ms != null ?
                            `${heartbeat.poll_duration_ms}ms`
                        :   '—'
                    }
                />
                <AdminStatCard
                    label="Uptime"
                    value={heartbeat ? formatUptime(heartbeat.started_at) : '—'}
                />
                <AdminStatCard
                    label="Poller"
                    value={heartbeat?.holder_id ? heartbeat.holder_id.split(':')[0] : '—'}
                />
            </div>

            {heartbeat?.last_error && (
                <div className="border border-danger bg-surface-1 p-3 text-body text-danger">
                    <span className="font-mono text-small text-text-muted uppercase">
                        Last Error:{' '}
                    </span>
                    {heartbeat.last_error}
                </div>
            )}

            {/* Row 2 — Game Data */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <AdminStatCard
                    label="Current Season"
                    value={currentSeason != null ? `#${currentSeason}` : '—'}
                />
                <AdminStatCard label="Active Factions" value={activeFactions} />
                <AdminStatCard label="Total Events" value={formatNumber(totalEvents)} />
                <AdminStatCard label="Seasons Stored" value={seasonsStored} />
            </div>

            {/* Row 3 — Users */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <AdminStatCard label="Users" value={totalUsers} />
                <AdminStatCard label="API Keys" value={totalApiKeys} />
                <AdminStatCard label="Push Subscribers" value={pushSubscribers} />
            </div>
        </div>
    );
}

function AdminStatCard({ label, value, accentColor = 'bg-primary' }) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_var(--card-accent-width)] border border-ghost bg-surface-1">
            <div className="p-3">
                <p className="font-mono text-small text-text-muted uppercase">{label}</p>
                <p className="font-display text-h1 leading-none font-black text-primary uppercase">
                    {value}
                </p>
            </div>
            <div className={accentColor} />
        </div>
    );
}
