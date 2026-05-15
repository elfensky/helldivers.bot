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
 * @param {number}   season
 * @param {boolean}  confirm   When true, sets last_updated to now (signals
 *                             "season's normalized data is saved").
 * @param {object?}  metadata  Optional per-season metadata:
 *                              { introOrder?: number[3],
 *                                pointsMax?: number[3],
 *                                seasonDuration?: number }
 */
export async function queryUpsertSeason(season, confirm = false, metadata = null) {
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

    if (metadata?.introOrder !== undefined) {
        update.introduction_order = metadata.introOrder;
        create.introduction_order = metadata.introOrder;
    }
    if (metadata?.pointsMax !== undefined) {
        update.points_max = metadata.pointsMax;
        create.points_max = metadata.pointsMax;
    }
    if (metadata?.seasonDuration !== undefined) {
        update.season_duration = metadata.seasonDuration;
        create.season_duration = metadata.seasonDuration;
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
