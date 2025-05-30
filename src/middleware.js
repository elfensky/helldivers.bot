import { NextResponse } from 'next/server';

export function middleware(request) {
    const now = new Date();
    console.log('middleware.js | ', request.nextUrl.pathname);
}

export const config = {
    matcher: [
        /**
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * Or ending with:
         * - .ico (favicon and other icons)
         * - .png (PNG images)
         * - .jpg (JPEG images)
         * - .webm (WebM videos)
         * - .webp (WebP images)
         * - .svg (SVG images)
         * - .js (JavaScript files)
         * - .css (CSS files)
         */
        '/((?!api|_next/static|_next/image|.*\\.ico$|.*\\.png$|.*\\.jpg$|.*\\.webm$|.*\\.webp$|.*\\.svg$|.*\\.js$|.*\\.css$).*$)',
    ],
};
