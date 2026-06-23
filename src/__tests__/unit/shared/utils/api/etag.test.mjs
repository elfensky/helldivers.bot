import { describe, expect, test } from 'vitest';
import { computeEtag, notModified } from '@/shared/utils/api/etag.mjs';

describe('computeEtag', () => {
    test('is stable for equal data and quoted', () => {
        const a = computeEtag({ items: [1, 2, 3] });
        const b = computeEtag({ items: [1, 2, 3] });
        expect(a).toBe(b);
        expect(a).toMatch(/^".+"$/);
    });

    test('differs when data differs', () => {
        expect(computeEtag({ n: 1 })).not.toBe(computeEtag({ n: 2 }));
    });

    test('serializes BigInt without throwing', () => {
        expect(() => computeEtag({ kills: 10n })).not.toThrow();
        expect(computeEtag({ kills: 10n })).toBe(computeEtag({ kills: 10 }));
    });
});

describe('notModified', () => {
    test('304 with no body and re-sent validators', () => {
        const res = notModified('"abc"', 'public, max-age=60');
        expect(res.status).toBe(304);
        expect(res.headers.get('etag')).toBe('"abc"');
        expect(res.headers.get('cache-control')).toBe('public, max-age=60');
    });
});
