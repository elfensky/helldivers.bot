import { describe, test, expect, vi } from 'vitest';

vi.mock('@/features/consent/umamiSessions.mjs', () => ({
    deleteLinkedSessions: vi.fn(),
}));

import db from '@/db/db';
import { auth } from '@/auth';
import { reportError } from '@/shared/utils/observability.mjs';
import { acceptTerms, setIdentifyConsent } from '@/features/consent/actions.mjs';
import { deleteLinkedSessions } from '@/features/consent/umamiSessions.mjs';

const userId = '01908174-d3a5-7e50-b964-6f5e9e48c0a1';
const session = { user: { id: userId } };

function form(entries) {
    const fd = new FormData();
    for (const [key, value] of Object.entries(entries)) fd.append(key, value);
    return fd;
}

describe('acceptTerms', () => {
    test('no session: auth error, no write', async () => {
        const result = await acceptTerms(undefined, form({ terms: 'on' }));
        expect(result.errors.auth).toBeDefined();
        expect(db.user.update).not.toHaveBeenCalled();
    });

    test('without the terms box: terms error, no write', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await acceptTerms(undefined, form({ identify: 'on' }));
        expect(result.errors.terms).toBeDefined();
        expect(db.user.update).not.toHaveBeenCalled();
    });

    test('terms only: stores the acceptance, the link stays off', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await acceptTerms(undefined, form({ terms: 'on' }));
        expect(result).toEqual({ ok: true });
        const { where, data } = vi.mocked(db.user.update).mock.calls[0][0];
        expect(where).toEqual({ id: userId });
        expect(data.termsAcceptedAt).toBeInstanceOf(Date);
        expect(data.identifyConsent).toBe(false);
        expect(data.identifyConsentAt).toBeNull();
    });

    test('both boxes: the link is on, with its date', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        await acceptTerms(undefined, form({ terms: 'on', identify: 'on' }));
        const { data } = vi.mocked(db.user.update).mock.calls[0][0];
        expect(data.identifyConsent).toBe(true);
        expect(data.identifyConsentAt).toBeInstanceOf(Date);
    });

    test('a forged checkbox value is refused', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await acceptTerms(
            undefined,
            form({ terms: 'on', identify: 'yes' }),
        );
        expect(result.errors.terms).toBeDefined();
        expect(db.user.update).not.toHaveBeenCalled();
    });
});

describe('setIdentifyConsent', () => {
    test('no session: auth error, no write', async () => {
        const result = await setIdentifyConsent(true);
        expect(result.errors.auth).toBeDefined();
        expect(db.user.update).not.toHaveBeenCalled();
    });

    test('on: stores the consent and its date, deletes nothing', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        expect(await setIdentifyConsent(true)).toEqual({ ok: true });
        const { where, data } = vi.mocked(db.user.update).mock.calls[0][0];
        expect(where).toEqual({ id: userId });
        expect(data.identifyConsent).toBe(true);
        expect(data.identifyConsentAt).toBeInstanceOf(Date);
        expect(deleteLinkedSessions).not.toHaveBeenCalled();
    });

    test('off: withdraws and deletes the linked sessions of this account', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(deleteLinkedSessions).mockResolvedValue(true);
        expect(await setIdentifyConsent(false)).toEqual({ ok: true });
        expect(vi.mocked(db.user.update).mock.calls[0][0]).toEqual({
            where: { id: userId },
            data: { identifyConsent: false, identifyConsentAt: null },
        });
        expect(deleteLinkedSessions).toHaveBeenCalledExactlyOnceWith(userId);
    });

    test('off with a failed delete: the link stays off, the failure is reported', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        vi.mocked(deleteLinkedSessions).mockResolvedValue(false);
        const result = await setIdentifyConsent(false);
        expect(result.ok).toBe(true);
        expect(result.errors.delete).toBeDefined();
        expect(reportError).toHaveBeenCalledOnce();
        expect(vi.mocked(db.user.update).mock.calls[0][0].data.identifyConsent).toBe(
            false,
        );
    });

    test('a non-boolean is refused', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue(session);
        const result = await setIdentifyConsent(/** @type {any} */ ('false'));
        expect(result.errors.general).toBeDefined();
        expect(db.user.update).not.toHaveBeenCalled();
    });
});
