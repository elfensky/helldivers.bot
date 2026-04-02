import factions from '@/enums/factions';
import { getWarOutcome } from '@/utils/getWarOutcome.mjs';

export function WarOutcome({ data }) {
    const result = getWarOutcome(data);
    if (!result) return null;

    const { outcome } = result;

    return (
        <div
            className={`flex flex-1 items-center border-2 border-ghost bg-surface-1 px-4 py-2 font-display text-xl font-black uppercase ${outcome === 'victory' ? 'border-primary text-primary' : 'border-danger text-danger'}`}
        >
            <span className="font-bold">
                {outcome === 'victory' ? 'Victory' : 'Defeat'}
            </span>
        </div>
    );
}

export default function War({ data }) {
    if (!data?.live?.length) return null;

    return (
        <section className="flex flex-col gap-4">
            <h2>War Stats</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {generateGlobalWarStats(data.live)}
                {data.live.map((statistic) => generateWarStats(statistic))}
            </div>
        </section>
    );
}
function generateGlobalWarStats(statistics) {
    let players = BigInt(0);
    let deaths = BigInt(0);
    let accidentals = BigInt(0);
    let kills = BigInt(0);

    statistics.forEach((statistic) => {
        players += BigInt(statistic.players);
        deaths += BigInt(statistic.deaths);
        accidentals += BigInt(statistic.accidentals);
        kills += BigInt(statistic.kills);
    });

    return (
        <article className="flex flex-col gap-1 border border-ghost bg-surface-1 p-4">
            <div className="flex items-center justify-start gap-2">
                <img
                    src={`/icons/faction3.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <h3>Global Stats</h3>
            </div>
            <p className="flex flex-col gap-1">
                <span>Enemies killed: {kills.toLocaleString()}</span>
                <span>Helldivers Online: {players.toLocaleString()}</span>
                <span>Helldivers Lost: {deaths.toLocaleString()}</span>
                <span>Accidentals: {accidentals.toLocaleString()}</span>
            </p>
        </article>
    );
}
function generateWarStats(statistic) {
    return (
        <article key={statistic.enemy} className="flex flex-col gap-1 border border-ghost bg-surface-1 p-4">
            <div className="flex items-center justify-start gap-2">
                <img
                    src={`/icons/faction${statistic.enemy}.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <h3>{factions[statistic.enemy].name}</h3>
            </div>
            <p className="flex flex-col gap-1">
                <span>Helldivers Online: {statistic.players.toLocaleString()}</span>
                {/* <span>{statistic.total_unique_players}</span> */}
                <span>
                    Missions: {statistic.successful_missions.toLocaleString()}/
                    {statistic.missions.toLocaleString()}
                </span>
                <span>Deaths: {statistic.deaths.toLocaleString()}</span>
                {/* <span>Kills: {statistic.kills}</span> */}
                <span>Accidentals: {statistic.accidentals.toLocaleString()}</span>
            </p>
        </article>
    );
}
