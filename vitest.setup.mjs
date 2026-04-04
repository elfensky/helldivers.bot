import { vi } from 'vitest';
import React from 'react';
import '@testing-library/jest-dom/vitest';

// #region Auth Mocks

/**
 * Mock BetterAuth server-side auth
 *
 * Defaults to null (logged-out). Override in tests:
 *   vi.mocked(auth.api.getSession).mockResolvedValue({ user: { ... } })
 */
vi.mock('@/auth', () => ({
    auth: {
        api: {
            getSession: vi.fn(() => Promise.resolve(null)),
        },
    },
}));

/**
 * Mock BetterAuth client-side auth
 */
vi.mock('@/auth-client', () => ({
    authClient: {
        signIn: { social: vi.fn() },
        signOut: vi.fn(),
        useSession: vi.fn(() => ({ data: null, isPending: false })),
    },
    signIn: vi.fn(),
    signOut: vi.fn(),
    useSession: vi.fn(() => ({ data: null, isPending: false })),
}));

// #endregion

// #region Database Mocks

/**
 * Mock Prisma client singleton
 *
 * Provides stubs for all models used in the app.
 * Override specific methods in tests:
 *   vi.mocked(db.h1_season.findMany).mockResolvedValue([...])
 */
const createModelMock = () => ({
    findMany: vi.fn(() => Promise.resolve([])),
    findUnique: vi.fn(() => Promise.resolve(null)),
    findFirst: vi.fn(() => Promise.resolve(null)),
    create: vi.fn(() => Promise.resolve({})),
    createMany: vi.fn(() => Promise.resolve({ count: 0 })),
    update: vi.fn(() => Promise.resolve({})),
    upsert: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve({})),
    deleteMany: vi.fn(() => Promise.resolve({ count: 0 })),
    count: vi.fn(() => Promise.resolve(0)),
});

vi.mock('@/db/db', () => ({
    default: {
        // Auth models (BetterAuth)
        user: createModelMock(),
        account: createModelMock(),
        session: createModelMock(),
        verification: createModelMock(),
        // App models
        app: createModelMock(),
        settings: createModelMock(),
        review: createModelMock(),
        apiKey: createModelMock(),
        ApiKey: createModelMock(),
        // Rebroadcast models
        rebroadcast_status: createModelMock(),
        rebroadcast_snapshot: createModelMock(),
        // Historical models
        h1_season: createModelMock(),
        h1_introduction_order: createModelMock(),
        h1_points_max: createModelMock(),
        h1_snapshot: createModelMock(),
        h1_event: createModelMock(),
        h1_live: createModelMock(),
        h1_live_snapshot: createModelMock(),
        h1_event_snapshot: createModelMock(),
        // Prisma utilities
        $transaction: vi.fn((fn) => Promise.resolve(Array.isArray(fn) ? fn : fn())),
        $connect: vi.fn(() => Promise.resolve()),
        $disconnect: vi.fn(() => Promise.resolve()),
    },
}));

// #endregion

// #region Next.js Mocks

/**
 * Mock Next.js cache utilities (server-side)
 */
vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
    unstable_cache: vi.fn((fn) => fn),
}));

/**
 * Mock Next.js server utilities — preserves NextResponse, stubs `after`
 */
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, after: vi.fn((fn) => fn()) };
});

/**
 * Mock Next.js App Router navigation
 */
vi.mock('next/navigation', () => ({
    useRouter: vi.fn(() => ({
        push: vi.fn(),
        replace: vi.fn(),
        back: vi.fn(),
        forward: vi.fn(),
        refresh: vi.fn(),
        prefetch: vi.fn(),
    })),
    usePathname: vi.fn(() => '/'),
    useSearchParams: vi.fn(() => new URLSearchParams()),
    redirect: vi.fn(),
    notFound: vi.fn(),
}));

/**
 * Mock Next.js headers (server-side)
 */
vi.mock('next/headers', () => ({
    headers: vi.fn(() => Promise.resolve(new Headers())),
    cookies: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        has: vi.fn(() => false),
        getAll: vi.fn(() => []),
    })),
}));

/**
 * Mock Next.js Image — renders as <img> element
 */
vi.mock('next/image', () => ({
    default: vi.fn((props) => React.createElement('img', props)),
}));

/**
 * Mock Next.js Link — renders as <a> element, filtering Next.js-specific props
 */
vi.mock('next/link', () => ({
    default: vi.fn(({ children, prefetch, scroll, replace, shallow, ...props }) =>
        React.createElement('a', props, children),
    ),
}));

// #endregion

// #region Global Test Lifecycle

// Suppress console noise from source code during tests (error paths, debug logs).
// Tests that need to assert console output can use vi.spyOn(console, 'error').
beforeAll(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterAll(() => {
    vi.restoreAllMocks();
});

beforeEach(() => {
    vi.clearAllMocks();
});

// #endregion
