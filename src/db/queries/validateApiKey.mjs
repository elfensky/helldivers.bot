import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch';
import { createHash } from 'crypto';

export const API_KEY_ERROR = Object.freeze({
    MISSING: 'missing',
    INVALID: 'invalid',
    DISABLED: 'disabled',
});

/**
 * Validate an API key from the Authorization header.
 * Not a server action — called from route handlers directly.
 */
export async function validateApiKey(request) {
    const header = request.headers.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
        return { data: null, error: API_KEY_ERROR.MISSING };
    }

    const key = header.slice(7);
    if (!key) {
        return { data: null, error: API_KEY_ERROR.MISSING };
    }

    const hash = createHash('sha256').update(key).digest('hex');

    const { data: row, error: dbError } = await tryCatch(
        db.ApiKey.findUnique({
            where: { hash },
            select: { id: true, userId: true, enabled: true },
        }),
    );

    if (dbError || !row) {
        return { data: null, error: API_KEY_ERROR.INVALID };
    }

    if (!row.enabled) {
        return { data: null, error: API_KEY_ERROR.DISABLED };
    }

    return { data: { userId: row.userId, keyId: row.id }, error: null };
}
