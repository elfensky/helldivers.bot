import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { mapStatsToDbFields } from '@/db/queries/mapStatsToDbFields';

export async function queryUpsertLive(season, enemy, campaign, stats, factionMap) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (enemy === undefined || enemy === null) throw new Error('enemy is missing');
    if (!campaign) throw new Error('campaign is missing');
    if (!stats) throw new Error('stats is missing');

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_live.upsert({
            where: {
                season_enemy: {
                    season: season,
                    enemy: enemy,
                },
            },
            update: {
                // campaign_status fields
                points: campaign.points,
                points_taken: campaign.points_taken,
                points_max: campaign.points_max,
                status: campaign.status,
                introduction_order: campaign.introduction_order,
                // statistics fields
                ...mapStatsToDbFields(stats),
                // computed map
                map: factionMap ?? null,
            },
            create: {
                season: season,
                enemy: enemy,
                // campaign_status fields
                points: campaign.points,
                points_taken: campaign.points_taken,
                points_max: campaign.points_max,
                status: campaign.status,
                introduction_order: campaign.introduction_order,
                // statistics fields
                ...mapStatsToDbFields(stats),
                // computed map
                map: factionMap ?? null,
            },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: upsertRecord };
}
