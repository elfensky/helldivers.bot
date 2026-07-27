import { describe, test, expect, vi, beforeEach } from 'vitest';
import db from '@/db/db';
import { getCrossSeasonStats } from '@/db/queries/getCrossSeasonStats.mjs';

// getCrossSeasonStats is wrapped in React's cache(); the global db mock from
// vitest.setup.mjs handles the underlying queries transparently. We feed
// each of the 5 $queryRaw calls with `mockResolvedValueOnce` in source-order:
//   1) per-season event aggregates
//   2) per-faction event totals (Threat Ranking)
//   3) per-season telemetry sums (latest-bucket-per-enemy summed)
//   4) per-season final faction states (DISTINCT ON season,enemy)
//   5) seasons where any bucket showed all-3-defeated

beforeEach(() => {
    vi.mocked(db.$queryRaw).mockReset();
    vi.mocked(db.h1_season.findMany).mockReset();
    vi.mocked(db.h1_event.findMany).mockReset();
});

function seed({
    eventAggs = [],
    factionTotals = [],
    seasons = [],
    telemetry = [],
    allEvents = [],
    finalStates = [],
    defeatedSeasonRows = [],
} = {}) {
    vi.mocked(db.$queryRaw)
        .mockResolvedValueOnce(eventAggs)
        .mockResolvedValueOnce(factionTotals)
        .mockResolvedValueOnce(telemetry)
        .mockResolvedValueOnce(finalStates)
        .mockResolvedValueOnce(defeatedSeasonRows);
    vi.mocked(db.h1_season.findMany).mockResolvedValue(seasons);
    vi.mocked(db.h1_event.findMany).mockResolvedValue(allEvents);
}

describe('getCrossSeasonStats', () => {
    test('returns empty arrays when there are no seasons', async () => {
        seed({});
        const r = await getCrossSeasonStats();
        expect(r.perSeason).toEqual([]);
        expect(r.factionTotals).toEqual([]);
    });

    test('builds a per-season row from h1_season + event aggregates + season_duration', async () => {
        seed({
            eventAggs: [
                {
                    season: 1,
                    events: 4,
                    defends: 1,
                    defend_wins: 1,
                    attacks: 3,
                    attack_wins: 3,
                    avg_event_duration: 3600,
                },
            ],
            seasons: [{ season: 1, season_duration: 432000 }],
        });
        const r = await getCrossSeasonStats();
        expect(r.perSeason).toHaveLength(1);
        expect(r.perSeason[0]).toMatchObject({
            season: 1,
            season_duration: 432000,
            events: 4,
            defends: 1,
            defend_wins: 1,
            attacks: 3,
            attack_wins: 3,
            avg_event_duration: 3600,
        });
    });

    test('passes per-faction totals through for the Threat Ranking', async () => {
        seed({
            factionTotals: [
                { enemy: 0, defends: 10, defend_wins: 5, attacks: 8, attack_wins: 6 },
                { enemy: 1, defends: 12, defend_wins: 8, attacks: 6, attack_wins: 3 },
                { enemy: 2, defends: 15, defend_wins: 7, attacks: 5, attack_wins: 5 },
            ],
            seasons: [{ season: 1, season_duration: 0 }],
        });
        const r = await getCrossSeasonStats();
        expect(r.factionTotals).toEqual([
            { enemy: 0, defends: 10, defend_wins: 5, attacks: 8, attack_wins: 6 },
            { enemy: 1, defends: 12, defend_wins: 8, attacks: 6, attack_wins: 3 },
            { enemy: 2, defends: 15, defend_wins: 7, attacks: 5, attack_wins: 5 },
        ]);
    });

    test('derives outcome=victory when all 3 final faction states are defeated', async () => {
        seed({
            seasons: [{ season: 1, season_duration: 0 }],
            allEvents: [
                {
                    season: 1,
                    type: 'attack',
                    status: 'success',
                    region: 5,
                    enemy: 0,
                    end_time: 100,
                    start_time: 50,
                },
                {
                    season: 1,
                    type: 'attack',
                    status: 'success',
                    region: 5,
                    enemy: 1,
                    end_time: 200,
                    start_time: 150,
                },
                {
                    season: 1,
                    type: 'attack',
                    status: 'success',
                    region: 5,
                    enemy: 2,
                    end_time: 300,
                    start_time: 250,
                },
            ],
            finalStates: [
                {
                    season: 1,
                    enemy: 0,
                    status: 'defeated',
                    points: 100,
                    points_taken: 100,
                },
                {
                    season: 1,
                    enemy: 1,
                    status: 'defeated',
                    points: 100,
                    points_taken: 100,
                },
                {
                    season: 1,
                    enemy: 2,
                    status: 'defeated',
                    points: 100,
                    points_taken: 100,
                },
            ],
        });
        const r = await getCrossSeasonStats();
        expect(r.perSeason[0].outcome).toBe('victory');
        // Victory faction = last conquered (enemy of last attack-success by end_time)
        expect(r.perSeason[0].outcome_faction).toBe(2);
    });

    test('derives outcome=defeat when the last r0 defend failed and no victory signal fires', async () => {
        seed({
            seasons: [{ season: 2, season_duration: 0 }],
            allEvents: [
                {
                    season: 2,
                    type: 'defend',
                    status: 'fail',
                    region: 0,
                    enemy: 1,
                    end_time: 500,
                    start_time: 400,
                },
            ],
            finalStates: [
                { season: 2, enemy: 0, status: 'active', points: 50, points_taken: 20 },
                { season: 2, enemy: 1, status: 'active', points: 80, points_taken: 30 },
                { season: 2, enemy: 2, status: 'hidden', points: 0, points_taken: 0 },
            ],
        });
        const r = await getCrossSeasonStats();
        expect(r.perSeason[0].outcome).toBe('defeat');
        expect(r.perSeason[0].outcome_faction).toBe(1);
    });

    test('telemetry fields are zero when the season has no h1_statistic row', async () => {
        seed({
            seasons: [{ season: 1, season_duration: 0 }],
            telemetry: [],
        });
        const r = await getCrossSeasonStats();
        expect(r.perSeason[0]).toMatchObject({
            kills: 0n,
            deaths: 0n,
            accidentals: 0n,
            shots: 0n,
            hits: 0n,
            missions: 0,
            successful_missions: 0,
            total_mission_difficulty: 0,
            completed_planets: 0,
        });
    });

    test('telemetry fields flow through when the season has h1_statistic', async () => {
        seed({
            seasons: [{ season: 157, season_duration: 0 }],
            telemetry: [
                {
                    season: 157,
                    kills: 12345678n,
                    deaths: 1000n,
                    accidentals: 50n,
                    shots: 9000000n,
                    hits: 4000000n,
                    missions: 100,
                    successful_missions: 80,
                    total_mission_difficulty: 600,
                    completed_planets: 4,
                },
            ],
        });
        const r = await getCrossSeasonStats();
        expect(r.perSeason[0]).toMatchObject({
            kills: 12345678n,
            deaths: 1000n,
            missions: 100,
            successful_missions: 80,
        });
    });
});
