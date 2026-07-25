import { z } from 'zod';
import { CAMPAIGN_STATUS, EVENT_STATUS } from '../shared/enums/events.mjs';

const campaignStatusSchema = z.object({
    season: z.number(),
    points: z.number(),
    points_taken: z.number(),
    points_max: z.number(),
    status: z.enum(Object.values(CAMPAIGN_STATUS)),
    // 0-based reveal rank for this faction; 255 = never introduced this season.
    introduction_order: z.number().int().min(0).max(255),
});

const defendEventSchema = z.object({
    season: z.number(),
    event_id: z.number(),
    start_time: z.number(),
    end_time: z.number(),
    region: z.number(),
    enemy: z.number(),
    points_max: z.number(),
    points: z.number(),
    status: z.enum(Object.values(EVENT_STATUS)),
});

const attackEventSchema = z.object({
    season: z.number(),
    event_id: z.number(),
    start_time: z.number(),
    end_time: z.number(),
    enemy: z.number(),
    points_max: z.number(),
    points: z.number(),
    status: z.enum(Object.values(EVENT_STATUS)),
    players_at_start: z.number(),
    max_event_id: z.number(),
});

const statisticsSchema = z.object({
    season: z.number(),
    season_duration: z.number(),
    enemy: z.number(),
    players: z.number(),
    total_unique_players: z.number(),
    missions: z.number(),
    successful_missions: z.number(),
    total_mission_difficulty: z.number(),
    completed_planets: z.number(),
    defend_events: z.number(),
    successful_defend_events: z.number(),
    attack_events: z.number(),
    successful_attack_events: z.number(),
    deaths: z.number(),
    kills: z.number(),
    accidentals: z.number(),
    shots: z.number(),
    hits: z.number(),
});

export const isValidStatus = z.object({
    time: z.number().int().min(1000000000).max(2000000000),
    error_code: z.number(),
    // The live HD1 status payload always includes exactly one entry per faction.
    // updateStatus indexes these arrays as fixed 3-faction tuples, so we reject
    // short or oversized payloads at the validator boundary.
    campaign_status: z.array(campaignStatusSchema).length(3),
    defend_event: defendEventSchema.nullable(),
    attack_events: z.array(attackEventSchema),
    statistics: z.array(statisticsSchema).length(3),
});

/**
 * Inferred shape of a validated `get_campaign_status` payload from HD1.
 * Use this typedef downstream of Zod validation instead of typing as `object`.
 *
 * @typedef {import('zod').infer<typeof isValidStatus>} StatusPayload
 */
