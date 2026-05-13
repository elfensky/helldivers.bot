import { describe, test, expect, vi } from 'vitest';
import { updateSeason } from '@/update/season';

// --- Dependency mocks ---

vi.mock('@/update/fetch', () => ({ fetchSeason: vi.fn() }));
vi.mock('@/validators/isValidSeason', () => ({ isValidSeason: vi.fn() }));
vi.mock('@/shared/utils/getSeason', () => ({ getSeasonFromSnapshot: vi.fn() }));
vi.mock('@/db/queries/upsertSeason', () => ({ queryUpsertSeason: vi.fn() }));
vi.mock('@/db/queries/upsertEvent', () => ({ queryUpsertEvent: vi.fn() }));
vi.mock('@/db/queries/upsertStatus', () => ({ queryUpsertStatus: vi.fn() }));

// --- Import mocked modules ---

import { fetchSeason } from '@/update/fetch';
import { isValidSeason } from '@/validators/isValidSeason';
import { getSeasonFromSnapshot } from '@/shared/utils/getSeason';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';
import { queryUpsertStatus } from '@/db/queries/upsertStatus';

// --- Test data ---

const SEASON = 5;

// Each snapshot.data is a stringified JSON array of 3 faction entries (by enemy).
const FRAME_ONE = JSON.stringify([
    { points: 10, points_taken: 1, status: 'active' },
    { points: 20, points_taken: 2, status: 'active' },
    { points: 30, points_taken: 3, status: 'active' },
]);
const FRAME_TWO = JSON.stringify([
    { points: 15, points_taken: 5, status: 'active' },
    { points: 25, points_taken: 6, status: 'active' },
    { points: 35, points_taken: 7, status: 'defeated' },
]);

const mockFetchedData = {
    introduction_order: [0, 1, 2],
    points_max: [100, 200, 300],
    snapshots: [
        { season: SEASON, time: 1000, data: FRAME_ONE },
        { season: SEASON, time: 2000, data: FRAME_TWO },
    ],
    defend_events: [{ event_id: 1, region: 3, enemy: 0 }],
    attack_events: [{ event_id: 2, enemy: 1 }],
};

/** Wire up all mocks for a successful run. */
function setupHappyPath() {
    vi.mocked(fetchSeason).mockResolvedValue(structuredClone(mockFetchedData));
    vi.mocked(isValidSeason).mockReturnValue({ success: true });
    vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);
    vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
    vi.mocked(queryUpsertEvent).mockResolvedValue({});
    vi.mocked(queryUpsertStatus).mockResolvedValue({});
}

describe('updateSeason', () => {
    test('throws when season is missing', async () => {
        await expect(updateSeason()).rejects.toThrow('season is missing');
        await expect(updateSeason(0)).rejects.toThrow('season is missing');
        await expect(updateSeason(null)).rejects.toThrow('season is missing');
        await expect(updateSeason(undefined)).rejects.toThrow('season is missing');
    });

    test('throws when fetchSeason fails', async () => {
        vi.mocked(fetchSeason).mockRejectedValue(new Error('network error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('network error');
    });

    test('throws when validation fails', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(structuredClone(mockFetchedData));
        vi.mocked(isValidSeason).mockReturnValue({
            success: false,
            error: { issues: [{ message: 'bad' }] },
        });

        await expect(updateSeason(SEASON)).rejects.toBeDefined();
    });

    test('throws when fetched season does not match input season', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(structuredClone(mockFetchedData));
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(99);

        await expect(updateSeason(SEASON)).rejects.toThrow('Invalid season');
    });

    test('throws when queryUpsertSeason fails', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(structuredClone(mockFetchedData));
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);
        vi.mocked(queryUpsertSeason).mockRejectedValue(new Error('db season error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('db season error');
    });

    test('throws when defend event upsert fails', async () => {
        setupHappyPath();
        vi.mocked(queryUpsertEvent).mockRejectedValue(new Error('defend event error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('defend event error');
    });

    test('throws when attack event upsert fails', async () => {
        setupHappyPath();
        // Defend events succeed, attack events fail
        vi.mocked(queryUpsertEvent)
            .mockResolvedValueOnce({}) // defend event
            .mockRejectedValueOnce(new Error('attack event error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('attack event error');
    });

    test('happy path: calls all functions in correct order and returns result', async () => {
        setupHappyPath();
        const confirmResult = { id: 1, season: SEASON };
        vi.mocked(queryUpsertSeason).mockResolvedValue(confirmResult);

        const result = await updateSeason(SEASON);

        // 1. fetch
        expect(fetchSeason).toHaveBeenCalledWith(SEASON);

        // 2. validate
        expect(isValidSeason).toHaveBeenCalled();

        // 3. season check
        expect(getSeasonFromSnapshot).toHaveBeenCalled();

        // 4. season upserted twice: once with arrays (false), once to confirm (true)
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, false, {
            introOrder: [0, 1, 2],
            pointsMax: [100, 200, 300],
        });
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, true);

        // 5. h1_status bucket-upserted: 2 frames x 3 factions = 6 calls
        expect(queryUpsertStatus).toHaveBeenCalledTimes(6);

        // 6. defend events
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'defend', {
            event_id: 1,
            region: 3,
            enemy: 0,
        });

        // 7. attack events with region: 11
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'attack', {
            event_id: 2,
            enemy: 1,
            region: 11,
        });

        // Return value
        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.season).toBe(SEASON);
        expect(result.confirmSeason).toEqual(confirmResult);
    });

    test('parses stringified snapshot data and upserts h1_status per frame per faction', async () => {
        setupHappyPath();

        await updateSeason(SEASON);

        // Frame 1 @ time 1000 — enemy 0,1,2
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 0, 1000, {
            points: 10,
            points_taken: 1,
            status: 'active',
        });
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 1, 1000, {
            points: 20,
            points_taken: 2,
            status: 'active',
        });
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 2, 1000, {
            points: 30,
            points_taken: 3,
            status: 'active',
        });

        // Frame 2 @ time 2000 — enemy 0,1,2
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 0, 2000, {
            points: 15,
            points_taken: 5,
            status: 'active',
        });
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 1, 2000, {
            points: 25,
            points_taken: 6,
            status: 'active',
        });
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 2, 2000, {
            points: 35,
            points_taken: 7,
            status: 'defeated',
        });
    });

    test('accepts already-parsed snapshot data (non-stringified)', async () => {
        const parsedData = {
            ...mockFetchedData,
            snapshots: [
                {
                    season: SEASON,
                    time: 5000,
                    data: [
                        { points: 1, points_taken: 1, status: 'active' },
                        { points: 2, points_taken: 2, status: 'active' },
                        { points: 3, points_taken: 3, status: 'active' },
                    ],
                },
            ],
        };
        vi.mocked(fetchSeason).mockResolvedValue(parsedData);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);

        vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
        vi.mocked(queryUpsertEvent).mockResolvedValue({});
        vi.mocked(queryUpsertStatus).mockResolvedValue({});

        await updateSeason(SEASON);

        expect(queryUpsertStatus).toHaveBeenCalledTimes(3);
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 0, 5000, {
            points: 1,
            points_taken: 1,
            status: 'active',
        });
    });

    test('skips snapshot frames whose parsed data is not a 3-element array', async () => {
        const malformedData = {
            ...mockFetchedData,
            snapshots: [
                // Object instead of array — skip
                { season: SEASON, time: 1000, data: JSON.stringify({ foo: 'bar' }) },
                // Array with wrong length — skip
                {
                    season: SEASON,
                    time: 2000,
                    data: JSON.stringify([{ points: 1 }]),
                },
                // Valid frame — process
                {
                    season: SEASON,
                    time: 3000,
                    data: JSON.stringify([
                        { points: 1, points_taken: 1, status: 'active' },
                        { points: 2, points_taken: 2, status: 'active' },
                        { points: 3, points_taken: 3, status: 'active' },
                    ]),
                },
            ],
        };
        vi.mocked(fetchSeason).mockResolvedValue(malformedData);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);

        vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
        vi.mocked(queryUpsertEvent).mockResolvedValue({});
        vi.mocked(queryUpsertStatus).mockResolvedValue({});

        await updateSeason(SEASON);

        // Only the 3rd (valid) frame emits 3 upserts
        expect(queryUpsertStatus).toHaveBeenCalledTimes(3);
        expect(queryUpsertStatus).toHaveBeenCalledWith(
            SEASON,
            0,
            3000,
            expect.objectContaining({ points: 1 }),
        );
    });

    test('logs status upsert errors but does not throw', async () => {
        setupHappyPath();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(queryUpsertStatus).mockRejectedValue(new Error('status failed'));

        // Should not throw — status errors are logged and skipped
        await expect(updateSeason(SEASON)).resolves.toBeDefined();
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
    });

    // --- protectedBucket tests ---
    // Default BUCKET_SIZE = 900. Test data times: 1000 (bucket 900), 2000 (bucket 1800).

    test('protectedBucket skips snapshots in or after the protected bucket', async () => {
        setupHappyPath();

        // Protect bucket 1800 — frame 2 (time 2000, bucket 1800) should be skipped
        await updateSeason(SEASON, { protectedBucket: 1800 });

        // Only frame 1 (time 1000, bucket 900) should produce 3 upserts
        expect(queryUpsertStatus).toHaveBeenCalledTimes(3);
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 0, 1000, expect.anything());
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 1, 1000, expect.anything());
        expect(queryUpsertStatus).toHaveBeenCalledWith(SEASON, 2, 1000, expect.anything());
    });

    test('protectedBucket skips all snapshots when all are in or after the protected bucket', async () => {
        setupHappyPath();

        // Protect bucket 900 — both frames (buckets 900, 1800) should be skipped
        await updateSeason(SEASON, { protectedBucket: 900 });

        expect(queryUpsertStatus).not.toHaveBeenCalled();
    });

    test('no protectedBucket writes all snapshots (existing behavior)', async () => {
        setupHappyPath();

        await updateSeason(SEASON);

        // 2 frames x 3 factions = 6
        expect(queryUpsertStatus).toHaveBeenCalledTimes(6);
    });

    test('protectedBucket does not affect events or season upserts', async () => {
        setupHappyPath();

        await updateSeason(SEASON, { protectedBucket: 900 });

        // All snapshots skipped, but events and season still written
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, false, expect.anything());
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, true);
        expect(queryUpsertEvent).toHaveBeenCalledTimes(2); // 1 defend + 1 attack
    });

    test('attack events get region: 11 added', async () => {
        const dataWithMultipleAttacks = {
            ...mockFetchedData,
            attack_events: [
                { event_id: 10, enemy: 1 },
                { event_id: 11, enemy: 2, someField: 'value' },
            ],
        };
        vi.mocked(fetchSeason).mockResolvedValue(dataWithMultipleAttacks);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);

        vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
        vi.mocked(queryUpsertEvent).mockResolvedValue({});
        vi.mocked(queryUpsertStatus).mockResolvedValue({});

        await updateSeason(SEASON);

        // Defend event keeps its original region
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'defend', {
            event_id: 1,
            region: 3,
            enemy: 0,
        });

        // Attack events all get region: 11
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'attack', {
            event_id: 10,
            enemy: 1,
            region: 11,
        });
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'attack', {
            event_id: 11,
            enemy: 2,
            someField: 'value',
            region: 11,
        });
    });
});
