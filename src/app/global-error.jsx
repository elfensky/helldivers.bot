'use client';

// Sentry captures errors automatically via instrumentation-client.js
// No manual captureException needed here

export default function GlobalError({ error, reset }) {
    return (
        <html lang="en">
            <body className="bg-[var(--color-surface-0)] text-[var(--color-text)]">
                <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                    <h1 className="text-3xl font-[family-name:var(--font-display)]">
                        Something went wrong!
                    </h1>
                    <p className="text-[var(--color-text-muted)]">
                        An unexpected error has occurred.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="mt-4 cursor-pointer bg-[var(--color-primary)] px-4 py-2 text-[var(--color-on-primary)]"
                    >
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
