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
            revokeSession: vi.fn(() => Promise.resolve()),
            revokeSessions: vi.fn(() => Promise.resolve()),
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
        User: createModelMock(),
        account: createModelMock(),
        Account: createModelMock(),
        session: createModelMock(),
        verification: createModelMock(),
        // App models
        settings: createModelMock(),
        apiKey: createModelMock(),
        ApiKey: createModelMock(),
        // Helldivers models
        h1_season: createModelMock(),
        h1_event: createModelMock(),
        h1_status: createModelMock(),
        h1_statistic: createModelMock(),
        h1_event_progress: createModelMock(),
        // Worker health
        worker_heartbeat: createModelMock(),
        // Push subscriptions
        push_subscription: createModelMock(),
        // Prisma utilities
        $transaction: vi.fn((fn) => Promise.resolve(Array.isArray(fn) ? fn : fn())),
        $connect: vi.fn(() => Promise.resolve()),
        $disconnect: vi.fn(() => Promise.resolve()),
        $queryRaw: vi.fn(() => Promise.resolve([])),
        $queryRawUnsafe: vi.fn(() => Promise.resolve([])),
        $executeRaw: vi.fn(() => Promise.resolve(0)),
        $executeRawUnsafe: vi.fn(() => Promise.resolve(0)),
    },
}));

// #endregion

// #region Live Data Mocks

/**
 * Mock LiveDataContext — provides default live data for component tests.
 * Override in tests:
 *   vi.mocked(useLiveDataContext).mockReturnValue({ status: 'offline', ... })
 */
vi.mock('@/shared/providers/LiveDataContext.mjs', () => ({
    LiveDataContext: React.createContext(null),
    useLiveDataContext: vi.fn(() => ({
        data: null,
        mapState: null,
        status: 'live',
        prevData: null,
        isLeader: false,
    })),
}));

// #endregion

// #region Third-Party Component Mocks

/**
 * Mock react-slot-counter — renders the current value as plain text so
 * existing `getByText(...)` / `textContent` assertions keep working.
 */
vi.mock('react-slot-counter', () => ({
    default: vi.fn(({ value }) => React.createElement('span', {}, String(value))),
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
 * Mock Next.js Image — renders as <img>, stripping Next.js-specific props
 * (priority, placeholder, quality, fill, loader, sizes, unoptimized, loading,
 * blurDataURL, onLoadingComplete) so React doesn't warn about non-DOM attributes.
 */
vi.mock('next/image', () => ({
    default: vi.fn(
        ({
            priority,
            placeholder,
            quality,
            fill,
            loader,
            sizes,
            unoptimized,
            loading,
            blurDataURL,
            onLoadingComplete,
            ...props
        }) => React.createElement('img', props),
    ),
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

// Console is NOT globally mocked — silencing console.error here would hide React
// act() warnings, missing-dependency warnings, and source-code error logs, which
// is how theater tests creep in. Tests that legitimately need to suppress or assert
// on console output should use `vi.spyOn(console, 'error').mockImplementation(...)`
// scoped to their own file/test.

beforeEach(() => {
    vi.clearAllMocks();
});

// #endregion
