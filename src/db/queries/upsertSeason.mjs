import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { zodIsNumber } from '@/validators/isNumber';

export async function queryUpsertSeason(season, complete) {
    'use server';
    const start = performance.now();

    const checkSeason = zodIsNumber.safeParse(season);
    if (!checkSeason.success) {
        throw checkSeason.error;
    }

    try {
        const now = new Date();

        const count = await db.h1_season.count();
        if (count !== season) {
            const origin = new Date(0);
            for (let index = 1; index < season; index++) {
                const createEmptySeason = await db.h1_season.upsert({
                    where: {
                        season: index,
                    },
                    update: {},
                    create: {
                        is_active: false,
                        last_updated: origin,
                        season: index,
                    },
                });
            }
        }

        //update active/inactive records
        const activeRecords = await db.h1_season.findMany({
            where: {
                is_active: true,
                season: {
                    not: season,
                },
            },
        });
        //set all non-active ones to false
        for (const record of activeRecords) {
            await db.h1_season.update({
                where: {
                    season: record.season,
                },
                data: {
                    is_active: false,
                },
            });
        }

        if (complete) {
            //update actual data
            const upsertRecord = await db.h1_season.upsert({
                where: {
                    season: season,
                },
                update: {
                    is_active: true,
                    last_updated: now,
                },
                create: {
                    is_active: true,
                    last_updated: now,
                    season: season,
                },
            });

            const response = {
                ms: performanceTime(start),
                query: upsertRecord,
            };

            return response;
        } else {
            //update actual data
            const upsertRecord = await db.h1_season.upsert({
                where: {
                    season: season,
                },
                update: {
                    is_active: true,
                },
                create: {
                    is_active: true,
                    last_updated: now,
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
