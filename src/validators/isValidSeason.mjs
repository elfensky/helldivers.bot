import { z } from 'zod';

// Schema for the objects inside the stringified "data" field in snapshots
const snapshotDataItemSchema = z.object({
    points: z.number(),
    points_taken: z.number(),
    status: z.enum(['hidden', 'active', 'defeated']),
});

// Snapshot data: JSON string (from API) or already-parsed array/object
const snapshotDataField = z.union([
    z.string().refine(
        (val) => {
            try {
                const arr = JSON.parse(val);
                return (
                    Array.isArray(arr) &&
                    arr.every((item) => snapshotDataItemSchema.safeParse(item).success)
                );
            } catch {
                return false;
            }
        },
        {
            message: 'data must be a stringified array of valid snapshot data items',
        },
    ),
    z.array(snapshotDataItemSchema),
    z.object({}).passthrough(),
]);

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
    status: z.enum(['fail', 'success', 'active']),
    players_at_start: z.number(),
    region: z.number().optional(),
});

// The main schema
const rootSchema = z.object({
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
            .refine((e) => e.status !== 'active', {
                message: 'defend_events must be resolved (fail or success)',
            }),
    ),
    attack_events: z.array(
        eventSchema.refine((e) => e.region === undefined, {
            message: 'attack_events must not have region',
        }),
    ),
});

export const isValidSeason = (data) => rootSchema.safeParse(data);
