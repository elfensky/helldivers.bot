'use server';

import db from '@/db/db';
import { auth } from '@/auth';
import { performance } from 'perf_hooks';
import { revalidatePath } from 'next/cache';

function getRandomBoolean() {
    return Math.random() < 0.5;
}

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

    try {
        const result = await db.post.findMany({
            where: {
                published: true,
            },
            include: {
                author: {
                    select: {
                        name: true,
                        username: true,
                        email: true,
                        image: true,
                    },
                },
            },
        });
        // console.log('getPosts', result);
        const query = {
            data: result,
            time: performance.now() - start,
        };
        return query;
    } catch (error) {
        console.error('getPosts()');
        console.error(error);
        throw error;
    }
}

export async function createRandomPost() {
    'use server';
    const start = performance.now();

    const session = await auth();
    if (!session || !session?.user) {
        throw new Error('No session found');
    }

    try {
        const randomTitle = getRandomString(10);
        const randomContent = getRandomString(50);

        const newPost = await db.post.create({
            data: {
                title: randomTitle,
                content: randomContent,
                published: true,
                authorId: session.user.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        const query = {
            data: newPost,
            time: performance.now() - start,
        };
        revalidatePath('/front/posts', 'page');
        return query;
    } catch (error) {
        console.error('createRandomPost()');
        console.error(error);
        throw error;
    }
}

export async function createPost(formData) {
    const start = performance.now();

    try {
        const session = await auth();
        // console.log('session', session);
        // console.log(formData);

        if (!session || !session?.user) {
            throw new Error('No session found');
        }
        // if (session?.user?.id !== user.id) {
        //     throw new Error('User does not match');
        // }

        const title = formData.get('title')?.trim();
        const content = formData.get('content')?.trim();

        const newPost = await db.post.create({
            data: {
                title: title,
                content: content,
                published: true,
                authorId: session.user.id,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        });

        const query = {
            data: newPost,
            time: performance.now() - start,
        };
        revalidatePath('/front/posts', 'page');
        return query;
    } catch (error) {
        console.error('createPost()');
        console.error(error);
        throw error;
    }
}

export async function getLatestPostDate() {
    const start = performance.now();

    try {
        const result = await db.post.findFirst({
            orderBy: {
                updatedAt: 'desc',
            },
            select: {
                updatedAt: true,
            },
        });

        const query = {
            data: result,
            time: performance.now() - start,
        };
        return query;
    } catch (error) {
        console.error('getLatestPostDate()');
        console.error(error);
        throw error;
    }
}
