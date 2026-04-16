/**
 * Fetches historical season data from the official Helldivers 1 API
 * and writes each season as a JSON file in prisma/seed/seasons/.
 *
 * **Never fetches the currently-active season.** The active season's
 * `get_snapshots` response is partial by definition (the war is still
 * running), so capturing it to disk would create a stale seed file that
 * reseeds incomplete data on fresh deploys. When --to is auto-detected,
 * it resolves to `currentSeason - 1` — the most recent completed season.
 * If you pass --to=<current> explicitly, the script will still exclude
 * anything ≥ currentSeason with a warning.
 *
 * Usage:
 *   node prisma/seed/fetch-seasons.mjs
 *
 * Options:
 *   --from=N   Start from season N (default: 1)
 *   --to=N     End at season N INCLUSIVE (default: last completed season
 *              auto-detected from get_campaign_status — i.e. currentSeason - 1)
 *   --delay=N  Delay in ms between requests (default: 500)
 *   --force    Overwrite existing files (default: skip)
 */

import axios from 'axios';
import https from 'node:https';
import { writeFile, mkdir, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEASONS_DIR = join(__dirname, 'seasons');
const API_URL = 'https://api.helldiversgame.com/1.0/';

const agent = new https.Agent({ rejectUnauthorized: false });

function parseArgs() {
    const args = { from: 1, to: null, delay: 500, force: false };
    for (const arg of process.argv.slice(2)) {
        if (arg.startsWith('--from=')) args.from = parseInt(arg.split('=')[1], 10);
        else if (arg.startsWith('--to=')) args.to = parseInt(arg.split('=')[1], 10);
        else if (arg.startsWith('--delay=')) args.delay = parseInt(arg.split('=')[1], 10);
        else if (arg === '--force') args.force = true;
    }
    return args;
}

async function fetchApi(action, extraFields = {}) {
    const form = new FormData();
    form.append('action', action);
    for (const [key, value] of Object.entries(extraFields)) {
        form.append(key, value.toString());
    }
    const response = await axios.post(API_URL, form, { httpsAgent: agent });
    return response.data;
}

async function fileExists(path) {
    try {
        await access(path);
        return true;
    } catch {
        return false;
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    const args = parseArgs();

    await mkdir(SEASONS_DIR, { recursive: true });

    // Resolve the last completed season from the live API. Used both as
    // the default --to value and as a safety cap on any explicit --to.
    console.log('Detecting current season...');
    const status = await fetchApi('get_campaign_status');
    const currentSeason = status?.campaign_status?.[0]?.season;
    if (!currentSeason) {
        console.error('Could not detect current season. Aborting.');
        process.exit(1);
    }
    const lastCompletedSeason = currentSeason - 1;
    console.log(
        `Current season: ${currentSeason}. Last completed: ${lastCompletedSeason}.`,
    );

    // Default --to to the last completed season. Never fetch the active
    // season — the snapshot endpoint returns a mid-war partial response that
    // would become stale the moment the war progresses.
    if (!args.to) {
        args.to = lastCompletedSeason;
    } else if (args.to >= currentSeason) {
        console.warn(
            `Warning: --to=${args.to} is >= current season ${currentSeason}. Clamping to ${lastCompletedSeason} (never fetch active season).`,
        );
        args.to = lastCompletedSeason;
    }

    if (args.from > args.to) {
        console.log(`Nothing to fetch: --from=${args.from} > --to=${args.to}. Exiting.`);
        return;
    }

    console.log(
        `Fetching seasons ${args.from} to ${args.to} (${args.delay}ms delay)...\n`,
    );

    let fetched = 0;
    let skipped = 0;
    let empty = 0;
    let errors = 0;

    for (let season = args.from; season <= args.to; season++) {
        const filename = `season-${String(season).padStart(3, '0')}.json`;
        const filepath = join(SEASONS_DIR, filename);

        // Skip existing files unless --force
        if (!args.force && (await fileExists(filepath))) {
            skipped++;
            continue;
        }

        try {
            const data = await fetchApi('get_snapshots', { season });

            // Skip seasons with no meaningful data
            const hasData =
                data?.snapshots?.length > 0 ||
                data?.defend_events?.length > 0 ||
                data?.attack_events?.length > 0;

            if (!hasData) {
                empty++;
                process.stdout.write(`  ${filename}: empty\n`);
            } else {
                await writeFile(filepath, JSON.stringify(data, null, 4));
                fetched++;
                const s = data.snapshots?.length ?? 0;
                const d = data.defend_events?.length ?? 0;
                const a = data.attack_events?.length ?? 0;
                process.stdout.write(
                    `  ${filename}: ${s} snapshots, ${d} defend, ${a} attack\n`,
                );
            }
        } catch (err) {
            errors++;
            process.stdout.write(`  ${filename}: ERROR - ${err.message}\n`);
        }

        if (season < args.to) await sleep(args.delay);
    }

    console.log(
        `\nDone. Fetched: ${fetched}, Skipped: ${skipped}, Empty: ${empty}, Errors: ${errors}`,
    );
}

main().catch((err) => {
    console.error('Fatal:', err);
    process.exit(1);
});
