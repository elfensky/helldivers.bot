import { tryCatch } from '@/shared/utils/tryCatch.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

vi.mock('@/shared/utils/observability.mjs', () => ({
    reportError: vi.fn(),
}));

describe('tryCatch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('returns data and null error when promise resolves', async () => {
        const result = await tryCatch(Promise.resolve('hello'));
        expect(result).toEqual({ data: 'hello', error: null });
    });

    test('returns null data and error when promise rejects', async () => {
        const err = new Error('fail');
        const result = await tryCatch(Promise.reject(err));
        expect(result).toEqual({ data: null, error: err });
    });

    test('handles non-Error rejection values', async () => {
        const result = await tryCatch(Promise.reject('string error'));
        expect(result).toEqual({ data: null, error: 'string error' });
    });

    test('returns data for falsy resolved values', async () => {
        expect(await tryCatch(Promise.resolve(null))).toEqual({
            data: null,
            error: null,
        });
        expect(await tryCatch(Promise.resolve(0))).toEqual({ data: 0, error: null });
        expect(await tryCatch(Promise.resolve(false))).toEqual({
            data: false,
            error: null,
        });
        expect(await tryCatch(Promise.resolve(''))).toEqual({ data: '', error: null });
    });

    test('handles resolved undefined', async () => {
        const result = await tryCatch(Promise.resolve(undefined));
        expect(result).toEqual({ data: undefined, error: null });
    });

    test('handles async function that throws', async () => {
        const err = new Error('async throw');
        const asyncFn = async () => {
            throw err;
        };
        const result = await tryCatch(asyncFn());
        expect(result).toEqual({ data: null, error: err });
    });

    test('returns resolved object data intact', async () => {
        const obj = { id: 1, name: 'test', nested: { key: 'value' } };
        const result = await tryCatch(Promise.resolve(obj));
        expect(result.data).toBe(obj);
        expect(result.error).toBeNull();
    });

    describe('GlitchTip auto-capture (v2)', () => {
        test('reports caught errors to GlitchTip with source=tryCatch, level=warning', async () => {
            const err = new Error('boom');
            await tryCatch(Promise.reject(err));
            expect(reportError).toHaveBeenCalledTimes(1);
            expect(reportError).toHaveBeenCalledWith(err, {
                source: 'tryCatch',
                level: 'warning',
            });
        });

        test('does NOT call reportError when the promise resolves', async () => {
            await tryCatch(Promise.resolve('ok'));
            expect(reportError).not.toHaveBeenCalled();
        });

        test('reports non-Error rejection values (strings, plain objects)', async () => {
            await tryCatch(Promise.reject('string error'));
            expect(reportError).toHaveBeenCalledWith('string error', {
                source: 'tryCatch',
                level: 'warning',
            });
        });

        test('still returns the original error to the caller after reporting', async () => {
            const err = new Error('boom');
            const result = await tryCatch(Promise.reject(err));
            // Auto-capture must not swallow the error from the caller's view.
            expect(result).toEqual({ data: null, error: err });
        });
    });
});
