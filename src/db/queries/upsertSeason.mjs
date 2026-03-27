import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

export async function queryUpsertSeason(season, complete = false) {
    'use server';
    const start = performance.now();

    const checkSeason = isValidNumber.safeParse(season);
    if (!checkSeason.success) {
        throw checkSeason.error;
    }

    if (!complete) {
        const query = await db.h1_season.upsert({
            where: { season },
            update: {},
            create: { season },
        });
        return { ms: performanceTime(start), query };
    }

    const now = new Date();
    const query = await db.h1_season.upsert({
        where: { season },
        update: { last_updated: now },
        create: { last_updated: now, season },
    });
    return { ms: performanceTime(start), query };
}
