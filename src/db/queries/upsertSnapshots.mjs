import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';

export async function queryUpsertSnapshots(season, snapshots) {
    'use server';
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!snapshots) throw new Error('snapshots are missing');

    const upsertRecords = [];

    for (const snapshot of snapshots) {
        if (snapshot?.season !== season) continue;

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
    }

    return {
        ms: performanceTime(start),
        query: upsertRecords,
    };
}
