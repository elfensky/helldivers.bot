/**
 * Map the 16 statistics fields shared between h1_live upserts
 * and h1_live_snapshot records.
 *
 * @param {object} stats - Statistics object from API response (must not be null/undefined)
 * @returns {object} Mapped stat fields for Prisma create/update
 * @throws {Error} If stats is nullish
 */
export function mapStatsToDbFields(stats) {
    if (!stats) throw new Error('stats is required');
    return {
        season_duration: stats.season_duration,
        players: stats.players,
        total_unique_players: stats.total_unique_players,
        missions: stats.missions,
        successful_missions: stats.successful_missions,
        total_mission_difficulty: stats.total_mission_difficulty,
        completed_planets: stats.completed_planets,
        defend_events: stats.defend_events,
        successful_defend_events: stats.successful_defend_events,
        attack_events: stats.attack_events,
        successful_attack_events: stats.successful_attack_events,
        deaths: stats.deaths,
        kills: stats.kills,
        accidentals: stats.accidentals,
        shots: stats.shots,
        hits: stats.hits,
    };
}
