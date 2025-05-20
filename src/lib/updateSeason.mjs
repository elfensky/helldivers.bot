'use server';
//performance
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
//util
import { tryCatch } from '@/lib/tryCatch.mjs';
//fetch
import { fetchData } from '@/utils/fetchData.mjs';
//validators
import { schema_number } from '@/validators/isValidFormData';
//db
import { query_upsert_rebroadcast_season } from '@/db/queries/rebroadcast';
// import { upsertSeason } from '@/db/queries/upsertSeason';

export async function updateSeason(season) {
    //0. initialize
    const start = performance.now();
    let check = null;

    //1. test if season exists and is valid
    check = schema_number.safeParse(season);
    if (!check.success) {
        throw new Error(check?.error?.issues[0]?.message || 'Invalid season', {
            cause: `updateSeason(${season})`,
        });
    }

    //2. initialize fetch
    const url = 'https://api.helldiversgame.com/1.0/';
    const form = new FormData();
    form.append('action', 'get_snapshots');
    form.append('season', season.toString());

    //3. execute fetch
    const { data: fetchedData, error: fetchedError } = await tryCatch(
        fetchData(url, form),
    );
    if (fetchedError) {
        throw new Error(fetchedError?.message || 'Failed to fetch data from the API', {
            cause: `fetchData(${season})`,
        });
    }

    //4. store in db -> for rebroadcast
    const { data: storedData, error: storedError } = await tryCatch(
        query_upsert_rebroadcast_season(season, fetchedData),
    );
    if (storedError) {
        throw new Error(storedError?.message || 'Failed to store data in the database', {
            cause: `upsertSeason(${season})`,
        });
    }

    //5. return response
    const status = {
        success: true,
        ms: performanceTime(start),
        data: storedData,
    };
    return status;
}
