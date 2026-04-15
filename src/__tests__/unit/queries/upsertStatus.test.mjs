import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import { queryUpsertStatus } from '@/db/queries/upsertStatus.mjs';

const baseCampaign = {
    points: 1500,
    points_taken: 500,
    points_max: 30000,
    status: 'active',
    introduction_order: 0,
};

describe('queryUpsertStatus', () => {
    test('throws when season is missing', async () => {
        await expect(queryUpsertStatus(null, 0, 1000, baseCampaign)).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when enemy is undefined', async () => {
        await expect(queryUpsertStatus(5, undefined, 1000, baseCampaign)).rejects.toThrow(
            'enemy is missing',
        );
    });

    test('accepts enemy=0 (falsy but valid)', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await expect(queryUpsertStatus(5, 0, 1000, baseCampaign)).resolves.toBeDefined();
    });

    test('throws when pollTime is missing', async () => {
        await expect(queryUpsertStatus(5, 0, null, baseCampaign)).rejects.toThrow(
            'pollTime is missing',
        );
    });

    test('throws when campaign is missing', async () => {
        await expect(queryUpsertStatus(5, 0, 1000, null)).rejects.toThrow(
            'campaign is missing',
        );
    });

    test('computes bucket from pollTime using default BUCKET_SIZE=900', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 0, 1000, baseCampaign);

        const callArg = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        // floor(1000 / 900) * 900 = 900
        expect(callArg.where.season_enemy_bucket.bucket).toBe(900);
    });

    test('upserts with correct where clause', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 2, 1000, baseCampaign);

        const callArg = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        expect(callArg.where).toEqual({
            season_enemy_bucket: { season: 5, enemy: 2, bucket: 900 },
        });
    });

    test('update path sets time + campaign fields only', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 0, 1000, baseCampaign);

        const callArg = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        expect(callArg.update).toEqual({
            time: 1000,
            points: 1500,
            points_taken: 500,
            status: 'active',
        });
        // points_max is NOT in update — it's a per-season constant on h1_season
        expect(callArg.update).not.toHaveProperty('points_max');
    });

    test('create path sets all columns including bucket', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 1, 1000, baseCampaign);

        const callArg = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        expect(callArg.create).toEqual({
            season: 5,
            enemy: 1,
            bucket: 900,
            time: 1000,
            points: 1500,
            points_taken: 500,
            status: 'active',
        });
    });

    test('same bucket for two polls within the same window', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 0, 1000, baseCampaign);
        await queryUpsertStatus(5, 0, 1500, baseCampaign);

        const call1 = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        const call2 = vi.mocked(db.h1_status.upsert).mock.calls[1][0];
        expect(call1.where.season_enemy_bucket.bucket).toBe(900);
        expect(call2.where.season_enemy_bucket.bucket).toBe(900);
    });

    test('new bucket at window boundary', async () => {
        vi.mocked(db.h1_status.upsert).mockResolvedValue({ id: 'a' });
        await queryUpsertStatus(5, 0, 899, baseCampaign); // bucket 0
        await queryUpsertStatus(5, 0, 900, baseCampaign); // bucket 900

        const call1 = vi.mocked(db.h1_status.upsert).mock.calls[0][0];
        const call2 = vi.mocked(db.h1_status.upsert).mock.calls[1][0];
        expect(call1.where.season_enemy_bucket.bucket).toBe(0);
        expect(call2.where.season_enemy_bucket.bucket).toBe(900);
    });

    test('propagates DB errors', async () => {
        const dbError = new Error('database boom');
        vi.mocked(db.h1_status.upsert).mockRejectedValue(dbError);
        await expect(queryUpsertStatus(5, 0, 1000, baseCampaign)).rejects.toThrow(
            'database boom',
        );
    });
});
