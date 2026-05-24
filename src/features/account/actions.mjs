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

    const key = randomUUID();
    const hash = createHash('sha256').update(key).digest('hex');

    const { data: newApiKey, error: createError } = await tryCatch(
        db.$transaction(
            async (tx) => {
                const count = await tx.ApiKey.count({
                    where: { userId: check.data.userId },
                });
                if (count >= 5) {
                    throw new Error('API_KEY_LIMIT_REACHED');
                }
                return tx.ApiKey.create({
                    data: {
                        userId: check.data.userId,
                        description: check.data.description,
                        createdAt: new Date(),
                        hash,
                        visible: key.slice(-4),
                    },
                });
            },
            { isolationLevel: 'Serializable' },
        ),
    );
    if (createError) {
        if (createError.message === 'API_KEY_LIMIT_REACHED') {
            return {
                errors: {
                    general: 'You have reached the maximum number of API keys allowed',
                },
                time: performanceTime(start),
            };
        }
        throw createError;
    }

    revalidatePath('/profile', 'layout');
    return { data: { ...newApiKey, key }, time: performanceTime(start) };
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

    if (user.id !== check.data.userId) {
        return {
            errors: { auth: 'Not authorized' },
            time: performanceTime(start),
        };
    }

    const { data: deletedApiKey, error } = await tryCatch(
        db.ApiKey.delete({
            where: { id: check.data.apikeyId, userId: check.data.userId },
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
 * Delete the authenticated user's account. Cascade-deletes all user data,
 * then revokes the session cookie.
 * @param {unknown} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId
 */
export async function deleteUserAccount(_, formData) {
    const start = performance.now();
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError }, time: performanceTime(start) };

    const formValues = { userId: formData.get('userId') };

    const schema = z.object({ userId: z.string().min(1) });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            values: formValues,
            time: performanceTime(start),
        };
    }

    if (user.id !== check.data.userId) {
        return {
            errors: { auth: 'Not authorized' },
            time: performanceTime(start),
        };
    }

    const { error } = await tryCatch(
        db.user.delete({ where: { id: check.data.userId } }),
    );
    if (error) throw error;

    const { error: revokeError } = await tryCatch(
        auth.api.revokeSessions({ headers: await headers() }),
    );
    if (revokeError) throw revokeError;

    revalidatePath('/profile', 'layout');
    return { data: { deleted: true }, time: performanceTime(start) };
}
