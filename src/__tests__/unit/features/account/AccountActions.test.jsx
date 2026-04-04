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
    const user = { id: 'user-123', email: 'test@example.com' };

    test('renders Download My Data button', () => {
        render(<AccountActions user={user} />);
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument();
    });

    test('renders Delete Account button', () => {
        render(<AccountActions user={user} />);
        expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    test('renders email confirmation input for delete', () => {
        render(<AccountActions user={user} />);
        expect(screen.getByPlaceholderText(/type your email/i)).toBeInTheDocument();
    });
});
