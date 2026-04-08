'use client';

export default function RouteError({ reset }) {
    return (
        <main className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-8">
            <h1 className="font-display">SECTOR MALFUNCTION</h1>
            <p className="text-text-muted">
                A tactical error has disrupted this sector. Super Earth Command
                has been notified.
            </p>
            <button
                onClick={() => reset()}
                className="mt-4 cursor-pointer border border-primary px-4 py-2 text-primary hover:bg-primary hover:text-surface-0"
            >
                RETRY OPERATION
            </button>
        </main>
    );
}
