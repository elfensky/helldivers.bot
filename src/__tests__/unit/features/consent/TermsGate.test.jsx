// @vitest-environment jsdom
import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

vi.mock('@/features/consent/TermsPrompt', () => ({
    default: () => <p>terms prompt</p>,
}));

import TermsGate from '@/features/consent/TermsGate';

const page = <p>page content</p>;

describe('TermsGate', () => {
    test('shows the page when the terms are accepted', () => {
        render(<TermsGate needsTerms={false}>{page}</TermsGate>);
        expect(screen.getByText('page content')).toBeInTheDocument();
        expect(screen.queryByText('terms prompt')).toBeNull();
    });

    test('shows the terms page instead of the content until they are accepted', () => {
        vi.mocked(usePathname).mockReturnValue('/profile');
        render(<TermsGate needsTerms>{page}</TermsGate>);
        expect(screen.getByText('terms prompt')).toBeInTheDocument();
        expect(screen.queryByText('page content')).toBeNull();
    });

    test.each(['/legal', '/privacy'])('leaves %s readable before acceptance', (path) => {
        vi.mocked(usePathname).mockReturnValue(path);
        render(<TermsGate needsTerms>{page}</TermsGate>);
        expect(screen.getByText('page content')).toBeInTheDocument();
    });

    test('a path that only starts with the same letters is gated', () => {
        vi.mocked(usePathname).mockReturnValue('/legalese');
        render(<TermsGate needsTerms>{page}</TermsGate>);
        expect(screen.getByText('terms prompt')).toBeInTheDocument();
    });
});
