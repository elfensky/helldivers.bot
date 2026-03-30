import { tryCatch } from '@/utils/tryCatch.mjs';

describe('tryCatch', () => {
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
});
