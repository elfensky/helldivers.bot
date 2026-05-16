import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reseedSeason } from '@/features/archives/reseedSeason.mjs';

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
vi.mock('@/update/season', () => ({
    updateSeason: vi.fn(),
}));
vi.mock('@/db/db', () => ({
    default: { h1_season: { findFirst: vi.fn() } },
}));

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { updateSeason } from '@/update/season.mjs';
import db from '@/db/db';

const adminSession = { user: { role: 'admin', id: 'admin-1' } };

beforeEach(() => {
    vi.resetAllMocks();
    auth.api.getSession.mockResolvedValue(adminSession);
    updateSeason.mockResolvedValue(undefined);
});

describe('reseedSeason', () => {
    it('returns errors when session is null', async () => {
        auth.api.getSession.mockResolvedValue(null);
        const result = await reseedSeason(153);
        expect(result.errors).toEqual({ auth: 'Forbidden' });
        expect(result.time).toEqual(expect.any(Number));
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns errors when user is not admin', async () => {
        auth.api.getSession.mockResolvedValue({ user: { role: 'user', id: 'u-1' } });
        const result = await reseedSeason(153);
        expect(result.errors).toEqual({ auth: 'Forbidden' });
        expect(result.time).toEqual(expect.any(Number));
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns errors for non-integer input', async () => {
        const result = await reseedSeason('abc');
        expect(result.errors).toEqual({ season: 'Invalid season' });
        expect(result.time).toEqual(expect.any(Number));
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns errors for zero or negative', async () => {
        const zero = await reseedSeason(0);
        expect(zero.errors).toEqual({ season: 'Invalid season' });
        expect(zero.time).toEqual(expect.any(Number));
        const neg = await reseedSeason(-5);
        expect(neg.errors).toEqual({ season: 'Invalid season' });
        expect(neg.time).toEqual(expect.any(Number));
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('calls updateSeason and revalidates on success', async () => {
        // DB returns null for latest season → no protectedBucket → empty opts
        db.h1_season.findFirst.mockResolvedValue(null);
        const result = await reseedSeason(153);
        expect(updateSeason).toHaveBeenCalledWith(153, {});
        expect(revalidatePath).toHaveBeenCalledWith('/archives');
        expect(result.data).toEqual({ ok: true });
        expect(result.time).toEqual(expect.any(Number));
    });

    it('passes protectedBucket when reseeding the current active season', async () => {
        db.h1_season.findFirst.mockResolvedValue({ season: 153 });
        const result = await reseedSeason(153);
        expect(updateSeason).toHaveBeenCalledWith(
            153,
            expect.objectContaining({ protectedBucket: expect.any(Number) }),
        );
        expect(result.data).toEqual({ ok: true });
        expect(result.time).toEqual(expect.any(Number));
    });

    it('does not pass protectedBucket when reseeding an older season', async () => {
        db.h1_season.findFirst.mockResolvedValue({ season: 160 });
        const result = await reseedSeason(153);
        expect(updateSeason).toHaveBeenCalledWith(153, {});
        expect(result.data).toEqual({ ok: true });
        expect(result.time).toEqual(expect.any(Number));
    });

    it('surfaces updateSeason errors without revalidating', async () => {
        updateSeason.mockRejectedValueOnce(new Error('API down'));
        const result = await reseedSeason(153);
        expect(result.errors).toEqual({ season: 'API down' });
        expect(result.time).toEqual(expect.any(Number));
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
