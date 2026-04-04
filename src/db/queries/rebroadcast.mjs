import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';

async function upsertRebroadcast(model, season, data) {
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!data) throw new Error('data is missing');

    const now = new Date();

    const { data: query, error } = await tryCatch(
        model.upsert({
            where: { season },
            update: { season, last_updated: now, json: data },
            create: { season, last_updated: now, json: data },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query };
}

export async function queryUpsertRebroadcastStatus(season, data) {
    return upsertRebroadcast(db.rebroadcast_status, season, data);
}

export async function queryUpsertRebroadcastSeason(season, data) {
    return upsertRebroadcast(db.rebroadcast_snapshot, season, data);
}

export async function queryGetRebroadcastStatus() {
    'use server';
    const start = performance.now();

    const { data: query, error } = await tryCatch(
        db.rebroadcast_status.findFirst({
            orderBy: { last_updated: 'desc' },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query };
}

export async function queryGetRebroadcastSeason(season) {
    'use server';
    const start = performance.now();

    const { data: query, error } = await tryCatch(
        db.rebroadcast_snapshot.findUnique({
            where: { season },
        }),
    );

    if (error) throw error;

    return { ms: performanceTime(start), query };
}
