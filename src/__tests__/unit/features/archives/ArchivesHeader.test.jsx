// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchivesHeader from '@/features/archives/ArchivesHeader';

const noEffects = { outcomeReveal: null, headerScramble: false, watermark: false, statFlickers: false };
const scrambleEffects = { outcomeReveal: null, headerScramble: true, watermark: false, statFlickers: false };

describe('ArchivesHeader', () => {
    it('renders propaganda copy', () => {
        render(<ArchivesHeader effects={noEffects} />);
        expect(screen.getByText('Declassified Campaign Archives')).toBeDefined();
        expect(screen.getByText(/Bureau of War Information/)).toBeDefined();
    });

    it('renders plain text when headerScramble is false', () => {
        const { container } = render(<ArchivesHeader effects={noEffects} />);
        const glitchChars = container.querySelectorAll('.glitch-char');
        expect(glitchChars.length).toBe(0);
    });

    it('renders GlitchText components when headerScramble is true', () => {
        const { container } = render(<ArchivesHeader effects={scrambleEffects} />);
        // GlitchText renders glitch-char spans for scrambling characters
        const glitchChars = container.querySelectorAll('.glitch-char');
        expect(glitchChars.length).toBeGreaterThan(0);
    });
});
