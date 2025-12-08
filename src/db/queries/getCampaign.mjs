'use server';
import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

export async function getCampaign(season = null) {
    const start = performance.now();

    if (season === null) {
        try {
            //order by DESC last_updated
            //filter by is_active === true
            const data = await db.h1_season.findFirst({
                orderBy: { season: 'desc' },
                where: {
                    // is_active: true,
                    last_updated: {
                        // not: new Date('1970-01-01T00:00:00.000Z'),
                        not: null,
                    },
                },
                select: {
                    //fields from season
                    season: true,
                    last_updated: true,
                    //related tables from get_campaign_status
                    campaigns: {
                        select: {
                            points: true,
                            points_taken: true,
                            points_max: true,
                            status: true,
                            introduction_order: true,
                        },
                    },
                    statistics: {
                        select: {
                            season_duration: true,
                            enemy: true,
                            players: true,
                            total_unique_players: true,
                            missions: true,
                            successful_missions: true,
                            total_mission_difficulty: true,
                            completed_planets: true,
                            defend_events: true,
                            successful_defend_events: true,
                            attack_events: true,
                            successful_attack_events: true,
                            deaths: true,
                            kills: true,
                            accidentals: true,
                            shots: true,
                            hits: true,
                        },
                    },
                    //related tables from get_snapshot
                    introduction_order: {
                        select: {
                            order: true,
                        },
                    },
                    points_max: {
                        select: {
                            points: true,
                        },
                    },
                    snapshots: {
                        select: {
                            data: true,
                            time: true,
                        },
                    },
                    //related tables shared between the two
                    defend_events: {
                        select: {
                            event_id: true,
                            start_time: true,
                            end_time: true,
                            region: true,
                            enemy: true,
                            points_max: true,
                            points: true,
                            status: true,
                            players_at_start: true,
                        },
                    },
                    attack_events: {
                        select: {
                            event_id: true,
                            start_time: true,
                            end_time: true,
                            enemy: true,
                            points_max: true,
                            points: true,
                            status: true,
                            players_at_start: true,
                        },
                    },
                },
                // include: {
                //     introduction_order: true,
                //     points_max: true,
                //     campaigns: true,
                //     snapshots: true,
                //     defend_events: true,
                //     attack_events: true,
                //     statistics: true,
                // },
            });
            if (data.length < 1) {
                return null;
            } else {
                return data;
            }
        } catch (error) {
            console.error(error.message, {
                cause: '/src/db/queries/getCampaign.mjs',
            });
            throw error;
        }
    } else {
        try {
            const data = await db.h1_season.findUnique({
                where: {
                    season: season,
                    last_updated: {
                        not: new Date('1970-01-01T00:00:00.000Z'), //this date is set on init, when the full season list is generated.
                    },
                },
                select: {
                    //fields from season
                    season: true,
                    last_updated: true,
                    //related tables from get_campaign_status
                    campaigns: {
                        select: {
                            points: true,
                            points_taken: true,
                            points_max: true,
                            status: true,
                            introduction_order: true,
                        },
                    },
                    statistics: {
                        select: {
                            season_duration: true,
                            enemy: true,
                            players: true,
                            total_unique_players: true,
                            missions: true,
                            successful_missions: true,
                            total_mission_difficulty: true,
                            completed_planets: true,
                            defend_events: true,
                            successful_defend_events: true,
                            attack_events: true,
                            successful_attack_events: true,
                            deaths: true,
                            kills: true,
                            accidentals: true,
                            shots: true,
                            hits: true,
                        },
                    },
                    //related tables from get_snapshot
                    introduction_order: {
                        select: {
                            order: true,
                        },
                    },
                    points_max: {
                        select: {
                            points: true,
                        },
                    },
                    snapshots: {
                        select: {
                            data: true,
                            time: true,
                        },
                    },
                    //related tables shared between the two
                    defend_events: {
                        select: {
                            event_id: true,
                            start_time: true,
                            end_time: true,
                            region: true,
                            enemy: true,
                            points_max: true,
                            points: true,
                            status: true,
                            players_at_start: true,
                        },
                    },
                    attack_events: {
                        select: {
                            event_id: true,
                            start_time: true,
                            end_time: true,
                            enemy: true,
                            points_max: true,
                            points: true,
                            status: true,
                            players_at_start: true,
                        },
                    },
                },
                // include: {
                //     introduction_order: true,
                //     points_max: true,
                //     campaigns: true,
                //     snapshots: true,
                //     defend_events: true,
                //     attack_events: true,
                //     statistics: true,
                // },
            });
            return data;
        } catch (error) {
            console.error(error.message, {
                cause: '/src/db/queries/getCampaign.mjs',
            });
            throw error;
        }
    }
}
