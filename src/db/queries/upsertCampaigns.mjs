import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertCampaigns(season, campaigns) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!campaigns) throw new Error('campaigns are missing');

    try {
        const now = new Date();

        const upsertRecords = [];
        for (const campaign of campaigns) {
            if (campaign?.season !== season) continue; //skip if data is not from current season

            const upsertRecord = await db.h1_campaign.upsert({
                where: {
                    season_introduction_order: {
                        season: campaign.season,
                        introduction_order: campaign.introduction_order,
                    },
                },
                update: {
                    points: campaign.points,
                    points_taken: campaign.points_taken,
                    points_max: campaign.points_max,
                    status: campaign.status,
                },
                create: {
                    season: campaign.season,
                    points: campaign.points,
                    points_taken: campaign.points_taken,
                    points_max: campaign.points_max,
                    status: campaign.status,
                    introduction_order: campaign.introduction_order,
                },
            });
            upsertRecords.push(upsertRecord);
        }

        const response = {
            ms: performanceTime(start),
            query: upsertRecords,
        };

        return response;
    } catch (error) {
        throw error;
    }
}
