import { vi } from 'vitest';
import { auth } from '@/auth';
import { ROLE } from '@/shared/enums/roles.mjs';
import {
    requireSession,
    requireUser,
    requireAdmin,
} from '@/shared/utils/api/authGuards.mjs';

// `@/auth` and `next/headers` are mocked globally in vitest.setup.mjs; this file
// only drives the session shape. Every guard returns the same
// `{ user, error }` pair — exactly one of the two is non-null.

const ADMIN = { id: 'admin-1', role: ROLE.ADMIN };
const USER = { id: 'user-1', role: ROLE.USER };

function givenSession(user) {
    vi.mocked(auth.api.getSession).mockResolvedValue(user ? { user } : null);
}

describe('requireSession', () => {
    test('returns the user when a session exists', async () => {
        givenSession(USER);
        await expect(requireSession()).resolves.toEqual({ user: USER, error: null });
    });

    test('returns "Not authenticated" when there is no session', async () => {
        givenSession(null);
        await expect(requireSession()).resolves.toEqual({
            user: null,
            error: 'Not authenticated',
        });
    });

    test('returns "Not authenticated" when the session carries no user', async () => {
        vi.mocked(auth.api.getSession).mockResolvedValue({ session: { id: 's1' } });
        const { user, error } = await requireSession();
        expect(user).toBeNull();
        expect(error).toBe('Not authenticated');
    });

    test('returns "Auth not configured" when auth is disabled', async () => {
        // `@/auth` exports null when BETTER_AUTH_SECRET is absent. That branch
        // needs a different module graph, so re-import against a null stub.
        vi.resetModules();
        vi.doMock('@/auth', () => ({ auth: null }));
        const mod = await import('@/shared/utils/api/authGuards.mjs');
        await expect(mod.requireSession()).resolves.toEqual({
            user: null,
            error: 'Auth not configured',
        });
        vi.doUnmock('@/auth');
        vi.resetModules();
    });
});

describe('requireUser', () => {
    test('allows a user acting on their own id', async () => {
        givenSession(USER);
        await expect(requireUser('user-1')).resolves.toEqual({
            user: USER,
            error: null,
        });
    });

    test('rejects a user acting on someone else’s id', async () => {
        givenSession(USER);
        const { user, error } = await requireUser('user-2');
        expect(user).toBeNull();
        expect(error).toBe('Not authorized');
    });

    test('an admin is NOT implicitly allowed to act on another user’s id', async () => {
        // Documents the current contract: requireUser is identity-scoped only —
        // admin is not a superuser here. Admin actions use requireAdmin.
        givenSession(ADMIN);
        const { user, error } = await requireUser('user-1');
        expect(user).toBeNull();
        expect(error).toBe('Not authorized');
    });

    test('propagates the unauthenticated error without leaking the target id', async () => {
        givenSession(null);
        await expect(requireUser('user-1')).resolves.toEqual({
            user: null,
            error: 'Not authenticated',
        });
    });
});

describe('requireAdmin', () => {
    test('allows a session whose role is exactly ROLE.ADMIN', async () => {
        givenSession(ADMIN);
        await expect(requireAdmin()).resolves.toEqual({ user: ADMIN, error: null });
    });

    test('rejects an authenticated non-admin with "Forbidden"', async () => {
        givenSession(USER);
        const { user, error } = await requireAdmin();
        expect(user).toBeNull();
        expect(error).toBe('Forbidden');
    });

    test.each([
        ['no role field at all', {}],
        ['a null role', { role: null }],
        ['an empty-string role', { role: '' }],
        ['an unknown role', { role: 'moderator' }],
        ['a case-mismatched role', { role: 'ADMIN' }],
        ['a role that merely contains "admin"', { role: 'not-admin' }],
        ['a truthy non-string role', { role: true }],
    ])('rejects %s', async (_label, roleFields) => {
        givenSession({ id: 'u-9', ...roleFields });
        const { user, error } = await requireAdmin();
        expect(user).toBeNull();
        expect(error).toBe('Forbidden');
    });

    test('rejects an unauthenticated caller before any role check', async () => {
        givenSession(null);
        await expect(requireAdmin()).resolves.toEqual({
            user: null,
            error: 'Not authenticated',
        });
    });
});
