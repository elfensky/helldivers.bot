'use client';

import Button from '@/shared/components/Button/Button';

export default function RouteError({ reset }) {
    return (
        <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
            <h1 className="font-display">SECTOR MALFUNCTION</h1>
            <p className="text-text-muted">
                A tactical error has disrupted this sector. Super Earth Command has been
                notified.
            </p>
            <p className="text-small text-text-muted italic">
                This incident has been logged.
            </p>
            <Button variant="primary" size="md" onClick={() => reset()}>
                Retry operation
            </Button>
        </main>
    );
}
