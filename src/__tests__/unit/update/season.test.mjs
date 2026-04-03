import { vi } from 'vitest';
import { updateSeason } from '@/update/season';
import { fetchSeason } from '@/update/fetch';
import { isValidSeason } from '@/validators/isValidSeason';
import { getSeasonFromSnapshot } from '@/utils/getSeason';
import { queryUpsertRebroadcastSeason } from '@/db/queries/rebroadcast';
import { queryUpsertSeason } from '@/db/queries/upsertSeason';
import { queryUpsertIntroductionOrder } from '@/db/queries/upsertIntroductionOrder';
import { queryUpsertPointsMax } from '@/db/queries/upsertPointsMax';
import { queryUpsertSnapshots } from '@/db/queries/upsertSnapshots';
import { queryUpsertEvent } from '@/db/queries/upsertEvent';

vi.mock('@/update/fetch', () => ({ fetchSeason: vi.fn() }));
vi.mock('@/validators/isValidSeason', () => ({ isValidSeason: vi.fn() }));
vi.mock('@/utils/getSeason', () => ({ getSeasonFromSnapshot: vi.fn() }));
vi.mock('@/db/queries/rebroadcast', () => ({ queryUpsertRebroadcastSeason: vi.fn() }));
vi.mock('@/db/queries/upsertSeason', () => ({ queryUpsertSeason: vi.fn() }));
vi.mock('@/db/queries/upsertIntroductionOrder', () => ({
    queryUpsertIntroductionOrder: vi.fn(),
}));
vi.mock('@/db/queries/upsertPointsMax', () => ({ queryUpsertPointsMax: vi.fn() }));
vi.mock('@/db/queries/upsertSnapshots', () => ({ queryUpsertSnapshots: vi.fn() }));
vi.mock('@/db/queries/upsertEvent', () => ({ queryUpsertEvent: vi.fn() }));

const SEASON = 5;

const mockFetchedData = {
    introduction_order: [0, 1, 2],
    points_max: [100, 200, 300],
    snapshots: [{ time: 1000, data: {} }],
    defend_events: [{ event_id: 1, region: 3, enemy: 0 }],
    attack_events: [{ event_id: 2, enemy: 1 }],
};

function setupHappyPath() {
    vi.mocked(fetchSeason).mockResolvedValue(mockFetchedData);
    vi.mocked(isValidSeason).mockReturnValue({ success: true });
    vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);
    vi.mocked(queryUpsertRebroadcastSeason).mockResolvedValue({});
    vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
    vi.mocked(queryUpsertIntroductionOrder).mockResolvedValue({});
    vi.mocked(queryUpsertPointsMax).mockResolvedValue({});
    vi.mocked(queryUpsertSnapshots).mockResolvedValue({});
    vi.mocked(queryUpsertEvent).mockResolvedValue({});
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
        vi.mocked(fetchSeason).mockResolvedValue(mockFetchedData);
        vi.mocked(isValidSeason).mockReturnValue({
            success: false,
            error: { issues: [{ message: 'bad' }] },
        });

        await expect(updateSeason(SEASON)).rejects.toBeDefined();
    });

    test('throws when fetched season does not match input season', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockFetchedData);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(99);

        await expect(updateSeason(SEASON)).rejects.toThrow('Invalid season');
    });

    test('throws when rebroadcast upsert fails', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockFetchedData);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);
        vi.mocked(queryUpsertRebroadcastSeason).mockRejectedValue(
            new Error('db rebroadcast error'),
        );

        await expect(updateSeason(SEASON)).rejects.toThrow('db rebroadcast error');
    });

    test('throws when queryUpsertSeason fails', async () => {
        vi.mocked(fetchSeason).mockResolvedValue(mockFetchedData);
        vi.mocked(isValidSeason).mockReturnValue({ success: true });
        vi.mocked(getSeasonFromSnapshot).mockReturnValue(SEASON);
        vi.mocked(queryUpsertRebroadcastSeason).mockResolvedValue({});
        vi.mocked(queryUpsertSeason).mockRejectedValue(new Error('db season error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('db season error');
    });

    test('throws when parallel upsert for introductionOrder fails', async () => {
        setupHappyPath();
        vi.mocked(queryUpsertIntroductionOrder).mockRejectedValue(
            new Error('intro order error'),
        );

        await expect(updateSeason(SEASON)).rejects.toThrow('intro order error');
    });

    test('throws when parallel upsert for pointsMax fails', async () => {
        setupHappyPath();
        vi.mocked(queryUpsertPointsMax).mockRejectedValue(new Error('points max error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('points max error');
    });

    test('throws when parallel upsert for snapshots fails', async () => {
        setupHappyPath();
        vi.mocked(queryUpsertSnapshots).mockRejectedValue(new Error('snapshots error'));

        await expect(updateSeason(SEASON)).rejects.toThrow('snapshots error');
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
        expect(isValidSeason).toHaveBeenCalledWith(mockFetchedData);

        // 3. season check
        expect(getSeasonFromSnapshot).toHaveBeenCalledWith(mockFetchedData);

        // 4. rebroadcast
        expect(queryUpsertRebroadcastSeason).toHaveBeenCalledWith(
            SEASON,
            mockFetchedData,
        );

        // 5.1 create season (first call with false)
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, false);

        // 5.2-5.4 parallel upserts
        expect(queryUpsertIntroductionOrder).toHaveBeenCalledWith(
            SEASON,
            mockFetchedData.introduction_order,
        );
        expect(queryUpsertPointsMax).toHaveBeenCalledWith(
            SEASON,
            mockFetchedData.points_max,
        );
        expect(queryUpsertSnapshots).toHaveBeenCalledWith(
            SEASON,
            mockFetchedData.snapshots,
        );

        // 5.5 defend events
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'defend', {
            event_id: 1,
            region: 3,
            enemy: 0,
        });

        // 5.6 attack events with region: 11
        expect(queryUpsertEvent).toHaveBeenCalledWith(SEASON, 'attack', {
            event_id: 2,
            enemy: 1,
            region: 11,
        });

        // 6. confirm season (second call with true)
        expect(queryUpsertSeason).toHaveBeenCalledWith(SEASON, true);

        // Return value
        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.season).toBe(SEASON);
        expect(result.confirmSeason).toEqual(confirmResult);
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
        vi.mocked(queryUpsertRebroadcastSeason).mockResolvedValue({});
        vi.mocked(queryUpsertSeason).mockResolvedValue({ id: 1, season: SEASON });
        vi.mocked(queryUpsertIntroductionOrder).mockResolvedValue({});
        vi.mocked(queryUpsertPointsMax).mockResolvedValue({});
        vi.mocked(queryUpsertSnapshots).mockResolvedValue({});
        vi.mocked(queryUpsertEvent).mockResolvedValue({});

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
