// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/auth', () => ({ signIn: vi.fn(), signOut: vi.fn() }));

import { SignIn, SignOut } from '@/components/layout/Auth/Auth';

describe('SignIn', () => {
    test('renders a form with "Sign In" button', () => {
        render(<SignIn />);
        expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    });

    test('button has data-umami-event="header-signin"', () => {
        render(<SignIn />);
        const button = screen.getByRole('button', { name: 'Sign In' });
        expect(button).toHaveAttribute('data-umami-event', 'header-signin');
    });
});

describe('SignOut', () => {
    test('renders a form with "Sign Out" button', () => {
        render(<SignOut />);
        expect(screen.getByRole('button', { name: 'Sign Out' })).toBeInTheDocument();
    });

    test('button has data-umami-event="header-signout"', () => {
        render(<SignOut />);
        const button = screen.getByRole('button', { name: 'Sign Out' });
        expect(button).toHaveAttribute('data-umami-event', 'header-signout');
    });
});
