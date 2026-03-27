import db from '@/db/db';
import { auth } from '@/auth';
import { tryCatch } from '@/utils/tryCatch';
import { performance } from 'perf_hooks';
import { performanceTime } from '@/utils/time';
import { revalidatePath } from 'next/cache';

function getRandomString(length) {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

export async function getPosts() {
    'use server';
    const start = performance.now();

    const { data: result, error } = await tryCatch(
        db.review.findMany({
            where: { published: true },
            include: {
                author: {
                    select: { name: true, username: true, email: true, image: true },
                },
            },
        }),
    );
    if (error) throw error;

    return { ms: performanceTime(start), query: result };
}

export async function createRandomPost() {
    'use server';
    const start = performance.now();

    const session = await auth();
    if (!session || !session?.user) {
        throw new Error('No session found');
    }

    const { data: newPost, error } = await tryCatch(
        db.review.create({
            data: {
                title: getRandomString(10),
                content: getRandomString(50),
                published: true,
                authorId: session.user.id,
            },
        }),
    );
    if (error) throw error;

    revalidatePath('/reviews', 'page');
    return { ms: performanceTime(start), query: newPost };
}

export async function createPost(formData) {
    'use server';
    const start = performance.now();

    const session = await auth();
    if (!session || !session?.user) {
        throw new Error('No session found');
    }

    const title = formData.get('title')?.trim();
    const content = formData.get('content')?.trim();

    const { data: newPost, error } = await tryCatch(
        db.review.create({
            data: {
                title,
                content,
                published: true,
                authorId: session.user.id,
            },
        }),
    );
    if (error) throw error;

    revalidatePath('/reviews', 'page');
    return { ms: performanceTime(start), query: newPost };
}

export async function getLatestPostDate() {
    'use server';
    const start = performance.now();

    const { data: result, error } = await tryCatch(
        db.review.findFirst({
            orderBy: { updatedAt: 'desc' },
            select: { updatedAt: true },
        }),
    );
    if (error) throw error;

    return { ms: performanceTime(start), query: result };
}
