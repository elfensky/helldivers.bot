'use server';
import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

export async function initializeDatabase(status) {
    //0. initialize variables
    const start = performance.now(); //start performance metrics
    const now = new Date(); //current date
    let currentSeason = null;

    //1.1 validate season parameter is a positive integer
    // const checkSeason = isValidNumber.safeParse(season);
    // if (!checkSeason.success) {
    //     throw checkSeason.error;
    // }

    //1/

    const { data: seasonCount, error: countError } = await tryCatch(db.h1_season.count());
    if (countError) {
        console.error(countError.message, {
            cause: '/src/db/queries/initializeDatabase.mjs | await tryCatch(db.h1_season.count())',
        });
        throw countError;
    }

    if (currentSeason !== seasonCount) {
        //database is not up to date, generate empty seasons
        const 


        try {
            for (let index = 1; index < season; index++) {
                const createEmptySeason = await db.h1_season.upsert({
                    where: {
                        season: index,
                    },
                    update: {},
                    create: {
                        is_active: false,
                        season: index,
                    },
                });
            }
        } catch (error) {
            console.error(error.message, {
                cause: '/src/db/queries/initializeDatabase.mjs | generating empty seasons for loop',
            });
            throw error;
        }
    }

    //2.
    try {
    } catch (error) {
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertSeason.mjs',
        });
        throw error;
    }
}
