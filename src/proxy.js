import { NextResponse } from 'next/server';

export function proxy(request) {
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const isDev = process.env.NODE_ENV === 'development';

    const csp = [
        "default-src 'self'",
        `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://umami.lav.ren https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ''}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https://authjs.dev https://cdn.discordapp.com https://avatars.githubusercontent.com https://www.gravatar.com",
        "font-src 'self'",
        "connect-src 'self' https://umami.lav.ren https://bugsink.lavrenov.cloud https://cloudflareinsights.com",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
    ].join('; ');

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });
    response.headers.set('Content-Security-Policy', csp);
    return response;
}

export const config = {
    matcher: [
        {
            source: '/((?!_next/static|_next/image|favicons|fonts|icons|images|svgs|workers|favicon.ico|sitemap.xml|robots.txt).*)',
            missing: [
                { type: 'header', key: 'next-router-prefetch' },
                { type: 'header', key: 'purpose', value: 'prefetch' },
            ],
        },
    ],
};
