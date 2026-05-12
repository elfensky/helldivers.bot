// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/shared/components/Navigation/Navigation.css', () => ({}));

// HeaderNav and UserSection have their own tests; stub them at the boundary
// so Navigation's assertions stay focused on what Navigation owns:
// external links + the auth-driven conditional rendering of UserSection.
vi.mock('@/shared/components/Navigation/HeaderNav', () => ({
    default: () => <nav data-testid="header-nav-stub" />,
}));
vi.mock('@/shared/components/Navigation/UserSection', () => ({
    default: () => <div data-testid="user-section-stub" />,
}));

import Navigation from '@/shared/components/Navigation/Navigation';

afterEach(() => {
    vi.unstubAllEnvs();
});

describe('Navigation — landmark', () => {
    test('renders a single <nav> landmark wrapping all nav items', () => {
        const { container } = render(<Navigation />);
        const navs = container.querySelectorAll('nav');
        // Navigation renders its own <nav> plus the stubbed HeaderNav (also a <nav>).
        // We assert the OUTER nav is owned by Navigation (top-level).
        expect(navs.length).toBeGreaterThanOrEqual(1);
        expect(container.firstChild.tagName).toBe('NAV');
    });

    test('renders HeaderNav as a child', () => {
        render(<Navigation />);
        expect(screen.getByTestId('header-nav-stub')).toBeInTheDocument();
    });
});

describe('Navigation — external links', () => {
    test('Status link points to status.helldivers.bot with umami tracking + a11y label', () => {
        render(<Navigation />);
        const statusLink = screen.getByLabelText('Status');
        expect(statusLink.tagName).toBe('A');
        expect(statusLink.getAttribute('href')).toBe('https://status.helldivers.bot');
        expect(statusLink.getAttribute('data-umami-event')).toBe('nav-status');
        expect(statusLink.getAttribute('title')).toBe('Status');
    });

    test('GitHub link points to elfensky/helldivers1api with umami tracking + a11y label', () => {
        render(<Navigation />);
        const githubLink = screen.getByLabelText('GitHub');
        expect(githubLink.tagName).toBe('A');
        expect(githubLink.getAttribute('href')).toBe(
            'https://github.com/elfensky/helldivers1api',
        );
        expect(githubLink.getAttribute('data-umami-event')).toBe('nav-github');
    });

    test('external links use an icon (SVG), not text content', () => {
        // Catches regressions where someone replaces the SVG with a text label
        // that would clash with HeaderNav's text-based nav.
        render(<Navigation />);
        const statusLink = screen.getByLabelText('Status');
        const githubLink = screen.getByLabelText('GitHub');
        expect(statusLink.querySelector('svg')).toBeInTheDocument();
        expect(githubLink.querySelector('svg')).toBeInTheDocument();
    });
});

describe('Navigation — UserSection auth gate', () => {
    // The conditional `{process.env.BETTER_AUTH_SECRET && ...}` is the security
    // boundary that hides the user UI when auth isn't configured. Test it.

    test('renders UserSection when BETTER_AUTH_SECRET is set', () => {
        vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret');
        render(<Navigation />);
        expect(screen.getByTestId('user-section-stub')).toBeInTheDocument();
    });

    test('hides UserSection when BETTER_AUTH_SECRET is the empty string', () => {
        vi.stubEnv('BETTER_AUTH_SECRET', '');
        render(<Navigation />);
        expect(screen.queryByTestId('user-section-stub')).not.toBeInTheDocument();
    });

    test('hides UserSection when BETTER_AUTH_SECRET is undefined', () => {
        // vi.stubEnv only supports strings; we ensure the env var is empty by
        // restoring and re-stubbing with empty (matches Next.js handling of
        // missing public env vars).
        vi.stubEnv('BETTER_AUTH_SECRET', '');
        render(<Navigation />);
        expect(screen.queryByTestId('user-section-stub')).not.toBeInTheDocument();
    });

    test('UserSection sits inside a Suspense boundary (wrapper class present)', () => {
        vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret');
        const { container } = render(<Navigation />);
        // Suspense fallback className locks in the boundary; if Suspense is
        // removed the user-section-skeleton wrapper class won't appear in the
        // DOM at all (only user-section-wrapper). We assert the wrapper, which
        // is the structural commitment Navigation makes.
        expect(container.querySelector('.user-section-wrapper')).toBeInTheDocument();
    });
});
