import { describe, expect, test, vi, beforeEach } from 'vitest';
import { CAMPAIGN_STATUS, EVENT_STATUS, EVENT_TYPE } from '@/shared/enums/events.mjs';

// Real implementation, used only to build realistic map-state fixtures for
// the edge-case tests below — @/shared/utils/game/computeMapState.mjs is
// mocked (below) so the route itself never runs it.
const { computeMapState: realComputeMapState } = await vi.importActual(
    '@/shared/utils/game/computeMapState.mjs',
);

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

const umamiTrackEvent = vi.fn();
vi.mock('@/shared/utils/umami.mjs', () => ({
    umamiTrackEvent: (...args) => umamiTrackEvent(...args),
}));

// `after()` schedules work post-response; the mock runs it immediately so
// assertions don't need to await Next's request lifecycle (same pattern as
// src/__tests__/unit/app/api/h1/rebroadcast/route.test.mjs).
vi.mock('next/server', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        after: vi.fn((fn) => fn()),
    };
});

const getCampaign = vi.fn();
vi.mock('@/db/queries/getCampaign.mjs', () => ({ getCampaign: () => getCampaign() }));

// Per-test controllable — default matches the pre-Task-3 flat empty array so
// the existing cases are unaffected; the edge-case tests below override this
// with a realistic per-case shape built from the real computeMapState.
let computeLiveMapStateResult = () => [];
vi.mock('@/shared/utils/game/computeMapState.mjs', () => ({
    computeLiveMapState: (...args) => computeLiveMapStateResult(...args),
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
        umamiTrackEvent.mockClear();
        getCampaign.mockResolvedValue(CAMPAIGN);
        bodyFails = false;
        readFileResult = () => Promise.resolve(FALLBACK_BYTES);
        computeLiveMapStateResult = () => [];
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

    test('a rejected getCampaign() is dispositioned as a query failure and reported to GlitchTip (D-11)', async () => {
        getCampaign.mockRejectedValue(new Error('connection refused'));

        await Image();

        expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({ message: 'connection refused' }),
            expect.objectContaining({ route: 'opengraph-image', stage: 'data-fetch' }),
        );
    });

    test('serves the uncacheable static fallback without constructing an ImageResponse when status is empty', async () => {
        getCampaign.mockResolvedValue({ status: [], events: [] });

        const response = await Image();

        expect(constructed).toHaveLength(0);
        expect(response.headers.get('content-type')).toBe('image/png');
        expect(response.headers.get('Cache-Control')).toContain('no-store');
    });

    test('a well-formed empty result is dispositioned as legitimately empty and does NOT report an error (D-11)', async () => {
        getCampaign.mockResolvedValue({ status: [], events: [] });

        await Image();

        expect(reportError).not.toHaveBeenCalled();
    });

    test('a successful render fires exactly one telemetry call marking the rendered outcome', async () => {
        await Image();

        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);
        expect(umamiTrackEvent).toHaveBeenCalledWith(
            expect.any(String),
            '/opengraph-image',
            'api-og-rendered',
            expect.any(Object),
        );
    });

    test('a rasterisation failure fires exactly one fallback-outcome telemetry call and still reports the original error', async () => {
        bodyFails = true;

        await Image();

        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);
        expect(umamiTrackEvent).toHaveBeenCalledWith(
            expect.any(String),
            '/opengraph-image',
            'api-og-fallback',
            expect.objectContaining({ stage: 'rasterisation' }),
        );
        expect(reportError).toHaveBeenCalledWith(
            expect.objectContaining({
                message: expect.stringContaining('unsupported image'),
            }),
            expect.objectContaining({ route: 'opengraph-image' }),
        );
    });

    test('a data-fetch failure fires exactly one telemetry call marking the fallback outcome', async () => {
        getCampaign.mockRejectedValue(new Error('connection refused'));

        await Image();

        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);
        expect(umamiTrackEvent).toHaveBeenCalledWith(
            expect.any(String),
            '/opengraph-image',
            'api-og-fallback',
            expect.objectContaining({ stage: 'query-failure' }),
        );
    });

    test('the rendered and fallback events are mutually exclusive — no invocation fires more than one telemetry call', async () => {
        await Image();
        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);

        umamiTrackEvent.mockClear();
        bodyFails = true;
        await Image();
        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);

        umamiTrackEvent.mockClear();
        bodyFails = false;
        getCampaign.mockRejectedValue(new Error('connection refused'));
        await Image();
        expect(umamiTrackEvent).toHaveBeenCalledTimes(1);
    });

    describe('edge-case map states (D-12)', () => {
        // Realistic 3-faction campaign, no active events — used as the base for
        // the null-slot and no-active-events cases below. Shape/values mirror
        // computeMapState.test.mjs's baseFactions fixture.
        const REALISTIC_FACTIONS = [
            {
                enemy: 0,
                points: 55000,
                points_max: 100000,
                status: CAMPAIGN_STATUS.ACTIVE,
            },
            {
                enemy: 1,
                points: 30000,
                points_max: 100000,
                status: CAMPAIGN_STATUS.ACTIVE,
            },
            {
                enemy: 2,
                points: 70000,
                points_max: 100000,
                status: CAMPAIGN_STATUS.ACTIVE,
            },
        ];

        test('control: guard fails when driven to the fallback by construction', async () => {
            // Confirms the discriminating assertion actually distinguishes success
            // from fallback before trusting the three cases below — a campaign
            // with an empty status array is a deliberately broken shape that must
            // fall back, not render.
            getCampaign.mockResolvedValue({ status: [], events: [] });

            const response = await Image();

            expect(constructed).toHaveLength(0);
            expect(response.headers.get('Cache-Control')).toContain('no-store');
        });

        test('a null faction slot in data.status still renders a real card, not the fallback', async () => {
            // A campaign whose status array contains a null faction entry — the
            // #503-class bug: data.status.map/.every previously read `.enemy` /
            // `.status` off that null unguarded (found and fixed in this task,
            // see the Deviations section of the plan summary). The mapState
            // fixture is built from only the non-null factions, since
            // computeMapState.mjs (mocked here, real implementation) also
            // assumes non-null entries — the null-slot is opengraph-image.jsx's
            // own concern, not computeMapState.mjs's.
            const NULL_SLOT_STATUS = [REALISTIC_FACTIONS[0], null, REALISTIC_FACTIONS[2]];
            getCampaign.mockResolvedValue({ status: NULL_SLOT_STATUS, events: [] });
            computeLiveMapStateResult = () =>
                realComputeMapState([REALISTIC_FACTIONS[0], REALISTIC_FACTIONS[2]], []);

            const response = await Image();

            expect(constructed).toHaveLength(1);
            expect(response.headers.get('Cache-Control')).not.toContain('no-store');
            expect(umamiTrackEvent).toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-rendered',
                expect.any(Object),
            );
            expect(umamiTrackEvent).not.toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-fallback',
                expect.any(Object),
            );
        });

        test('no-active-events map state still renders a real card, not the fallback', async () => {
            getCampaign.mockResolvedValue({ status: REALISTIC_FACTIONS, events: [] });
            computeLiveMapStateResult = () => realComputeMapState(REALISTIC_FACTIONS, []);

            const response = await Image();

            expect(constructed).toHaveLength(1);
            expect(response.headers.get('Cache-Control')).not.toContain('no-store');
            expect(umamiTrackEvent).toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-rendered',
                expect.any(Object),
            );
            expect(umamiTrackEvent).not.toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-fallback',
                expect.any(Object),
            );
        });

        test('homeworld-only map state (active attack, no sector campaigns) still renders a real card, not the fallback', async () => {
            const now = Math.floor(Date.now() / 1000);
            const NO_SECTOR_FACTIONS = [
                {
                    enemy: 0,
                    points: 0,
                    points_max: 100000,
                    status: CAMPAIGN_STATUS.ACTIVE,
                },
                {
                    enemy: 1,
                    points: 0,
                    points_max: 100000,
                    status: CAMPAIGN_STATUS.ACTIVE,
                },
                {
                    enemy: 2,
                    points: 0,
                    points_max: 100000,
                    status: CAMPAIGN_STATUS.ACTIVE,
                },
            ];
            const homeworldAttack = {
                type: EVENT_TYPE.ATTACK,
                enemy: 0,
                status: EVENT_STATUS.ACTIVE,
                start_time: now - 3600,
                end_time: now + 3600,
                points: 5000,
                points_max: 10000,
            };
            getCampaign.mockResolvedValue({
                status: NO_SECTOR_FACTIONS,
                events: [homeworldAttack],
            });
            const realMapState = realComputeMapState(NO_SECTOR_FACTIONS, [
                homeworldAttack,
            ]);
            expect(realMapState[0][11].status).toBe('active'); // guard: region 11 really is owned
            computeLiveMapStateResult = () => realMapState;

            const response = await Image();

            expect(constructed).toHaveLength(1);
            expect(response.headers.get('Cache-Control')).not.toContain('no-store');
            expect(umamiTrackEvent).toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-rendered',
                expect.any(Object),
            );
            expect(umamiTrackEvent).not.toHaveBeenCalledWith(
                expect.any(String),
                '/opengraph-image',
                'api-og-fallback',
                expect.any(Object),
            );
        });
    });
});
