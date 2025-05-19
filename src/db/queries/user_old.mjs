import db from '@/db/db';
import { performance } from 'perf_hooks';
//auth
import { auth } from '@/auth';

export async function updateUser(user) {
    'use server';
    const start = performance.now();

    //validate user
    const session = await auth();
    if (session && session.user && session.user.id === user.id) {
        return 'nice try';
    }

    try {
        console.log('updateUser', user);
        // const updatedUser = await db.User.update({
        //     where: {
        //         id: user.id,
        //     },
        //     data: {
        //         title: randomTitle,
        //         content: randomContent,
        //         published: randomPublished,
        //     },
        // });
    } catch (error) {
        console.error('updateUser()');
        console.error(error);
        throw error;
    }
}
