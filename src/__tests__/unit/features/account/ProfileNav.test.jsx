// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';

import ProfileNav from '@/features/account/ProfileNav';

describe('ProfileNav', () => {
    test('renders plain heading for non-admin user', () => {
        vi.mocked(usePathname).mockReturnValue('/profile');
        render(<ProfileNav role="user" />);

        expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
        expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });

    test('renders Profile and Admin links for admin on /profile', () => {
        vi.mocked(usePathname).mockReturnValue('/profile');
        render(<ProfileNav role="admin" />);

        const heading = screen.getByRole('heading', { name: 'Profile' });
        expect(heading).toBeInTheDocument();

        const adminLink = screen.getByRole('link', { name: 'Admin' });
        expect(adminLink).toHaveAttribute('href', '/profile/admin');
    });

    test('renders Admin as heading and Profile as link on /profile/admin', () => {
        vi.mocked(usePathname).mockReturnValue('/profile/admin');
        render(<ProfileNav role="admin" />);

        const heading = screen.getByRole('heading', { name: 'Admin' });
        expect(heading).toBeInTheDocument();

        const profileLink = screen.getByRole('link', { name: 'Profile' });
        expect(profileLink).toHaveAttribute('href', '/profile');
    });
});
