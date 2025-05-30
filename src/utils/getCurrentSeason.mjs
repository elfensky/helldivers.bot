export function getCurrentSeason(data) {
    // Gather all relevant season numbers
    const campaignSeasons = (data.campaign_status || []).map((cs) => cs.season);
    const defendSeason = data.defend_event ? [data.defend_event.season] : [];
    const statisticsSeasons = (data.statistics || []).map((stat) => stat.season);

    // Combine all seasons
    const allSeasons = [...campaignSeasons, ...defendSeason, ...statisticsSeasons];

    // Check if all seasons are equal
    const uniqueSeasons = [...new Set(allSeasons)];
    const isValid = uniqueSeasons.length === 1;

    if (isValid) {
        return uniqueSeasons[0];
    } else {
        throw new Error('Invalid Current Season');
    }
}
