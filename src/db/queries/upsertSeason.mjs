import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

/**
 * Upsert an h1_season row. Optionally takes intro_order and points_max
 * arrays (3 values each, indexed by enemy) which get inlined on the row.
 *
 * @param {number}   season
 * @param {boolean}  confirm   When true, sets last_updated to now (signals
 *                             "season's normalized data is saved").
 * @param {object?}  arrays    Optional { introOrder: number[3], pointsMax: number[3] }
 */
export async function queryUpsertSeason(season, confirm = false, arrays = null) {
    'use server';
    const start = performance.now();

    if (season == null) throw new Error('season is missing');

    const checkSeason = isValidNumber.safeParse(season);
    if (!checkSeason.success) {
        throw checkSeason.error;
    }

    const update = {};
    const create = { season };

    if (confirm) {
        const now = new Date();
        update.last_updated = now;
        create.last_updated = now;
    }

    if (arrays?.introOrder !== undefined) {
        update.intro_order_array = arrays.introOrder;
        create.intro_order_array = arrays.introOrder;
    }
    if (arrays?.pointsMax !== undefined) {
        update.points_max_array = arrays.pointsMax;
        create.points_max_array = arrays.pointsMax;
    }

    const { data: upsertRecord, error } = await tryCatch(
        db.h1_season.upsert({
            where: { season },
            update,
            create,
        }),
    );

    if (error) throw error;
    return { ms: performanceTime(start), query: upsertRecord };
}
