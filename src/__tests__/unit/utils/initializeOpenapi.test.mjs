import { vi } from 'vitest';

vi.mock('@/utils/openapi.registry', () => ({
    generateOpenApiSpec: vi.fn(() => ({ openapi: '3.0.0' })),
}));
vi.mock('fs/promises', () => ({
    writeFile: vi.fn(),
    readFile: vi.fn(),
}));

import { initializeOpenApiSpec } from '@/utils/initialize.openapi';

describe('initializeOpenApiSpec', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    test('returns result of generateOpenApiSpec in development', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('NODE_ENV', 'development');

        const fs = await import('fs/promises');
        vi.mocked(fs.readFile).mockResolvedValue('{"openapi":"3.0.0"}');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(true);
    });

    test('returns result of checkOpenApiSpec in production', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('NODE_ENV', 'production');

        const fs = await import('fs/promises');
        vi.mocked(fs.readFile).mockResolvedValue('{"openapi":"3.0.0"}');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(true);
    });

    test('returns false when NEXT_RUNTIME is not nodejs', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        vi.stubEnv('NODE_ENV', 'development');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(false);
    });
});

describe('generateOpenApiSpec', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    test('writes and reads file, returns true for valid JSON', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('NODE_ENV', 'development');

        const fs = await import('fs/promises');
        vi.mocked(fs.readFile).mockResolvedValue('{"openapi":"3.0.0"}');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(true);
        expect(fs.writeFile).toHaveBeenCalled();
        expect(fs.readFile).toHaveBeenCalled();
    });
});

describe('checkOpenApiSpec', () => {
    beforeEach(() => {
        vi.unstubAllEnvs();
    });

    test('reads file, returns true for valid JSON', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('NODE_ENV', 'production');

        const fs = await import('fs/promises');
        vi.mocked(fs.readFile).mockResolvedValue('{"openapi":"3.0.0"}');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(true);
        expect(fs.readFile).toHaveBeenCalled();
    });

    test('returns false when file content is invalid JSON', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('NODE_ENV', 'production');

        const fs = await import('fs/promises');
        vi.mocked(fs.readFile).mockResolvedValue('not-valid-json{{{');

        const result = await initializeOpenApiSpec();
        expect(result).toBe(false);
    });
});
