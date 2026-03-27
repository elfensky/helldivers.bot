import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';


export async function queryUpsertSeason(season, complete = false) {
    'use server';
    //0. initialize variables
    const start = performance.now(); //start performance metrics
    const now = new Date(); //current date
    let seasonCount = null;

    //1. validate season parameter is a positive integer
    const checkSeason = isValidNumber.safeParse(season);
    if (!checkSeason.success) {
        throw checkSeason.error;
    }

    //2.
    try {
        if (!complete) {
            const upsertRecord = await db.h1_season.upsert({
                where: {
                    season: season,
                },
                update: {
                    // last_updated: null, //do not (yet) update last_updated date
                },
                create: {
                    // last_updated: null, //do not (yet) create last_updated date
                    season: season,
                },
            });

            const response = {
                ms: performanceTime(start),
                query: upsertRecord,
            };

            return response;
        }

        if (complete) {
            const upsertRecord = await db.h1_season.upsert({
                where: {
                    season: season,
                },
                update: {
                    last_updated: now, //update date
                },
                create: {
                    last_updated: now, //update date
                    season: season,
                },
            });

            const response = {
                ms: performanceTime(start),
                query: upsertRecord,
            };

            return response;
        }
    } catch (error) {
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertSeason.mjs',
        });
        throw error;
    }
}
