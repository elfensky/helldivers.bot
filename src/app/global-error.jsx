'use client';

import { useEffect } from 'react';
import RouteError from '@/shared/components/RouteError';
import { reportError } from '@/shared/utils/observability.mjs';

export default function GlobalError({ error, reset }) {
    useEffect(() => {
        reportError(error, { boundary: 'global' });
    }, [error]);
    return (
        <html lang="en">
            <body className="bg-surface-0 text-text">
                <RouteError reset={reset} />
            </body>
        </html>
    );
}
