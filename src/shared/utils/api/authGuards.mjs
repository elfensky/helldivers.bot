'use server';
import { auth } from '@/auth';
import { headers } from 'next/headers';
import { ROLE } from '@/shared/enums/roles.mjs';

/**
 * @typedef {{ user: object, error: null } | { user: null, error: string }} AuthGuardResult
 *   Both `user` and `error` are always present — one is non-null, the other is null.
 *   This lets callers destructure either field without conditional guards.
 */

/**
 * Verify the request has an authenticated session.
 * @returns {Promise<AuthGuardResult>}
 */
export async function requireSession() {
    if (!auth) return { user: null, error: 'Auth not configured' };
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { user: null, error: 'Not authenticated' };
    return { user: session.user, error: null };
}

/**
 * Verify the request is from an authenticated user whose id matches `userId`.
 * @param {string} userId - User id the action targets.
 * @returns {Promise<AuthGuardResult>}
 */
export async function requireUser(userId) {
    const { user, error } = await requireSession();
    if (error) return { user: null, error };
    if (user.id !== userId) return { user: null, error: 'Not authorized' };
    return { user, error: null };
}

/**
 * Verify the request is from an authenticated admin.
 * @returns {Promise<AuthGuardResult>}
 */
export async function requireAdmin() {
    const { user, error } = await requireSession();
    if (error) return { user: null, error };
    if (user.role !== ROLE.ADMIN) return { user: null, error: 'Forbidden' };
    return { user, error: null };
}
