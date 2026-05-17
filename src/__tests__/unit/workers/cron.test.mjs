import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    makeDoWork,
    WORKER_STARTUP_HEADER as CRON_WORKER_STARTUP_HEADER,
} from '../../../../public/workers/cronLogic.js';
import { WORKER_STARTUP_HEADER as ROUTE_WORKER_STARTUP_HEADER } from '@/app/api/h1/update/route.js';

// public/workers/cron.js is the entry shell — it only wires up
// parentPort.on('message', ...) → makeDoWork(...). The interesting logic
// lives in public/workers/cronLogic.js and is what these tests exercise.
// makeDoWork(cfg, parentPort) returns a self-scheduling doWork() closure
// that fetches /api/h1/update on the configured interval and reports
// success/error via parentPort.postMessage.

function makeParentPort() {
    return { postMessage: vi.fn() };
}

const baseCfg = { key: 'test-update-key', interval: 30, port: 3000 };

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.fetch;
});

// Drain microtasks + 0-delay timers without firing scheduled future timers.
async function flushMicrotasks() {
    for (let i = 0; i < 20; i += 1) {
        const before = vi.getTimerCount();
        await vi.advanceTimersByTimeAsync(0);
        const after = vi.getTimerCount();
        if (after === 0 || after === before) break;
    }
}

// --- Tests ---

describe('cron worker — first poll', () => {
    test('immediately fetches /api/h1/update when doWork() is called', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const parentPort = makeParentPort();
        const doWork = makeDoWork(baseCfg, parentPort);

        doWork();
        await flushMicrotasks();

        expect(globalThis.fetch).toHaveBeenCalledTimes(1);
        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://localhost:3000/api/h1/update',
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer test-update-key',
                }),
            }),
        );
    });
});

describe('cron worker — first-poll header', () => {
    test('cron worker constant matches the route handler (case-insensitive)', () => {
        // The worker writes the header as-is; HTTP normalises the name on the
        // wire. NextRequest.headers.get(...) lowercases on lookup. This test
        // protects against either side drifting the spelling without the other.
        expect(CRON_WORKER_STARTUP_HEADER.toLowerCase()).toBe(
            ROUTE_WORKER_STARTUP_HEADER.toLowerCase(),
        );
    });

    test('sends X-Worker-Startup: 1 on the first poll', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork(baseCfg, makeParentPort());

        doWork();
        await flushMicrotasks();

        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.headers['X-Worker-Startup']).toBe('1');
    });

    test('does NOT send X-Worker-Startup on subsequent polls', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork(baseCfg, makeParentPort());

        doWork();
        await flushMicrotasks();

        // Advance one full interval to trigger the second poll.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 + 50);
        await flushMicrotasks();

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        const [, secondInit] = globalThis.fetch.mock.calls[1];
        expect(secondInit.headers).not.toHaveProperty('X-Worker-Startup');
    });
});

describe('cron worker — setTimeout non-overlap invariant', () => {
    test('next poll is scheduled AFTER the current request resolves (setTimeout, not setInterval)', async () => {
        // Build a fetch that hangs on the first call. With setInterval, a
        // second fetch would fire after the interval regardless of the first
        // resolving. With setTimeout self-scheduling, the second fetch must
        // wait for the first to resolve AND another interval to elapse.
        let resolveFirst;
        const fetchCalls = [];
        globalThis.fetch = vi.fn((url, init) => {
            fetchCalls.push({ url, init });
            const idx = fetchCalls.length;
            if (idx === 1) {
                return new Promise((res) => {
                    resolveFirst = () =>
                        res({ json: () => Promise.resolve({ ok: true, idx }) });
                });
            }
            return Promise.resolve({
                json: () => Promise.resolve({ ok: true, idx }),
            });
        });

        const doWork = makeDoWork(baseCfg, makeParentPort());
        doWork();
        await flushMicrotasks();
        expect(fetchCalls).toHaveLength(1);

        // Advance past 3× interval while the first fetch is still pending.
        // setInterval would have queued more fetches; setTimeout has not.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 * 3);
        await flushMicrotasks();
        expect(fetchCalls).toHaveLength(1);

        // Resolve the first. The doWork closure now schedules its setTimeout.
        resolveFirst();
        await flushMicrotasks();
        // Still only one fetch — the second is scheduled but not fired yet.
        expect(fetchCalls).toHaveLength(1);

        // Advance one interval — second fires.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 + 50);
        await flushMicrotasks();
        expect(fetchCalls).toHaveLength(2);
    });

    test('each subsequent poll is scheduled at the configured interval after the previous resolves', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork(baseCfg, makeParentPort());
        doWork();
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Just under the interval — no new fetch.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 - 100);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Cross it — second fires.
        await vi.advanceTimersByTimeAsync(200);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);

        // Another full interval — third fires.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });
});

describe('cron worker — success reporting', () => {
    test('posts { data, time } to parentPort on successful fetch', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({
                json: () => Promise.resolve({ season: 157, status: 'ok' }),
            }),
        );
        const parentPort = makeParentPort();
        const doWork = makeDoWork(baseCfg, parentPort);

        doWork();
        await flushMicrotasks();

        expect(parentPort.postMessage).toHaveBeenCalledTimes(1);
        const msg = parentPort.postMessage.mock.calls[0][0];
        expect(msg.data).toEqual({ season: 157, status: 'ok' });
        expect(typeof msg.time).toBe('string');
        expect(msg.time.length).toBeGreaterThan(10);
    });
});

describe('cron worker — error recovery', () => {
    test('fetch rejection posts { error, time } to parentPort and the loop continues', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn(() => {
            callCount += 1;
            if (callCount === 1) {
                return Promise.reject(new Error('connection refused'));
            }
            return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
        });
        const parentPort = makeParentPort();
        const doWork = makeDoWork(baseCfg, parentPort);

        doWork();
        await flushMicrotasks();

        expect(parentPort.postMessage).toHaveBeenCalledTimes(1);
        const errMsg = parentPort.postMessage.mock.calls[0][0];
        expect(errMsg.error).toBe('Error: connection refused');
        expect(typeof errMsg.time).toBe('string');
        expect(errMsg.data).toBeUndefined();

        // Crucially: the loop continued. The next interval fires.
        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 + 50);
        await flushMicrotasks();

        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
        expect(parentPort.postMessage).toHaveBeenCalledTimes(2);
        expect(parentPort.postMessage.mock.calls[1][0].data).toEqual({ ok: true });
    });

    test('response.json() rejection (malformed JSON from server) is reported as error and loop continues', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn(() => {
            callCount += 1;
            if (callCount === 1) {
                return Promise.resolve({
                    json: () => Promise.reject(new SyntaxError('Unexpected token')),
                });
            }
            return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
        });
        const parentPort = makeParentPort();
        const doWork = makeDoWork(baseCfg, parentPort);

        doWork();
        await flushMicrotasks();

        expect(parentPort.postMessage).toHaveBeenCalledTimes(1);
        expect(parentPort.postMessage.mock.calls[0][0].error).toContain(
            'Unexpected token',
        );

        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 + 50);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    test('errors do NOT cause an X-Worker-Startup header on the next poll (isFirstPoll still flips)', async () => {
        let callCount = 0;
        globalThis.fetch = vi.fn(() => {
            callCount += 1;
            if (callCount === 1) {
                return Promise.reject(new Error('boom'));
            }
            return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
        });
        const doWork = makeDoWork(baseCfg, makeParentPort());

        doWork();
        await flushMicrotasks();
        // First call had the header.
        expect(globalThis.fetch.mock.calls[0][1].headers['X-Worker-Startup']).toBe('1');

        await vi.advanceTimersByTimeAsync(baseCfg.interval * 1000 + 50);
        await flushMicrotasks();

        // Second call must NOT have it — isFirstPoll is reset on the success
        // path AND the error path (line `isFirstPoll = false` runs after the
        // try/catch).
        const [, secondInit] = globalThis.fetch.mock.calls[1];
        expect(secondInit.headers).not.toHaveProperty('X-Worker-Startup');
    });
});

describe('cron worker — config wiring', () => {
    test('uses cfg.port in the fetch URL', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork({ ...baseCfg, port: 9999 }, makeParentPort());

        doWork();
        await flushMicrotasks();

        expect(globalThis.fetch).toHaveBeenCalledWith(
            'http://localhost:9999/api/h1/update',
            expect.any(Object),
        );
    });

    test('uses cfg.key as the Bearer token', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork(
            { ...baseCfg, key: 'super-secret-rotation-token' },
            makeParentPort(),
        );

        doWork();
        await flushMicrotasks();

        const [, init] = globalThis.fetch.mock.calls[0];
        expect(init.headers.Authorization).toBe('Bearer super-secret-rotation-token');
    });

    test('uses cfg.interval (seconds → milliseconds) for setTimeout', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve({ json: () => Promise.resolve({ ok: true }) }),
        );
        const doWork = makeDoWork({ ...baseCfg, interval: 5 }, makeParentPort());

        doWork();
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // 4.9s — no second.
        await vi.advanceTimersByTimeAsync(4900);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(1);

        // Cross 5s — second fires.
        await vi.advanceTimersByTimeAsync(200);
        await flushMicrotasks();
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });
});
