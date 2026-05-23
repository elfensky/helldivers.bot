// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/features/account/actions', () => ({
    exportUserData: vi.fn(),
    deleteUserAccount: vi.fn(),
}));

import AccountActions from '@/features/account/AccountActions';

describe('AccountActions', () => {
    const user = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
    const avatarUrl = 'https://example.com/avatar.jpg';
    const providers = ['discord'];
    const props = { user, avatarUrl, providers };

    test('renders profile info', () => {
        render(<AccountActions {...props} />);
        expect(screen.getByText('Test User')).toBeInTheDocument();
        expect(screen.getByText('test@example.com')).toBeInTheDocument();
        expect(screen.getByText('discord')).toBeInTheDocument();
    });

    test('renders Download My Data button', () => {
        render(<AccountActions {...props} />);
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    test('renders Delete Account button', () => {
        render(<AccountActions {...props} />);
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    test('renders Delete Account button next to Download', () => {
        render(<AccountActions {...props} />);
        const downloadBtn = screen.getByRole('button', { name: /download/i });
        const deleteBtn = screen.getByRole('button', { name: /delete/i });
        expect(downloadBtn.parentElement).toBe(deleteBtn.parentElement);
    });

    test('renders google provider', () => {
        render(<AccountActions {...props} />);
        expect(screen.getByText('google')).toBeInTheDocument();
    });
});
