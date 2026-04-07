'use client';

import RouteError from '@/shared/components/RouteError';

export default function ArchivesError({ error, reset }) {
    return <RouteError reset={reset} />;
}
