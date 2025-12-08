import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

export async function queryUpsertSnapshots(season, snapshots) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!snapshots) throw new Error('snapshots are missing');

    try {
        let skipped = false;
        const now = new Date();
        const upsertRecords = [];

        for (const snapshot of snapshots) {
            if (snapshot?.season !== season) {
                skipped = true;
                continue; //skip if data is not from current season
            }

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
            skipped = false;
        }

        const response = {
            ms: performanceTime(start),
            query: upsertRecords || skipped,
        };

        return response;
    } catch (error) {
        console.error(error.message, {
            cause: '/src/db/queries/queryUpsertAttackEvents.mjs',
        });
        throw error;
    }
}
