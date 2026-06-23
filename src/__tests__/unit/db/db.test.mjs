import { afterEach, describe, expect, test, vi } from 'vitest';

function setGlobalDb(value) {
    if (value === undefined) {
        delete globalThis.prismaGlobal;
        return;
    }

    globalThis.prismaGlobal = value;
}

async function loadDbModule(options = {}) {
    const connectionString =
        Object.hasOwn(options, 'connectionString') ?
            options.connectionString
        :   'postgresql://localhost:5432/helldivers_test';
    const { existingGlobal } = options;

    vi.resetModules();
    vi.doUnmock('@/db/db');
    vi.unstubAllEnvs();
    setGlobalDb(existingGlobal);

    if (connectionString === undefined) {
        delete process.env.POSTGRES_URL;
    } else {
        vi.stubEnv('POSTGRES_URL', connectionString);
    }

    const PrismaPg = vi.fn(function PrismaPg(options) {
        return { options };
    });
    const PrismaClient = vi.fn(function PrismaClient(config) {
        return { config, marker: 'mock-prisma-client' };
    });

    vi.doMock('@prisma/adapter-pg', () => ({ PrismaPg }));
    vi.doMock('@/generated/prisma/client', () => ({ PrismaClient }));

    const dbModule = await import('@/db/db');
    return { dbModule, PrismaClient, PrismaPg };
}

afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/db/db');
    vi.doUnmock('@prisma/adapter-pg');
    vi.doUnmock('@/generated/prisma/client');
    vi.unstubAllEnvs();
    delete process.env.POSTGRES_URL;
    delete globalThis.prismaGlobal;
});

describe('db singleton', () => {
    test('throws a clear error when POSTGRES_URL is missing and no global client exists', async () => {
        await expect(loadDbModule({ connectionString: undefined })).rejects.toThrow(
            'POSTGRES_URL is not set',
        );
    });

    test('reuses the cached global client without constructing a new adapter', async () => {
        const existingGlobal = { marker: 'existing-db' };
        const { dbModule, PrismaClient, PrismaPg } = await loadDbModule({
            connectionString: undefined,
            existingGlobal,
        });

        expect(dbModule.default).toBe(existingGlobal);
        expect(globalThis.prismaGlobal).toBe(existingGlobal);
        expect(PrismaPg).not.toHaveBeenCalled();
        expect(PrismaClient).not.toHaveBeenCalled();
    });

    test('creates and caches a prisma client when no global client exists', async () => {
        const connectionString = 'postgresql://localhost:5432/helldivers_test';
        const { dbModule, PrismaClient, PrismaPg } = await loadDbModule({
            connectionString,
        });

        expect(PrismaPg).toHaveBeenCalledTimes(1);
        expect(PrismaPg).toHaveBeenCalledWith({ connectionString });
        expect(PrismaClient).toHaveBeenCalledTimes(1);
        expect(dbModule.default).toEqual({
            config: {
                adapter: {
                    options: { connectionString },
                },
            },
            marker: 'mock-prisma-client',
        });
        expect(globalThis.prismaGlobal).toBe(dbModule.default);
    });
});
