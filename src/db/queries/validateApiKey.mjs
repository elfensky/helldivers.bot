import db from '@/db/db';
import { tryCatch } from '@/utils/tryCatch';
import { createHash } from 'crypto';

/**
 * Validate an API key from the Authorization header.
 * Not a server action — called from route handlers directly.
 */
export async function validateApiKey(request) {
    const header = request.headers.get('authorization');
    if (!header || !header.startsWith('Bearer ')) {
        return { data: null, error: 'missing' };
    }

    const key = header.slice(7);
    if (!key) {
        return { data: null, error: 'missing' };
    }

    const hash = createHash('md5').update(key).digest('hex');

    const { data: row, error: dbError } = await tryCatch(
        db.ApiKey.findUnique({
            where: { hash },
            select: { id: true, userId: true, enabled: true },
        }),
    );

    if (dbError || !row) {
        return { data: null, error: 'invalid' };
    }

    if (!row.enabled) {
        return { data: null, error: 'disabled' };
    }

    return { data: { userId: row.userId, keyId: row.id }, error: null };
}
