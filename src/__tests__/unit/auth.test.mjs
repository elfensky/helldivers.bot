import { afterEach, describe, expect, test, vi } from 'vitest';

/**
 * `src/auth.js` evaluates its ternary at MODULE LOAD time, so every scenario
 * needs a fresh module graph. `vi.resetModules()` + `vi.doUnmock('@/auth')`
 * defeats the global `vi.mock('@/auth')` in vitest.setup.mjs — the same pattern
 * `db.test.mjs` uses to reach the real module.
 */
async function loadAuth({ secret } = {}) {
    vi.resetModules();
    vi.doUnmock('@/auth');
    vi.unstubAllEnvs();

    const betterAuth = vi.fn((config) => ({ marker: 'better-auth-instance', config }));
    const prismaAdapter = vi.fn(() => ({ marker: 'prisma-adapter' }));
    vi.doMock('better-auth', () => ({ betterAuth }));
    vi.doMock('better-auth/adapters/prisma', () => ({ prismaAdapter }));

    // An empty string is falsy, matching "unset" for the ternary under test.
    vi.stubEnv('BETTER_AUTH_SECRET', secret ?? '');

    const mod = await import('@/auth');
    return { mod, betterAuth, prismaAdapter };
}

/** Loads the module with auth enabled and returns the config passed to betterAuth(). */
async function loadAuthConfig() {
    const { betterAuth } = await loadAuth({ secret: 'test-secret' });
    return betterAuth.mock.calls[0][0];
}

afterEach(() => {
    vi.resetModules();
    vi.doUnmock('@/auth');
    vi.doUnmock('better-auth');
    vi.doUnmock('better-auth/adapters/prisma');
    vi.unstubAllEnvs();
});

describe('auth module wiring', () => {
    test('exports null and never constructs BetterAuth when BETTER_AUTH_SECRET is absent', async () => {
        const { mod, betterAuth, prismaAdapter } = await loadAuth({ secret: undefined });

        expect(mod.auth).toBeNull();
        expect(betterAuth).not.toHaveBeenCalled();
        expect(prismaAdapter).not.toHaveBeenCalled();
    });

    test('constructs BetterAuth with the configured secret when one is present', async () => {
        const { mod, betterAuth, prismaAdapter } = await loadAuth({
            secret: 'test-secret',
        });

        expect(mod.auth).not.toBeNull();
        expect(betterAuth).toHaveBeenCalledTimes(1);
        expect(prismaAdapter).toHaveBeenCalledTimes(1);
        expect(betterAuth.mock.calls[0][0].secret).toBe('test-secret');
    });
});

describe('auth privilege escalation guards', () => {
    test('role is server-controlled — clients cannot submit it at sign-up', async () => {
        const config = await loadAuthConfig();
        const role = config.user.additionalFields.role;

        // `input: false` is the single line that stops a sign-up request from
        // carrying `role: 'admin'` straight into the user row. If it is ever
        // dropped or flipped to true, self-promotion to admin becomes a POST.
        expect(role.input).toBe(false);
        expect(role.type).toBe('string');
        expect(role.defaultValue).toBe('user');
    });

    test('account linking is limited to the three known OAuth providers', async () => {
        const config = await loadAuthConfig();
        const linking = config.account.accountLinking;

        // Pinned so that adding a provider to this list is a deliberate, visible
        // change rather than a silent one: `allowDifferentEmails: true` links
        // accounts across mismatched addresses, which is only sound while every
        // entry here is an OAuth provider that verifies the identity itself.
        expect(linking.trustedProviders).toEqual(['discord', 'github', 'google']);
        expect(linking.allowDifferentEmails).toBe(true);
    });

    test('exposes exactly the three expected social providers', async () => {
        const config = await loadAuthConfig();

        expect(Object.keys(config.socialProviders).sort()).toEqual([
            'discord',
            'github',
            'google',
        ]);
    });
});
