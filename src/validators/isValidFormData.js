import { z } from 'zod/v4';

//preprocessor to convert to number if string, and check if number
export const schema_number = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);

//required: action
const schema_get_campaign_status = z
    .object({
        action: z.literal('get_campaign_status'),
    })
    .refine((obj) => Object.keys(obj).length === 1, {
        message: 'No other keys allowed when action is "get_campaign_status"',
    });

//required: action, season(int)
const schema_get_snapshots = z.object({
    action: z.literal('get_snapshots'),
    season: schema_number,
});

const schema_get_available_entitlements = z
    .object({
        action: z.literal('get_available_entitlements'),
    })
    .refine((obj) => Object.keys(obj).length === 1, {
        message: 'No other keys allowed when action is "get_available_entitlements"',
    });

//required: action, network(steam||psn), season(int)
// optional: count(int), users(array of steamIDs)
const schema_get_leaderboards = z.object({
    action: z.literal('get_leaderboards'),
    network: z.enum(['steam', 'psn']),
    season: schema_number,
    count: schema_number.optional(),
    users: z.array(z.string()).optional(),
});

// required: action, network(steam||psn), count(int)
const schema_get_usernames = z.object({
    action: z.literal('get_usernames'),
    network: z.enum(['steam', 'psn']),
    count: schema_number,
});

export const isValidFormData = z.discriminatedUnion('action', [
    schema_get_campaign_status,
    schema_get_snapshots,
    schema_get_available_entitlements,
    schema_get_leaderboards,
    schema_get_usernames,
]);

// export const isValidFormData = z.any().superRefine((data, ctx) => {
//     // Check for action presence
//     if (typeof data !== 'object' || data === null || !('action' in data)) {
//         ctx.addIssue({
//             code: z.ZodIssueCode.custom,
//             message: 'action is required',
//             path: ['action'],
//             errorCode: 1,
//         });
//         return;
//     }
//     // Try the union
//     return union.safeParse(data);
// });
