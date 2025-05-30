import { z } from 'zod/v4';

const campaignStatusSchema = z.object({
    season: z.number(),
    points: z.number(),
    points_taken: z.number(),
    points_max: z.number(),
    status: z.enum(['active', 'defeated', 'hidden']),
    introduction_order: z.number(),
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
    status: z.enum(['active', 'success', 'failure']),
});

const attackEventSchema = z.object({
    season: z.number(),
    event_id: z.number(),
    start_time: z.number(),
    end_time: z.number(),
    enemy: z.number(),
    points_max: z.number(),
    points: z.number(),
    status: z.enum(['active', 'success', 'failure']),
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

const rootSchema = z.object({
    time: z.number(),
    error_code: z.number(),
    campaign_status: z.array(campaignStatusSchema),
    defend_event: defendEventSchema,
    attack_events: z.array(attackEventSchema),
    statistics: z.array(statisticsSchema),
});

export const isValidStatus = (data) => rootSchema.safeParse(data);
