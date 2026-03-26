/**
 * Background Worker Thread - Continuous API Polling
 *
 * This worker runs in a separate thread from the main Next.js application and
 * continuously polls the Helldivers API update endpoint at a configurable interval.
 *
 * Purpose:
 * - Fetches fresh campaign data from the official Helldivers 1 API via /api/h1/update
 * - Runs independently of HTTP requests, ensuring data stays current
 * - Reports success/failure back to the parent thread for logging
 *
 * Lifecycle:
 * 1. Spawned by src/instrumentation.js during application startup
 * 2. Receives initial configuration (key, interval) from parent thread
 * 3. Enters infinite polling loop until application shutdown
 *
 * Why a Worker Thread?
 * - Runs in isolation from the main event loop
 * - Won't block or be blocked by incoming HTTP requests
 * - Continues running even under heavy server load
 */
const { parentPort } = require('worker_threads');

/**
 * Listen for the initialization message from the parent thread.
 * The parent sends { key, interval, port } where:
 * - key: The UPDATE_KEY secret required to authenticate with /api/h1/update
 * - interval: Polling frequency in seconds (from UPDATE_INTERVAL env var)
 * - port: The port the Next.js server is listening on (defaults to 3000)
 */
parentPort.on('message', async (msg) => {
    const { key, interval, port } = msg;

    /**
     * Recursive polling function that fetches the update endpoint.
     * Uses setTimeout for self-scheduling to ensure sequential execution.
     */
    async function doWork() {
        const url = `http://localhost:${port}/api/h1/update?key=${key}`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            // Report successful update back to parent for logging
            parentPort.postMessage({ data, time: new Date().toString() });
        } catch (err) {
            // Report errors back to parent - the worker continues running
            parentPort.postMessage({
                error: err.toString(),
                time: new Date().toString(),
            });
        }

        // Schedule the next update after the current one completes.
        // Using setTimeout instead of setInterval is intentional:
        // - Prevents overlapping requests if an update takes longer than the interval
        // - Ensures each update fully completes before the next one starts
        // - Avoids potential race conditions in database operations
        setTimeout(doWork, interval * 1000);
    }

    // Start the polling loop
    doWork();
});
