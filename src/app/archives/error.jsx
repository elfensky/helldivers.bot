'use client';

import { useEffect } from 'react';
import RouteError from '@/shared/components/RouteError';
import { reportError } from '@/shared/utils/observability.mjs';

export default function ArchivesError({ error, reset }) {
    useEffect(() => {
        reportError(error, { boundary: 'archives' });
    }, [error]);
    return <RouteError reset={reset} />;
}
