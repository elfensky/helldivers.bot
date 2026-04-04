import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';

export async function queryUpsertPointsMax(season, points) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!points) throw new Error('points is missing');

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_points_max.upsert({
            where: { season: season },
            update: { points: points },
            create: { season: season, points: points },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: upsertRecord };
}
