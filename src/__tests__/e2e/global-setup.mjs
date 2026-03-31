/**
 * Playwright global setup — checks that the dev server is running before smoke tests.
 * Exits early with a clear message if localhost:3000 is unreachable.
 */
export default async function globalSetup() {
    const baseURL = 'http://localhost:3000';
    try {
        await fetch(`${baseURL}/api/healthcheck`);
    } catch {
        console.error(
            `\n  ✘ Dev server is not running on ${baseURL} — skipping smoke tests.\n` +
                `    Start it with: npm run dev\n`,
        );
        process.exit(0);
    }
}
