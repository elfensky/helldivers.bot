'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performanceTime } from '@/shared/utils/time';
import { revalidatePath } from 'next/cache';
import { computeWorkerHealth } from '@/shared/utils/admin/computeWorkerHealth';

/**
 * Verify the current request is from an authenticated admin user.
 * @returns {Promise<{ user: object } | { error: string }>} User object or error message
 */
async function requireAdmin() {
    if (!auth) return { error: 'Auth not configured' };
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
                accounts: { select: { providerId: true } },
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
        userId: z.string().min(1),
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

    // Last-admin protection: block demotion if this is the only admin
    if (formValues.newRole === 'user') {
        const { data: adminCount, error: countError } = await tryCatch(
            db.user.count({ where: { role: 'admin' } }),
        );
        if (countError) throw countError;

        if (adminCount === 1) {
            return {
                errors: { auth: 'Cannot demote the last admin' },
                time: performanceTime(start),
            };
        }
    }

    const { data: updated, error } = await tryCatch(
        db.user.update({
            where: { id: formValues.userId },
            data: { role: formValues.newRole },
        }),
    );
    if (error) throw error;

    revalidatePath('/profile', 'layout');
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
        userId: z.string().min(1),
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

    // Last-admin protection: block banning the only remaining admin
    if (check.data.banned === true) {
        const { data: target, error: targetError } = await tryCatch(
            db.user.findUnique({
                where: { id: check.data.userId },
                select: { role: true },
            }),
        );
        if (targetError) throw targetError;

        if (target?.role === 'admin') {
            const { data: adminCount, error: countError } = await tryCatch(
                db.user.count({ where: { role: 'admin' } }),
            );
            if (countError) throw countError;

            if (adminCount === 1) {
                return {
                    errors: { auth: 'Cannot ban the last admin' },
                    time: performanceTime(start),
                };
            }
        }
    }

    const { data: updated, error } = await tryCatch(
        db.user.update({
            where: { id: check.data.userId },
            data: { banned: check.data.banned },
        }),
    );
    if (error) throw error;

    revalidatePath('/profile', 'layout');
    return { data: updated, time: performanceTime(start) };
}

export async function adminGetUserApiKeys(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const userId = formData.get('userId');
    const schema = z.string().min(1);
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
    const schema = z.string().min(1);
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

    revalidatePath('/profile', 'layout');
    return { data: deleted, time: performanceTime(start) };
}

export async function getSystemStats() {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    // Step 1: Get current season (needed for active factions query)
    const { data: latestSeason, error: seasonError } = await tryCatch(
        db.h1_season.findFirst({ orderBy: { season: 'desc' }, select: { season: true } }),
    );
    if (seasonError) throw seasonError;

    const currentSeason = latestSeason?.season ?? null;

    // Step 2: All remaining queries in parallel
    const { data: results, error } = await tryCatch(
        Promise.all([
            db.worker_heartbeat.findUnique({ where: { worker_type: 'cron_api_poller' } }),
            currentSeason ?
                db.h1_live.count({ where: { status: 'active', season: currentSeason } })
            :   Promise.resolve(0),
            db.h1_event.count(),
            db.h1_season.count(),
            db.user.count(),
            db.ApiKey.count(),
            db.push_subscription.count(),
        ]),
    );
    if (error) throw error;

    const [
        heartbeat,
        activeFactions,
        totalEvents,
        seasonsStored,
        totalUsers,
        totalApiKeys,
        pushSubscribers,
    ] = results;

    return {
        data: {
            heartbeat,
            workerHealth: computeWorkerHealth(heartbeat),
            currentSeason,
            activeFactions,
            totalEvents,
            seasonsStored,
            totalUsers,
            totalApiKeys,
            pushSubscribers,
        },
        time: performanceTime(start),
    };
}

export async function getAllApiKeys() {
    const start = performance.now();
    const { user, error: authError } = await requireAdmin();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: keys, error } = await tryCatch(
        db.ApiKey.findMany({
            select: {
                id: true,
                description: true,
                visible: true,
                enabled: true,
                createdAt: true,
                user: { select: { email: true } },
            },
            orderBy: { createdAt: 'desc' },
        }),
    );
    if (error) throw error;

    return { data: keys, time: performanceTime(start) };
}
