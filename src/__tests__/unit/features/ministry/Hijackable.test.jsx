// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, render as rtlRender } from '@testing-library/react';
import Hijackable from '@/features/ministry/Hijackable';
import { MinistryContext } from '@/features/ministry/MinistryContext.mjs';

describe('Hijackable — idle render (no provider)', () => {
    test('renders as a plain <span> by default with text content', () => {
        const { container } = render(<Hijackable text="Hello" />);
        const span = container.firstChild;
        expect(span.tagName).toBe('SPAN');
        expect(span.textContent).toBe('Hello');
        expect(span.getAttribute('aria-label')).toBeNull();
        expect(span.querySelector('.glitch-char')).toBeNull();
    });

    test('as="h1" renders as an <h1>', () => {
        const { container } = render(
            <Hijackable as="h1" category="heading" text="My Title" />,
        );
        expect(container.firstChild.tagName).toBe('H1');
        expect(container.firstChild.textContent).toBe('My Title');
    });

    test('className is applied to the wrapper element', () => {
        const { container } = render(
            <Hijackable as="h2" category="heading" text="X" className="font-display" />,
        );
        expect(container.firstChild.className).toContain('font-display');
    });

    test('banned categories (nav/button/link) throw a dev assertion', () => {
        // In dev (process.env.NODE_ENV !== 'production'), this should throw.
        // We invoke the component and assert React surfaces an error.
        expect(() => render(<Hijackable as="span" category="nav" text="X" />)).toThrow();
        expect(() =>
            render(<Hijackable as="span" category="button" text="X" />),
        ).toThrow();
    });
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
});

function makeFakeCtx() {
    const callbacks = new Map();
    return {
        ctx: {
            register: vi.fn((id, descriptor) => callbacks.set(id, descriptor)),
            unregister: vi.fn((id) => callbacks.delete(id)),
            setIdle: vi.fn(),
            warTone: 'winning',
            enabled: true,
        },
        // Fire the registered onHijack callback for the first registered id.
        fireHijack(altText) {
            const [first] = callbacks.values();
            act(() => first.onHijack(altText));
        },
    };
}

describe('Hijackable — provider-wired hijack render', () => {
    test('registers on mount via context.register', () => {
        const { ctx } = makeFakeCtx();
        rtlRender(
            <MinistryContext.Provider value={ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        expect(ctx.register).toHaveBeenCalledTimes(1);
        const [id, descriptor] = ctx.register.mock.calls[0];
        expect(typeof id).toBe('string');
        expect(descriptor.text).toBe('My Title');
        expect(descriptor.category).toBe('heading');
        expect(descriptor.scope).toBe('global');
        expect(typeof descriptor.onHijack).toBe('function');
        expect(typeof descriptor.onFlicker).toBe('function');
    });

    test('unregisters on unmount', () => {
        const { ctx } = makeFakeCtx();
        const { unmount } = rtlRender(
            <MinistryContext.Provider value={ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        unmount();
        expect(ctx.unregister).toHaveBeenCalledTimes(1);
    });

    test('onHijack call switches render to sr-only truth + aria-hidden propaganda overlay', () => {
        const fake = makeFakeCtx();
        const { container } = rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        fake.fireHijack('PROPAGANDA');
        const h1 = container.querySelector('h1');
        // Truth still in DOM as sr-only sibling — AT announces it.
        const truth = h1.querySelector('.sr-only');
        expect(truth?.textContent).toBe('My Title');
        // Propaganda overlay marked aria-hidden so AT never reads it.
        const overlay = h1.querySelector('[aria-hidden="true"]');
        expect(overlay).not.toBeNull();
    });

    test('after CYCLE_MS, render returns to plain idle (no sr-only, no overlay)', async () => {
        const fake = makeFakeCtx();
        const { container } = rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        fake.fireHijack('PROPAGANDA');
        // Cycle ends at 2600ms.
        act(() => vi.advanceTimersByTime(2600));
        const h1 = container.querySelector('h1');
        expect(h1.querySelector('.sr-only')).toBeNull();
        expect(h1.querySelector('[aria-hidden="true"]')).toBeNull();
        expect(h1.textContent).toBe('My Title');
    });

    test('without a provider, register/unregister are skipped — component still renders text', () => {
        const { container } = rtlRender(
            <Hijackable as="h1" category="heading" text="No Provider" />,
        );
        expect(container.firstChild.textContent).toBe('No Provider');
    });

    test('onFlicker call renders sr-only truth + aria-hidden glyph swap', () => {
        const fake = makeFakeCtx();
        const { container } = rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        // Get the first registered onFlicker callback and invoke it
        const firstDescriptor = fake.ctx.register.mock.calls[0][1];
        act(() => firstDescriptor.onFlicker(2, 200)); // charIndex=2, 200ms

        const h1 = container.querySelector('h1');
        expect(h1.querySelector('.sr-only')?.textContent).toBe('My Title');
        const overlay = h1.querySelector('[aria-hidden="true"]');
        expect(overlay).not.toBeNull();
        expect(overlay.querySelector('.glitch-char')).not.toBeNull();
    });

    test('ctx.setIdle is called when phase changes', () => {
        const fake = makeFakeCtx();
        rtlRender(
            <MinistryContext.Provider value={fake.ctx}>
                <Hijackable as="h1" category="heading" text="My Title" />
            </MinistryContext.Provider>,
        );
        // Mount triggers initial setIdle(id, true) since phase starts idle
        expect(fake.ctx.setIdle).toHaveBeenCalled();
        const callsBefore = fake.ctx.setIdle.mock.calls.length;
        fake.fireHijack('PROPAGANDA');
        // setIdle should have been called again for the phase change to takeover
        expect(fake.ctx.setIdle.mock.calls.length).toBeGreaterThan(callsBefore);
    });
});
