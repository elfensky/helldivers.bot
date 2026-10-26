import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportError } from '@/shared/utils/observability.mjs';

const fakeClient = vi.hoisted(() => ({
    on: vi.fn(),
    connect: vi.fn(),
    query: vi.fn(),
    end: vi.fn(),
}));

vi.mock('pg', () => ({
    Client: vi.fn(function () {
        return fakeClient;
    }),
}));

const {
    MIGRATE_ARGS,
    MIGRATION_LOCK_KEY,
    RETRY_DELAYS_MS,
    SEED_ARGS,
    computeSeedHash,
    migrateOnce,
    migrateOrWait,
    runNode,
    seedIfChanged,
} = await import('@/update/migrateOnStart.mjs');

const makeLogger = () => ({ log: vi.fn(), error: vi.fn() });

describe('migrateOrWait', () => {
    it('returns 0 after a first-try success without waiting or reporting', async () => {
        const attempt = vi.fn().mockResolvedValue(undefined);
        const wait = vi.fn();
        const report = vi.fn();
        const logger = makeLogger();

        const failures = await migrateOrWait({
            connectionString: 'cs',
            root: '/r',
            attempt,
            wait,
            report,
            logger,
        });

        expect(failures).toBe(0);
        expect(logger.log).toHaveBeenCalledTimes(1);
        expect(logger.log.mock.calls[0][0]).toMatch(/^\[migrate\] up to date/);
        expect(wait).not.toHaveBeenCalled();
        expect(report).not.toHaveBeenCalled();
    });

    it('backs off 30 s, 60 s, 2 min, then 5 min and reports every failure', async () => {
        const errors = [1, 2, 3, 4, 5].map((n) => new Error(n === 1 ? 'boom' : `e${n}`));
        const attempt = vi.fn();
        errors.forEach((e) => attempt.mockRejectedValueOnce(e));
        attempt.mockResolvedValueOnce(undefined);
        const wait = vi.fn().mockResolvedValue(undefined);
        const report = vi.fn();
        const logger = makeLogger();

        const failures = await migrateOrWait({
            connectionString: 'cs',
            root: '/r',
            attempt,
            wait,
            report,
            logger,
        });

        expect(failures).toBe(5);
        expect(wait.mock.calls.map((c) => c[0])).toEqual([
            30000, 60000, 120000, 300000, 300000,
        ]);
        expect(report.mock.calls.map((c) => c[0])).toEqual(errors);
        expect(logger.error.mock.calls[0][0]).toBe(
            '[migrate] failed: boom — retry in 30 s',
        );
        expect(logger.log.mock.calls[0][0]).toContain('after 5 failed attempt(s)');
    });

    it('logs a non-Error rejection as its string and keeps looping', async () => {
        const attempt = vi
            .fn()
            .mockRejectedValueOnce('plain')
            .mockResolvedValue(undefined);
        const logger = makeLogger();

        await expect(
            migrateOrWait({
                connectionString: 'cs',
                root: '/r',
                attempt,
                wait: vi.fn().mockResolvedValue(undefined),
                report: vi.fn(),
                logger,
            }),
        ).resolves.toBe(1);
        expect(logger.error.mock.calls[0][0]).toBe(
            '[migrate] failed: plain — retry in 30 s',
        );
    });

    describe('defaults', () => {
        afterEach(() => vi.unstubAllEnvs());

        it('reads POSTGRES_URL and MIGRATE_ROOT', async () => {
            vi.stubEnv('POSTGRES_URL', 'postgres://x');
            vi.stubEnv('MIGRATE_ROOT', '/app/migrate');
            const attempt = vi.fn().mockResolvedValue(undefined);

            await migrateOrWait({ attempt, logger: makeLogger() });

            expect(attempt).toHaveBeenCalledWith({
                connectionString: 'postgres://x',
                root: '/app/migrate',
            });
        });

        it('falls back to the cwd when MIGRATE_ROOT is empty', async () => {
            vi.stubEnv('MIGRATE_ROOT', '');
            const attempt = vi.fn().mockResolvedValue(undefined);

            await migrateOrWait({ attempt, logger: makeLogger() });

            expect(attempt.mock.calls[0][0].root).toBe(process.cwd());
        });

        it('reports through reportError with the migrate-on-start stage', async () => {
            const error = new Error('db down');
            const attempt = vi
                .fn()
                .mockRejectedValueOnce(error)
                .mockResolvedValue(undefined);

            await migrateOrWait({
                attempt,
                wait: vi.fn().mockResolvedValue(undefined),
                logger: makeLogger(),
            });

            expect(reportError).toHaveBeenCalledWith(error, {
                stage: 'migrate-on-start',
                level: 'error',
            });
        });
    });

    it('exposes the documented delays', () => {
        expect(RETRY_DELAYS_MS).toEqual([30000, 60000, 120000, 300000]);
    });
});

describe('computeSeedHash', () => {
    /** @type {string} */
    let root;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'seedhash-'));
        await fs.mkdir(path.join(root, 'prisma/seed/seasons'), { recursive: true });
        await fs.writeFile(path.join(root, 'prisma/seed/seed.mjs'), 'seed v1');
        await fs.writeFile(
            path.join(root, 'prisma/seed/seasons/season-001.json'),
            '{"a":1}',
        );
        await fs.writeFile(
            path.join(root, 'prisma/seed/seasons/season-002.json'),
            '{"b":2}',
        );
    });

    afterEach(() => fs.rm(root, { recursive: true, force: true }));

    const seasons = (name) => path.join(root, 'prisma/seed/seasons', name);

    it('is a stable 64-char hex digest', async () => {
        const a = await computeSeedHash(root);
        expect(a).toMatch(/^[0-9a-f]{64}$/);
        expect(await computeSeedHash(root)).toBe(a);
    });

    it('changes when a season file changes', async () => {
        const before = await computeSeedHash(root);
        await fs.writeFile(seasons('season-002.json'), '{"b":3}');
        expect(await computeSeedHash(root)).not.toBe(before);
    });

    it('changes when a season file is added or removed', async () => {
        const before = await computeSeedHash(root);
        await fs.writeFile(seasons('season-003.json'), '{}');
        const added = await computeSeedHash(root);
        expect(added).not.toBe(before);
        await fs.rm(seasons('season-003.json'));
        expect(await computeSeedHash(root)).toBe(before);
        await fs.rm(seasons('season-002.json'));
        expect(await computeSeedHash(root)).not.toBe(before);
    });

    it('changes when seed.mjs changes', async () => {
        const before = await computeSeedHash(root);
        await fs.writeFile(path.join(root, 'prisma/seed/seed.mjs'), 'seed v2');
        expect(await computeSeedHash(root)).not.toBe(before);
    });

    it('ignores non-JSON files in seasons/', async () => {
        const before = await computeSeedHash(root);
        await fs.writeFile(seasons('readme.md'), 'notes');
        expect(await computeSeedHash(root)).toBe(before);
    });
});

describe('seedIfChanged', () => {
    /** @type {string} */
    let root;
    let expectedHash;

    beforeEach(async () => {
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'seedhash-'));
        await fs.mkdir(path.join(root, 'prisma/seed/seasons'), { recursive: true });
        await fs.writeFile(path.join(root, 'prisma/seed/seed.mjs'), 'seed');
        expectedHash = await computeSeedHash(root);
    });

    afterEach(() => fs.rm(root, { recursive: true, force: true }));

    const makeClient = (rows) => ({ query: vi.fn().mockResolvedValue({ rows }) });

    it('skips when the stored hash matches', async () => {
        const client = makeClient([{ hash: expectedHash }]);
        const run = vi.fn();

        await expect(
            seedIfChanged({ client, root, run, logger: makeLogger() }),
        ).resolves.toBe(false);
        expect(run).not.toHaveBeenCalled();
        expect(client.query).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['no row', []],
        ['a different hash', [{ hash: 'old' }]],
    ])('seeds then stores the hash with %s', async (_label, rows) => {
        const client = makeClient(rows);
        const run = vi.fn().mockResolvedValue(undefined);

        await expect(
            seedIfChanged({ client, root, run, logger: makeLogger() }),
        ).resolves.toBe(true);
        expect(run).toHaveBeenCalledTimes(1);
        expect(run).toHaveBeenCalledWith(SEED_ARGS, root);
        const [sql, params] = client.query.mock.calls[1];
        expect(sql).toMatch(/INSERT INTO seed_state[\s\S]*ON CONFLICT \(id\)/);
        expect(params).toEqual([expectedHash]);
    });

    it('stores nothing when the seed fails', async () => {
        const client = makeClient([]);
        const run = vi.fn().mockRejectedValue(new Error('seed failed'));

        await expect(
            seedIfChanged({ client, root, run, logger: makeLogger() }),
        ).rejects.toThrow('seed failed');
        expect(client.query).toHaveBeenCalledTimes(1);
    });
});

describe('migrateOnce', () => {
    /** @type {string} */
    let root;

    beforeEach(async () => {
        vi.clearAllMocks();
        fakeClient.connect.mockResolvedValue(undefined);
        fakeClient.end.mockResolvedValue(undefined);
        fakeClient.query.mockResolvedValue({ rows: [] });
        root = await fs.mkdtemp(path.join(os.tmpdir(), 'seedhash-'));
        await fs.mkdir(path.join(root, 'prisma/seed/seasons'), { recursive: true });
        await fs.writeFile(path.join(root, 'prisma/seed/seed.mjs'), 'seed');
    });

    afterEach(() => fs.rm(root, { recursive: true, force: true }));

    it('locks, bounds the session, migrates, seeds, then ends the session', async () => {
        const order = [];
        fakeClient.on.mockImplementation(() => order.push('on'));
        fakeClient.connect.mockImplementation(async () => order.push('connect'));
        fakeClient.query.mockImplementation(async (sql) => {
            order.push(sql.trim().split('\n')[0].slice(0, 45));
            return { rows: [] };
        });
        fakeClient.end.mockImplementation(async () => order.push('end'));
        const run = vi.fn(async (args) => {
            order.push(args === MIGRATE_ARGS ? 'migrate' : 'seed');
        });

        await migrateOnce({ connectionString: 'cs', root, run, logger: makeLogger() });

        expect(order[0]).toBe('on');
        expect(order[1]).toBe('connect');
        expect(order.slice(2)).toEqual([
            'SELECT pg_advisory_lock($1)',
            "SET lock_timeout = '30s'",
            "SET statement_timeout = '10min'",
            'migrate',
            'SELECT hash FROM seed_state WHERE id = 1',
            'seed',
            'INSERT INTO seed_state (id, hash, applied_at)',
            'end',
        ]);
        expect(fakeClient.query.mock.calls[0][1]).toEqual([MIGRATION_LOCK_KEY]);
        expect(run).toHaveBeenCalledWith(MIGRATE_ARGS, root);
        expect(fakeClient.end).toHaveBeenCalledTimes(1);
    });

    it('still ends the session when the migrate step fails', async () => {
        const run = vi.fn().mockRejectedValue(new Error('migrate failed'));

        await expect(
            migrateOnce({ connectionString: 'cs', root, run, logger: makeLogger() }),
        ).rejects.toThrow('migrate failed');
        expect(fakeClient.end).toHaveBeenCalledTimes(1);
    });
});

describe('runNode', () => {
    it('resolves on exit code 0', async () => {
        await expect(
            runNode(['-e', 'process.exit(0)'], os.tmpdir()),
        ).resolves.toBeUndefined();
    });

    it('rejects with the exit code', async () => {
        await expect(runNode(['-e', 'process.exit(3)'], os.tmpdir())).rejects.toThrow(
            /code 3/,
        );
    });
});
