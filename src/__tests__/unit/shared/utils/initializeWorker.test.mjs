import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest';

const mockWorker = {
    postMessage: vi.fn(),
    on: vi.fn(),
    terminate: vi.fn(),
};

vi.mock('worker_threads', () => ({
    Worker: vi.fn(function () {
        return mockWorker;
    }),
}));

vi.mock('perf_hooks', () => ({
    performance: { now: vi.fn(() => 0) },
}));

const { initializeWorker } = await import('@/shared/utils/initializeWorker.mjs');

describe('initializeWorker', () => {
    beforeEach(() => {
        vi.stubEnv('NEXT_RUNTIME', 'nodejs');
        vi.stubEnv('UPDATE_KEY', 'test-key');
        vi.stubEnv('UPDATE_INTERVAL', '60000');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    test('returns false when NEXT_RUNTIME is not nodejs', async () => {
        vi.stubEnv('NEXT_RUNTIME', 'edge');
        const result = await initializeWorker();
        expect(result).toBe(false);
    });

    test('returns false when NEXT_RUNTIME is undefined', async () => {
        vi.unstubAllEnvs();
        const result = await initializeWorker();
        expect(result).toBe(false);
    });

    test('throws when UPDATE_KEY is not set', async () => {
        vi.stubEnv('UPDATE_KEY', '');
        await expect(initializeWorker()).rejects.toThrow('UPDATE_KEY is not set');
    });

    test('throws when UPDATE_INTERVAL is not set', async () => {
        vi.stubEnv('UPDATE_INTERVAL', '');
        await expect(initializeWorker()).rejects.toThrow('UPDATE_INTERVAL is not set');
    });

    test('WORKER_ENABLED=false returns true without spawning a Worker', async () => {
        vi.stubEnv('WORKER_ENABLED', 'false');
        const { Worker } = await import('worker_threads');
        const result = await initializeWorker();
        expect(result).toBe(true);
        expect(Worker).not.toHaveBeenCalled();
    });

    test('creates Worker and returns true on success', async () => {
        const { Worker } = await import('worker_threads');
        const result = await initializeWorker();
        expect(result).toBe(true);
        expect(Worker).toHaveBeenCalledOnce();
        expect(mockWorker.postMessage).toHaveBeenCalledOnce();
        expect(mockWorker.on).toHaveBeenCalledTimes(3);
    });

    test('posts correct message with key, interval, and port', async () => {
        await initializeWorker();
        expect(mockWorker.postMessage).toHaveBeenCalledWith({
            key: 'test-key',
            interval: '60000',
            port: 3000,
        });
    });

    test('uses default port 3000 when PORT is not set', async () => {
        await initializeWorker();
        expect(mockWorker.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ port: 3000 }),
        );
    });

    test('uses custom PORT when set', async () => {
        vi.stubEnv('PORT', '4000');
        await initializeWorker();
        expect(mockWorker.postMessage).toHaveBeenCalledWith(
            expect.objectContaining({ port: '4000' }),
        );
    });

    test('returns false when Worker constructor throws', async () => {
        const { Worker } = await import('worker_threads');
        Worker.mockImplementationOnce(function () {
            throw new Error('spawn failed');
        });
        const result = await initializeWorker();
        expect(result).toBe(false);
    });

    test('sets up message, error, and exit event handlers', async () => {
        await initializeWorker();
        const eventNames = mockWorker.on.mock.calls.map((call) => call[0]);
        expect(eventNames).toContain('message');
        expect(eventNames).toContain('error');
        expect(eventNames).toContain('exit');
    });
});
