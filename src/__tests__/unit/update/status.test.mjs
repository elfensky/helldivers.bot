import { describe, it, expect, vi } from 'vitest';
import { updateStatus } from '@/update/status.mjs';

// --- Dependency mocks ---

vi.mock('@/update/fetch.mjs', () => ({ fetchStatus: vi.fn() }));
vi.mock('@/validators/isValidStatus', () => ({ isValidStatus: vi.fn() }));
vi.mock('@/shared/utils/getSeason', () => ({ getSeasonFromStatus: vi.fn() }));
vi.mock('@/db/queries/upsertSeason', () => ({ queryUpsertSeason: vi.fn() }));
vi.mock('@/db/queries/upsertEvent', () => ({ queryUpsertEvent: vi.fn() }));
vi.mock('@/db/queries/upsertStatus', () => ({ queryUpsertStatus: vi.fn() }));
vi.mock('@/db/queries/upsertStatistic', () => ({ queryUpsertStatistic: vi.fn() }));
vi.mock('@/db/queries/upsertEventProgress', () => ({
    queryUpsertEventProgress: vi.fn(),
}));

// --- Import mocked modules ---

import { fetchStatus } from '@/update/fetch.mjs';
import { isValidStatus } from '@/validators/isValidStatus';
import { getSeasonFromStatus } from '@/shared/utils/getSeason';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertStatus } from '@/db/queries/upsertStatus';
import { queryUpsertStatistic } from '@/db/queries/upsertStatistic';
import { queryUpsertEventProgress } from '@/db/queries/upsertEventProgress';

// --- Test data ---

const mockFetchedData = {
    time: 1000,
    campaign_status: [
        {
            introduction_order: 0,
            points_max: 100,
            points: 50,
            points_taken: 50,
            status: 'active',
        },
        {
            introduction_order: 1,
            points_max: 200,
            points: 100,
            points_taken: 100,
            status: 'active',
        },
        {
            introduction_order: 2,
            points_max: 300,
            points: 150,
            points_taken: 150,
            status: 'active',
        },
    ],
    statistics: [
        { kills: 100, season_duration: 86400 },
        { kills: 200, season_duration: 86400 },
        { kills: 300, season_duration: 86400 },
    ],
    defend_event: {
        event_id: 1,
        region: 3,
        enemy: 0,
        season: 5,
        status: 'active',
        points: 10,
    },
    attack_events: [{ event_id: 2, enemy: 1, season: 5, status: 'active', points: 20 }],
};

/** Wire up all mocks for a successful run. */
function setupHappyPath() {
    fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
    isValidStatus.mockReturnValue({ success: true });
    getSeasonFromStatus.mockReturnValue(5);
    queryUpsertSeason.mockResolvedValue({});
    queryUpsertEvent.mockResolvedValue({});
    queryUpsertStatus.mockResolvedValue({});
    queryUpsertStatistic.mockResolvedValue({});
    queryUpsertEventProgress.mockResolvedValue({});
}

// --- Tests ---

describe('updateStatus', () => {
    // 1. Throws when fetchStatus fails
    it('throws when fetchStatus rejects', async () => {
        fetchStatus.mockRejectedValue(new Error('network down'));

        await expect(updateStatus()).rejects.toThrow('network down');
    });

    // 2. Throws when validation fails
    it('throws when isValidStatus returns failure', async () => {
        fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
        isValidStatus.mockReturnValue({ success: false, error: { message: 'bad data' } });

        await expect(updateStatus()).rejects.toThrow('bad data');
    });

    // 3. Throws when queryUpsertSeason fails
    it('throws when queryUpsertSeason rejects', async () => {
        fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
        isValidStatus.mockReturnValue({ success: true });
        getSeasonFromStatus.mockReturnValue(5);
        queryUpsertSeason.mockRejectedValue(new Error('season write failed'));

        await expect(updateStatus()).rejects.toThrow('season write failed');
    });

    // 4. Happy path: returns expected shape, calls all dependencies
    it('returns { ms, season, confirmSeason } on success', async () => {
        setupHappyPath();

        const result = await updateStatus();

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.season).toBe(5);
        expect(result).toHaveProperty('confirmSeason');

        // Verify key calls
        expect(fetchStatus).toHaveBeenCalledOnce();
        expect(isValidStatus).toHaveBeenCalledOnce();
        expect(getSeasonFromStatus).toHaveBeenCalledOnce();
        // Season upserted twice: once with arrays (false), once to confirm (true)
        expect(queryUpsertSeason).toHaveBeenCalledTimes(2);
        expect(queryUpsertSeason).toHaveBeenCalledWith(5, false, {
            introOrder: [0, 1, 2],
            pointsMax: [100, 200, 300],
            seasonDuration: 86400,
        });
        expect(queryUpsertSeason).toHaveBeenCalledWith(5, true);
    });

    // 5. Defend event upserted when present
    it('upserts defend event when defend_event exists', async () => {
        setupHappyPath();

        await updateStatus();

        expect(queryUpsertEvent).toHaveBeenCalledWith(
            5,
            'defend',
            expect.objectContaining({ event_id: 1, region: 3, enemy: 0 }),
        );
    });

    // 6. Defend event skipped when null
    it('skips defend event upsert when defend_event is null', async () => {
        setupHappyPath();
        const dataNoDefend = structuredClone(mockFetchedData);
        dataNoDefend.defend_event = null;
        fetchStatus.mockResolvedValue(dataNoDefend);

        await updateStatus();

        // Only attack event upserted, no defend
        const defendCalls = queryUpsertEvent.mock.calls.filter(
            (call) => call[1] === 'defend',
        );
        expect(defendCalls).toHaveLength(0);
    });

    // 7. Attack events get region: 11 added
    it('adds region: 11 to each attack event', async () => {
        setupHappyPath();

        await updateStatus();

        const attackCalls = queryUpsertEvent.mock.calls.filter(
            (call) => call[1] === 'attack',
        );
        expect(attackCalls).toHaveLength(1);
        expect(attackCalls[0][2]).toMatchObject({ event_id: 2, region: 11 });
    });

    // 8. h1_status bucket-upserted for all 3 factions
    it('upserts h1_status for enemy 0, 1, and 2', async () => {
        setupHappyPath();

        await updateStatus();

        expect(queryUpsertStatus).toHaveBeenCalledTimes(3);
        for (let enemy = 0; enemy < 3; enemy++) {
            expect(queryUpsertStatus).toHaveBeenCalledWith(
                5,
                enemy,
                mockFetchedData.time,
                mockFetchedData.campaign_status[enemy],
            );
        }
    });

    // 9. h1_statistic bucket-upserted for all 3 factions
    it('upserts h1_statistic for enemy 0, 1, and 2', async () => {
        setupHappyPath();

        await updateStatus();

        expect(queryUpsertStatistic).toHaveBeenCalledTimes(3);
        for (let enemy = 0; enemy < 3; enemy++) {
            expect(queryUpsertStatistic).toHaveBeenCalledWith(
                5,
                enemy,
                mockFetchedData.time,
                mockFetchedData.statistics[enemy],
            );
        }
    });

    // 10. h1_event_progress upserted for active defend event + attack events
    it('upserts h1_event_progress for defend and attack events in current season', async () => {
        setupHappyPath();

        await updateStatus();

        // 1 defend + 1 attack in current season
        expect(queryUpsertEventProgress).toHaveBeenCalledTimes(2);
        expect(queryUpsertEventProgress).toHaveBeenCalledWith(
            'defend',
            expect.objectContaining({ event_id: 1 }),
            mockFetchedData.time,
        );
        expect(queryUpsertEventProgress).toHaveBeenCalledWith(
            'attack',
            expect.objectContaining({ event_id: 2 }),
            mockFetchedData.time,
        );
    });

    // 11. h1_event_progress skipped for lagged cross-season events
    it('skips h1_event_progress for attack events from a different season', async () => {
        setupHappyPath();
        const laggedData = structuredClone(mockFetchedData);
        laggedData.attack_events = [
            { event_id: 9, enemy: 1, season: 4, status: 'active', points: 30 },
        ];
        fetchStatus.mockResolvedValue(laggedData);

        await updateStatus();

        // Only the defend event progress call — attack skipped because season mismatch
        const attackProgCalls = queryUpsertEventProgress.mock.calls.filter(
            (call) => call[0] === 'attack',
        );
        expect(attackProgCalls).toHaveLength(0);
    });
});
