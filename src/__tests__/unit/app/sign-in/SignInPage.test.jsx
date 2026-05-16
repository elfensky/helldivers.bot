// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/auth-client', () => ({
    signIn: vi.fn(),
}));

import SignInPage from '@/app/sign-in/page';

describe('SignInPage', () => {
    test('renders Discord sign-in button', () => {
        render(<SignInPage />);
        expect(
            screen.getByRole('button', { name: /sign in with discord/i }),
        ).toBeInTheDocument();
    });

    test('renders GitHub sign-in button', () => {
        render(<SignInPage />);
        expect(
            screen.getByRole('button', { name: /sign in with github/i }),
        ).toBeInTheDocument();
    });

    test('renders Google sign-in button', () => {
        render(<SignInPage />);
        expect(
            screen.getByRole('button', { name: /sign in with google/i }),
        ).toBeInTheDocument();
    });

    test('Google button has correct umami tracking', () => {
        render(<SignInPage />);
        const button = screen.getByRole('button', { name: /sign in with google/i });
        expect(button).toHaveAttribute('data-umami-event', 'auth-signin-google');
    });

    test('buttons are in alphabetical order: Discord, GitHub, Google', () => {
        render(<SignInPage />);
        const buttons = screen.getAllByRole('button');
        expect(buttons[0]).toHaveTextContent(/discord/i);
        expect(buttons[1]).toHaveTextContent(/github/i);
        expect(buttons[2]).toHaveTextContent(/google/i);
    });
});
