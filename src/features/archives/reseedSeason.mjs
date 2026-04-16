'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { updateSeason } from '@/update/season';
import { computeBucket } from '@/update/bucketing';
import db from '@/db/db';

const seasonSchema = z.number().int().positive();

/**
 * Admin-only: force re-fetch a specific season from the official HD1 API and
 * upsert it into `h1_event`, `h1_snapshot`, `h1_season`, etc. Delegates to
 * `updateSeason` — the same pipeline the worker runs every poll — which also
 * writes the raw response to `rebroadcast_season` and stamps
 * `h1_season.last_updated = now` at the end of its pipeline. Idempotent.
 *
 * The `last_updated` stamp lets the client enforce a 24-hour cooldown on the
 * refresh button (prevents API hammering).
 *
 * Use case: close ingestion gaps where a season's final state never landed
 * in the normalized tables — e.g. the closing snapshot HD1 writes shortly
 * after a season transition. The worker's poll loop now detects transitions
 * and runs a closing pass automatically (see `src/app/api/h1/update/route.js`),
 * but this manual button remains useful for admin-driven recovery and for
 * catching any edge case the automatic detection misses (e.g. a worker
 * restart during the transition window).
 */
export async function reseedSeason(season) {
    if (!auth) return { error: 'Auth not configured' };

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== 'admin') {
        return { error: 'Forbidden' };
    }

    const parsed = seasonSchema.safeParse(season);
    if (!parsed.success) return { error: 'Invalid season' };

    // If reseeding the active season, protect the live bucket so stale
    // get_snapshots data doesn't overwrite the worker's fresher writes.
    const opts = {};
    const { data: latestSeason } = await tryCatch(
        db.h1_season.findFirst({
            where: { last_updated: { not: null } },
            orderBy: { season: 'desc' },
            select: { season: true },
        }),
    );
    if (latestSeason && parsed.data >= latestSeason.season) {
        opts.protectedBucket = computeBucket(Math.floor(Date.now() / 1000));
    }

    const { error: seedError } = await tryCatch(updateSeason(parsed.data, opts));
    if (seedError) return { error: seedError.message ?? 'Reseed failed' };

    revalidatePath('/archives');
    return { ok: true };
}
