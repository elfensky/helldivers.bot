// @vitest-environment jsdom
import { describe, test, expect } from 'vitest';
import { render } from '@testing-library/react';
import ArchivesHeader from '@/features/archives/ArchivesHeader';

describe('ArchivesHeader', () => {
    test('renders h1 with PROPAGANDA_TITLE as a Hijackable', () => {
        const { container } = render(<ArchivesHeader />);
        const h1 = container.querySelector('h1');
        expect(h1).not.toBeNull();
        expect(h1.textContent).toBe('Declassified Campaign Archives');
    });

    test('renders body paragraph with PROPAGANDA_BODY', () => {
        const { container } = render(<ArchivesHeader />);
        const p = container.querySelector('p');
        expect(p).not.toBeNull();
        expect(p.textContent.length).toBeGreaterThan(0);
    });

    test('no EffectsToggle button present (removed)', () => {
        const { container } = render(<ArchivesHeader />);
        const btns = container.querySelectorAll('button');
        expect(btns.length).toBe(0);
    });
});
