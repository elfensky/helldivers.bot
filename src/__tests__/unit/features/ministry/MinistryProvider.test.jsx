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

describe('MinistryProvider — hijack scheduler', () => {
    test('fires onHijack with resolved altText after random(2-5 min)', () => {
        // rng = 0 → first hijack fires after HIJACK_MIN_MS (2 min).
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'Live Statistics',
            category: 'heading',
            scope: 'global',
            altText: undefined,
            onHijack,
            onFlicker: () => {},
        });

        act(() => vi.advanceTimersByTime(2 * 60 * 1000));

        expect(onHijack).toHaveBeenCalledTimes(1);
        // rng=0 → pickAlt returns the first entry of winning.heading.
        const arg = onHijack.mock.calls[0][0];
        expect(typeof arg).toBe('string');
        expect(arg.length).toBeGreaterThan(0);
    });

    test('explicit altText on descriptor wins over pool lookup', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'My Title',
            altText: 'Explicit Override',
            category: 'heading',
            scope: 'global',
            onHijack,
            onFlicker: () => {},
        });
        act(() => vi.advanceTimersByTime(2 * 60 * 1000));
        expect(onHijack).toHaveBeenCalledWith('Explicit Override');
    });

    test('does NOT pick archives-scoped descriptor when pathname is /', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="losing">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('a', {
            text: 'X',
            category: 'body',
            scope: 'archives',
            onHijack,
            onFlicker: () => {},
        });
        act(() => vi.advanceTimersByTime(2 * 60 * 1000));
        expect(onHijack).not.toHaveBeenCalled();
    });

    test('empty registry → tick reschedules without firing', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={() => {}} />
            </MinistryProvider>,
        );
        // 2 min → no callback (no registrations). 4 min → still no callback.
        act(() => vi.advanceTimersByTime(4 * 60 * 1000));
        // (No assertion beyond "didn't throw"; we'd see an error if scheduler crashed.)
    });

    test('flicker timer skips elements with isIdle === false', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onFlicker = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('f', {
            text: 'Hello world',
            category: 'heading',
            scope: 'global',
            onHijack: () => {},
            onFlicker,
        });
        ctx.setIdle('f', false);
        act(() => vi.advanceTimersByTime(15 * 1000));
        expect(onFlicker).not.toHaveBeenCalled();

        ctx.setIdle('f', true);
        act(() => vi.advanceTimersByTime(15 * 1000));
        expect(onFlicker).toHaveBeenCalledTimes(1);
    });

    test('reduced-motion: reduce → no scheduler ever fires', () => {
        reducedMotion = true;
        setupMatchMedia();
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        const onFlicker = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'X',
            category: 'heading',
            scope: 'global',
            onHijack,
            onFlicker,
        });
        act(() => vi.advanceTimersByTime(10 * 60 * 1000));
        expect(onHijack).not.toHaveBeenCalled();
        expect(onFlicker).not.toHaveBeenCalled();
    });

    test('document.hidden gate: no callback fires when tab is hidden', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        // jsdom defines `hidden` as a getter on Document.prototype, so this
        // defines an own property on `document` that *shadows* it. The shadow
        // has to be deleted again — restoring the prototype descriptor would
        // put back something that was never changed and leave the shadow in
        // place, making every later test in this file see a hidden tab (both
        // schedulers bail on document.hidden, so nothing would ever fire).
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get: () => true,
        });
        let ctx;
        const onHijack = vi.fn();
        const onFlicker = vi.fn();
        try {
            render(
                <MinistryProvider warTone="winning">
                    <Probe onCtx={(c) => (ctx = c)} />
                </MinistryProvider>,
            );
            ctx.register('h', {
                text: 'X',
                category: 'heading',
                scope: 'global',
                onHijack,
                onFlicker,
            });
            // Advance through both schedulers' fire windows.
            act(() => vi.advanceTimersByTime(5 * 60 * 1000));
            expect(onHijack).not.toHaveBeenCalled();
            expect(onFlicker).not.toHaveBeenCalled();
        } finally {
            delete document.hidden;
        }
    });
});

describe('MinistryProvider — forceHijack', () => {
    test('fires onHijack on first eligible descriptor and returns true', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'Live Statistics',
            category: 'heading',
            scope: 'global',
            onHijack,
            onFlicker: () => {},
        });

        let result;
        act(() => {
            result = ctx.forceHijack();
        });

        expect(result).toBe(true);
        expect(onHijack).toHaveBeenCalledTimes(1);
        const arg = onHijack.mock.calls[0][0];
        expect(typeof arg).toBe('string');
        expect(arg.length).toBeGreaterThan(0);
    });

    test('predicate filters which descriptor gets hijacked', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijackA = vi.fn();
        const onHijackB = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('a', {
            text: 'Skip Me',
            category: 'heading',
            scope: 'global',
            onHijack: onHijackA,
            onFlicker: () => {},
        });
        ctx.register('b', {
            text: 'Pick Me',
            category: 'heading',
            scope: 'global',
            onHijack: onHijackB,
            onFlicker: () => {},
        });

        let result;
        act(() => {
            result = ctx.forceHijack((text) => text === 'Pick Me');
        });

        expect(result).toBe(true);
        expect(onHijackA).not.toHaveBeenCalled();
        expect(onHijackB).toHaveBeenCalledTimes(1);
    });

    test('returns false when no eligible descriptor matches the predicate', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="winning">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'Live Statistics',
            category: 'heading',
            scope: 'global',
            onHijack,
            onFlicker: () => {},
        });

        let result;
        act(() => {
            result = ctx.forceHijack(() => false);
        });

        expect(result).toBe(false);
        expect(onHijack).not.toHaveBeenCalled();
    });

    test('returns false when warTone is null (no propaganda available)', () => {
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone={null}>
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('h', {
            text: 'Live Statistics',
            category: 'heading',
            scope: 'global',
            onHijack,
            onFlicker: () => {},
        });

        let result;
        act(() => {
            result = ctx.forceHijack();
        });

        expect(result).toBe(false);
        expect(onHijack).not.toHaveBeenCalled();
    });

    test('respects scope: archives-scoped descriptor not picked when pathname is /', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0);
        let ctx;
        const onHijack = vi.fn();
        render(
            <MinistryProvider warTone="losing">
                <Probe onCtx={(c) => (ctx = c)} />
            </MinistryProvider>,
        );
        ctx.register('a', {
            text: 'Archives Only',
            category: 'body',
            scope: 'archives',
            onHijack,
            onFlicker: () => {},
        });

        let result;
        act(() => {
            result = ctx.forceHijack();
        });

        expect(result).toBe(false);
        expect(onHijack).not.toHaveBeenCalled();
    });
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
