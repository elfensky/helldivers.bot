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

    try {
        const randomTitle = getRandomString(10); // Generate a random string of length 10 for the title
        const randomContent = getRandomString(50); // Generate a random string of length 50 for the content
        const randomPublished = getRandomBoolean(); // Randomly decide if the post is published

        const newPost = await db.post.create({
            data: {
                title: randomTitle,
                content: randomContent,
                published: true,
                authorId: '0196c87c-5447-7df1-a89e-799d2cf6e1ce',
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
        console.error('createRandomPost()');
        console.error(error);
        throw error;
    }
}

export async function getLatestsPostDate() {
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
        console.error('getLatestsPostDate()');
        console.error(error);
        throw error;
    }
}
