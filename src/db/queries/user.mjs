'use server';
import db from '@/db/db';
import { auth } from '@/auth';
import { randomUUID, createHash } from 'crypto';
import { performance } from 'perf_hooks';
import { revalidatePath } from 'next/cache';

export async function createApiKey(user, formData) {
    // 'use server';
    const start = performance.now(); //measure time

    try {
        const session = await auth();
        if (!session || !session.user) {
            throw new Error('No session found');
        }
        if (session.user.id !== user.id) {
            throw new Error('User does not match');
        }

        const key = randomUUID();
        // will be shown to user once, and never again, because the store version is hashed.

        const query = await db.apiKey.create({
            data: {
                userId: user.id,
                hash: createHash('md5').update(key).digest('hex'),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        query.data.key = key;

        const result = {
            data: query.data,
            time: performance.now() - start,
        };
        // revalidatePath('/dashboard', 'page');
        return result;
    } catch (error) {
        // log.error('createApiKey()', error); //logging to db or somewhere.
        console.error('/src/db/queries/user.mjs -> createApiKey()', error.message);
    }
}
