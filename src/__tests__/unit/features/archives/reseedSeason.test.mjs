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
vi.mock('@/update/season', () => ({
    updateSeason: vi.fn(),
}));

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { updateSeason } from '@/update/season';

const adminSession = { user: { role: 'admin', id: 'admin-1' } };

beforeEach(() => {
    vi.resetAllMocks();
    auth.api.getSession.mockResolvedValue(adminSession);
    updateSeason.mockResolvedValue(undefined);
});

describe('reseedSeason', () => {
    it('returns { error: "Forbidden" } when session is null', async () => {
        auth.api.getSession.mockResolvedValue(null);
        const result = await reseedSeason(153);
        expect(result).toEqual({ error: 'Forbidden' });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Forbidden" } when user is not admin', async () => {
        auth.api.getSession.mockResolvedValue({ user: { role: 'user', id: 'u-1' } });
        const result = await reseedSeason(153);
        expect(result).toEqual({ error: 'Forbidden' });
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Invalid season" } for non-integer input', async () => {
        const result = await reseedSeason('abc');
        expect(result.error).toBe('Invalid season');
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('returns { error: "Invalid season" } for zero or negative', async () => {
        const zero = await reseedSeason(0);
        expect(zero.error).toBe('Invalid season');
        const neg = await reseedSeason(-5);
        expect(neg.error).toBe('Invalid season');
        expect(updateSeason).not.toHaveBeenCalled();
    });

    it('calls updateSeason and revalidates on success', async () => {
        const result = await reseedSeason(153);
        // updateSeason stamps last_updated internally via queryUpsertSeason(season, true),
        // so reseedSeason no longer does the manual stamp itself.
        expect(updateSeason).toHaveBeenCalledWith(153);
        expect(revalidatePath).toHaveBeenCalledWith('/archives');
        expect(result).toEqual({ ok: true });
    });

    it('surfaces updateSeason errors without revalidating', async () => {
        updateSeason.mockRejectedValueOnce(new Error('API down'));
        const result = await reseedSeason(153);
        expect(result.error).toBe('API down');
        expect(revalidatePath).not.toHaveBeenCalled();
    });
});
