'use server';
import { z } from 'zod';
import db from '@/db/db';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { tryCatch } from '@/shared/utils/tryCatch';
import { performanceTime } from '@/shared/utils/time';

/**
 * Export all data for the authenticated user (profile, accounts, settings, reviews, API keys).
 * Auth guard: session must exist and match the requested userId.
 * @param {string} userId - User ID to export data for
 */
export async function exportUserData(userId) {
    const start = performance.now();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        return { errors: { auth: 'Not authenticated' }, time: performanceTime(start) };
    }
    if (session.user.id !== userId) {
        return { errors: { auth: 'Not authorized' }, time: performanceTime(start) };
    }

    const { data: userData, error } = await tryCatch(
        db.user.findUnique({
            where: { id: userId },
            include: {
                accounts: {
                    select: { providerId: true, accountId: true, createdAt: true },
                },
                settings: { select: { settings: true } },
                reviews: {
                    select: {
                        id: true,
                        title: true,
                        content: true,
                        published: true,
                        createdAt: true,
                    },
                },
                apiKeys: {
                    select: {
                        id: true,
                        description: true,
                        visible: true,
                        createdAt: true,
                        enabled: true,
                    },
                },
            },
        }),
    );
    if (error) throw error;

    return { data: userData, time: performanceTime(start) };
}

/**
 * Delete the authenticated user's account. Requires email confirmation.
 * Revokes session before cascade-deleting all user data.
 * @param {*} _ - Unused (server action signature)
 * @param {FormData} formData - Must contain userId and confirmEmail fields
 */
export async function deleteUserAccount(_, formData) {
    const start = performance.now();
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session || !session.user) {
        return { errors: { auth: 'Not authenticated' }, time: performanceTime(start) };
    }

    const formValues = {
        userId: formData.get('userId'),
        confirmEmail: formData.get('confirmEmail'),
    };

    if (session.user.id !== formValues.userId) {
        return { errors: { auth: 'Not authorized' }, time: performanceTime(start) };
    }

    const schema = z.object({
        userId: z.string().min(1),
        confirmEmail: z.string().email(),
    });
    const check = schema.safeParse(formValues);
    if (!check.success) {
        return {
            errors: check.error.flatten().fieldErrors,
            time: performanceTime(start),
        };
    }

    if (formValues.confirmEmail !== session.user.email) {
        return {
            errors: { confirmEmail: 'Email does not match your account' },
            time: performanceTime(start),
        };
    }

    // Revoke session before deleting user (cascade will delete sessions from DB,
    // but we need to clear the cookie so the browser doesn't hold a stale token)
    const { error: revokeError } = await tryCatch(
        auth.api.revokeSession({ headers: await headers() }),
    );
    if (revokeError) throw revokeError;

    const { data: deleted, error } = await tryCatch(
        db.user.delete({ where: { id: formValues.userId } }),
    );
    if (error) throw error;

    return { data: { deleted: true }, time: performanceTime(start) };
}
