import {
    guardedReload,
    clearReloadGuard,
    GUARD_KEY,
} from '@/shared/utils/reloadGuard.mjs';

const storage = new Map();
const mockReload = vi.fn();

beforeEach(() => {
    storage.clear();
    mockReload.mockClear();

    vi.stubGlobal('window', {
        location: { reload: mockReload },
    });
    vi.stubGlobal('localStorage', {
        getItem: (k) => storage.get(k) ?? null,
        setItem: (k, v) => storage.set(k, v),
        removeItem: (k) => storage.delete(k),
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('guardedReload', () => {
    test('calls location.reload and sets localStorage guard', () => {
        guardedReload('version');

        expect(mockReload).toHaveBeenCalledOnce();
        const raw = storage.get(GUARD_KEY);
        expect(raw).toMatch(/^version:\d+:1$/);
    });

    test('increments counter and reloads if guard was set less than 30s ago', () => {
        storage.set(GUARD_KEY, `version:${Date.now()}:1`);

        guardedReload('chunk');

        expect(mockReload).toHaveBeenCalledOnce();
        expect(storage.get(GUARD_KEY)).toMatch(/^chunk:\d+:2$/);
    });

    test('allows reload if guard is older than 30s', () => {
        storage.set(GUARD_KEY, `version:${Date.now() - 31_000}:1`);

        guardedReload('chunk');

        expect(mockReload).toHaveBeenCalledOnce();
        expect(storage.get(GUARD_KEY)).toMatch(/^chunk:\d+:1$/);
    });

    test('stops reloading after 3 attempts', () => {
        storage.set(GUARD_KEY, `version:${Date.now()}:3`);

        guardedReload('version');

        expect(mockReload).not.toHaveBeenCalled();
    });

    test('records the reason in the guard value', () => {
        guardedReload('sw');

        expect(storage.get(GUARD_KEY)).toMatch(/^sw:\d+:1$/);
    });
});

// #671: without storage the circuit breaker cannot count, so no reload runs.
describe.each([
    // Android WebViews with DOM storage off (HELLDIVERSBOT-6D).
    ['is null', () => vi.stubGlobal('localStorage', null)],
    // Chrome when the visitor blocks site data.
    [
        'getter throws',
        () => {
            vi.stubGlobal('localStorage', null); // records the original for unstubAllGlobals
            Object.defineProperty(globalThis, 'localStorage', {
                configurable: true,
                get() {
                    throw new DOMException('Access is denied', 'SecurityError');
                },
            });
        },
    ],
])('when localStorage %s', (_, removeStorage) => {
    beforeEach(removeStorage);

    test('guardedReload does not throw and does not reload', () => {
        expect(() => guardedReload('chunk')).not.toThrow();
        expect(mockReload).not.toHaveBeenCalled();
    });

    test('clearReloadGuard does not throw', () => {
        expect(() => clearReloadGuard()).not.toThrow();
    });
});

describe('clearReloadGuard', () => {
    test('removes the guard key', () => {
        storage.set(GUARD_KEY, `version:${Date.now()}:1`);

        clearReloadGuard();

        expect(storage.has(GUARD_KEY)).toBe(false);
    });

    test('allows reload after clearing', () => {
        guardedReload('version');
        mockReload.mockClear();

        clearReloadGuard();
        guardedReload('version');

        expect(mockReload).toHaveBeenCalledOnce();
    });

    test('resets the attempt counter', () => {
        storage.set(GUARD_KEY, `version:${Date.now() - 31_000}:3`);

        clearReloadGuard();
        guardedReload('version');

        expect(mockReload).toHaveBeenCalledOnce();
        expect(storage.get(GUARD_KEY)).toMatch(/^version:\d+:1$/);
    });
});
