import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reseedSeason } from '@/features/archives/reseedSeason';

vi.mock('@/auth', () => ({
    auth: { api: { getSession: vi.fn() } },
}));
vi.mock('next/headers', () => ({
    headers: vi.fn(() => new Headers()),
}));
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}));
vi.mock('@/shared/utils/tryCatch', () => ({
    tryCatch: vi.fn(async (p) => {
        try {
            const data = await p;
            return { data, error: null };
        } catch (e) {
            return { data: null, error: e };
        }
    }),
}));
vi.mock('@/db/queries/fetchAndSeedSeason', () => ({
    fetchAndSeedSeason: vi.fn(),
}));
vi.mock('@/db/db', () => ({
    default: { h1_season: { update: vi.fn() } },
}));

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { fetchAndSeedSeason } from '@/db/queries/fetchAndSeedSeason';
import db from '@/db/db';

const adminSession = { user: { role: 'admin', id: 'admin-1' } };

beforeEach(() => {
    vi.resetAllMocks();
    auth.api.getSession.mockResolvedValue(adminSession);
    fetchAndSeedSeason.mockResolvedValue(undefined);
    db.h1_season.update.mockResolvedValue({ season: 153 });
});

describe('reseedSeason', () => {
    it('returns { error: "Forbidden" } when session is null', async () => {
        auth.api.getSession.mockResolvedValue(null);
        const result = await reseedSeason(153);
        expect(result).toEqual({ error: 'Forbidden' });
        expect(fetchAndSeedSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Forbidden" } when user is not admin', async () => {
        auth.api.getSession.mockResolvedValue({ user: { role: 'user', id: 'u-1' } });
        const result = await reseedSeason(153);
        expect(result).toEqual({ error: 'Forbidden' });
        expect(fetchAndSeedSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Invalid season" } for non-integer input', async () => {
        const result = await reseedSeason('abc');
        expect(result.error).toBe('Invalid season');
        expect(fetchAndSeedSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Invalid season" } for zero or negative', async () => {
        const zero = await reseedSeason(0);
        expect(zero.error).toBe('Invalid season');
        const neg = await reseedSeason(-5);
        expect(neg.error).toBe('Invalid season');
        expect(fetchAndSeedSeason).not.toHaveBeenCalled();
    });

    it('calls fetchAndSeedSeason, stamps last_updated, and revalidates on success', async () => {
        const result = await reseedSeason(153);
        expect(fetchAndSeedSeason).toHaveBeenCalledWith(153);
        expect(db.h1_season.update).toHaveBeenCalledWith({
            where: { season: 153 },
            data: { last_updated: expect.any(Date) },
        });
        expect(revalidatePath).toHaveBeenCalledWith('/archives');
        expect(result).toEqual({ ok: true });
    });

    it('surfaces fetchAndSeedSeason errors without stamping or revalidating', async () => {
        fetchAndSeedSeason.mockRejectedValueOnce(new Error('API down'));
        const result = await reseedSeason(153);
        expect(result.error).toBe('API down');
        expect(db.h1_season.update).not.toHaveBeenCalled();
        expect(revalidatePath).not.toHaveBeenCalled();
    });

    it('surfaces last_updated stamp errors without revalidating', async () => {
        db.h1_season.update.mockRejectedValueOnce(new Error('DB write failed'));
        const result = await reseedSeason(153);
        expect(result.error).toBe('DB write failed');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
