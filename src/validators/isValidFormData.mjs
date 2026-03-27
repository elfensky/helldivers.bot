import { z } from 'zod';

export const schemaNumber = z.preprocess(
    (val) => (typeof val === 'string' ? Number(val) : val),
    z.number().int().positive(),
);

const schemaGetCampaignStatus = z
    .object({
        action: z.literal('get_campaign_status'),
    })
    .refine((obj) => Object.keys(obj).length === 1, {
        message: 'No other keys allowed when action is "get_campaign_status"',
    });

const schemaGetSnapshots = z.object({
    action: z.literal('get_snapshots'),
    season: schemaNumber,
});

const schemaGetAvailableEntitlements = z
    .object({
        action: z.literal('get_available_entitlements'),
    })
    .refine((obj) => Object.keys(obj).length === 1, {
        message: 'No other keys allowed when action is "get_available_entitlements"',
    });

const schemaGetLeaderboards = z.object({
    action: z.literal('get_leaderboards'),
    network: z.enum(['steam', 'psn']),
    season: schemaNumber,
    count: schemaNumber.optional(),
    users: z.array(z.string()).optional(),
});

const schemaGetUsernames = z.object({
    action: z.literal('get_usernames'),
    network: z.enum(['steam', 'psn']),
    count: schemaNumber,
});

export const isValidFormData = z.discriminatedUnion('action', [
    schemaGetCampaignStatus,
    schemaGetSnapshots,
    schemaGetAvailableEntitlements,
    schemaGetLeaderboards,
    schemaGetUsernames,
]);
