import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client } from 'pg';
import { reportError } from '@/shared/utils/observability.mjs';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';

/**
 * Migrate on start (#599). Swarm ignores depends_on, so every new app task
 * applies pending Prisma migrations, and the seed when its data changed,
 * before it serves. Next awaits `register()` before it serves a request, so a
 * migrating task stays Starting while start-first keeps the old tasks serving.
 *
 * It never throws: Next caches a rejected `register()`, and the task would
 * lose its safe wait. Failures log, report to GlitchTip and retry.
 *
 * The lock is a dedicated `pg` session, not Prisma: an advisory lock belongs
 * to one session and Prisma pools connections (the reason src/update/lease.mjs
 * gives too). The outer lock serializes replicas, so Prisma's own fixed 10 s
 * migrate lock never contends.
 */

/** Advisory-lock key that serializes the replicas (the issue number; Prisma's own is 72707369). */
export const MIGRATION_LOCK_KEY = 599_000_001;

/** Back-off between failed attempts; the last value repeats. */
export const RETRY_DELAYS_MS = [30_000, 60_000, 120_000, 300_000];

/** The Prisma CLI path comes from prisma's package.json `bin`. */
export const MIGRATE_ARGS = ['node_modules/prisma/build/index.js', 'migrate', 'deploy'];

/** The same two steps as the Dockerfile.migrate CMD. */
export const SEED_ARGS = ['--experimental-strip-types', 'prisma/seed/seed.mjs'];

/**
 * Time limit for one child. The session timeouts do not reach the children's own
 * connections; this keeps a stuck child from holding the lock. It equals the
 * image's 300 s health-check start period, so the failure reports before Swarm
 * replaces the task.
 */
export const CHILD_TIMEOUT_MS = 300_000;

/**
 * Run `node <args>` in `cwd` with the parent env (POSTGRES_URL never appears in argv).
 * @param {string[]} args - Arguments for the node binary.
 * @param {string} cwd - Working directory of the child.
 * @param {object} [options] - Options.
 * @param {number} [options.timeout] - Kill the child (SIGTERM) after this many ms.
 * @returns {Promise<void>} Resolves on exit code 0.
 */
export function runNode(args, cwd, { timeout = CHILD_TIMEOUT_MS } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', timeout });
        child.on('error', reject);
        child.on('exit', (code, signal) => {
            if (code === 0) resolve();
            else
                reject(
                    new Error(
                        `node ${args.join(' ')} failed with ${signal ? `signal ${signal}` : `code ${code}`}`,
                    ),
                );
        });
    });
}

/**
 * sha256 over seed.mjs and every seasons/*.json (name and bytes, NUL separated).
 * @param {string} root - Folder that holds prisma/seed.
 * @returns {Promise<string>} Hex digest.
 */
export async function computeSeedHash(root) {
    const seedDir = path.join(root, 'prisma/seed');
    const hash = createHash('sha256');
    hash.update(await readFile(path.join(seedDir, 'seed.mjs')));
    const names = (await readdir(path.join(seedDir, 'seasons')))
        .filter((name) => name.endsWith('.json'))
        .sort();
    for (const name of names) {
        hash.update(name).update('\0');
        hash.update(await readFile(path.join(seedDir, 'seasons', name))).update('\0');
    }
    return hash.digest('hex');
}

/**
 * Seed only when the seed inputs differ from the hash in `seed_state`; store
 * the new hash after a successful seed. A failed seed stores nothing.
 * @param {object} options - Options.
 * @param {{ query: Function }} options.client - The lock session.
 * @param {string} options.root - Folder that holds prisma/seed.
 * @param {(args: string[], cwd: string) => Promise<void>} [options.run] - Child runner.
 * @param {Pick<Console, 'log'>} [options.logger] - Log sink.
 * @returns {Promise<boolean>} True when the seed ran.
 */
export async function seedIfChanged({ client, root, run = runNode, logger = console }) {
    const hash = await computeSeedHash(root);
    const { rows } = await client.query('SELECT hash FROM seed_state WHERE id = 1');
    if (rows[0]?.hash === hash) {
        logger.log('[migrate] seed unchanged, skipped');
        return false;
    }
    logger.log('[migrate] seed data changed, seeding');
    await run(SEED_ARGS, root);
    // UTC: the naive timestamp(3) columns hold UTC (see src/update/lease.mjs).
    await client.query(
        `INSERT INTO seed_state (id, hash, applied_at)
         VALUES (1, $1, now() AT TIME ZONE 'UTC')
         ON CONFLICT (id) DO UPDATE SET hash = EXCLUDED.hash, applied_at = EXCLUDED.applied_at`,
        [hash],
    );
    return true;
}

/**
 * The steps that run under the advisory lock.
 * @param {import('pg').Client} client - Connected session.
 * @param {string} root - Folder with the Prisma CLI and prisma/.
 * @param {(args: string[], cwd: string) => Promise<void>} run - Child runner.
 * @param {Pick<Console, 'log'>} logger - Log sink.
 * @returns {Promise<void>}
 */
async function lockedSteps(client, root, run, logger) {
    // No timeout set yet: a second replica waits here, then finds nothing pending.
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_KEY]);
    // These bound this session's statements; the children open their own connections,
    // which CHILD_TIMEOUT_MS bounds.
    await client.query(`SET lock_timeout = '30s'`);
    await client.query(`SET statement_timeout = '10min'`);
    await run(MIGRATE_ARGS, root);
    await seedIfChanged({ client, root, run, logger });
}

/**
 * One attempt: take the advisory lock, migrate, seed when changed, end the session.
 * @param {object} options - Options.
 * @param {string} options.connectionString - Postgres URL.
 * @param {string} options.root - Folder with the Prisma CLI and prisma/.
 * @param {(args: string[], cwd: string) => Promise<void>} [options.run] - Child runner.
 * @param {Pick<Console, 'log'>} [options.logger] - Log sink.
 * @returns {Promise<void>}
 */
export async function migrateOnce({
    connectionString,
    root,
    run = runNode,
    logger = console,
}) {
    const client = new Client({ connectionString, keepAlive: true });
    // An unexpected socket end emits 'error'; with no listener the process exits.
    // The failure still surfaces through the rejected query.
    client.on('error', () => {});
    await client.connect();
    // Ending the session releases the advisory lock, on success and on failure.
    return lockedSteps(client, root, run, logger).finally(() => client.end());
}

/**
 * Run `attempt` until it succeeds, waiting `RETRY_DELAYS_MS` between failures
 * and reporting each one. Never throws.
 * @param {object} [deps] - Injectable for tests; production uses the defaults.
 * @param {string} [deps.connectionString] - Postgres URL.
 * @param {string} [deps.root] - Folder with the Prisma CLI and prisma/.
 * @param {(options: { connectionString: string, root: string }) => Promise<void>} [deps.attempt] - One attempt.
 * @param {(ms: number) => Promise<unknown>} [deps.wait] - Back-off wait.
 * @param {(error: unknown) => void} [deps.report] - Failure report.
 * @param {Pick<Console, 'log' | 'error'>} [deps.logger] - Log sink.
 * @returns {Promise<number>} Failed attempts before success.
 */
export async function migrateOrWait({
    connectionString = process.env.POSTGRES_URL ?? '',
    // /app/migrate in the image, the repo root under `npm run dev`; `||` so an empty value falls back.
    root = process.env.MIGRATE_ROOT || process.cwd(),
    attempt = migrateOnce,
    wait = sleep,
    report = (error) => reportError(error, { stage: 'migrate-on-start', level: 'error' }),
    logger = console,
} = {}) {
    for (let failures = 0; ; failures++) {
        const started = Date.now();
        const { error } = await tryCatch(attempt({ connectionString, root }));
        if (!error) {
            const retried = failures ? `, after ${failures} failed attempt(s)` : '';
            logger.log(`[migrate] up to date (${Date.now() - started} ms${retried})`);
            return failures;
        }
        const delay = RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length - 1)];
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`[migrate] failed: ${message} — retry in ${delay / 1000} s`);
        report(error);
        await wait(delay);
    }
}
