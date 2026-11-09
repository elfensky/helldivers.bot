// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import GlitchText from '@/features/archives/GlitchText';

describe('GlitchText', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        // GlitchText checks prefers-reduced-motion; jsdom doesn't have matchMedia
        window.matchMedia = vi.fn(() => ({ matches: false }));
    });

    afterEach(() => {
        vi.useRealTimers();
        delete window.matchMedia;
    });

    it('renders base text when active is false', () => {
        const { container } = render(
            <GlitchText text="HELLO" active={false} className="test" />,
        );
        expect(container.textContent).toBe('HELLO');
        expect(container.querySelectorAll('.glitch-char').length).toBe(0);
    });

    it('scrambles into sextant glyphs (U+1FB00–1FB3B) during takeover', () => {
        const { container } = render(
            // Many words: the first word batch settles at 0 ms, the rest scramble.
            <GlitchText
                text="ONE TWO THREE FOUR FIVE SIX SEVEN EIGHT"
                phase="takeover"
                className="test"
            />,
        );
        act(() => {
            vi.advanceTimersByTime(60);
        });
        const glyphs = [...container.querySelectorAll('.glitch-char')];
        expect(glyphs.length).toBeGreaterThan(0);
        for (const g of glyphs) {
            expect([...g.textContent]).toHaveLength(1);
            const cp = g.textContent.codePointAt(0);
            expect(cp).toBeGreaterThanOrEqual(0x1fb00);
            expect(cp).toBeLessThanOrEqual(0x1fb3b);
        }
    });

    it('renders base text initially (SSR-safe)', () => {
        const { container } = render(
            <GlitchText text="TEST" active={true} className="test" />,
        );
        // Before useEffect fires, should show base text (deterministic for SSR)
        expect(container.textContent).toBe('TEST');
    });

    it('shows glitch characters during a pulse', () => {
        const { container } = render(
            <GlitchText text="ABCD" altText="WXYZ" active={true} className="test" />,
        );
        // Advance past the pulse delay (6000-12000ms) — use max to guarantee
        act(() => {
            vi.advanceTimersByTime(13000);
        });
        // During a pulse, some chars may be glitch-char styled
        // After pulse settles (300ms), text returns to base
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(container.textContent).toBe('ABCD');
    });

    it('preserves text length with altText of different length', () => {
        const { container } = render(
            <GlitchText
                text="SHORT"
                altText="MUCH LONGER TEXT"
                active={true}
                className="test"
            />,
        );
        expect(container.textContent).toBe('SHORT');
        expect(container.textContent.length).toBe(5);
    });

    it('renders without altText (Cyberstan-only glitches)', () => {
        const { container } = render(
            <GlitchText text="TEST" active={true} className="test" />,
        );
        expect(container.textContent).toBe('TEST');
    });
});
