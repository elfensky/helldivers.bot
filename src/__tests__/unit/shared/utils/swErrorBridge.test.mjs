import { handleSwErrorMessage } from '@/shared/utils/swErrorBridge.mjs';
import { reportError } from '@/shared/utils/observability.mjs';

vi.mock('@/shared/utils/observability.mjs', () => ({
    reportError: vi.fn(),
}));

describe('handleSwErrorMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test('reconstructs the error and forwards to reportError with source=sw + context', () => {
        const event = {
            data: {
                type: 'sw-error',
                error: { message: 'boom', name: 'TypeError', stack: 'stack-trace' },
                context: { handler: 'push', stage: 'showNotification' },
            },
        };
        handleSwErrorMessage(event);
        expect(reportError).toHaveBeenCalledTimes(1);
        const [errArg, ctxArg] = reportError.mock.calls[0];
        expect(errArg).toBeInstanceOf(Error);
        expect(errArg.message).toBe('boom');
        expect(errArg.name).toBe('TypeError');
        expect(errArg.stack).toBe('stack-trace');
        expect(ctxArg).toEqual({
            source: 'sw',
            handler: 'push',
            stage: 'showNotification',
        });
    });

    test('ignores unrelated message types', () => {
        handleSwErrorMessage({ data: { type: 'other-thing' } });
        handleSwErrorMessage({ data: { type: 'sw-update' } });
        expect(reportError).not.toHaveBeenCalled();
    });

    test('ignores null/undefined/malformed events without throwing', () => {
        expect(() => handleSwErrorMessage(null)).not.toThrow();
        expect(() => handleSwErrorMessage(undefined)).not.toThrow();
        expect(() => handleSwErrorMessage({})).not.toThrow();
        expect(() => handleSwErrorMessage({ data: null })).not.toThrow();
        expect(reportError).not.toHaveBeenCalled();
    });

    test('does not report when the error field is absent', () => {
        handleSwErrorMessage({ data: { type: 'sw-error' } });
        expect(reportError).not.toHaveBeenCalled();
    });

    test('handles missing optional fields gracefully', () => {
        handleSwErrorMessage({ data: { type: 'sw-error', error: {} } });
        expect(reportError).toHaveBeenCalledTimes(1);
        const [errArg, ctxArg] = reportError.mock.calls[0];
        expect(errArg).toBeInstanceOf(Error);
        expect(errArg.message).toBe('Service worker error');
        expect(errArg.name).toBe('Error');
        expect(ctxArg).toEqual({ source: 'sw' });
    });
});
