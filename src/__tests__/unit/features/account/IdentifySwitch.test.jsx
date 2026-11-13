// @vitest-environment jsdom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/features/consent/actions.mjs', () => ({
    setIdentifyConsent: vi.fn(),
}));
vi.mock('@/features/consent/reloadDocument.mjs', () => ({
    reloadDocument: vi.fn(),
}));

import IdentifySwitch from '@/features/account/IdentifySwitch';
import { setIdentifyConsent } from '@/features/consent/actions.mjs';
import { reloadDocument } from '@/features/consent/reloadDocument.mjs';

describe('IdentifySwitch', () => {
    beforeEach(() => {
        vi.mocked(setIdentifyConsent).mockResolvedValue({ ok: true });
    });

    test.each([true, false])(
        'is a switch that shows the stored state (%s)',
        (initial) => {
            render(<IdentifySwitch initial={initial} />);
            const sw = screen.getByRole('switch', {
                name: /Link my use of this site to my account/,
            });
            expect(sw).toHaveAttribute('aria-checked', String(initial));
            expect(sw).toHaveAttribute('data-umami-event', 'account-identify-toggle');
        },
    );

    test.each([
        [true, false],
        [false, true],
    ])('one click from %s saves %s and ends the document once', async (initial, next) => {
        render(<IdentifySwitch initial={initial} />);
        fireEvent.click(screen.getByRole('switch'));
        await waitFor(() => expect(reloadDocument).toHaveBeenCalledTimes(1));
        expect(setIdentifyConsent).toHaveBeenCalledExactlyOnceWith(next);
    });

    test('a failed save shows the error and keeps the page', async () => {
        vi.mocked(setIdentifyConsent).mockResolvedValue({
            errors: { general: 'Could not save. Please try again.' },
        });
        render(<IdentifySwitch initial={false} />);
        fireEvent.click(screen.getByRole('switch'));
        expect(await screen.findByRole('alert')).toHaveTextContent('Could not save.');
        expect(reloadDocument).not.toHaveBeenCalled();
    });

    test('a failed delete after withdrawal is shown, and the document still ends', async () => {
        vi.mocked(setIdentifyConsent).mockResolvedValue({
            ok: true,
            errors: { delete: 'Deleting the linked visits failed.' },
        });
        const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
        render(<IdentifySwitch initial />);
        fireEvent.click(screen.getByRole('switch'));
        await waitFor(() => expect(reloadDocument).toHaveBeenCalledTimes(1));
        expect(alert).toHaveBeenCalledWith('Deleting the linked visits failed.');
    });
});
