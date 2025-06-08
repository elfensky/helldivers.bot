import { isValidNumber } from '@/validators/isValidNumber';

export function getSeasonFromStatus(data) {
    if (!data) throw new Error('status is missing', { cause: 'utils/getSeason.mjs' });

    // Gather all relevant season numbers
    const campaignSeasons = (data.campaign_status || []).map((cs) => cs.season);
    const defendEvent = data.defend_event ? [data.defend_event.season] : [];
    // const attackEvents = (data.attack_events || []).map((ae) => ae.season); //can be from old season
    const statisticsSeasons = (data.statistics || []).map((st) => st.season);

    // Combine all seasons
    const allSeasons = [...campaignSeasons, ...defendEvent, ...statisticsSeasons]; //...attackEvents,

    // Check if all seasons are equal
    const uniqueSeasons = [...new Set(allSeasons)];
    if (uniqueSeasons.length === 0) {
        //theoretically this should never happen, but just in case
        throw new Error('No seasons found in status data');
    }
    if (uniqueSeasons.length > 1) {
        console.warn('Multiple seasons present in status data', uniqueSeasons);
    }

    const isNumber = isValidNumber.safeParse(uniqueSeasons[0]);
    if (!isNumber.success) throw new Error('Invalid Current Season');

    const season = Number(uniqueSeasons[0]);
    return season;
}

export function getSeasonFromSnapshot(data) {
    if (!data) throw new Error('snapshot is missing', { cause: 'utils/getSeason.mjs' });

    // Gather all relevant season numbers
    const snapshots = (data.snapshots || []).map((sh) => sh.season);
    const defendEvents = (data.defend_events || []).map((de) => de.season);
    const attackEvents = (data.attack_events || []).map((ae) => ae.season);

    // Combine all seasons
    const allSeasons = [...snapshots, ...defendEvents, ...attackEvents];

    // Check if all seasons are equal
    const uniqueSeasons = [...new Set(allSeasons)];
    if (uniqueSeasons.length === 0) {
        //theoretically this should never happen, but just in case
        throw new Error('No seasons found in status data');
    }
    if (uniqueSeasons.length > 1) {
        console.warn('Multiple seasons present in status data', uniqueSeasons);
    }

    const isNumber = isValidNumber.safeParse(uniqueSeasons[0]);
    if (!isNumber.success) throw new Error('Invalid Current Season');

    const season = Number(uniqueSeasons[0]);
    return season;
}
