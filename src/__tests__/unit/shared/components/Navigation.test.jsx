// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Suspense } from 'react';

vi.mock('@/shared/components/Navigation/Navigation.css', () => ({}));
vi.mock('@/auth', () => ({
    auth: { api: { getSession: vi.fn() } },
}));
vi.mock('@/shared/components/Auth/Auth', () => ({
    SignIn: () => <button>Sign In</button>,
    SignOut: () => <button>Sign Out</button>,
}));
vi.mock('@/shared/components/Navigation/HeaderNav', () => ({
    default: () => <nav data-testid="header-nav" />,
}));
vi.mock('next/image', () => ({
    default: (props) => <img {...props} />,
}));
vi.mock('@/shared/utils/gravatar', () => ({
    getGravatarUrl: vi.fn(() => 'https://www.gravatar.com/avatar/mock?s=64'),
}));

import Navigation from '@/shared/components/Navigation/Navigation';
import { auth } from '@/auth';

async function renderNavigation() {
    const jsx = await Navigation();
    await act(async () => {
        render(<Suspense fallback={null}>{jsx}</Suspense>);
    });
}

describe('Navigation', () => {
    test('renders HeaderNav', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        await renderNavigation();
        expect(screen.getByTestId('header-nav')).toBeInTheDocument();
    });

    test('shows SignIn when no session', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(null);
        await renderNavigation();
        expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    test('shows avatar and SignOut when session exists', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue({
            user: {
                name: 'Test',
                email: 'test@test.com',
                image: 'https://example.com/avatar.jpg',
            },
        });
        await renderNavigation();
        expect(screen.getByText('Sign Out')).toBeInTheDocument();
        const avatar = screen.getByAltText('Test avatar');
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
        const link = avatar.closest('a');
        expect(link).toHaveAttribute('href', '/profile');
    });

    test('uses gravatar when session.user.image is null', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue({
            user: {
                name: 'GravUser',
                email: 'grav@test.com',
                image: null,
            },
        });
        await renderNavigation();
        const avatar = screen.getByAltText('GravUser avatar');
        expect(avatar).toBeInTheDocument();
    });
});
