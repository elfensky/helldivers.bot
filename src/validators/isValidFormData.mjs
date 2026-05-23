import { z } from 'zod';
import { isValidNumber } from '@/validators/isValidNumber.mjs';

const schemaGetCampaignStatus = z
    .object({
        action: z.literal('get_campaign_status'),
    })
    .refine((obj) => Object.keys(obj).length === 1, {
        message: 'No other keys allowed when action is "get_campaign_status"',
    });

const schemaGetSnapshots = z.object({
    action: z.literal('get_snapshots'),
    season: isValidNumber,
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
    season: isValidNumber,
    count: isValidNumber.optional(),
    users: z.array(z.string()).optional(),
});

const schemaGetUsernames = z.object({
    action: z.literal('get_usernames'),
    network: z.enum(['steam', 'psn']),
    count: isValidNumber,
});

export const isValidFormData = z.discriminatedUnion('action', [
    schemaGetCampaignStatus,
    schemaGetSnapshots,
    schemaGetAvailableEntitlements,
    schemaGetLeaderboards,
    schemaGetUsernames,
]);

/**
 * Inferred shape of a validated rebroadcast form-data body. Discriminated
 * on `action`, so consumers get exhaustive narrowing automatically.
 *
 * @typedef {import('zod').infer<typeof isValidFormData>} FormDataPayload
 */
