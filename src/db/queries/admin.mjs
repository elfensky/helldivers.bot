'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performanceTime } from '@/shared/utils/time';
import { revalidatePath } from 'next/cache';

async function requireAdmin() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user) return { error: 'Not authenticated' };
    if (session.user.role !== 'admin') return { error: 'Forbidden' };
    return { user: session.user };
}

export async function getAllUsers() {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: users, error } = await tryCatch(
        db.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                image: true,
                role: true,
                banned: true,
                createdAt: true,
                _count: { select: { apiKeys: true } },
            },
        }),
    );
    if (error) throw error;

    return { data: users, time: performanceTime(start) };
}

export async function updateUserRole(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        newRole: formData.get('newRole'),
    };

    const schema = z.object({
        userId: z.string().uuid(),
        newRole: z.enum(['user', 'admin']),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            time: performanceTime(start),
        };
    }

    if (user.id === formValues.userId) {
        return {
            errors: { auth: 'Cannot change your own role' },
            time: performanceTime(start),
        };
    }

    const { data: updated, error } = await tryCatch(
        db.user.update({
            where: { id: formValues.userId },
            data: { role: formValues.newRole },
        }),
    );
    if (error) throw error;

    revalidatePath('/profile/admin');
    return { data: updated, time: performanceTime(start) };
}

export async function toggleUserBan(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        banned: formData.get('banned'),
    };

    const schema = z.object({
        userId: z.string().uuid(),
        banned: z.enum(['true', 'false']).transform((v) => v === 'true'),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            time: performanceTime(start),
        };
    }

    if (user.id === check.data.userId) {
        return {
            errors: { auth: 'Cannot ban your own account' },
            time: performanceTime(start),
        };
    }

    const { data: updated, error } = await tryCatch(
        db.user.update({
            where: { id: check.data.userId },
            data: { banned: check.data.banned },
        }),
    );
    if (error) throw error;

    revalidatePath('/profile/admin');
    return { data: updated, time: performanceTime(start) };
}

export async function adminGetUserApiKeys(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const userId = formData.get('userId');
    const schema = z.string().uuid();
    const check = schema.safeParse(userId);
    if (!check.success) {
        return { errors: { userId: 'Invalid user ID' }, time: performanceTime(start) };
    }

    const { data: keys, error } = await tryCatch(
        db.ApiKey.findMany({
            where: { userId },
            select: {
                id: true,
                description: true,
                visible: true,
                createdAt: true,
                enabled: true,
            },
        }),
    );
    if (error) throw error;

    return { data: keys, time: performanceTime(start) };
}

export async function adminRevokeApiKey(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const apikeyId = formData.get('apikeyId');
    const schema = z.string().uuid();
    const check = schema.safeParse(apikeyId);
    if (!check.success) {
        return {
            errors: { apikeyId: 'Invalid API key ID' },
            time: performanceTime(start),
        };
    }

    const { data: deleted, error } = await tryCatch(
        db.ApiKey.delete({ where: { id: apikeyId } }),
    );
    if (error) throw error;

    revalidatePath('/profile/admin');
    return { data: deleted, time: performanceTime(start) };
}

export async function getSystemStats() {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: results, error } = await tryCatch(
        Promise.all([
            db.user.count(),
            db.ApiKey.count(),
            db.h1_season.findFirst({
                orderBy: { last_updated: 'desc' },
                select: { last_updated: true },
            }),
        ]),
    );
    if (error) throw error;

    const [totalUsers, totalApiKeys, latestSeason] = results;
    const lastPollTime = latestSeason?.last_updated ?? null;
    const workerHealthy =
        lastPollTime ? Date.now() - new Date(lastPollTime).getTime() < 60000 : false;

    return {
        data: { totalUsers, totalApiKeys, lastPollTime, workerHealthy },
        time: performanceTime(start),
    };
}
