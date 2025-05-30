import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { zodIsNumber } from '@/validators/isNumber';

export async function queryUpsertSnapshots(season, snapshots) {
    'use server';
    const start = performance.now();

    try {
        const now = new Date();

        const upsertRecords = [];
        for (const snapshot of snapshots) {
            const upsertRecord = await db.h1_snapshot.upsert({
                where: {
                    season_time: {
                        season: season,
                        time: snapshot.time,
                    },
                },
                update: {
                    // season: season,
                    // time: snapshot.time,
                    data: snapshot.data,
                    json: snapshot,
                },
                create: {
                    season: season,
                    time: snapshot.time,
                    data: snapshot.data,
                    json: snapshot,
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
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertAttackEvents.mjs',
        });
        throw error;
    }
}
