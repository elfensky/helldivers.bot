import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest): Promise<NextResponse> {
    const { searchParams } = request.nextUrl;
    // Get specific query parameters
    // const testKey = searchParams.get('testKey');
    // const anotherParam = searchParams.get('anotherParam');
    console.log(searchParams);

    return new NextResponse(JSON.stringify({ message: 'Hello, world!' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}
