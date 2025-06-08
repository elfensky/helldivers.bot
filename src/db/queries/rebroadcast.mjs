'use server';
import { z } from 'zod/v4';
import db from '@/db/db';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';

export async function queryUpsertRebroadcastStatus(season, data) {
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!data) throw new Error('data is missing');
    // if (!key) throw new Error('key is missing');
    // if (key !== process.env.UPDATE_KEY) throw new Error('key is invalid');

    try {
        const now = new Date();

        const existingRecord = await db.rebroadcast_status.findUnique({
            where: {
                season: season,
            },
        });

        const upsertRecord = await db.rebroadcast_status.upsert({
            where: {
                season: season,
            },
            update: {
                season: season,
                last_updated: now,
                json: data,
            },
            create: {
                season: season,
                last_updated: now,
                json: data,
            },
        });

        const action = existingRecord ? 'UPDATE' : 'CREATE';

        // log.info(
        //     chalk.white(`(2/7) ${action} STATUS`) +
        //         chalk.white("'s [core] in ") +
        //         chalk.blue((performance.now() - start).toFixed(3) + ' ms'),
        // );

        const response = {
            ms: performanceTime(start),
            action: action,
            query: upsertRecord,
        };
        return response;

        // return upsertRecord; // Return the newly created event
    } catch (error) {
        throw error;
    }
}

export async function queryUpsertRebroadcastSeason(season, data) {
    const start = performance.now();

    if (!season) throw new Error('season is missing');
    if (!data) throw new Error('data is missing');
    // if (!key) throw new Error('key is missing');
    // if (key !== process.env.UPDATE_KEY) throw new Error('key is invalid');

    try {
        const now = new Date();

        const existingRecord = await db.rebroadcast_snapshot.findUnique({
            where: {
                season: season,
            },
        });

        const upsertRecord = await db.rebroadcast_snapshot.upsert({
            where: {
                season: season,
            },
            update: {
                season: season,
                last_updated: now,
                json: data,
            },
            create: {
                season: season,
                last_updated: now,
                json: data,
            },
        });

        const action = existingRecord ? 'UPDATE' : 'CREATE';

        // log.info(
        //     chalk.white(`(2/7) ${action} STATUS`) +
        //         chalk.white("'s [core] in ") +
        //         chalk.blue((performance.now() - start).toFixed(3) + ' ms'),
        // );

        const response = {
            ms: performanceTime(start),
            action: action,
            query: upsertRecord,
        };
        return response;

        // return upsertRecord; // Return the newly created event
    } catch (error) {
        throw error;
    }
}

export async function queryGetRebroadcastStatus(season) {
    'use server';
    const start = performance.now();

    try {
        const query = await db.rebroadcast_status.findFirst({
            orderBy: {
                last_updated: 'desc', // or 'asc' for oldest
            },
            // Optionally, add a where clause if you want to filter
            // where: { ... }
        });

        const response = {
            ms: performanceTime(start),
            data: query,
        };

        return response;

        // if (query?.json) {
        //     return query.json;
        // } else {
        //     return null;
        // }
    } catch (error) {
        throw error;
    }
}

export async function queryGetRebroadcastSeason(season) {
    'use server';
    const start = performance.now();

    try {
        const query = await db.rebroadcast_snapshot.findUnique({
            where: {
                season: season,
            },
        });

        const response = {
            ms: performanceTime(start),
            data: query,
        };

        return response;

        // if (query?.json) {
        //     return query.json;
        // } else {
        //     return null;
        // }
    } catch (error) {
        throw error;
    }
}
