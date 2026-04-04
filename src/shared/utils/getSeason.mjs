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

    const campaignSeasons = (data.campaign_status || []).map((cs) => cs.season);
    const defendEvent = data.defend_event ? [data.defend_event.season] : [];
    // const attackEvents = (data.attack_events || []).map((ae) => ae.season); //can be from old season
    const statisticsSeasons = (data.statistics || []).map((st) => st.season);

    const allSeasons = [...campaignSeasons, ...defendEvent, ...statisticsSeasons]; //...attackEvents,
    return resolveSeason(allSeasons, 'status');
}

export function getSeasonFromSnapshot(data) {
    if (!data) throw new Error('snapshot is missing', { cause: 'utils/getSeason.mjs' });

    const snapshots = (data.snapshots || []).map((sh) => sh.season);
    const defendEvents = (data.defend_events || []).map((de) => de.season);
    const attackEvents = (data.attack_events || []).map((ae) => ae.season);

    const allSeasons = [...snapshots, ...defendEvents, ...attackEvents];
    return resolveSeason(allSeasons, 'snapshot');
}
