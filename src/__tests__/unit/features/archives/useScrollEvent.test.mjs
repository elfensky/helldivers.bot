// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollEvent } from '@/shared/hooks/useScrollEvent.mjs';

// useScrollEvent computes which event card is "selected" based on scroll
// position. Depends heavily on getBoundingClientRect (which jsdom returns
// 0/0/0/0 by default) — tests inject layout values per card and stub
// requestAnimationFrame to run sync so scroll events fire updateSelection
// deterministically.

const SAMPLE_EVENTS = [
    { event_id: 1, enemy: 0, region: 5, type: 'defend', status: 'active' },
    { event_id: 2, enemy: 1, region: 6, type: 'attack', status: 'active' },
    { event_id: 3, enemy: 2, region: 7, type: 'defend', status: 'active' },
];

function buildRail(events, getRectByKey) {
    // Build a DOM rail with one [data-event-key] child per event. Each child
    // can have a custom getBoundingClientRect via the getRectByKey map.
    const rail = document.createElement('div');
    for (const e of events) {
        const card = document.createElement('div');
        const key = `evt-${e.event_id}-${e.enemy}-${e.region}-${e.type}`;
        card.setAttribute('data-event-key', key);
        if (getRectByKey?.[key]) {
            card.getBoundingClientRect = () => getRectByKey[key];
        }
        rail.appendChild(card);
    }
    document.body.appendChild(rail);
    return rail;
}

// eventKey from @/shared/utils/game/eventKey.mjs builds keys deterministically
// from event fields. We mirror that here for our fixtures.
function fixtureKey(e) {
    return `evt-${e.event_id}-${e.enemy}-${e.region}-${e.type}`;
}

// We need the hook's lookup map to find events by the SAME key shape the
// real eventKey() produces. The hook imports eventKey internally — so we
// mock it to use our fixture format.
vi.mock('@/shared/utils/game/eventKey.mjs', () => ({
    eventKey: (e) => `evt-${e.event_id}-${e.enemy}-${e.region}-${e.type}`,
}));

let originalRAF;
let originalCAF;
let pendingRAFs;
// Capture original viewport property descriptors so afterEach can restore
// them — without this, the Object.defineProperty stubs leak to subsequent
// test files run by the same jsdom worker.
let originalDescriptors;

function captureDescriptor(target, key) {
    return Object.getOwnPropertyDescriptor(target, key);
}
function restoreDescriptor(target, key, descriptor) {
    if (descriptor) {
        Object.defineProperty(target, key, descriptor);
    } else {
        delete target[key];
    }
}

beforeEach(() => {
    document.body.innerHTML = '';
    // Stub requestAnimationFrame to run synchronously when we choose.
    pendingRAFs = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (cb) => {
        const id = pendingRAFs.length + 1;
        pendingRAFs.push({ id, cb, cancelled: false });
        return id;
    };
    globalThis.cancelAnimationFrame = (id) => {
        const entry = pendingRAFs.find((r) => r.id === id);
        if (entry) entry.cancelled = true;
    };

    // Capture original descriptors before stubbing.
    originalDescriptors = {
        innerHeight: captureDescriptor(window, 'innerHeight'),
        innerWidth: captureDescriptor(window, 'innerWidth'),
        scrollY: captureDescriptor(window, 'scrollY'),
        scrollHeight: captureDescriptor(document.documentElement, 'scrollHeight'),
    };

    // Stub viewport dimensions to known values.
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 });
    Object.defineProperty(window, 'scrollY', {
        configurable: true,
        writable: true,
        value: 0,
    });
    Object.defineProperty(document.documentElement, 'scrollHeight', {
        configurable: true,
        value: 2000,
    });
});

afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    // Restore the original property descriptors so subsequent tests (and
    // subsequent test files in the same pool) don't inherit the stubs.
    restoreDescriptor(window, 'innerHeight', originalDescriptors.innerHeight);
    restoreDescriptor(window, 'innerWidth', originalDescriptors.innerWidth);
    restoreDescriptor(window, 'scrollY', originalDescriptors.scrollY);
    restoreDescriptor(
        document.documentElement,
        'scrollHeight',
        originalDescriptors.scrollHeight,
    );
    document.body.innerHTML = '';
    vi.restoreAllMocks();
});

function flushRAFs() {
    // Run all queued rAFs (in order). Each callback may schedule more —
    // process the snapshot only, mirroring browser semantics for a single frame.
    const snapshot = [...pendingRAFs];
    pendingRAFs = [];
    for (const entry of snapshot) {
        if (!entry.cancelled) entry.cb();
    }
}

describe('useScrollEvent — guards', () => {
    test('with no events, returns { selectedEvent: null } and never installs scroll listener', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');

        const { result } = renderHook(() => useScrollEvent([]));

        expect(result.current.selectedEvent).toBeNull();
        // Scroll listener guarded by `!rail || !events.length`.
        expect(addSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0);
    });

    test('with events but no railRef.current (ref never attached), no listener and no selection', () => {
        const addSpy = vi.spyOn(window, 'addEventListener');
        const { result } = renderHook(() => useScrollEvent(SAMPLE_EVENTS));
        // result.current.railRef.current is still null — user never attached it.
        expect(result.current.selectedEvent).toBeNull();
        expect(addSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0);
    });
});

describe('useScrollEvent — anchor + selection', () => {
    function setHeaderHeight(h) {
        const header = document.createElement('div');
        header.id = 'header';
        Object.defineProperty(header, 'offsetHeight', {
            configurable: true,
            value: h,
        });
        document.body.appendChild(header);
    }

    test('selects the card whose mid-point is nearest the anchor on mount', () => {
        setHeaderHeight(80);
        const rects = {
            [fixtureKey(SAMPLE_EVENTS[0])]: { top: 100, bottom: 200, height: 100 },
            [fixtureKey(SAMPLE_EVENTS[1])]: { top: 300, bottom: 400, height: 100 },
            [fixtureKey(SAMPLE_EVENTS[2])]: { top: 600, bottom: 700, height: 100 },
        };
        const rail = buildRail(SAMPLE_EVENTS, rects);

        const { result, rerender } = renderHook(
            ({ events }) => {
                const r = useScrollEvent(events);
                r.railRef.current = rail; // attach BEFORE effect runs
                return r;
            },
            { initialProps: { events: [] } },
        );

        // Pass different events to trigger effect re-run.
        rerender({ events: SAMPLE_EVENTS });

        // Mount runs updateSelection() once synchronously inside the effect.
        // Anchor at ~354px, card 2 (mid 350px) is closest → SAMPLE_EVENTS[1].
        expect(result.current.selectedEvent).toEqual(SAMPLE_EVENTS[1]);
    });

    test('scroll triggers an updateSelection via requestAnimationFrame', () => {
        setHeaderHeight(80);
        const rects = {
            [fixtureKey(SAMPLE_EVENTS[0])]: { top: 100, bottom: 200, height: 100 },
            [fixtureKey(SAMPLE_EVENTS[1])]: { top: 300, bottom: 400, height: 100 },
            [fixtureKey(SAMPLE_EVENTS[2])]: { top: 600, bottom: 700, height: 100 },
        };
        const rail = buildRail(SAMPLE_EVENTS, rects);
        const { result, rerender } = renderHook(
            ({ events }) => {
                const r = useScrollEvent(events);
                r.railRef.current = rail;
                return r;
            },
            { initialProps: { events: [] } },
        );
        rerender({ events: SAMPLE_EVENTS });
        expect(result.current.selectedEvent).toEqual(SAMPLE_EVENTS[1]);

        // Simulate scroll: cards 2 and 3 shift up so card 3 becomes closest.
        rects[fixtureKey(SAMPLE_EVENTS[0])] = { top: -100, bottom: 0, height: 100 };
        rects[fixtureKey(SAMPLE_EVENTS[1])] = { top: 100, bottom: 200, height: 100 };
        rects[fixtureKey(SAMPLE_EVENTS[2])] = { top: 300, bottom: 400, height: 100 };
        // Re-attach the updated rects (buildRail wires closures; do it again).
        for (const card of rail.querySelectorAll('[data-event-key]')) {
            const key = card.dataset.eventKey;
            card.getBoundingClientRect = () => rects[key];
        }

        act(() => {
            window.dispatchEvent(new Event('scroll'));
            flushRAFs();
        });

        // Anchor is still ~354; now card 3 (mid 350) is closest.
        expect(result.current.selectedEvent).toEqual(SAMPLE_EVENTS[2]);
    });
});

describe('useScrollEvent — visibility gating', () => {
    function setHeaderHeight(h) {
        const header = document.createElement('div');
        header.id = 'header';
        Object.defineProperty(header, 'offsetHeight', {
            configurable: true,
            value: h,
        });
        document.body.appendChild(header);
    }

    test('cards entirely above the header are NOT selected — selectedEvent goes null', () => {
        setHeaderHeight(80);
        const rects = {
            // Single card, entirely above the header (bottom < headerHeight).
            [fixtureKey(SAMPLE_EVENTS[0])]: {
                top: -200,
                bottom: -50,
                height: 150,
            },
        };
        const events = [SAMPLE_EVENTS[0]];
        const rail = buildRail(events, rects);

        const { result, rerender } = renderHook(
            ({ events: e }) => {
                const r = useScrollEvent(e);
                r.railRef.current = rail;
                return r;
            },
            { initialProps: { events: [] } },
        );
        rerender({ events });

        // Card is the "best" (only) match but fails the isVisible check.
        expect(result.current.selectedEvent).toBeNull();
    });

    test('cards entirely below the viewport are NOT selected', () => {
        setHeaderHeight(80);
        const rects = {
            [fixtureKey(SAMPLE_EVENTS[0])]: {
                top: 900, // window.innerHeight is 800 → entirely below
                bottom: 1000,
                height: 100,
            },
        };
        const events = [SAMPLE_EVENTS[0]];
        const rail = buildRail(events, rects);

        const { result, rerender } = renderHook(
            ({ events: e }) => {
                const r = useScrollEvent(e);
                r.railRef.current = rail;
                return r;
            },
            { initialProps: { events: [] } },
        );
        rerender({ events });

        expect(result.current.selectedEvent).toBeNull();
    });
});

describe('useScrollEvent — anchor switches between mobile and desktop', () => {
    function setHeaderHeight(h) {
        const header = document.createElement('div');
        header.id = 'header';
        Object.defineProperty(header, 'offsetHeight', {
            configurable: true,
            value: h,
        });
        document.body.appendChild(header);
    }

    test('mobile (<1024px) uses the lower anchor (75%) — card closer to viewport bottom wins', () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 600 });
        setHeaderHeight(50);
        // visibleHeight = 800 - 50 = 750. ratio = 0.75 + 0 = 0.75.
        // anchor = 50 + 750 * 0.75 = 612.5px.
        const rects = {
            // Top card mid at 150 — far from anchor.
            [fixtureKey(SAMPLE_EVENTS[0])]: { top: 100, bottom: 200, height: 100 },
            // Middle card mid at 350 — still far.
            [fixtureKey(SAMPLE_EVENTS[1])]: { top: 300, bottom: 400, height: 100 },
            // Bottom card mid at 650 — nearest to 612.
            [fixtureKey(SAMPLE_EVENTS[2])]: { top: 600, bottom: 700, height: 100 },
        };
        const rail = buildRail(SAMPLE_EVENTS, rects);
        const { result, rerender } = renderHook(
            ({ events }) => {
                const r = useScrollEvent(events);
                r.railRef.current = rail;
                return r;
            },
            { initialProps: { events: [] } },
        );
        rerender({ events: SAMPLE_EVENTS });

        // Lower anchor → bottom card selected.
        expect(result.current.selectedEvent).toEqual(SAMPLE_EVENTS[2]);
    });
});

describe('useScrollEvent — cleanup', () => {
    test('removes scroll listener and cancels pending rAF on unmount', () => {
        const rail = buildRail(SAMPLE_EVENTS, {});
        const removeSpy = vi.spyOn(window, 'removeEventListener');

        const { unmount, rerender } = renderHook(
            ({ events }) => {
                const r = useScrollEvent(events);
                r.railRef.current = rail;
                return r;
            },
            { initialProps: { events: [] } },
        );
        rerender({ events: SAMPLE_EVENTS });

        // Trigger a scroll to schedule a rAF.
        window.dispatchEvent(new Event('scroll'));
        expect(pendingRAFs.length).toBeGreaterThan(0);
        const lastRAF = pendingRAFs[pendingRAFs.length - 1];

        unmount();

        // Listener removed.
        expect(removeSpy.mock.calls.some(([type]) => type === 'scroll')).toBe(true);
        // rAF cancelled.
        expect(lastRAF.cancelled).toBe(true);
    });
});
