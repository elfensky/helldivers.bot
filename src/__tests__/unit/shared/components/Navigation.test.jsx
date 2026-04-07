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
vi.mock('next/link', () => ({
    default: ({ children, ...props }) => <a {...props}>{children}</a>,
}));

import Navigation from '@/shared/components/Navigation/Navigation';

describe('Navigation', () => {
    test('renders HeaderNav', () => {
        render(<Navigation />);
        expect(screen.getByTestId('header-nav')).toBeInTheDocument();
    });

    test('renders UserSection', () => {
        render(<Navigation />);
        expect(screen.getByTestId('user-section')).toBeInTheDocument();
    });

    test('renders external links', () => {
        render(<Navigation />);
        expect(screen.getByLabelText('Status')).toBeInTheDocument();
        expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
    });
});
