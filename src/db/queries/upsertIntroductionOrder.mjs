import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';

export async function queryUpsertIntroductionOrder(season, order) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!order) throw new Error('order is missing');

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_introduction_order.upsert({
            where: { season: season },
            update: { order: order },
            create: { season: season, order: order },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query: upsertRecord };
}
