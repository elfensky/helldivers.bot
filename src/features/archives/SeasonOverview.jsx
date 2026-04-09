import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';
import { StatCard } from '@/features/stats/StatGrid';

export default function SeasonOverview({ data }) {
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';

    const accentColor =
        outcome === 'victory' ? 'success'
        : outcome === 'defeat' ? 'danger'
        : undefined;

    return <StatCard label="OUTCOME" value={outcome.toUpperCase()} accentColor={accentColor} />;
}
