import { isChunkError } from '@/shared/utils/isChunkError.mjs';

describe('isChunkError', () => {
    test('matches the ChunkLoadError shape seen in production', () => {
        // Verbatim from GlitchTip HELLDIVERSBOT-2K (0.65.2).
        const err = new Error(
            'Failed to load chunk /_next/static/chunks/2avgbxs8eufgs.js?dpl=0-65-2 from module 964893',
        );
        err.name = 'ChunkLoadError';
        expect(isChunkError(err)).toBe(true);
    });

    test('matches the other post-deploy import failure shapes', () => {
        expect(isChunkError('Failed to fetch dynamically imported module: /x.js')).toBe(
            true,
        );
        expect(isChunkError(new Error('error loading dynamically imported module'))).toBe(
            true,
        );
        expect(isChunkError(new Error('Importing a module script failed.'))).toBe(true);
    });

    test('matches on name even when message is non-empty and non-matching', () => {
        // Regression: the predicate used `message || name`, so a non-empty
        // message short-circuited away the `name` that actually identified the
        // error — the auto-reload never fired for real production chunk errors.
        const err = new Error('totally unrelated wording');
        err.name = 'ChunkLoadError';
        expect(isChunkError(err)).toBe(true);
    });

    test('ignores unrelated errors', () => {
        expect(isChunkError(new Error('Minified React error #418'))).toBe(false);
        expect(isChunkError(new TypeError('x is not a function'))).toBe(false);
        expect(isChunkError('POSTGRES_URL is not set')).toBe(false);
    });

    test('tolerates empty and non-error values', () => {
        expect(isChunkError(null)).toBe(false);
        expect(isChunkError(undefined)).toBe(false);
        expect(isChunkError('')).toBe(false);
        expect(isChunkError({})).toBe(false);
    });
});
