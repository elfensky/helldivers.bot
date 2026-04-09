import { getWarOutcome } from '@/features/archives/getWarOutcome.mjs';

export default function SeasonOverview({ data }) {
    const result = getWarOutcome(data);
    const outcome = result?.outcome ?? 'unknown';

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
        </div>
    );
}
