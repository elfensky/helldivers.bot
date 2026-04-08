'use client';

import RouteError from '@/shared/components/RouteError';

export default function GlobalError({ error, reset }) {
    return (
        <html lang="en">
            <body className="bg-surface-0 text-text">
                <RouteError reset={reset} />
            </body>
        </html>
    );
}
