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
 * 2. Receives initial configuration (key, interval, port) from parent thread
 * 3. Enters infinite polling loop until application shutdown
 *
 * Why a Worker Thread?
 * - Runs in isolation from the main event loop
 * - Won't block or be blocked by incoming HTTP requests
 * - Continues running even under heavy server load
 *
 * This file is a thin shell over `cronLogic.js`. The logic lives there so it
 * can be unit-tested without spawning a real worker_threads thread or
 * intercepting Node built-ins.
 */
const { parentPort } = require('worker_threads');
const { makeDoWork } = require('./cronLogic');

/**
 * Listen for the initialization message from the parent thread.
 * The parent sends { key, interval, port }:
 * - key: The UPDATE_KEY secret required to authenticate with /api/h1/update
 * - interval: Polling frequency in seconds (from UPDATE_INTERVAL env var)
 * - port: The port the Next.js server is listening on (defaults to 3000)
 */
parentPort.on('message', (msg) => {
    const doWork = makeDoWork(msg, parentPort);
    doWork();
});
