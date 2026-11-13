// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/features/consent/actions.mjs', () => ({
    acceptTerms: vi.fn(),
}));
vi.mock('@/features/consent/reloadDocument.mjs', () => ({
    reloadDocument: vi.fn(),
}));

import TermsPrompt from '@/features/consent/TermsPrompt';
import { acceptTerms } from '@/features/consent/actions.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';

const submit = () =>
    fireEvent.submit(
        screen.getByRole('button', { name: 'Report for duty' }).closest('form'),
    );

describe('TermsPrompt', () => {
    beforeEach(() => {
        vi.mocked(acceptTerms).mockResolvedValue({ ok: true });
    });

    test('both boxes start empty; only the terms box is required', () => {
        render(<TermsPrompt />);
        const [terms, identify] = screen.getAllByRole('checkbox');
        expect(terms).not.toBeChecked();
        expect(identify).not.toBeChecked();
        expect(terms).toBeRequired();
        expect(identify).not.toBeRequired();
    });

    test('the terms box keeps the plain no-warranty and no-uptime lines', () => {
        render(<TermsPrompt />);
        expect(screen.getByText('This site comes with no warranty.')).toBeInTheDocument();
        expect(screen.getByText('There is no guaranteed uptime.')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'terms of service' })).toHaveAttribute(
            'href',
            '/legal#terms',
        );
    });

    test('the optional box links to /privacy inside its label', () => {
        render(<TermsPrompt />);
        const identify = screen.getAllByRole('checkbox')[1];
        const link = screen.getByRole('link', { name: 'How this works' });
        expect(link).toHaveAttribute('href', '/privacy');
        expect(identify.closest('label')).toContainElement(link);
        expect(identify.closest('label')).toHaveTextContent(
            'The Ministry of Truth wants to know who you are.',
        );
    });

    test('terms only: sends terms=on and no identify, then ends the document once', async () => {
        render(<TermsPrompt />);
        fireEvent.click(screen.getAllByRole('checkbox')[0]);
        submit();
        await waitFor(() => expect(reloadDocument).toHaveBeenCalledTimes(1));
        const formData = vi.mocked(acceptTerms).mock.calls[0][1];
        expect(formData.get('terms')).toBe('on');
        expect(formData.get('identify')).toBeNull();
    });

    test('both: sends identify=on', async () => {
        render(<TermsPrompt />);
        for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
        submit();
        await waitFor(() => expect(acceptTerms).toHaveBeenCalled());
        expect(vi.mocked(acceptTerms).mock.calls[0][1].get('identify')).toBe('on');
    });

    test('a refused submit shows the message and stays', async () => {
        vi.mocked(acceptTerms).mockResolvedValue({
            errors: { terms: 'Accept the terms to continue.' },
        });
        render(<TermsPrompt />);
        submit();
        expect(await screen.findByRole('alert')).toHaveTextContent(
            'Accept the terms to continue.',
        );
        expect(reloadDocument).not.toHaveBeenCalled();
    });
});
