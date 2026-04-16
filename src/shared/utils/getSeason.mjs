import { isValidNumber } from '@/validators/isValidNumber';

function resolveSeason(allSeasons, errorContext) {
    const uniqueSeasons = [...new Set(allSeasons)];
    if (uniqueSeasons.length === 0) {
        throw new Error(`No seasons found in ${errorContext} data`);
    }
    if (uniqueSeasons.length > 1) {
        console.warn(`Multiple seasons present in ${errorContext} data`, uniqueSeasons);
    }

    const isNumber = isValidNumber.safeParse(uniqueSeasons[0]);
    if (!isNumber.success) throw new Error('Invalid Current Season');

    return Number(uniqueSeasons[0]);
}

export function getSeasonFromStatus(data) {
    if (!data) throw new Error('status is missing', { cause: 'utils/getSeason.mjs' });

    // defend_event and attack_events are "most recent event" slots that persist
    // across season transitions until replaced by a new event of the same type —
    // they lag the current season and must NOT be used for current-season
    // resolution. Only campaign_status and statistics reflect the live war state.
    // isValidStatus enforces that both arrays are non-empty, so this aggregation
    // is guaranteed to produce at least one season.
    const campaignSeasons = (data.campaign_status || []).map((cs) => cs.season);
    const statisticsSeasons = (data.statistics || []).map((st) => st.season);

    return resolveSeason([...campaignSeasons, ...statisticsSeasons], 'status');
}

export function getSeasonFromSnapshot(data) {
    if (!data) throw new Error('snapshot is missing', { cause: 'utils/getSeason.mjs' });

    const snapshots = (data.snapshots || []).map((sh) => sh.season);
    const defendEvents = (data.defend_events || []).map((de) => de.season);
    const attackEvents = (data.attack_events || []).map((ae) => ae.season);

    const allSeasons = [...snapshots, ...defendEvents, ...attackEvents];
    return resolveSeason(allSeasons, 'snapshot');
}
