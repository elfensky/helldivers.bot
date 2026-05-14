import { guardedReload, clearReloadGuard, GUARD_KEY } from '@/shared/utils/reloadGuard.mjs';

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

    test('suppresses reload if guard was set less than 30s ago', () => {
        storage.set(GUARD_KEY, `version:${Date.now()}:1`);

        guardedReload('chunk');

        expect(mockReload).not.toHaveBeenCalled();
    });

    test('allows reload if guard is older than 30s', () => {
        storage.set(GUARD_KEY, `version:${Date.now() - 31_000}:1`);

        guardedReload('chunk');

        expect(mockReload).toHaveBeenCalledOnce();
        expect(storage.get(GUARD_KEY)).toMatch(/^chunk:\d+:2$/);
    });

    test('stops reloading after 3 attempts', () => {
        storage.set(GUARD_KEY, `version:${Date.now() - 31_000}:3`);

        guardedReload('version');

        expect(mockReload).not.toHaveBeenCalled();
    });

    test('records the reason in the guard value', () => {
        guardedReload('sw');

        expect(storage.get(GUARD_KEY)).toMatch(/^sw:\d+:1$/);
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
