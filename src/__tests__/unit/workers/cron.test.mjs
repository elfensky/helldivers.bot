import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import Module from 'module';
import path from 'path';

// public/workers/cron.js is the worker_threads ENTRY shell. cronLogic.test.mjs
// tests cronLogic.js (its dependency) in isolation; this file tests that
// cron.js still wires parentPort + cronLogic together correctly.
//
// vi.mock can't reliably intercept require('worker_threads') (a Node
// built-in) so we monkey-patch Module._load to inject a controllable
// parentPort BEFORE Node resolves cron.js's top-level require.

// `require` is not defined in ESM `.mjs` scope. We construct a CommonJS
// require here via createRequire — both for require()ing cron.js (which is
// CJS) AND for accessing the require.cache (so we can evict cron.js between
// tests and re-evaluate it with our patched Module._load in place).
const requireFromHere = createRequire(import.meta.url);

const cronPath = path.resolve(process.cwd(), 'public/workers/cron.js');
const _cronLogicPath = path.resolve(process.cwd(), 'public/workers/cronLogic.js');

let parentPortMock;
let originalLoad;
let registeredListeners;
let makeDoWorkSpy;
let doWorkSpy;

beforeEach(() => {
    registeredListeners = new Map();
    parentPortMock = {
        on: vi.fn((event, listener) => {
            registeredListeners.set(event, listener);
        }),
        postMessage: vi.fn(),
    };
    doWorkSpy = vi.fn();
    makeDoWorkSpy = vi.fn(() => doWorkSpy);

    // Intercept Module._load to swap worker_threads + the real cronLogic.
    originalLoad = Module._load;
    Module._load = function (request, parent, ...rest) {
        if (request === 'worker_threads') {
            return { parentPort: parentPortMock };
        }
        if (request === './cronLogic' && parent?.filename === cronPath) {
            return { makeDoWork: makeDoWorkSpy };
        }
        return originalLoad.call(this, request, parent, ...rest);
    };

    // Clear Node's require cache so re-importing cron.js re-evaluates it
    // with our patched _load. require.cache is per-Module-system; the
    // createRequire'd require shares Node's main require.cache.
    delete requireFromHere.cache[cronPath];
});

afterEach(() => {
    Module._load = originalLoad;
    delete requireFromHere.cache[cronPath];
    vi.restoreAllMocks();
});

describe('public/workers/cron.js — entry shell wiring', () => {
    test('registers a "message" listener on parentPort at module load', () => {
        requireFromHere(cronPath);

        expect(parentPortMock.on).toHaveBeenCalledTimes(1);
        expect(parentPortMock.on).toHaveBeenCalledWith('message', expect.any(Function));
    });

    test('on receipt of a message, calls makeDoWork(msg, parentPort) and immediately invokes the returned doWork', () => {
        requireFromHere(cronPath);

        const handler = registeredListeners.get('message');
        expect(handler).toBeDefined();

        const msg = { key: 'test-key', interval: 30, port: 3000 };
        handler(msg);

        // makeDoWork received exactly (msg, parentPort) — same instance, no transform.
        expect(makeDoWorkSpy).toHaveBeenCalledTimes(1);
        expect(makeDoWorkSpy).toHaveBeenCalledWith(msg, parentPortMock);

        // The returned doWork was invoked once (loop started).
        expect(doWorkSpy).toHaveBeenCalledTimes(1);
    });

    test('does NOT call makeDoWork or doWork at module load (only on message)', () => {
        requireFromHere(cronPath);

        expect(makeDoWorkSpy).not.toHaveBeenCalled();
        expect(doWorkSpy).not.toHaveBeenCalled();
    });
});
