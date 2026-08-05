import { readFileSync } from 'node:fs';

/**
 * Bridge Docker / Swarm secrets (files) into environment variables.
 *
 * Swarm mounts secrets as files under `/run/secrets/`, but the app reads its
 * config from `process.env`. For every `<KEY>_FILE` variable present, this reads
 * the file and populates `<KEY>` — unless `<KEY>` is already set, in which case
 * the direct env var wins (so a local `.env` keeps working untouched). This is
 * the common `*_FILE` container convention.
 *
 * Runs first thing in {@link initializeEnvironmentVariables} — before Prisma
 * reads `POSTGRES_URL` — so the values are in place before anything reads them.
 * A missing/unreadable file warns and is skipped; downstream validation then
 * surfaces the unset variable with its normal, clearer message.
 *
 * @returns {string[]} base keys that were populated from a file (for logging/tests)
 */
export function hydrateFileSecrets() {
    /** @type {string[]} */
    const populated = [];
    for (const [fileKey, filePath] of Object.entries(process.env)) {
        if (!fileKey.endsWith('_FILE') || !filePath) continue;
        const key = fileKey.slice(0, -'_FILE'.length);
        if (process.env[key]) continue; // direct env var wins

        try {
            const value = readFileSync(filePath, 'utf8').trim();
            if (value) {
                process.env[key] = value;
                populated.push(key);
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn(
                `hydrateFileSecrets: ${fileKey}=${filePath} is unreadable — ${message}`,
            );
        }
    }
    return populated;
}
