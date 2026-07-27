// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

vi.mock('react-slot-counter', () => ({
    default: vi.fn(
        ({
            value,
            startValue,
            startValueOnce,
            duration,
            direction,
            sequentialAnimationMode,
            useMonospaceWidth,
        }) => (
            <span
                data-testid="slot-counter"
                data-start-value={String(startValue)}
                data-start-value-once={String(startValueOnce)}
                data-duration={String(duration)}
                data-direction={String(direction)}
                data-sequential={String(sequentialAnimationMode)}
                data-monospace={String(useMonospaceWidth)}
            >
                {value}
            </span>
        ),
    ),
}));

import AnimatedStat from '@/shared/components/AnimatedStat/AnimatedStat';

function setReducedMotion(matches) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
    }));
}

describe('AnimatedStat', () => {
    beforeEach(() => {
        setReducedMotion(false);
    });

    it('renders the formatted value via SlotCounter', async () => {
        const { findByTestId } = render(<AnimatedStat value={12345} />);
        const el = await findByTestId('slot-counter');
        expect(el.textContent).toBe('12,345');
    });

    it('seeds startValue to the initial formatted value with startValueOnce', async () => {
        const { findByTestId } = render(<AnimatedStat value={12345} />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.startValue).toBe('12,345');
        expect(el.dataset.startValueOnce).toBe('true');
    });

    it('keeps startValue pinned to the first-mount value across rerenders', async () => {
        const { findByTestId, rerender } = render(<AnimatedStat value={12345} />);
        rerender(<AnimatedStat value={99999} />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.startValue).toBe('12,345');
        expect(el.textContent).toBe('99,999');
    });

    it('respects prefers-reduced-motion by rendering plain text', async () => {
        setReducedMotion(true);
        const { container, queryByTestId } = render(<AnimatedStat value={12345} />);
        await Promise.resolve();
        await Promise.resolve();
        expect(queryByTestId('slot-counter')).toBeNull();
        expect(container.textContent).toBe('12,345');
    });

    it('uses a custom format function when supplied', async () => {
        const { findByTestId } = render(
            <AnimatedStat value={1234} format={(n) => `${n} ok`} />,
        );
        const el = await findByTestId('slot-counter');
        expect(el.textContent).toBe('1234 ok');
    });

    it('renders "—" for null', async () => {
        const { findByTestId } = render(<AnimatedStat value={null} />);
        const el = await findByTestId('slot-counter');
        expect(el.textContent).toBe('—');
    });

    it('uses bottom-up direction when the value increases', async () => {
        const { findByTestId, rerender } = render(<AnimatedStat value={100} />);
        rerender(<AnimatedStat value={500} />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.direction).toBe('bottom-up');
    });

    it('uses top-down direction when the value decreases', async () => {
        const { findByTestId, rerender } = render(<AnimatedStat value={500} />);
        rerender(<AnimatedStat value={100} />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.direction).toBe('top-down');
    });

    it('honours an explicit direction prop override', async () => {
        const { findByTestId, rerender } = render(
            <AnimatedStat value={100} direction="top-down" />,
        );
        rerender(<AnimatedStat value={500} direction="top-down" />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.direction).toBe('top-down');
    });

    it('passes the duration prop straight through to the slot counter', async () => {
        const { findByTestId, rerender } = render(
            <AnimatedStat value={100} duration={0.9} />,
        );
        rerender(<AnimatedStat value={1_000_000} duration={0.9} />);
        const el = await findByTestId('slot-counter');
        expect(Number(el.dataset.duration)).toBe(0.9);
    });

    it('defaults sequentialAnimationMode to false and useMonospaceWidth to true', async () => {
        const { findByTestId } = render(<AnimatedStat value={100} />);
        const el = await findByTestId('slot-counter');
        expect(el.dataset.sequential).toBe('false');
        expect(el.dataset.monospace).toBe('true');
    });

    it('forwards sequentialAnimationMode and useMonospaceWidth overrides', async () => {
        const { findByTestId } = render(
            <AnimatedStat
                value={100}
                sequentialAnimationMode
                useMonospaceWidth={false}
            />,
        );
        const el = await findByTestId('slot-counter');
        expect(el.dataset.sequential).toBe('true');
        expect(el.dataset.monospace).toBe('false');
    });
});
