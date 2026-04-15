import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { isValidNumber } from '@/validators/isValidNumber';

/**
 * Upsert an h1_season row. Optionally takes inlined per-season metadata:
 *   - introOrder   — number[3] indexed by enemy (war-entry position)
 *   - pointsMax    — number[3] indexed by enemy (per-faction point ceiling)
 *   - seasonDuration — scalar int (per-season state, not per-faction)
 *
 * The `arrays` parameter name is stale (it's not only arrays anymore) but
 * several callers already pass by the `arrays` keyword — keep the name.
 *
 * @param {number}   season
 * @param {boolean}  confirm   When true, sets last_updated to now (signals
 *                             "season's normalized data is saved").
 * @param {object?}  arrays    Optional per-season metadata:
 *                             { introOrder?: number[3],
 *                               pointsMax?: number[3],
 *                               seasonDuration?: number }
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
    if (arrays?.seasonDuration !== undefined) {
        update.season_duration = arrays.seasonDuration;
        create.season_duration = arrays.seasonDuration;
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
