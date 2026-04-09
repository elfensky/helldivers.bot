import factions from '@/shared/enums/factions.mjs';

const FACTION_ACCENT = {
    0: 'border-r-[4px] border-r-faction-bugs',
    1: 'border-r-[4px] border-r-faction-cyborgs',
    2: 'border-r-[4px] border-r-faction-illuminate',
};

const FACTION_TEXT = {
    0: 'text-faction-bugs',
    1: 'text-faction-cyborgs',
    2: 'text-faction-illuminate',
};

function displayName(name) {
    return name.replace(/^The\s+/i, '').toUpperCase();
}

export default function FactionSummary({ live }) {
    if (!live?.length) return null;

    return (
        <div>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Faction Campaigns
            </div>
            <div className="flex flex-col gap-1">
                {live.map((faction) => {
                    const wins =
                        Number(faction.successful_defend_events ?? 0n) +
                        Number(faction.successful_attack_events ?? 0n);
                    const total =
                        Number(faction.defend_events ?? 0n) +
                        Number(faction.attack_events ?? 0n);
                    const losses = total - wins;
                    const name = factions[faction.enemy]?.name ?? 'Unknown';

                    return (
                        <div
                            key={faction.enemy}
                            className={`flex items-center justify-between border border-ghost bg-surface-1 px-3 py-2 ${FACTION_ACCENT[faction.enemy] ?? ''}`}
                        >
                            <span
                                className={`text-xs font-bold uppercase tracking-wider ${FACTION_TEXT[faction.enemy] ?? 'text-text'}`}
                            >
                                {displayName(name)}
                            </span>
                            <span className="font-mono text-xs text-text-muted">
                                {wins}W / {losses}L
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
