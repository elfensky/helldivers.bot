import db from '@/db/db';
import { performance } from 'perf_hooks';

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
    const start = performance.now();

    try {
        const result = await db.post.findMany();

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
    const start = performance.now();

    try {
        const randomTitle = getRandomString(10); // Generate a random string of length 10 for the title
        const randomContent = getRandomString(50); // Generate a random string of length 50 for the content
        const randomPublished = getRandomBoolean(); // Randomly decide if the post is published

        const newPost = await db.post.create({
            data: {
                title: randomTitle,
                content: randomContent,
                published: randomPublished,
            },
        });

        const query = {
            data: newPost,
            time: performance.now() - start,
        };
        return query;
    } catch (error) {
        console.error('createRandomPost()');
        console.error(error);
        throw error;
    }
}
