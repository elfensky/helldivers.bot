import { describe, expect, test, vi, beforeEach } from 'vitest';

// Constructed instances of the LIVE card only — the fallback reads static
// bytes and never constructs an ImageResponse (D-07).
const constructed = [];
let bodyFails = false;

vi.mock('next/og', () => ({
    ImageResponse: class {
        constructor(element, options) {
            this.element = element;
            this.options = options;
            this.headers = new Headers({ 'content-type': 'image/png' });
            constructed.push(this);
        }
        // The real one only rasterises while the body streams — that is exactly
        // why the route has to await it to catch a failure.
        arrayBuffer() {
            return bodyFails ?
                    Promise.reject(
                        new Error('Input buffer contains unsupported image format'),
                    )
                :   Promise.resolve(new ArrayBuffer(8));
        }
    },
}));

const reportError = vi.fn();
vi.mock('@/shared/utils/observability.mjs', () => ({
    reportError: (...args) => reportError(...args),
}));

const getCampaign = vi.fn();
vi.mock('@/db/queries/getCampaign.mjs', () => ({ getCampaign: () => getCampaign() }));

vi.mock('@/shared/utils/game/computeMapState.mjs', () => ({
    computeLiveMapState: () => [],
}));

// The route reads the committed static fallback via `node:fs/promises`
// `readFile` — mocked so the test suite does not depend on the committed
// binary at public/og-fallback.png.
let readFileResult;
vi.mock('node:fs/promises', () => ({
    readFile: (...args) => readFileResult(...args),
}));

const { default: Image } = await import('@/app/opengraph-image.jsx');

const CAMPAIGN = {
    status: [{ enemy: 0, points: 50, points_max: 100, status: 1 }],
    events: [],
};

const FALLBACK_BYTES = Buffer.from('fake-fallback-png-bytes');

describe('opengraph-image', () => {
    beforeEach(() => {
        constructed.length = 0;
        reportError.mockClear();
        getCampaign.mockResolvedValue(CAMPAIGN);
        bodyFails = false;
        readFileResult = () => Promise.resolve(FALLBACK_BYTES);
    });

    test('returns the rendered card when rasterisation succeeds', async () => {
        const response = await Image();

        expect(await response.arrayBuffer()).toHaveProperty('byteLength', 8);
        expect(constructed).toHaveLength(1);
        expect(reportError).not.toHaveBeenCalled();
    });

    test('caches a successful render with a non-zero shared max-age', async () => {
        const response = await Image();

        const cacheControl = response.headers.get('Cache-Control') ?? '';
        expect(cacheControl).toMatch(/s-maxage=[1-9]\d*|max-age=[1-9]\d*/);
    });

    test('falls back to the static bytes instead of throwing when the rasteriser rejects', async () => {
        bodyFails = true;

        const response = await Image();

        // Exactly one construction: the real card that failed. The fallback
        // branch reads bytes off disk and never constructs an ImageResponse.
        expect(constructed).toHaveLength(1);
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('Cache-Control')).toContain('no-store');
        expect(Buffer.from(await response.arrayBuffer()).toString()).toBe(
            'fake-fallback-png-bytes',
        );
    });

    test('reports the rasterisation failure to GlitchTip with the route tag preserved', async () => {
        bodyFails = true;

        await Image();

        expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('unsupported image'),
            }),
            expect.objectContaining({ route: 'opengraph-image' }),
        );
    });

    test('serves the uncacheable static fallback without constructing an ImageResponse when getCampaign rejects', async () => {
        getCampaign.mockRejectedValue(new Error('connection refused'));

        const response = await Image();

        expect(constructed).toHaveLength(0);
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    test('serves the uncacheable static fallback without constructing an ImageResponse when status is empty', async () => {
        getCampaign.mockResolvedValue({ status: [], events: [] });

        const response = await Image();

        expect(constructed).toHaveLength(0);
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('Cache-Control')).toContain('no-store');
    });
});
