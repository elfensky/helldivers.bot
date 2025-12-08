'use server';
import { z } from 'zod/v4';
import db from '@/db/db';
import { auth } from '@/auth';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { randomUUID, createHash } from 'crypto';
import { revalidatePath } from 'next/cache';

export async function getApiKeysByUserId(userId) {
    const start = performance.now();
    const session = await auth();

    if (!session || !session.user) {
        throw new Error('No session found');
    }
    if (session.user.id !== userId) {
        throw new Error('User does not match');
    }

    try {
        const result = await db.ApiKey.findMany({
            where: {
                userId: userId,
            },
            select: {
                id: true,
                description: true,
                visible: true,
                createdAt: true,
                enabled: true,
            },
        });

        const query = {
            data: result,
            time: performanceTime(start),
        };
        return query;
    } catch (error) {
        console.error('getApiKeysByUser()');
        console.error(error);
        throw error;
    }
}

export async function generateApiKey(_, formData) {
    const start = performance.now();

    //get values from FormData
    const formValues = {
        userId: formData.get('userId'),
        description: formData.get('description'),
    };

    //create and test FormData values using zod
    const schema = z.object({
        userId: z.string().uuid(),
        description: z.string().min(3).max(200),
    });
    const check = schema.safeParse(formValues);
    if (check?.success === false) {
        // console.log(check);
        // console.log(check.error);
        // console.log(check.error.issues);
        // console.log(check.error.toString());
        // console.log(check.error);
        return {
            errors: error.flatten().fieldErrors,
            values: formValues,
            time: performanceTime(start),
        };
    }

    //check if user has reached the maximum number of API keys
    const apiKeyCount = await db.ApiKey.count({
        where: {
            userId: formValues.userId,
        },
    });

    if (apiKeyCount >= 5) {
        return {
            errors: {
                general: 'You have reached the maximum number of API keys allowed',
            },
            time: performanceTime(start),
        };
    }

    const key = randomUUID();
    const hash = createHash('md5').update(key).digest('hex');

    try {
        const session = await auth();
        if (!session || !session?.user) {
            throw new Error('No session found');
        }

        const newApiKey = await db.ApiKey.create({
            data: {
                userId: formValues.userId,
                description: formValues.description,
                createdAt: new Date(),
                // updatedAt: new Date(),
                hash: hash,
                visible: key.slice(-4),
            },
        });

        newApiKey['key'] = key;

        const query = {
            data: newApiKey,
            time: performanceTime(start),
        };

        revalidatePath('/dashboard', 'page');
        return query;
    } catch (error) {
        console.error('createRandomPost()');
        console.error(error);
        throw error;
    }
}

export async function deleteApiKey(_, formData) {
    const start = performance.now();

    //get values from FormData
    const formValues = {
        userId: formData.get('userId'),
        apikeyId: formData.get('apikeyId'),
    };

    //create and test FormData values using zod
    const schema = z.object({
        userId: z.string().uuid(),
        apikeyId: z.string().uuid(),
    });
    const check = schema.safeParse(formValues);
    if (check?.success === false) {
        return {
            errors: check.error.flatten().fieldErrors,
            data: formValues,
            time: performanceTime(start),
        };
    }

    try {
        const session = await auth();
        if (!session || !session?.user) {
            return {
                errors: { auth: "You don't have permission to delete this API key" },
                time: performanceTime(start),
            };
        }
        if (session.user.id !== formValues.userId) {
            return {
                errors: { auth: "You don't have permission to delete this API key" },
                time: performanceTime(start),
            };
        }

        const deletedApiKey = await db.ApiKey.delete({
            where: {
                id: formValues.apikeyId,
            },
        });

        const query = {
            data: deletedApiKey,
            time: performanceTime(start),
        };

        revalidatePath('/dashboard', 'page');
        return query;
    } catch (error) {
        console.error('deleteApiKey()');
        console.error(error);
        throw error;
    }
}
