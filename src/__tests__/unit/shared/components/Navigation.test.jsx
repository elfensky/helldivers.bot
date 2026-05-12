// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/shared/components/Navigation/Navigation.css', () => ({}));
vi.mock('@/shared/components/Navigation/HeaderNav', () => ({
    default: () => <nav data-testid="header-nav" />,
}));
vi.mock('@/shared/components/Navigation/UserSection', () => ({
    default: () => <div data-testid="user-section" />,
}));

import Navigation from '@/shared/components/Navigation/Navigation';

describe('Navigation', () => {
    test('renders HeaderNav', () => {
        render(<Navigation />);
        expect(screen.getByTestId('header-nav')).toBeInTheDocument();
    });

    test('renders UserSection when auth is configured', () => {
        vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret');
        render(<Navigation />);
        expect(screen.getByTestId('user-section')).toBeInTheDocument();
        vi.unstubAllEnvs();
    });

    test('hides UserSection when auth is not configured', () => {
        vi.stubEnv('BETTER_AUTH_SECRET', '');
        render(<Navigation />);
        expect(screen.queryByTestId('user-section')).not.toBeInTheDocument();
        vi.unstubAllEnvs();
    });

    test('renders external links', () => {
        render(<Navigation />);
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
        expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    });
});
