import { NextRequest, NextResponse } from 'next/server';

export async function POST() {
    console.log('update user POST');

    const user = {
        name: 'Andrei Lavrenov',
        username: 'elfensky',
        email: 'elfensky@gmail.com',
        emailVerified: true,
        image: 'https://avatars.githubusercontent.com/u/178718?v=4',
        role: 'user',
    };

    return new NextResponse(JSON.stringify(post), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function PATCH() {
    console.log('update user PATCH');

    const user = {
        name: 'Andrei Lavrenov',
        username: 'elfensky',
        email: 'elfensky@gmail.com',
        emailVerified: true,
        image: 'https://avatars.githubusercontent.com/u/178718?v=4',
        role: 'user',
    };

    return new NextResponse(JSON.stringify(user), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
