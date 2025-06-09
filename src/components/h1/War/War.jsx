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
            {generateGlobalWarStats(data?.statistics)}
            {data?.statistics?.map((statistic) => generateWarStats(statistic))}
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
        <article id="war" className="flex flex-col gap-1 px-4">
            <div className="flex items-center justify-center gap-2 text-xl">
                <img
                    src={`/icons/factions/3.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <h3>Global Stats</h3>
            </div>
            <span>Enemies killed: {kills.toLocaleString()}</span>
            <span>Helldivers Online: {players.toLocaleString()}</span>
            <span>Helldivers Lost: {deaths.toLocaleString()}</span>
            <span>Accidentals: {accidentals.toLocaleString()}</span>
        </article>
    );
}
function generateWarStats(statistic) {
    return (
        <article id="war" key={statistic.enemy} className="flex flex-col gap-1 px-4">
            <div className="flex items-center justify-center gap-2 text-xl">
                <img
                    src={`/icons/factions/${statistic.enemy}.webp`}
                    alt="Logo of Helldivers Bot, which is a cartoon depiction of a spy sattelite"
                    width={20}
                    height={20}
                />
                <h3>{factions[statistic.enemy].name}</h3>
            </div>

            <span>Helldivers Online: {statistic.players.toLocaleString()}</span>
            {/* <span>{statistic.total_unique_players}</span> */}
            <span>
                Missions: {statistic.successful_missions.toLocaleString()}/
                {statistic.missions.toLocaleString()}
            </span>
            <span>Deaths: {statistic.deaths.toLocaleString()}</span>
            {/* <span>Kills: {statistic.kills}</span> */}
            <span>Accidentals: {statistic.accidentals.toLocaleString()}</span>
        </article>
    );
}
