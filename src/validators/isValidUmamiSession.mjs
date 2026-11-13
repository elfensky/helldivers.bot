import { z } from 'zod';

/**
 * Umami 3.5 `GET /api/websites/{websiteId}/sessions`: one page of sessions.
 * Only the fields the withdrawal delete reads are checked; the rest pass.
 */
export const isValidUmamiSessionPage = z.looseObject({
    data: z.array(z.looseObject({ id: z.uuid() })),
    count: z.coerce.number().int().nonnegative(),
});

/**
 * Umami 3.5 `GET /api/websites/{websiteId}/sessions/{sessionId}`: the distinct
 * ids linked to the session, and how many sessions share its distinct id.
 */
export const isValidUmamiSessionDetail = z.looseObject({
    id: z.uuid(),
    distinctIds: z.array(z.string()),
    stitchedSessionCount: z.number().int().nonnegative(),
});
