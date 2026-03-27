import { describe, test, expect, vi } from 'vitest';
import db from '@/db/db';
import {
    queryUpsertRebroadcastStatus,
    queryUpsertRebroadcastSeason,
    queryGetRebroadcastStatus,
    queryGetRebroadcastSeason,
} from '@/db/queries/rebroadcast.mjs';

describe('queryUpsertRebroadcastStatus', () => {
    test('upserts status and returns ms and query', async () => {
        const mockRow = { season: 1, json: { foo: 'bar' } };
        vi.mocked(db.rebroadcast_status.upsert).mockResolvedValue(mockRow);

        const result = await queryUpsertRebroadcastStatus(1, { foo: 'bar' });

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.query).toEqual(mockRow);
        expect(db.rebroadcast_status.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season: 1 },
                update: expect.objectContaining({ season: 1, json: { foo: 'bar' } }),
                create: expect.objectContaining({ season: 1, json: { foo: 'bar' } }),
            }),
        );
    });

    test('throws when season is missing', async () => {
        await expect(queryUpsertRebroadcastStatus(null, {})).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when data is missing', async () => {
        await expect(queryUpsertRebroadcastStatus(1, null)).rejects.toThrow(
            'data is missing',
        );
    });
});

describe('queryUpsertRebroadcastSeason', () => {
    test('upserts snapshot and returns ms and query', async () => {
        const mockRow = { season: 2, json: { status: 'active' } };
        vi.mocked(db.rebroadcast_snapshot.upsert).mockResolvedValue(mockRow);

        const result = await queryUpsertRebroadcastSeason(2, { status: 'active' });

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.query).toEqual(mockRow);
        expect(db.rebroadcast_snapshot.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { season: 2 },
                update: expect.objectContaining({
                    season: 2,
                    json: { status: 'active' },
                }),
                create: expect.objectContaining({
                    season: 2,
                    json: { status: 'active' },
                }),
            }),
        );
    });

    test('throws when season is missing', async () => {
        await expect(queryUpsertRebroadcastSeason(undefined, {})).rejects.toThrow(
            'season is missing',
        );
    });

    test('throws when data is missing', async () => {
        await expect(queryUpsertRebroadcastSeason(1, undefined)).rejects.toThrow(
            'data is missing',
        );
    });
});

describe('queryGetRebroadcastStatus', () => {
    test('returns ms and data from latest status', async () => {
        const mockStatus = {
            season: 5,
            json: { war: 'ongoing' },
            last_updated: new Date(),
        };
        vi.mocked(db.rebroadcast_status.findFirst).mockResolvedValue(mockStatus);

        const result = await queryGetRebroadcastStatus();

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.data).toEqual(mockStatus);
        expect(db.rebroadcast_status.findFirst).toHaveBeenCalledWith({
            orderBy: { last_updated: 'desc' },
        });
    });

    test('returns null data when no status exists', async () => {
        vi.mocked(db.rebroadcast_status.findFirst).mockResolvedValue(null);

        const result = await queryGetRebroadcastStatus();

        expect(result.data).toBeNull();
        expect(result).toHaveProperty('ms');
    });
});

describe('queryGetRebroadcastSeason', () => {
    test('returns ms and data for a specific season', async () => {
        const mockSnapshot = { season: 3, json: { data: 'snapshot' } };
        vi.mocked(db.rebroadcast_snapshot.findUnique).mockResolvedValue(mockSnapshot);

        const result = await queryGetRebroadcastSeason(3);

        expect(result).toHaveProperty('ms');
        expect(typeof result.ms).toBe('number');
        expect(result.data).toEqual(mockSnapshot);
        expect(db.rebroadcast_snapshot.findUnique).toHaveBeenCalledWith({
            where: { season: 3 },
        });
    });

    test('returns null data when season not found', async () => {
        vi.mocked(db.rebroadcast_snapshot.findUnique).mockResolvedValue(null);

        const result = await queryGetRebroadcastSeason(999);

        expect(result.data).toBeNull();
    });
});
