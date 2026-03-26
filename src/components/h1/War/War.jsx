import './War.css';
import factions from '@/enums/factions';

function getWarOutcome(data) {
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const live = data?.live || [];

    // No data at all — no banner
    if (snapshots.length === 0 && events.length === 0 && live.length === 0) {
        return null;
    }

    // Victory signal 1: live data shows all 3 factions defeated (current season)
    if (live.length === 3 && live.every((f) => f.status === 'defeated')) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }

    // Victory signal 2: ANY snapshot shows all 3 factions defeated
    const anySnapshotDefeated = snapshots.some((snap) => {
        const factionData =
            typeof snap.data === 'string' ? JSON.parse(snap.data) : snap.data;
        return (
            Array.isArray(factionData) &&
            factionData.length === 3 &&
            factionData.every((f) => f.status === 'defeated')
        );
    });

    // Victory signal 3: all 3 enemy homeworlds captured (successful attacks)
    const factionsDefeated = new Set(
        events
            .filter((e) => e.type === 'attack' && e.status === 'success')
            .map((e) => e.enemy),
    );
    const allHomeworldsCaptured = factionsDefeated.size === 3;

    const victorySignal = anySnapshotDefeated || allHomeworldsCaptured;

    // Defeat signal: last region-0 defend event failed (Super Earth fell)
    const r0Defends = events
        .filter((e) => e.type === 'defend' && e.region === 0)
        .sort((a, b) => a.end_time - b.end_time);
    const defeatSignal =
        r0Defends.length > 0 && r0Defends[r0Defends.length - 1].status === 'fail';

    // Decision
    if (victorySignal && !defeatSignal) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }
    if (defeatSignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }
    if (!victorySignal) {
        return { outcome: 'defeat', reason: 'The war was lost.' };
    }

    return null;
}

export function WarOutcome({ data }) {
    const result = getWarOutcome(data);
    if (!result) return null;

    const { outcome } = result;

    return (
        <div className={`war-outcome ${outcome}`}>
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
