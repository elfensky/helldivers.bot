import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

export default function SeasonOverview({ data }) {
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';
    const events = data?.events ?? [];
    const wonCount = events.filter((e) => e.status === 'success').length;

    const firstStart = events.length
        ? Math.min(...events.map((e) => e.start_time))
        : null;
    const lastEnd = events.length
        ? Math.max(...events.map((e) => e.end_time))
        : null;
    const durationDays =
        firstStart != null && lastEnd != null
            ? Math.round((lastEnd - firstStart) / 86400)
            : null;

    const isVictory = outcome === 'victory';
    const isDefeat = outcome === 'defeat';

    return (
        <div
            className={`border-2 p-4 text-center font-display ${
                isVictory
                    ? 'border-primary bg-surface-1'
                    : isDefeat
                      ? 'border-danger bg-surface-1'
                      : 'border-ghost bg-surface-1'
            }`}
        >
            <div
                className={`text-2xl font-black uppercase tracking-wider ${
                    isVictory
                        ? 'text-primary'
                        : isDefeat
                          ? 'text-danger'
                          : 'text-text-muted'
                }`}
            >
                {outcome.toUpperCase()}
            </div>
            <div className="mt-1 font-body text-sm text-text-muted">
                {durationDays != null && `${durationDays} days · `}
                {wonCount} of {events.length} events won
            </div>
        </div>
    );
}
