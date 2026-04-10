'use client';

export default function RouteError({ reset }) {
    return (
        <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
            <h1 className="font-display">SECTOR MALFUNCTION</h1>
            <p className="text-text-muted">
                A tactical error has disrupted this sector. Super Earth Command
                has been notified.
            </p>
            <p className="text-small text-text-muted italic">
                This incident has been logged.
            </p>
            <button
                onClick={() => reset()}
                className="cursor-pointer border border-primary px-3 py-1.5 font-body text-small font-bold uppercase tracking-[0.02em] text-primary hover:bg-primary hover:text-surface-0"
            >
                Retry operation
            </button>
        </main>
    );
}
