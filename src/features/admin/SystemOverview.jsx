import { getSystemStats } from '@/db/queries/admin';
import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo';

export default async function SystemOverview() {
    const result = await getSystemStats();

    if (result.errors) {
        return <div className="text-sm text-danger">Failed to load system stats.</div>;
    }

    const { totalUsers, totalApiKeys, lastPollTime, workerHealthy } = result.data;

    return (
        <div className="flex flex-col gap-3">
            <h2>System Overview</h2>
            <div className="grid grid-cols-3 gap-3">
                <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
                    <div className="p-3">
                        <p className="text-xs font-mono uppercase text-text-muted">Users</p>
                        <p className="font-display text-2xl font-black leading-none text-primary uppercase">
                            {totalUsers}
                        </p>
                    </div>
                    <div className="bg-primary" />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
                    <div className="p-3">
                        <p className="text-xs font-mono uppercase text-text-muted">API Keys</p>
                        <p className="font-display text-2xl font-black leading-none text-primary uppercase">
                            {totalApiKeys}
                        </p>
                    </div>
                    <div className="bg-primary" />
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_4px] border border-ghost bg-surface-1">
                    <div className="p-3">
                        <p className="text-xs font-mono uppercase text-text-muted">Last Poll</p>
                        <p className="font-display text-2xl font-black leading-none text-primary uppercase">
                            {lastPollTime ? formatTimeAgo(lastPollTime) : '—'}
                        </p>
                    </div>
                    <div className="bg-primary" />
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div
                    className={`h-2 w-2 rounded-full ${workerHealthy ? 'bg-green-400' : 'bg-danger'}`}
                />
                <span
                    className={`text-sm ${workerHealthy ? 'text-green-400' : 'text-danger'}`}
                >
                    {workerHealthy ? 'Worker healthy' : 'Worker unhealthy'}
                </span>
            </div>
        </div>
    );
}
