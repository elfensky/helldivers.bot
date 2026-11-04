import db from '@/db/db';
import { after } from 'next/server';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { createHash } from 'crypto';

const LAST_USED_INTERVAL_MS = 60_000;

export const API_KEY_ERROR = Object.freeze({
    MISSING: 'missing',
    INVALID: 'invalid',
    DISABLED: 'disabled',
    DB_ERROR: 'db_error',
});

/**
 * Validate an API key from the Authorization header.
 * Not a server action — called from route handlers directly.
 * A valid key's `lastUsedAt` is stamped in `after()`, at most once a minute.
 *
 * Returns `{ data, code }`, not `{ data, error }` — the second slot
 * carries a `API_KEY_ERROR` enum string, NOT an `Error` instance. The
 * separate field name avoids confusion with the project's `tryCatch`
 * tuple convention (where `error` is always an `Error` instance or null).
 *
 * @returns {Promise<{ data: { userId: string, keyId: string } | null,
 *   code: typeof API_KEY_ERROR[keyof typeof API_KEY_ERROR] | null }>}
 */
export async function validateApiKey(request) {
    const header = request.headers.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
        return { data: null, code: API_KEY_ERROR.MISSING };
    }

    const key = header.slice(7);
    if (!key) {
        return { data: null, code: API_KEY_ERROR.MISSING };
    }

    const hash = createHash('sha256').update(key).digest('hex');

    const { data: row, error: dbError } = await tryCatch(
        db.ApiKey.findUnique({
            where: { hash },
            select: { id: true, userId: true, enabled: true, lastUsedAt: true },
        }),
    );

    if (dbError) {
        return { data: null, code: API_KEY_ERROR.DB_ERROR };
    }
    if (!row) {
        return { data: null, code: API_KEY_ERROR.INVALID };
    }

    if (!row.enabled) {
        return { data: null, code: API_KEY_ERROR.DISABLED };
    }

    const cutoff = new Date(Date.now() - LAST_USED_INTERVAL_MS);
    if (!row.lastUsedAt || row.lastUsedAt < cutoff) {
        // The conditional where keeps this at one write per key per minute across replicas.
        after(async () => {
            const { error } = await tryCatch(
                db.ApiKey.updateMany({
                    where: {
                        id: row.id,
                        OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: cutoff } }],
                    },
                    data: { lastUsedAt: new Date() },
                }),
            );
            if (error) {
                reportError(error, {
                    route: 'validateApiKey',
                    stage: 'last-used',
                    level: 'warning',
                });
            }
        });
    }

    return { data: { userId: row.userId, keyId: row.id }, code: null };
}
