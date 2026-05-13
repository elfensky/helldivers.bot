// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useHeaderGlassFilter } from '@/shared/hooks/useHeaderGlassFilter.mjs';

// useHeaderGlassFilter reads `--header-glass-filter` from <html>.style and
// re-reads it on every <html> style attribute change via MutationObserver.
// jsdom's MutationObserver fires async (microtask); we flush with await.

// Sanity helper — clear all inline styles on <html> before each test so
// the var-not-set fallback can be observed cleanly.
function clearHtmlStyle() {
    document.documentElement.removeAttribute('style');
}

beforeEach(() => {
    clearHtmlStyle();
});

afterEach(() => {
    clearHtmlStyle();
    vi.restoreAllMocks();
});

describe('useHeaderGlassFilter — initial value', () => {
    test('returns "none" when --header-glass-filter is not set on <html>', () => {
        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('none');
    });

    test('reads the CSS var on mount when set BEFORE the hook mounts', () => {
        document.documentElement.style.setProperty(
            '--header-glass-filter',
            'blur(8.8px)',
        );

        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('blur(8.8px)');
    });

    test('trims whitespace from the CSS var value', () => {
        document.documentElement.style.setProperty(
            '--header-glass-filter',
            '   blur(4px)   ',
        );

        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('blur(4px)');
    });

    test('treats an empty-string property value as "none" (fallback)', () => {
        document.documentElement.style.setProperty('--header-glass-filter', '');

        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('none');
    });
});

describe('useHeaderGlassFilter — MutationObserver updates', () => {
    test('updates when <html>.style is mutated with a new --header-glass-filter value', async () => {
        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('none');

        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(8.8px)',
            );
            // Let MutationObserver flush.
            await Promise.resolve();
        });

        expect(result.current).toBe('blur(8.8px)');
    });

    test('does NOT re-render when the same value is written twice (dedup against last)', async () => {
        const renders = [];
        const { result } = renderHook(() => {
            const v = useHeaderGlassFilter();
            renders.push(v);
            return v;
        });

        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(8.8px)',
            );
            await Promise.resolve();
        });
        const rendersAfterFirstChange = renders.length;
        expect(result.current).toBe('blur(8.8px)');

        // Write the same value again — should NOT trigger an extra render.
        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(8.8px)',
            );
            await Promise.resolve();
        });

        expect(renders.length).toBe(rendersAfterFirstChange);
    });

    test('updates again when the value changes to something different', async () => {
        const { result } = renderHook(() => useHeaderGlassFilter());

        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(4px)',
            );
            await Promise.resolve();
        });
        expect(result.current).toBe('blur(4px)');

        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(12px)',
            );
            await Promise.resolve();
        });
        expect(result.current).toBe('blur(12px)');
    });

    test('observes <html> with attributeFilter: ["style"] — non-style changes do NOT fire reads', async () => {
        const { result } = renderHook(() => useHeaderGlassFilter());
        expect(result.current).toBe('none');

        // Mutate a non-style attribute on <html>.
        await act(async () => {
            document.documentElement.setAttribute('lang', 'en');
            await Promise.resolve();
        });

        // No style change → no MutationObserver fire → still 'none'.
        expect(result.current).toBe('none');
    });
});

describe('useHeaderGlassFilter — cleanup', () => {
    // Capture/restore MutationObserver in afterEach (not at the end of the
    // test body) so a thrown assertion does NOT leave the fake class
    // installed for subsequent tests.
    let realMutationObserver;
    afterEach(() => {
        if (realMutationObserver) {
            globalThis.MutationObserver = realMutationObserver;
            realMutationObserver = undefined;
        }
    });

    test('disconnects the MutationObserver on unmount', async () => {
        const disconnectSpy = vi.fn();
        realMutationObserver = globalThis.MutationObserver;
        // Wrap real MutationObserver so we can spy on disconnect.
        globalThis.MutationObserver = class extends realMutationObserver {
            constructor(cb) {
                super(cb);
                this.disconnect = vi.fn().mockImplementation(() => {
                    disconnectSpy();
                    return super.disconnect();
                });
            }
        };

        const { unmount } = renderHook(() => useHeaderGlassFilter());

        unmount();

        expect(disconnectSpy).toHaveBeenCalledTimes(1);
    });

    test('observes <html> with attributeFilter: ["style"] — the constraint flows through to MutationObserver.observe()', () => {
        // Strengthens the prior "non-style attr does not fire" test, which
        // would pass trivially if the observer simply re-read an unchanged
        // CSS var. Here we directly inspect the args passed to observe().
        const observeSpy = vi.fn();
        realMutationObserver = globalThis.MutationObserver;
        globalThis.MutationObserver = class extends realMutationObserver {
            observe(target, opts) {
                observeSpy(target, opts);
                return super.observe(target, opts);
            }
        };

        renderHook(() => useHeaderGlassFilter());

        expect(observeSpy).toHaveBeenCalledTimes(1);
        const [target, opts] = observeSpy.mock.calls[0];
        expect(target).toBe(document.documentElement);
        expect(opts).toEqual({
            attributes: true,
            attributeFilter: ['style'],
        });
    });

    test('after unmount, subsequent <html>.style writes do NOT update the (now-orphaned) state', async () => {
        const { result, unmount } = renderHook(() => useHeaderGlassFilter());

        unmount();

        // result.current is the LAST committed snapshot before unmount.
        const lastValueBeforeUnmount = result.current;

        await act(async () => {
            document.documentElement.style.setProperty(
                '--header-glass-filter',
                'blur(99px)',
            );
            await Promise.resolve();
        });

        // Hook unmounted, observer disconnected → no setState → result stale.
        expect(result.current).toBe(lastValueBeforeUnmount);
    });
});
