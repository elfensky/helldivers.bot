import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertSnapshots(season, snapshots) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!snapshots) throw new Error('snapshots are missing');

    const upsertRecords = [];
    let skipped = false;

    for (const snapshot of snapshots) {
        if (snapshot?.season !== season) {
            skipped = true;
            continue;
        }

        const { data: upsertRecord, error } = await tryCatch(
            db.h1_snapshot.upsert({
                where: {
                    season_time: {
                        season: season,
                        time: snapshot.time,
                    },
                },
                update: {
                    data: snapshot.data,
                },
                create: {
                    season: season,
                    time: snapshot.time,
                    data: snapshot.data,
                },
            }),
        );

        if (error) throw error;

        upsertRecords.push(upsertRecord);
        skipped = false;
    }

    return {
        ms: performanceTime(start),
        query: upsertRecords || skipped,
    };
}
