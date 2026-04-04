// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/auth-client', () => ({
    signIn: vi.fn(),
    signOut: vi.fn(),
}));

import { SignIn, SignOut } from '@/shared/components/Auth/Auth';

describe('SignIn', () => {
    test('renders a link with "Sign In"', () => {
        render(<SignIn />);
        expect(screen.getByRole('link', { name: 'Sign In' })).toBeInTheDocument();
    });

    test('link points to /sign-in', () => {
        render(<SignIn />);
        const link = screen.getByRole('link', { name: 'Sign In' });
        expect(link).toHaveAttribute('href', '/sign-in');
    });

    test('link has data-umami-event="header-signin"', () => {
        render(<SignIn />);
        const link = screen.getByRole('link', { name: 'Sign In' });
        expect(link).toHaveAttribute('data-umami-event', 'header-signin');
    });
});

describe('SignOut', () => {
    test('renders a button with "Sign Out"', () => {
        render(<SignOut />);
        expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    });

    test('button has data-umami-event="header-signout"', () => {
        render(<SignOut />);
        const button = screen.getByRole('button', { name: 'Sign Out' });
        expect(button).toHaveAttribute('data-umami-event', 'header-signout');
    });
});
