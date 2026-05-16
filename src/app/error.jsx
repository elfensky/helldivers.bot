'use client';

import RouteError from '@/shared/components/RouteError';

export default function Error({ error: _error, reset }) {
    return <RouteError reset={reset} />;
}
