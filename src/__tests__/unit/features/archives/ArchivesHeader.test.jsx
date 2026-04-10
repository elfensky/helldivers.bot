// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock the dynamic import — render text directly in tests
vi.mock('@/features/archives/ClientGlitchText', () => ({
    default: ({ text, className }) => <span className={className}>{text}</span>,
}));

import ArchivesHeader from '@/features/archives/ArchivesHeader';
import { RESISTANCE_MESSAGES } from '@/features/archives/resistanceMessages.mjs';

const noEffects = { headerScramble: false, watermark: false };
const defeatEffects = { headerScramble: true, watermark: false };

describe('ArchivesHeader', () => {
    it('renders propaganda copy on victory', () => {
        render(<ArchivesHeader isDefeat={false} effects={noEffects} />);
        expect(screen.getByText('Declassified Campaign Archives')).toBeDefined();
        expect(screen.getByText(/Bureau of War Information/)).toBeDefined();
    });

    it('renders resistance copy on defeat with message index', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} defeatMessageIndex={0} />);
        expect(screen.getByText(/Leaked Campaign Records/)).toBeDefined();
        expect(screen.getByText(RESISTANCE_MESSAGES[0])).toBeDefined();
    });

    it('renders different message for different index', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} defeatMessageIndex={3} />);
        expect(screen.getByText(RESISTANCE_MESSAGES[3])).toBeDefined();
    });

    it('does not show resistance text on victory', () => {
        render(<ArchivesHeader isDefeat={false} effects={noEffects} />);
        expect(screen.queryByText(/Leaked Campaign Records/)).toBeNull();
    });

    it('does not render toggle (moved to ArchivesClient)', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} defeatMessageIndex={0} />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('falls back to first message for invalid index', () => {
        render(<ArchivesHeader isDefeat={true} effects={defeatEffects} defeatMessageIndex={999} />);
        expect(screen.getByText(RESISTANCE_MESSAGES[0])).toBeDefined();
    });
});
