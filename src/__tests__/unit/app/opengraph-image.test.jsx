import { describe, expect, test, vi, beforeEach } from 'vitest';

// Constructed instances, in order: [0] is the real card, [1] the fallback.
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

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({
    captureException: (...args) => captureException(...args),
}));

const getCampaign = vi.fn();
vi.mock('@/db/queries/getCampaign.mjs', () => ({ getCampaign: () => getCampaign() }));

vi.mock('@/shared/utils/game/computeMapState.mjs', () => ({
    computeLiveMapState: () => [],
}));

const { default: Image } = await import('@/app/opengraph-image.jsx');

const CAMPAIGN = {
    status: [{ enemy: 0, points: 50, points_max: 100, status: 1 }],
    events: [],
};

describe('opengraph-image', () => {
    beforeEach(() => {
        constructed.length = 0;
        captureException.mockClear();
        getCampaign.mockResolvedValue(CAMPAIGN);
        bodyFails = false;
    });

    test('returns the rendered card when rasterisation succeeds', async () => {
        const response = await Image();

        expect(await response.arrayBuffer()).toHaveProperty('byteLength', 8);
        expect(constructed).toHaveLength(1);
        expect(captureException).not.toHaveBeenCalled();
    });

    test('falls back instead of throwing when the rasteriser rejects', async () => {
        bodyFails = true;

        const response = await Image();

        // Two constructions: the real card that failed, then the fallback —
        // and the fallback is what the crawler gets, not a 500.
        expect(constructed).toHaveLength(2);
        expect(response).toBe(constructed[1]);
        expect(captureException).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('unsupported image'),
            }),
            { tags: { route: 'opengraph-image' } },
        );
    });
});
