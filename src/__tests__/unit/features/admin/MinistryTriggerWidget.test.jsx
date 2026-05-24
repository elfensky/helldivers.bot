// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';

vi.mock('sonner', () => ({
    toast: { error: vi.fn(), success: vi.fn() },
}));

import { toast } from 'sonner';
import MinistryTriggerWidget from '@/features/admin/MinistryTriggerWidget';
import { MinistryContext } from '@/features/ministry/MinistryContext.mjs';

beforeEach(() => {
    vi.mocked(toast.error).mockClear();
    vi.mocked(toast.success).mockClear();
});

function makeCtx({ forceHijack = vi.fn(() => true), warTone = 'winning' } = {}) {
    return {
        register: vi.fn(),
        unregister: vi.fn(),
        setIdle: vi.fn(),
        forceHijack,
        warTone,
        enabled: true,
    };
}

describe('MinistryTriggerWidget', () => {
    test('returns null when isAdmin is false', () => {
        const { container } = render(
            <MinistryContext.Provider value={makeCtx()}>
                <MinistryTriggerWidget isAdmin={false} />
            </MinistryContext.Provider>,
        );
        expect(container.firstChild).toBeNull();
    });

    test('renders a trigger button when isAdmin is true', () => {
        const { getByRole } = render(
            <MinistryContext.Provider value={makeCtx()}>
                <MinistryTriggerWidget isAdmin={true} />
            </MinistryContext.Provider>,
        );
        expect(getByRole('button', { name: /trigger ministry/i })).toBeTruthy();
    });

    test('clicking the button calls forceHijack and toasts success on hit', () => {
        const forceHijack = vi.fn(() => true);
        const { getByRole } = render(
            <MinistryContext.Provider value={makeCtx({ forceHijack })}>
                <MinistryTriggerWidget isAdmin={true} />
            </MinistryContext.Provider>,
        );
        fireEvent.click(getByRole('button', { name: /trigger ministry/i }));
        expect(forceHijack).toHaveBeenCalledTimes(1);
        expect(toast.success).toHaveBeenCalledWith('Hijack triggered');
        expect(toast.error).not.toHaveBeenCalled();
    });

    test('toasts error when no eligible Hijackable is found', () => {
        const forceHijack = vi.fn(() => false);
        const { getByRole } = render(
            <MinistryContext.Provider value={makeCtx({ forceHijack })}>
                <MinistryTriggerWidget isAdmin={true} />
            </MinistryContext.Provider>,
        );
        fireEvent.click(getByRole('button', { name: /trigger ministry/i }));
        expect(toast.error).toHaveBeenCalledWith('No eligible Hijackable on this page');
        expect(toast.success).not.toHaveBeenCalled();
    });

    test('toasts a disabled message when warTone is null', () => {
        const forceHijack = vi.fn(() => false);
        const { getByRole } = render(
            <MinistryContext.Provider value={makeCtx({ forceHijack, warTone: null })}>
                <MinistryTriggerWidget isAdmin={true} />
            </MinistryContext.Provider>,
        );
        fireEvent.click(getByRole('button', { name: /trigger ministry/i }));
        expect(toast.error).toHaveBeenCalledWith(
            'Ministry disabled — no war tone resolved',
        );
    });

    test('toasts unavailable when there is no provider', () => {
        const { getByRole } = render(<MinistryTriggerWidget isAdmin={true} />);
        fireEvent.click(getByRole('button', { name: /trigger ministry/i }));
        expect(toast.error).toHaveBeenCalledWith('Ministry context unavailable');
    });
});
