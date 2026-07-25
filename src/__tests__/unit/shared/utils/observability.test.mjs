// This file tests the REAL reportError, so it must opt out of the global
// observability mock installed in vitest.setup.mjs.
vi.unmock('@/shared/utils/observability.mjs');

const { reportError } = await vi.importActual('@/shared/utils/observability.mjs');
import * as Sentry from '@sentry/nextjs';

vi.mock('@sentry/nextjs', () => ({
    captureException: vi.fn(),
}));

describe('reportError', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('forwards the error and context to Sentry.captureException', () => {
        const err = new Error('boom');
        reportError(err, { route: '/api/h1/update' });
        expect(Sentry.captureException).toHaveBeenCalledTimes(1);
        expect(Sentry.captureException).toHaveBeenCalledWith(err, {
            level: undefined,
            extra: { route: '/api/h1/update' },
        });
    });

    test('passes level through to Sentry as severity', () => {
        const err = new Error('not fatal');
        reportError(err, { level: 'warning', stage: 'closing-pass' });
        expect(Sentry.captureException).toHaveBeenCalledWith(err, {
            level: 'warning',
            extra: { stage: 'closing-pass' },
        });
    });

    test('no-ops on falsy errors', () => {
        reportError(null);
        reportError(undefined);
        reportError('');
        reportError(0);
        expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    test('handles missing context with empty extra', () => {
        const err = new Error('boom');
        reportError(err);
        expect(Sentry.captureException).toHaveBeenCalledWith(err, {
            level: undefined,
            extra: {},
        });
    });
});
