import './War.css';
import factions from '@/enums/factions';
import warOutcomes from '@/enums/warOutcomes';

function getWarOutcome(data) {
    const season = data?.season;

    // 1. Canonical lookup (wars 2-138 from wiki)
    if (season && warOutcomes[season] !== undefined) {
        return warOutcomes[season] ?
                { outcome: 'victory', reason: 'All enemy factions have been defeated.' }
            :   { outcome: 'defeat', reason: 'The war was lost.' };
    }

    // For wars not in the lookup (139+), derive from data:
    const snapshots = data?.snapshots || [];
    const events = data?.events || [];
    const live = data?.live || [];

    // 2. Check live data (current season)
    if (live.length === 3 && live.every((f) => f.status === 'defeated')) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }

    // 3. Check last snapshot
    if (snapshots.length > 0) {
        const lastSnapshot = snapshots[snapshots.length - 1];
        const factionData =
            typeof lastSnapshot.data === 'string' ?
                JSON.parse(lastSnapshot.data)
            :   lastSnapshot.data;
        if (Array.isArray(factionData) && factionData.length === 3) {
            if (factionData.every((f) => f.status === 'defeated')) {
                return {
                    outcome: 'victory',
                    reason: 'All enemy factions have been defeated.',
                };
            }
        }
    }

    // 4. Check if all 3 homeworlds were captured
    const factionsDefeated = new Set(
        events
            .filter((e) => e.type === 'attack' && e.status === 'success')
            .map((e) => e.enemy),
    );
    if (factionsDefeated.size === 3) {
        return { outcome: 'victory', reason: 'All enemy factions have been defeated.' };
    }

    // 5. If we have data but no victory — it's a defeat
    if (snapshots.length > 0 || events.length > 0) {
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
