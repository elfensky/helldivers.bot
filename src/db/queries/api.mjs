'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/shared/utils/time';
import { randomUUID, createHash } from 'crypto';
import { revalidatePath } from 'next/cache';

/**
 * Retrieve all API keys for the authenticated user.
 * Auth guard: session must match the requested userId.
 * @param {string} userId - User ID whose keys to retrieve
 */
export async function getApiKeysByUserId(userId) {
    const start = performance.now();
    if (!auth)
        return { errors: { auth: 'Auth not configured' }, time: performanceTime(start) };
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        return {
            errors: { auth: 'No session found' },
            time: performanceTime(start),
        };
    }
    if (session.user.id !== userId) {
        return {
            errors: { auth: 'User does not match' },
            time: performanceTime(start),
        };
    }

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
 * @param {*} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and description fields
 */
export async function generateApiKey(_, formData) {
    const start = performance.now();
    if (!auth)
        return { errors: { auth: 'Auth not configured' }, time: performanceTime(start) };

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session?.user) {
        return {
            errors: { auth: 'You must be signed in to generate an API key' },
            time: performanceTime(start),
        };
    }

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

    if (session.user.id !== formValues.userId) {
        return {
            errors: { auth: "You don't have permission to create this API key" },
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
 * @param {*} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and apikeyId fields
 */
export async function deleteApiKey(_, formData) {
    const start = performance.now();
    if (!auth)
        return { errors: { auth: 'Auth not configured' }, time: performanceTime(start) };

    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session?.user) {
        return {
            errors: { auth: "You don't have permission to delete this API key" },
            time: performanceTime(start),
        };
    }

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

    if (session.user.id !== formValues.userId) {
        return {
            errors: { auth: "You don't have permission to delete this API key" },
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
