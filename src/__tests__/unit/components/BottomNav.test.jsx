// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

vi.mock('@/components/layout/BottomNav/BottomNav.css', () => ({}));

import BottomNav from '@/components/layout/BottomNav/BottomNav';

describe('BottomNav', () => {
    beforeEach(() => {
        vi.mocked(usePathname).mockReturnValue('/');
    });

    test('renders 3 navigation links', () => {
        render(<BottomNav />);
        const links = screen.getAllByRole('link');
        expect(links).toHaveLength(3);
    });

    test('renders correct labels', () => {
        render(<BottomNav />);
        expect(screen.getByText('Live')).toBeInTheDocument();
        expect(screen.getByText('Archives')).toBeInTheDocument();
        expect(screen.getByText('About')).toBeInTheDocument();
    });

    test('home link is active when pathname is "/"', () => {
        vi.mocked(usePathname).mockReturnValue('/');
        render(<BottomNav />);
        const homeLink = screen.getByRole('link', { name: /Live/i });
        expect(homeLink.className).toContain('active');
    });

    test('archives link is active when pathname starts with /archives', () => {
        vi.mocked(usePathname).mockReturnValue('/archives');
        render(<BottomNav />);
        const archivesLink = screen.getByRole('link', { name: /Archives/i });
        expect(archivesLink.className).toContain('active');

        const homeLink = screen.getByRole('link', { name: /Live/i });
        expect(homeLink.className).not.toContain('active');
    });

    test('about link is active when pathname starts with /about', () => {
        vi.mocked(usePathname).mockReturnValue('/about');
        render(<BottomNav />);
        const aboutLink = screen.getByRole('link', { name: /About/i });
        expect(aboutLink.className).toContain('active');
    });

    test('links have correct href attributes', () => {
        render(<BottomNav />);
        expect(screen.getByRole('link', { name: /Live/i })).toHaveAttribute('href', '/');
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
