'use server';
import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertRebroadcastStatus(season, data) {
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!data) throw new Error('data is missing');

    const now = new Date();

    const existingRecord = await db.rebroadcast_status.findUnique({
        where: { season },
    });

    const upsertRecord = await db.rebroadcast_status.upsert({
        where: { season },
        update: { season, last_updated: now, json: data },
        create: { season, last_updated: now, json: data },
    });

    return {
        ms: performanceTime(start),
        action: existingRecord ? 'UPDATE' : 'CREATE',
        query: upsertRecord,
    };
}

export async function queryUpsertRebroadcastSeason(season, data) {
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!data) throw new Error('data is missing');

    const now = new Date();

    const existingRecord = await db.rebroadcast_snapshot.findUnique({
        where: { season },
    });

    const upsertRecord = await db.rebroadcast_snapshot.upsert({
        where: { season },
        update: { season, last_updated: now, json: data },
        create: { season, last_updated: now, json: data },
    });

    return {
        ms: performanceTime(start),
        action: existingRecord ? 'UPDATE' : 'CREATE',
        query: upsertRecord,
    };
}

export async function queryGetRebroadcastStatus() {
    'use server';
    const start = performance.now();

    const query = await db.rebroadcast_status.findFirst({
        orderBy: { last_updated: 'desc' },
    });

    return {
        ms: performanceTime(start),
        data: query,
    };
}

export async function queryGetRebroadcastSeason(season) {
    'use server';
    const start = performance.now();

    const query = await db.rebroadcast_snapshot.findUnique({
        where: { season },
    });

    return {
        ms: performanceTime(start),
        data: query,
    };
}
