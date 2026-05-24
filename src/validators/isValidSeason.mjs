import { z } from 'zod';
// Relative import (not '@/shared/...') because this file is loaded by the
// raw-Node migrate container's seed script, where jsconfig path aliases
// don't resolve.
import { CAMPAIGN_STATUS, EVENT_STATUS } from '../shared/enums/events.mjs';

// Schema for the objects inside the stringified "data" field in snapshots
const snapshotDataItemSchema = z.object({
    points: z.number(),
    points_taken: z.number(),
    status: z.enum(Object.values(CAMPAIGN_STATUS)),
});

// Snapshot data: JSON string (from HD1 API wire format). Parsed at write time
// by updateSeason; validated here only at the Zod level to ensure the inner
// content is shape-compatible.
const snapshotDataField = z.string().refine(
    (val) => {
        try {
            const arr = JSON.parse(val);
            return (
                Array.isArray(arr) &&
                arr.length === 3 &&
                arr.every((item) => snapshotDataItemSchema.safeParse(item).success)
            );
        } catch {
            return false;
        }
    },
    {
        message: 'data must be a stringified array of 3 valid snapshot data items',
    },
);

// Schema for the "snapshots" array
const snapshotSchema = z.object({
    season: z.number(),
    time: z.number(),
    data: snapshotDataField,
});

// Schema for defend_events and attack_events (shared base)
const eventSchema = z.object({
    season: z.number(),
    event_id: z.number(),
    start_time: z.number(),
    end_time: z.number(),
    enemy: z.number(),
    points_max: z.number(),
    points: z.number(),
    status: z.enum(Object.values(EVENT_STATUS)),
    players_at_start: z.number(),
    region: z.number().optional(),
});

export const isValidSeason = z.object({
    time: z.number(),
    error_code: z.number(),
    introduction_order: z.array(z.number()).nullable(),
    points_max: z.array(z.number()).nullable(),
    snapshots: z.array(snapshotSchema),
    defend_events: z.array(
        eventSchema
            .refine((e) => e.region !== undefined, {
                message: 'defend_events must have region',
            })
            .refine((e) => e.status !== EVENT_STATUS.ACTIVE, {
                message: 'defend_events must be resolved (fail or success)',
            }),
    ),
    attack_events: z.array(
        eventSchema.refine((e) => e.region === undefined, {
            message: 'attack_events must not have region',
        }),
    ),
});

/**
 * Inferred shape of a validated `get_snapshots` payload from HD1.
 * Use this typedef downstream of Zod validation instead of typing as `object`.
 *
 * @typedef {import('zod').infer<typeof isValidSeason>} SeasonPayload
 */
