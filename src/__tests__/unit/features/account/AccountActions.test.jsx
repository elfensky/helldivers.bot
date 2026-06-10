// @vitest-environment jsdom
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock('@/features/account/actions', () => ({
    exportUserData: vi.fn(),
    deleteUserAccount: vi.fn(),
}));

import { toast } from 'sonner';
import { exportUserData, deleteUserAccount } from '@/features/account/actions';
import AccountActions from '@/features/account/AccountActions';

describe('AccountActions', () => {
    const user = { id: 'user-123', name: 'Test User', email: 'test@example.com' };
    const avatarUrl = 'https://example.com/avatar.jpg';
    const providers = ['discord'];
    const props = { user, avatarUrl, providers };

    beforeEach(() => {
        vi.mocked(toast.error).mockClear();
        vi.mocked(exportUserData).mockReset();
        vi.mocked(deleteUserAccount).mockReset();
    });

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

    test('handleExport shows toast when action returns errors envelope', async () => {
        vi.mocked(exportUserData).mockResolvedValue({
            errors: { auth: 'Not authorized' },
        });
        render(<AccountActions {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /download/i }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/export/i));
    });

    test('handleDelete shows toast when action returns undefined', async () => {
        vi.mocked(deleteUserAccount).mockResolvedValue(undefined);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        render(<AccountActions {...props} />);
        fireEvent.click(screen.getByRole('button', { name: /delete/i }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
        expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/delete/i));
    });
});
