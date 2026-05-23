// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import MinistryProvider from '@/features/ministry/MinistryProvider';
import { useMinistryContext } from '@/features/ministry/MinistryContext.mjs';

vi.mock('next/navigation', () => ({
    usePathname: () => '/',
}));

let reducedMotion = false;
function setupMatchMedia() {
    window.matchMedia = vi.fn((query) => ({
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

function Probe({ onCtx }) {
    const ctx = useMinistryContext();
    onCtx(ctx);
    return null;
}

beforeEach(() => {
    reducedMotion = false;
    setupMatchMedia();
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

describe('MinistryProvider — disabled states', () => {
    test('warTone null → context.enabled === false; register is a no-op', () => {
        let ctx;
        render(
            <MinistryProvider warTone={null}>
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx).not.toBeNull();
        expect(ctx.enabled).toBe(false);
        expect(typeof ctx.register).toBe('function');
        // Calling register should not throw and should not record anything we can observe.
        ctx.register('x', {
            text: 'X',
            category: 'heading',
            scope: 'global',
            onHijack: () => {},
            onFlicker: () => {},
        });
        // Advance time — no scheduler should be running.
        act(() => vi.advanceTimersByTime(10 * 60 * 1000));
        // (No assertion needed beyond "didn't throw".)
    });

    test('prefers-reduced-motion: reduce → context.enabled === false even with warTone set', () => {
        reducedMotion = true;
        setupMatchMedia();
        let ctx;
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx.enabled).toBe(false);
    });

    test('warTone set and reduced-motion off → context.enabled === true', () => {
        let ctx;
        render(
            <MinistryProvider warTone="losing">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        expect(ctx.enabled).toBe(true);
        expect(ctx.warTone).toBe('losing');
    });
});
