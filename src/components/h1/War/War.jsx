import './War.css';
import factions from '@/enums/factions';

export default function War({ data }) {
    if (!data) return null;

    return (
        <section className="flex flex-col gap-4">
            <h2
                className="text-3xl uppercase"
                style={{ fontFamily: 'Insignia, sans-serif' }}
            >
                War Stats
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {generateGlobalWarStats(data?.statistics)}
                {data?.statistics?.map((statistic) => generateWarStats(statistic))}
            </div>
        </section>
    );
}
function generateGlobalWarStats(statistics) {
    let players = 0;
    let deaths = 0;
    let accidentals = 0;
    let kills = 0;

    statistics.forEach((statistic) => {
        players += statistic.players;
        deaths += statistic.deaths;
        accidentals += statistic.accidentals;
        kills += statistic.kills;
    });

    return (
        <article id="war" className="flex flex-col gap-1 p-4">
            <div className="flex items-center justify-start gap-2 text-xl">
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
            <div className="flex items-center justify-start gap-2 text-xl">
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
