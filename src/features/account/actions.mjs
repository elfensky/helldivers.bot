'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time.mjs';
import { randomUUID, createHash } from 'crypto';
import { revalidatePath } from 'next/cache';
import { requireSession, requireUser } from '@/shared/utils/api/authGuards.mjs';

// ─── API key management (self-service) ──────────────────────────────

/**
 * Retrieve all API keys for the authenticated user.
 * Auth guard: session must match the requested userId.
 * @param {string} userId - User ID whose keys to retrieve
 */
export async function getApiKeysByUserId(userId) {
    const start = performance.now();
    const { error: authError } = await requireUser(userId);
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: result, error } = await tryCatch(
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

    return { data: result, time: performanceTime(start) };
}

/**
 * Generate a new API key for the authenticated user. Max 5 keys per user.
 * Key is SHA-256 hashed before storage; plaintext shown once at creation.
 * @param {unknown} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and description fields
 */
export async function generateApiKey(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        description: formData.get('description'),
    };

    const schema = z.object({
        userId: z.string().min(1),
        description: z.string().min(3).max(32),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            values: formValues,
            time: performanceTime(start),
        };
    }

    if (user.id !== formValues.userId) {
        return {
            errors: { auth: 'Not authorized' },
            time: performanceTime(start),
        };
    }

    const { data: apiKeyCount, error: countError } = await tryCatch(
        db.ApiKey.count({ where: { userId: formValues.userId } }),
    );
    if (countError) throw countError;

    if (apiKeyCount >= 5) {
        return {
            errors: {
                general: 'You have reached the maximum number of API keys allowed',
            },
            time: performanceTime(start),
        };
    }

    const key = randomUUID();
    const hash = createHash('sha256').update(key).digest('hex');

    const { data: newApiKey, error: createError } = await tryCatch(
        db.ApiKey.create({
            data: {
                userId: formValues.userId,
                description: formValues.description,
                createdAt: new Date(),
                hash,
                visible: key.slice(-4),
            },
        }),
    );
    if (createError) throw createError;

    newApiKey['key'] = key;

    revalidatePath('/profile', 'layout');
    return { data: newApiKey, time: performanceTime(start) };
}

/**
 * Delete an API key owned by the authenticated user.
 * @param {unknown} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and apikeyId fields
 */
export async function deleteApiKey(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = {
        userId: formData.get('userId'),
        apikeyId: formData.get('apikeyId'),
    };

    const schema = z.object({
        userId: z.string().min(1),
        apikeyId: z.string().min(1),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            values: formValues,
            time: performanceTime(start),
        };
    }

    if (user.id !== formValues.userId) {
        return {
            errors: { auth: 'Not authorized' },
            time: performanceTime(start),
        };
    }

    const { data: deletedApiKey, error } = await tryCatch(
        db.ApiKey.delete({
            where: { id: formValues.apikeyId, userId: formValues.userId },
        }),
    );
    if (error) throw error;

    revalidatePath('/profile', 'layout');
    return { data: deletedApiKey, time: performanceTime(start) };
}

// ─── User data lifecycle ────────────────────────────────────────────

/**
 * Export all data for the authenticated user (profile, accounts, settings, API keys).
 * Auth guard: session must exist and match the requested userId.
 * @param {string} userId - User ID to export data for
 */
export async function exportUserData(userId) {
    const start = performance.now();
    const { error: authError } = await requireUser(userId);
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const { data: userData, error } = await tryCatch(
        db.user.findUnique({
            where: { id: userId },
            include: {
                accounts: {
                    select: { providerId: true, accountId: true, createdAt: true },
                },
                settings: { select: { settings: true } },
                apiKeys: {
                    select: {
                        id: true,
                        description: true,
                        visible: true,
                        createdAt: true,
                        enabled: true,
                    },
                },
            },
        }),
    );
    if (error) throw error;

    return { data: userData, time: performanceTime(start) };
}

/**
 * Delete the authenticated user's account. Requires email confirmation.
 * Revokes session before cascade-deleting all user data.
 * @param {unknown} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and confirmEmail fields
 */
export async function deleteUserAccount(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const userId = formData.get('userId');

    if (user.id !== userId) {
        return {
            errors: { auth: 'Not authorized' },
            time: performanceTime(start),
        };
    }

    // Revoke all sessions before deleting user (cascade will delete sessions from DB,
    // but we need to clear the cookie so no device holds a stale token)
    const { error: revokeError } = await tryCatch(
        auth.api.revokeSessions({ headers: await headers() }),
    );
    if (revokeError) throw revokeError;

    const { error } = await tryCatch(db.user.delete({ where: { id: userId } }));
    if (error) throw error;

    return { data: { deleted: true }, time: performanceTime(start) };
}
