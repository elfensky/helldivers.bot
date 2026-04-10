// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ArchivesHeader from '@/features/archives/ArchivesHeader';

const noEffects = { headerScramble: false, watermark: false };
const defeatEffects = { headerScramble: true, watermark: false };

describe('ArchivesHeader', () => {
    it('renders propaganda copy on victory', () => {
        render(<ArchivesHeader isDefeat={false} effects={noEffects} />);
        expect(screen.getByText('Declassified Campaign Archives')).toBeDefined();
        expect(screen.getByText(/Bureau of War Information/)).toBeDefined();
    });

    it('renders resistance copy on defeat', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} />);
        expect(screen.getByText(/Leaked Campaign Records/)).toBeDefined();
        expect(screen.getByText(/intercepted by Cyberstan intelligence/)).toBeDefined();
    });

    it('does not show resistance text on victory', () => {
        render(<ArchivesHeader isDefeat={false} effects={noEffects} />);
        expect(screen.queryByText(/Leaked Campaign Records/)).toBeNull();
    });

    it('shows disable toggle on defeat', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} />);
        expect(screen.getByText('[Disable interference]')).toBeDefined();
    });

    it('does not show toggle on victory', () => {
        render(<ArchivesHeader isDefeat={false} effects={noEffects} />);
        expect(screen.queryByText(/interference/)).toBeNull();
    });

    it('shows enable toggle when effects are off', () => {
        render(<ArchivesHeader isDefeat={true} effects={noEffects} />);
        expect(screen.getByText('[Enable interference]')).toBeDefined();
    });
});
