'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { randomUUID, createHash } from 'crypto';
import { revalidatePath } from 'next/cache';

export async function getApiKeysByUserId(userId) {
    const start = performance.now();
    const session = await auth();

    if (!session || !session.user) {
        return {
            ms: performanceTime(start),
            query: null,
            errors: { auth: 'No session found' },
        };
    }
    if (session.user.id !== userId) {
        return {
            ms: performanceTime(start),
            query: null,
            errors: { auth: 'User does not match' },
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

    return { ms: performanceTime(start), query: result };
}

export async function generateApiKey(_, formData) {
    const start = performance.now();

    const session = await auth();
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
        userId: z.string().uuid(),
        description: z.string().min(3).max(200),
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

    revalidatePath('/dashboard', 'page');
    return { data: newApiKey, time: performanceTime(start) };
}

export async function deleteApiKey(_, formData) {
    const start = performance.now();

    const session = await auth();
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
        userId: z.string().uuid(),
        apikeyId: z.string().uuid(),
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

    revalidatePath('/dashboard', 'page');
    return { data: deletedApiKey, time: performanceTime(start) };
}
