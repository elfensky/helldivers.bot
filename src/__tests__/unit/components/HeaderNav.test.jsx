// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import HeaderNav from '@/components/layout/Navigation/HeaderNav';

describe('HeaderNav', () => {
    beforeEach(() => {
        vi.mocked(usePathname).mockReturnValue('/');
    });

    test('renders 3 navigation links', () => {
        render(<HeaderNav />);
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(3);
    });

    test('renders correct labels', () => {
        render(<HeaderNav />);
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.getByText('Archives')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
    });

    test('active link has "header-nav-link--active" class on home', () => {
        vi.mocked(usePathname).mockReturnValue('/');
        render(<HeaderNav />);
        const homeLink = screen.getByRole('link', { name: /Live/i });
        expect(homeLink.className).toContain('header-nav-link--active');
    });

    test('archives link has "header-nav-link--active" class when on archives', () => {
        vi.mocked(usePathname).mockReturnValue('/archives');
        render(<HeaderNav />);
        const archivesLink = screen.getByRole('link', { name: /Archives/i });
        expect(archivesLink.className).toContain('header-nav-link--active');

        const homeLink = screen.getByRole('link', { name: /Live/i });
        expect(homeLink.className).not.toContain('header-nav-link--active');
    });

    test('non-active links do not have "header-nav-link--active" class', () => {
        vi.mocked(usePathname).mockReturnValue('/about');
        render(<HeaderNav />);
        const homeLink = screen.getByRole('link', { name: /Live/i });
        expect(homeLink.className).not.toContain('header-nav-link--active');

        const archivesLink = screen.getByRole('link', { name: /Archives/i });
        expect(archivesLink.className).not.toContain('header-nav-link--active');
    });

    test('links have correct href attributes', () => {
        render(<HeaderNav />);
        expect(screen.getByRole('link', { name: /Live/i })).toHaveAttribute(
            'href',
            '/',
        );
        expect(screen.getByRole('link', { name: /Archives/i })).toHaveAttribute(
            'href',
            '/archives',
        );
        expect(screen.getByRole('link', { name: /About/i })).toHaveAttribute(
            'href',
            '/about',
        );
    });
});
