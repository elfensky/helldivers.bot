import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// #region Auth Mocks

/**
 * Mock NextAuth v5 server-side auth
 *
 * Defaults to null (logged-out). Override in tests:
 *   vi.mocked(auth).mockResolvedValue(createMockSession())
 */
vi.mock('@/auth', () => ({
    auth: vi.fn(() => Promise.resolve(null)),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
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
        // Auth models
        user: createModelMock(),
        account: createModelMock(),
        session: createModelMock(),
        verificationToken: createModelMock(),
        authenticator: createModelMock(),
        // App models
        app: createModelMock(),
        settings: createModelMock(),
        review: createModelMock(),
        apiKey: createModelMock(),
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
 * Mock Next.js Image — renders as plain <img>
 */
vi.mock('next/image', () => ({
    default: vi.fn((props) => props),
}));

/**
 * Mock Next.js Link — renders as plain <a>
 */
vi.mock('next/link', () => ({
    default: vi.fn((props) => props),
}));

// #endregion

// #region Global Test Lifecycle

beforeEach(() => {
    vi.clearAllMocks();
});

// #endregion
