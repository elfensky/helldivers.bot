'use server';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import db from '@/db/db';
import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';
import { requireSession } from '@/shared/utils/api/authGuards.mjs';
import { deleteLinkedSessions } from '@/features/consent/umamiSessions.mjs';

/**
 * @typedef {object} ConsentActionState
 * @property {true} [ok] - The change is saved.
 * @property {{ auth?: string, terms?: string, delete?: string, general?: string }} [errors] - Messages for the user.
 */

// A checkbox sends "on" when ticked and nothing when not.
const termsForm = z.object({
    terms: z.literal('on'),
    identify: z.literal('on').nullable(),
});

/**
 * Records the terms acceptance from the signup or next-login page (#617), and the
 * optional account link when its box is ticked. The `useActionState` form:
 * previous state first, ignored.
 *
 * @param {unknown} _prevState - Unused (server action signature).
 * @param {FormData} formData - `terms=on` (required), `identify=on` (optional).
 * @returns {Promise<ConsentActionState>}
 */
export async function acceptTerms(_prevState, formData) {
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError } };

    const check = termsForm.safeParse({
        terms: formData.get('terms'),
        identify: formData.get('identify'),
    });
    if (!check.success) return { errors: { terms: 'Accept the terms to continue.' } };

    const now = new Date();
    const identify = check.data.identify === 'on';
    const { error } = await tryCatch(
        db.user.update({
            where: { id: user.id },
            data: {
                termsAcceptedAt: now,
                identifyConsent: identify,
                identifyConsentAt: identify ? now : null,
            },
        }),
    );
    if (error) {
        reportError(error, { stage: 'consent-accept-terms' });
        return { errors: { general: 'Could not save. Please try again.' } };
    }

    revalidatePath('/', 'layout');
    return { ok: true };
}

/**
 * The profile switch for the account link (#617). Turning it off withdraws the
 * consent and deletes the account's Umami sessions at once; a failed delete still
 * leaves the link off and is reported, so the operator can finish it by hand.
 *
 * @param {boolean} on - The new state of the switch.
 * @returns {Promise<ConsentActionState>}
 */
export async function setIdentifyConsent(on) {
    const { user, error: authError } = await requireSession();
    if (authError) return { errors: { auth: authError } };

    const check = z.boolean().safeParse(on);
    if (!check.success) return { errors: { general: 'Invalid request.' } };

    const { error } = await tryCatch(
        db.user.update({
            where: { id: user.id },
            data: {
                identifyConsent: check.data,
                identifyConsentAt: check.data ? new Date() : null,
            },
        }),
    );
    if (error) {
        reportError(error, { stage: 'consent-identify' });
        return { errors: { general: 'Could not save. Please try again.' } };
    }
    revalidatePath('/', 'layout');

    if (!check.data && !(await deleteLinkedSessions(user.id))) {
        reportError(new Error('Linked Umami sessions not deleted after withdrawal'), {
            stage: 'consent-withdraw-delete',
            userId: user.id,
        });
        return {
            ok: true,
            errors: {
                delete: 'The link is off. Deleting the linked visits failed; the operator has been told and will finish it.',
            },
        };
    }
    return { ok: true };
}
