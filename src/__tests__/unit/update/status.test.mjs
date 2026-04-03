import { describe, it, expect, vi } from 'vitest';
import { updateStatus } from '@/update/status.mjs';

// --- Dependency mocks ---

vi.mock('@/update/fetch.mjs', () => ({ fetchStatus: vi.fn() }));
vi.mock('@/validators/isValidStatus', () => ({ isValidStatus: vi.fn() }));
vi.mock('@/utils/getSeason', () => ({ getSeasonFromStatus: vi.fn() }));
vi.mock('@/db/queries/rebroadcast', () => ({ queryUpsertRebroadcastStatus: vi.fn() }));
vi.mock('@/db/queries/upsertSeason', () => ({ queryUpsertSeason: vi.fn() }));
vi.mock('@/db/queries/upsertEvent', () => ({ queryUpsertEvent: vi.fn() }));
vi.mock('@/db/queries/upsertLive', () => ({ queryUpsertLive: vi.fn() }));
vi.mock('@/db/queries/upsertIntroductionOrder', () => ({
    queryUpsertIntroductionOrder: vi.fn(),
}));
vi.mock('@/db/queries/upsertPointsMax', () => ({ queryUpsertPointsMax: vi.fn() }));
vi.mock('@/db/queries/createLiveSnapshots', () => ({
    queryCreateLiveSnapshots: vi.fn(),
}));
vi.mock('@/db/queries/createEventSnapshots', () => ({
    queryCreateEventSnapshot: vi.fn(),
}));
vi.mock('@/update/snapshotTimers', () => ({
    shouldTakeLiveSnapshot: vi.fn(),
    recordLiveSnapshotTime: vi.fn(),
    shouldTakeEventSnapshot: vi.fn(),
    recordEventSnapshotTime: vi.fn(),
}));
vi.mock('@/enums/map', () => ({
    default: {
        0: { 1: { status: null }, 11: { status: null } },
        1: { 1: { status: null }, 11: { status: null } },
        2: { 1: { status: null }, 11: { status: null } },
    },
}));

// --- Import mocked modules ---

import { fetchStatus } from '@/update/fetch.mjs';
import { isValidStatus } from '@/validators/isValidStatus';
import { getSeasonFromStatus } from '@/utils/getSeason';
import { queryUpsertRebroadcastStatus } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertLive } from '@/db/queries/upsertLive';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax';
import { queryCreateLiveSnapshots } from '@/db/queries/createLiveSnapshots';
import { queryCreateEventSnapshot } from '@/db/queries/createEventSnapshots';
import {
    shouldTakeLiveSnapshot,
    recordLiveSnapshotTime,
    shouldTakeEventSnapshot,
    recordEventSnapshotTime,
} from '@/update/snapshotTimers';

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
    statistics: [{ kills: 100 }, { kills: 200 }, { kills: 300 }],
    defend_event: { event_id: 1, region: 3, enemy: 0, season: 5, status: 'active' },
    attack_events: [{ event_id: 2, enemy: 1, season: 5, status: 'active' }],
};

/** Wire up all mocks for a successful run. */
function setupHappyPath() {
    fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
    isValidStatus.mockReturnValue({ success: true });
    getSeasonFromStatus.mockReturnValue(5);
    queryUpsertRebroadcastStatus.mockResolvedValue({});
    queryUpsertSeason.mockResolvedValue({});
    queryUpsertEvent.mockResolvedValue({});
    queryUpsertLive.mockResolvedValue({});
    queryUpsertIntroductionOrder.mockResolvedValue({});
    queryUpsertPointsMax.mockResolvedValue({});
    queryCreateLiveSnapshots.mockResolvedValue({});
    queryCreateEventSnapshot.mockResolvedValue({});
    shouldTakeLiveSnapshot.mockResolvedValue(false);
    shouldTakeEventSnapshot.mockResolvedValue(false);
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

    // 3. Throws when rebroadcast upsert fails
    it('throws when queryUpsertRebroadcastStatus rejects', async () => {
        fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
        isValidStatus.mockReturnValue({ success: true });
        getSeasonFromStatus.mockReturnValue(5);
        queryUpsertRebroadcastStatus.mockRejectedValue(new Error('db write failed'));

        await expect(updateStatus()).rejects.toThrow('db write failed');
    });

    // 4. Throws when queryUpsertSeason fails
    it('throws when queryUpsertSeason rejects', async () => {
        fetchStatus.mockResolvedValue(structuredClone(mockFetchedData));
        isValidStatus.mockReturnValue({ success: true });
        getSeasonFromStatus.mockReturnValue(5);
        queryUpsertRebroadcastStatus.mockResolvedValue({});
        queryUpsertSeason.mockRejectedValue(new Error('season write failed'));

        await expect(updateStatus()).rejects.toThrow('season write failed');
    });

    // 5. Happy path: returns expected shape, calls all dependencies
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
        expect(queryUpsertRebroadcastStatus).toHaveBeenCalledWith(5, expect.any(Object));
        // Season upserted twice: once with false, once with true
        expect(queryUpsertSeason).toHaveBeenCalledTimes(2);
        expect(queryUpsertSeason).toHaveBeenCalledWith(5, false);
        expect(queryUpsertSeason).toHaveBeenCalledWith(5, true);
    });

    // 6. Defend event upserted when present
    it('upserts defend event when defend_event exists', async () => {
        setupHappyPath();

        await updateStatus();

        expect(queryUpsertEvent).toHaveBeenCalledWith(
            5,
            'defend',
            expect.objectContaining({ event_id: 1, region: 3, enemy: 0 }),
        );
    });

    // 7. Defend event skipped when null
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

    // 8. Attack events get region: 11 added
    it('adds region: 11 to each attack event', async () => {
        setupHappyPath();

        await updateStatus();

        const attackCalls = queryUpsertEvent.mock.calls.filter(
            (call) => call[1] === 'attack',
        );
        expect(attackCalls).toHaveLength(1);
        expect(attackCalls[0][2]).toMatchObject({ event_id: 2, region: 11 });
    });

    // 9. Live upserted for all 3 factions
    it('upserts h1_live for enemy 0, 1, and 2', async () => {
        setupHappyPath();

        await updateStatus();

        expect(queryUpsertLive).toHaveBeenCalledTimes(3);
        // Verify each enemy index
        for (let enemy = 0; enemy < 3; enemy++) {
            expect(queryUpsertLive).toHaveBeenCalledWith(
                5,
                enemy,
                mockFetchedData.campaign_status[enemy],
                mockFetchedData.statistics[enemy],
                expect.any(Object), // factionMap
            );
        }
    });

    // 10. Live snapshot captured when timer says yes
    it('captures live snapshot when shouldTakeLiveSnapshot returns true', async () => {
        setupHappyPath();
        shouldTakeLiveSnapshot.mockResolvedValue(true);

        await updateStatus();

        expect(queryCreateLiveSnapshots).toHaveBeenCalledWith(
            5,
            1000,
            mockFetchedData.statistics,
        );
        expect(recordLiveSnapshotTime).toHaveBeenCalledWith(1000);
    });

    // 11. Live snapshot skipped when timer says no
    it('skips live snapshot when shouldTakeLiveSnapshot returns false', async () => {
        setupHappyPath();
        shouldTakeLiveSnapshot.mockResolvedValue(false);

        await updateStatus();

        expect(queryCreateLiveSnapshots).not.toHaveBeenCalled();
        expect(recordLiveSnapshotTime).not.toHaveBeenCalled();
    });
});
