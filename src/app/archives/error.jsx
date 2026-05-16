'use client';

import RouteError from '@/shared/components/RouteError';

export default function ArchivesError({ error: _error, reset }) {
    return <RouteError reset={reset} />;
}
