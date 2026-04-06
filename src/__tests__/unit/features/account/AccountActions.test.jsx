// @vitest-environment jsdom
import { vi, describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useActionState: vi.fn((action, initialState) => [initialState, vi.fn(), false]),
    };
});
vi.mock('@/db/queries/account', () => ({
    exportUserData: vi.fn(),
    deleteUserAccount: vi.fn(),
}));
vi.mock('next/form', () => ({
    default: ({ children, ...props }) => <form {...props}>{children}</form>,
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

    test('renders email confirmation input for delete', () => {
        render(<AccountActions {...props} />);
        expect(screen.getByPlaceholderText(/type your email/i)).toBeInTheDocument();
    });
});
