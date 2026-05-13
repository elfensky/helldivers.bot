// @vitest-environment jsdom
import { describe, it, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useLiveData uses a module-level singleton store. Every test re-imports the
// module fresh via vi.resetModules() + dynamic import, so `store`, `listeners`,
// `pollTimer`, `cachedState`, etc. are reset between tests.
//
// Globals patched per test: fetch, navigator.onLine, BroadcastChannel,
// document.hidden + visibilitychange dispatch. requestIdleCallback is unset
// so emit() falls back to setTimeout — which fake timers can flush.

const POLL_INTERVAL = 10_000;

function setOnline(value) {
    Object.defineProperty(navigator, 'onLine', {
        value,
        configurable: true,
        writable: true,
    });
}

function makeFetchResponse(payload, { ok = true, status = 200 } = {}) {
    return {
        ok,
        status,
        json: async () => payload,
    };
}

let openChannels = [];
function installBroadcastChannelMock() {
    // Same-realm pub/sub: every channel created during a single test sees
    // every other channel's posted messages. Mirrors how the browser routes
    // BroadcastChannel between tabs in one origin.
    openChannels = [];
    class FakeBroadcastChannel {
        constructor(name) {
            this.name = name;
            this.onmessage = null;
            this.closed = false;
            openChannels.push(this);
        }
        postMessage(data) {
            for (const ch of openChannels) {
                if (ch === this || ch.closed) continue;
                if (ch.name !== this.name) continue;
                ch.onmessage?.({ data });
            }
        }
        close() {
            this.closed = true;
            openChannels = openChannels.filter((c) => c !== this);
        }
    }
    globalThis.BroadcastChannel = FakeBroadcastChannel;
}

async function loadHookFresh() {
    vi.resetModules();
    // Ensure requestIdleCallback is undefined so emit() takes the setTimeout
    // fallback — fake timers can flush setTimeout, but not rIC.
    if ('requestIdleCallback' in globalThis) {
        delete globalThis.requestIdleCallback;
    }
    return await import('@/shared/hooks/useLiveData.mjs');
}

beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
    localStorage.clear();
    // Reset Math.random to deterministic 0 → leader-election timeout = 0ms.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    installBroadcastChannelMock();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete globalThis.fetch;
    openChannels.forEach((c) => c.close());
    openChannels = [];
    // Reset document.hidden in case a visibilitychange test set it. jsdom's
    // default getter returns false, but tests Object.defineProperty it.
    delete document.hidden;
});

// Flush microtasks + the setTimeout(0) used by emit() — WITHOUT advancing
// the setInterval clock. We never want flushAll to accidentally fire a
// scheduled poll; tests opt in to that by calling advanceTimersByTimeAsync
// with POLL_INTERVAL explicitly.
//
// Fixed-point loop: keep draining 0-delay timers until the pending-timer
// count stops decreasing. This survives any future change to the number of
// awaits in poll() / await hops in the emit→listener→setState chain.
async function flushAll() {
    for (let i = 0; i < 20; i += 1) {
        const before = vi.getTimerCount();
        await vi.advanceTimersByTimeAsync(0);
        const after = vi.getTimerCount();
        if (after === 0 || after === before) break;
    }
}

describe('useLiveData — initial mount', () => {
    test('fires an immediate poll on first mount', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(
                makeFetchResponse({ data: { foo: 1 }, mapState: { 0: 'bugs' } }),
            ),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/h1/live');
    });

    test('schedules subsequent polls at POLL_INTERVAL', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Advance ~9.9s — no second fetch yet.
        await act(async () => { await vi.advanceTimersByTimeAsync(POLL_INTERVAL - 100); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Cross the threshold → second fetch.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
            await flushAll();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);

        // Another full interval → third fetch.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
            await flushAll();
        });
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    test('initial status is "polling" while first request is in flight', async () => {
        // Never resolve the fetch — status should remain 'polling'.
        let resolveFetch;
        globalThis.fetch = vi.fn(
            () =>
                new Promise((res) => {
                    resolveFetch = res;
                }),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await vi.advanceTimersByTimeAsync(0); // let connect() run

        expect(result.current.status).toBe('polling');

        // Don't leave fetch dangling.
        resolveFetch(makeFetchResponse({ data: {}, mapState: {} }));
        await flushAll();
    });
});

describe('useLiveData — status transitions', () => {
    test('successful poll: polling → live with payload', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                makeFetchResponse({
                    data: { campaign: 42 },
                    mapState: { 0: 'cyborgs' },
                }),
            ),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.status).toBe('live');
        expect(result.current.data).toEqual({ campaign: 42 });
        expect(result.current.mapState).toEqual({ 0: 'cyborgs' });
    });

    test('failed poll: status → offline; data stays at the last initial fallback', async () => {
        globalThis.fetch = vi.fn(() => Promise.reject(new Error('network down')));
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() =>
            useLiveData({ initial: true }, { 0: 'bugs' }),
        );
        await act(async () => {
            await flushAll();
        });

        expect(result.current.status).toBe('offline');
        // Initial server-rendered fallback survives offline transitions.
        expect(result.current.data).toEqual({ initial: true });
        expect(result.current.mapState).toEqual({ 0: 'bugs' });
    });

    test('HTTP non-OK response is treated as poll failure (offline)', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse(null, { ok: false, status: 503 })),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.status).toBe('offline');
    });

    test('first successful poll is silent — prevData stays null (no false change detection)', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: { v: 1 }, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.data).toEqual({ v: 1 });
        expect(result.current.prevData).toBeNull();
    });

    test('second poll sets prevData to the previous data (change-detection signal)', async () => {
        let n = 0;
        const fetchMock = vi.fn(() => {
            n += 1;
            return Promise.resolve(makeFetchResponse({ data: { v: n }, mapState: {} }));
        });
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.current.data).toEqual({ v: 1 });

        // Cross the interval boundary cleanly (+100ms buffer) and flush.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL + 100);
            await flushAll();
        });
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(result.current.data).toEqual({ v: 2 });
        expect(result.current.prevData).toEqual({ v: 1 });
    });
});

describe('useLiveData — offline state (reachable via fetch failure)', () => {
    // Note: the navigator.onLine check in connect() is dead code — poll()
    // runs synchronously after and overwrites the offline status before
    // emit's setTimeout(0) fires (the emits coalesce). Tracked in #320.
    // The reachable offline state is what we test here: status settles
    // to 'offline' once the fetch rejects.

    test('rejected fetch → status settles to offline (regardless of navigator.onLine)', async () => {
        setOnline(false);
        globalThis.fetch = vi.fn(() => Promise.reject(new Error('offline')));
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.status).toBe('offline');
    });
});

describe('useLiveData — visibilitychange handler', () => {
    test('tab regaining focus fires an immediate out-of-band poll', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        // Simulate tab focus
        Object.defineProperty(document, 'hidden', {
            value: false,
            configurable: true,
        });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await flushAll();
        });

        // visibilitychange triggered an extra fetch before the next interval.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('tab going hidden does NOT fire a poll (only visible does)', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        Object.defineProperty(document, 'hidden', {
            value: true,
            configurable: true,
        });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await flushAll();
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('useLiveData — singleton & cleanup', () => {
    test('two hook consumers share a single interval (no duplicate polling)', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });

        // Both consumers triggered the SAME initial poll (set up by the first mount),
        // not a fetch per consumer.
        expect(fetchMock).toHaveBeenCalledTimes(1);

        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL);
            await flushAll();
        });

        // Only one fresh interval fire — not two.
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    test('unmount of the last consumer clears the interval (no leaked polls)', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        const a = renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        a.unmount();

        await act(async () => {
            await vi.advanceTimersByTimeAsync(POLL_INTERVAL * 3);
            await flushAll();
        });

        // Interval cleared on last unmount → no further fetches.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test('unmount removes the visibilitychange listener (no leaked focus polls)', async () => {
        const fetchMock = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        globalThis.fetch = fetchMock;
        const { useLiveData } = await loadHookFresh();

        const { unmount } = renderHook(() => useLiveData(null, null));
        await act(async () => { await flushAll(); });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        unmount();

        Object.defineProperty(document, 'hidden', {
            value: false,
            configurable: true,
        });
        await act(async () => {
            document.dispatchEvent(new Event('visibilitychange'));
            await flushAll();
        });

        // Listener removed → focus event must not trigger a poll.
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});

describe('useLiveData — localStorage cache fallback', () => {
    test('seeds data + mapState from localStorage on mount (before first poll resolves)', async () => {
        localStorage.setItem(
            'hd1-live-cache',
            JSON.stringify({
                data: { cached: true },
                mapState: { 0: 'illuminate' },
                ts: 1700000000,
            }),
        );
        let resolveFetch;
        globalThis.fetch = vi.fn(
            () =>
                new Promise((res) => {
                    resolveFetch = res;
                }),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await vi.advanceTimersByTimeAsync(0);
            await vi.runOnlyPendingTimersAsync();
        });

        // Cache hydrated before fetch resolved.
        expect(result.current.data).toEqual({ cached: true });
        expect(result.current.mapState).toEqual({ 0: 'illuminate' });

        resolveFetch?.(makeFetchResponse({ data: {}, mapState: {} }));
        await act(async () => { await flushAll(); });
    });

    test('writes the latest successful poll payload to localStorage', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                makeFetchResponse({ data: { fresh: 1 }, mapState: { 0: 'bugs' } }),
            ),
        );
        const { useLiveData } = await loadHookFresh();

        renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        const raw = localStorage.getItem('hd1-live-cache');
        expect(raw).toBeTruthy();
        const parsed = JSON.parse(raw);
        expect(parsed.data).toEqual({ fresh: 1 });
        expect(parsed.mapState).toEqual({ 0: 'bugs' });
        expect(typeof parsed.ts).toBe('number');
    });

    test('malformed cache JSON is ignored (does not crash; falls back to null)', async () => {
        localStorage.setItem('hd1-live-cache', '{ not valid json');
        let resolveFetch;
        globalThis.fetch = vi.fn(
            () =>
                new Promise((res) => {
                    resolveFetch = res;
                }),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await vi.advanceTimersByTimeAsync(0);

        // Cache parse failed → falls through to null (or initial fallback).
        expect(result.current.data).toBeNull();
        expect(result.current.mapState).toBeNull();

        resolveFetch?.(makeFetchResponse({ data: {}, mapState: {} }));
        await flushAll();
    });
});

describe('useLiveData — BroadcastChannel leader election', () => {
    test('single tab becomes leader after election timeout fires', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        // Math.random stubbed to 0 → election timeout 0 → leader claimed.
        expect(result.current.isLeader).toBe(true);
    });

    test('when BroadcastChannel is unavailable, the tab is leader by fallback', async () => {
        // Pretend the browser doesn't expose BroadcastChannel (older clients / SSR).
        delete globalThis.BroadcastChannel;
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.isLeader).toBe(true);
    });

    test('leader is NOT claimed before the election timeout elapses', async () => {
        // Un-stub Math.random so the election uses a real (>0) delay. The
        // beforeEach stub forces 0ms, which is degenerate — this test proves
        // the setTimeout actually has to elapse before isLeader flips.
        Math.random.mockRestore();
        vi.spyOn(Math, 'random').mockReturnValue(0.5); // → 250ms delay

        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData(null, null));
        await act(async () => {
            await flushAll();
        });
        // Initial state: election started but timeout hasn't fired.
        expect(result.current.isLeader).toBe(false);

        // Just before the deadline — still not leader.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(200);
            await flushAll();
        });
        expect(result.current.isLeader).toBe(false);

        // Cross the deadline — leader claim fires.
        await act(async () => {
            await vi.advanceTimersByTimeAsync(100);
            await flushAll();
        });
        expect(result.current.isLeader).toBe(true);
    });

    test('opens a BroadcastChannel named "hd1-sse-leader" on mount', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        await act(async () => {
            renderHook(() => useLiveData(null, null));
            await flushAll();
        });

        expect(openChannels.length).toBeGreaterThanOrEqual(1);
        expect(openChannels.some((c) => c.name === 'hd1-sse-leader')).toBe(true);
    });

    test('unmount closes the BroadcastChannel', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(makeFetchResponse({ data: {}, mapState: {} })),
        );
        const { useLiveData } = await loadHookFresh();

        const { unmount } = await act(async () => {
            const result = renderHook(() => useLiveData(null, null));
            await flushAll();
            return result;
        });
        expect(openChannels.length).toBeGreaterThanOrEqual(1);

        await act(() => {
            unmount();
        });
        expect(openChannels.length).toBe(0);
    });
});

describe('useLiveData — initial fallback chain', () => {
    test('initialData/initialMapState surface before any poll resolves', async () => {
        // Fetch never resolves → snapshot.data stays null → fallback returns
        // initialData. This is the SSR-hydration window.
        globalThis.fetch = vi.fn(() => new Promise(() => {}));
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData({ ssr: true }, { 0: 'cyborgs' }));
        await flushAll();

        expect(result.current.data).toEqual({ ssr: true });
        expect(result.current.mapState).toEqual({ 0: 'cyborgs' });
        expect(result.current.status).toBe('polling');
    });

    test('live poll payload wins over initialData fallback', async () => {
        // Simple synchronous-resolving fetch: same shape as the success test
        // but with non-null initial fallbacks to confirm precedence.
        globalThis.fetch = vi.fn(() =>
            Promise.resolve(
                makeFetchResponse({
                    data: { live: true },
                    mapState: { 0: 'bugs' },
                }),
            ),
        );
        const { useLiveData } = await loadHookFresh();

        const { result } = renderHook(() => useLiveData({ ssr: true }, { 0: 'cyborgs' }));
        await act(async () => {
            await flushAll();
        });

        expect(result.current.data).toEqual({ live: true });
        expect(result.current.mapState).toEqual({ 0: 'bugs' });
        expect(result.current.status).toBe('live');
    });
});
