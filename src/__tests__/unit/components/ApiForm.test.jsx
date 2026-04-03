// @vitest-environment jsdom
import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('react', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        useActionState: vi.fn((action, initialState) => [initialState, vi.fn(), false]),
    };
});
vi.mock('@/db/queries/api', () => ({
    generateApiKey: vi.fn(),
    deleteApiKey: vi.fn(),
}));
vi.mock('next/form', () => ({
    default: ({ children, ...props }) => <form {...props}>{children}</form>,
}));

import { GenerateApiKeyForm, DeleteApiKeyForm } from '@/components/dashboard/ApiForm';

describe('GenerateApiKeyForm', () => {
    test('shows "No user found" when userId is null', () => {
        render(<GenerateApiKeyForm userId={null} />);
        expect(screen.getByText(/No user found/)).toBeInTheDocument();
    });

    test('renders form with description input', () => {
        render(<GenerateApiKeyForm userId="user-123" />);
        expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    test('shows Generate button', () => {
        render(<GenerateApiKeyForm userId="user-123" />);
        expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument();
    });
});

describe('DeleteApiKeyForm', () => {
    test('shows "Error" when userId is missing', () => {
        render(<DeleteApiKeyForm userId={null} apikeyId="key-1" />);
        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    test('shows "Error" when apikeyId is missing', () => {
        render(<DeleteApiKeyForm userId="user-123" apikeyId={null} />);
        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    test('renders Delete button', () => {
        render(<DeleteApiKeyForm userId="user-123" apikeyId="key-1" />);
        expect(screen.getByRole('button', { name: /Delete/ })).toBeInTheDocument();
    });
});
