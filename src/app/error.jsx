'use client';

import { useEffect } from 'react';
import RouteError from '@/shared/components/RouteError';
import { reportError } from '@/shared/utils/observability.mjs';

export default function Error({ error, reset }) {
    useEffect(() => {
        reportError(error, { boundary: 'route' });
    }, [error]);
    return <RouteError reset={reset} />;
}
