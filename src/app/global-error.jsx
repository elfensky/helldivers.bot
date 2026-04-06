'use client';

// Sentry captures errors automatically via instrumentation-client.js
// No manual captureException needed here

export default function GlobalError({ error, reset }) {
    return (
        <html lang="en">
            <body className="bg-surface-0 text-text">
                <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                    <h1 className="font-display">DEMOCRATIC ANOMALY DETECTED</h1>
                    <p className="text-text-muted">
                        This incident has been reported to the Ministry of Truth. Your
                        continued loyalty is appreciated.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="mt-4 cursor-pointer border border-primary px-4 py-2 text-primary hover:bg-primary hover:text-surface-0"
                    >
                        RESUME PATRIOTIC DUTIES
                    </button>
                </main>
            </body>
        </html>
    );
}
