'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { fetchAndSeedSeason } from '@/db/queries/fetchAndSeedSeason';
import db from '@/db/db';

const seasonSchema = z.number().int().positive();

/**
 * Admin-only: force re-fetch a specific season from the official HD1 API and
 * upsert it into `h1_event`, `h1_snapshot`, `h1_season`, etc. Idempotent —
 * `fetchAndSeedSeason` only updates rows, never deletes.
 *
 * Stamps `h1_season.last_updated = now` on success so the client can enforce
 * a 24-hour cooldown on the refresh button (prevents API hammering).
 *
 * Use case: close ingestion gaps where a season's final state (e.g. a failed
 * region-0 defend that was still `active` at the last poll before the worker
 * switched to the next season) never landed in the normalized tables.
 */
export async function reseedSeason(season) {
    if (!auth) return { error: 'Auth not configured' };

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user || session.user.role !== 'admin') {
        return { error: 'Forbidden' };
    }

    const parsed = seasonSchema.safeParse(season);
    if (!parsed.success) return { error: 'Invalid season' };

    const { error: seedError } = await tryCatch(fetchAndSeedSeason(parsed.data));
    if (seedError) return { error: seedError.message ?? 'Reseed failed' };

    const { error: stampError } = await tryCatch(
        db.h1_season.update({
            where: { season: parsed.data },
            data: { last_updated: new Date() },
        }),
    );
    if (stampError)
        return { error: stampError.message ?? 'Failed to stamp last_updated' };

    revalidatePath('/archives');
    return { ok: true };
}
