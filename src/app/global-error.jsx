'use client';

// Sentry captures errors automatically via instrumentation-client.js
// No manual captureException needed here

export default function GlobalError({ error, reset }) {
    return (
        <html>
            <body>
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '100vh',
                        padding: '2rem',
                        fontFamily: 'system-ui, sans-serif',
                    }}
                >
                    <h1>Something went wrong!</h1>
                    <p>An unexpected error has occurred.</p>
                    <button
                        onClick={() => reset()}
                        style={{
                            marginTop: '1rem',
                            padding: '0.5rem 1rem',
                            cursor: 'pointer',
                        }}
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
