import './War.css';
import factions from '@/enums/factions';

function getWarOutcome(data) {
    if (!data?.live || data.live.length !== 3) return null;

    const events = data?.events || [];
    const defeatEvent = events.find(
        (e) => e.type === 'defend' && e.region === 0 && e.status === 'fail',
    );
    if (defeatEvent) {
        return {
            outcome: 'defeat',
            reason: 'Super Earth was invaded and overrun.',
        };
    }

    const victory = data.live.every((f) => f.status === 'defeated');
    if (victory) {
        return {
            outcome: 'victory',
            reason: 'All enemy factions have been defeated.',
        };
    }

    return null;
}

function WarOutcome({ data }) {
    const result = getWarOutcome(data);
    if (!result) return null;

    const { outcome, reason } = result;

    return (
        <div className={`war-outcome ${outcome}`}>
            <h3>{outcome === 'victory' ? 'Victory' : 'Defeat'}</h3>
            <p>{reason}</p>
            <ul>
                {data.live.map((f) => (
                    <li
                        key={f.enemy}
                        className={`faction-status ${f.status === 'defeated' ? 'defeated' : ''}`}
                    >
                        <img
                            src={`/icons/faction${f.enemy}.webp`}
                            alt={factions[f.enemy]?.name ?? `Faction ${f.enemy}`}
                            width={16}
                            height={16}
                        />
                        <span>{factions[f.enemy]?.name ?? `Faction ${f.enemy}`}</span>
                        <span>{f.status}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default function War({ data, showOutcome = false }) {
    if (!data) return null;

    const hasStats = data?.live?.length > 0;

    return (
        <section className="flex flex-col gap-4">
            {showOutcome && <WarOutcome data={data} />}
            {hasStats && (
                <>
                    <h2>War Stats</h2>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                        {generateGlobalWarStats(data.live)}
                        {data.live.map((statistic) => generateWarStats(statistic))}
                    </div>
                </>
            )}
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
        <article id="war" className="flex flex-col gap-1 p-4">
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
        <article id="war" key={statistic.enemy} className="flex flex-col gap-1 p-4">
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
