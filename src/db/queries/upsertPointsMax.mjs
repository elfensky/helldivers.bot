import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertPointsMax(season, points) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!points) throw new Error('points is missing');

    try {
        const now = new Date();

        const upsertRecord = await db.h1_points_max.upsert({
            where: {
                season: season,
            },
            update: {
                // season: season,
                points: points,
                json: points,
            },
            create: {
                season: season,
                points: points,
                json: points,
            },
        });

        const response = {
            ms: performanceTime(start),
            query: upsertRecord,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: 'db/queries/queryUpsertPointsMax.mjs',
        });
        throw error;
    }
}
