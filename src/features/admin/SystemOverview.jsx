import { getSystemStats } from '@/db/queries/admin';
import { formatTimeAgo } from '@/shared/utils/format/formatTimeAgo';

export default async function SystemOverview() {
    const result = await getSystemStats();

    if (result.errors) {
        return <div className="text-sm text-danger">Failed to load system stats.</div>;
    }

    const { totalUsers, totalApiKeys, lastPollTime, workerHealthy } = result.data;

    return (
        <div className="grid grid-cols-[1fr_4px]">
            <div className="flex flex-col gap-4 bg-surface-1 p-4">
                <h2 className="font-semibold text-text">System Overview</h2>
                <div className="grid grid-cols-3 gap-4">
                    <div>
                        <p className="text-xs text-text-muted uppercase">Users</p>
                        <p className="text-lg font-semibold text-text">{totalUsers}</p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted uppercase">API Keys</p>
                        <p className="text-lg font-semibold text-text">{totalApiKeys}</p>
                    </div>
                    <div>
                        <p className="text-xs text-text-muted uppercase">Last Poll</p>
                        <p className="text-lg font-semibold text-text">
                            {lastPollTime ? formatTimeAgo(lastPollTime) : '—'}
                        </p>
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
            <div className="bg-primary" />
        </div>
    );
}
