import { NextRequest, NextResponse } from 'next/server';
import { getPosts, createRandomPost } from '@/db/queries/post';

// export async function GET(request: NextRequest): Promise<NextResponse> {
//     console.log('api/example/helloworld/route.ts GET');
//     const { searchParams } = request.nextUrl;
//     // Get specific query parameters
//     // const testKey = searchParams.get('testKey');
//     // const anotherParam = searchParams.get('anotherParam');
//     console.log(searchParams);

//     return new NextResponse(JSON.stringify({ message: 'Hello, world!' }), {
//         status: 200,
//         headers: { 'Content-Type': 'application/json' },
//     });
// }

export async function GET(request) {
    console.log('api/example/helloworld/route.ts GET');
    const { searchParams } = request.nextUrl;
    console.log(searchParams);

    const posts = await getPosts();

    return new NextResponse(JSON.stringify(posts), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

export async function POST() {
    console.log('api/example/helloworld/route.ts POST');

    const post = await createRandomPost();

    return new NextResponse(JSON.stringify(post), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
