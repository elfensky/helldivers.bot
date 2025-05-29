'use server';
//performance
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
//util
import { tryCatch } from '@/lib/tryCatch.mjs';
//fetch
import { fetchData } from '@/utils/fetchData.mjs';
//validators
import { schemaNumber } from '@/validators/isValidFormData';
//db
import { query_upsert_rebroadcast_status } from '@/db/queries/rebroadcast';
// import { upsertStatus } from '@/db/queries/upsertSeason';

export async function updateStatus() {
    //0. initialize
    const start = performance.now();
    let check = null;

    //2. initialize fetch
    const url = 'https://api.helldiversgame.com/1.0/';
    const form = new FormData();
    form.append('action', 'get_campaign_status');

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
        query_upsert_rebroadcast_status(fetchedData),
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
