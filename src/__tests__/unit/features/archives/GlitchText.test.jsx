// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import GlitchText from '@/features/archives/GlitchText';

describe('GlitchText', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders final text immediately when active is false', () => {
        const { container } = render(<GlitchText text="HELLO" active={false} />);
        expect(container.textContent).toBe('HELLO');
        expect(container.querySelectorAll('.glitch-char').length).toBe(0);
    });

    it('renders scrambled characters when active', () => {
        const { container } = render(<GlitchText text="TEST" active={true} delay={0} duration={1000} />);
        const glitchChars = container.querySelectorAll('.glitch-char');
        // 4 non-space characters should be scrambling
        expect(glitchChars.length).toBe(4);
    });

    it('settles all characters after duration', () => {
        const { container } = render(<GlitchText text="AB" active={true} delay={0} duration={100} />);
        // Advance past delay + duration + buffer, wrapped in act for state updates
        act(() => { vi.advanceTimersByTime(200); });
        expect(container.textContent).toBe('AB');
        expect(container.querySelectorAll('.glitch-char').length).toBe(0);
    });

    it('preserves spaces without scrambling', () => {
        const { container } = render(<GlitchText text="A B" active={true} delay={0} duration={1000} />);
        // Only 2 glitch chars (A and B), space is preserved
        expect(container.querySelectorAll('.glitch-char').length).toBe(2);
    });
});
