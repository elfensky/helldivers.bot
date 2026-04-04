import { generateOpenApiSpec } from '@/shared/utils/api/openapi.registry.mjs';

describe('generateOpenApiSpec', () => {
    const spec = generateOpenApiSpec();

    test('returns object with openapi version 3.0.0', () => {
        expect(spec.openapi).toBe('3.0.0');
    });

    test('has info.title set to Helldivers 1 API', () => {
        expect(spec.info.title).toBe('Helldivers 1 API');
    });

    test('has all expected API paths', () => {
        expect(spec.paths).toHaveProperty('/api/h1/campaign');
        expect(spec.paths).toHaveProperty('/api/h1/rebroadcast');
        expect(spec.paths).toHaveProperty('/api/h1/update');
        expect(spec.paths).toHaveProperty('/api/h1/stream');
        expect(spec.paths).toHaveProperty('/api/notifications/subscribe');
    });

    test('/api/h1/stream has GET with text/event-stream response', () => {
        const stream = spec.paths['/api/h1/stream'].get;
        expect(stream.responses['200'].content).toHaveProperty('text/event-stream');
    });

    test('/api/notifications/subscribe has both POST and DELETE', () => {
        const subscribe = spec.paths['/api/notifications/subscribe'];
        expect(subscribe).toHaveProperty('post');
        expect(subscribe).toHaveProperty('delete');
    });

    test('has component schemas for ErrorResponse, SuccessResponse, and PushSubscription', () => {
        const schemaNames = Object.keys(spec.components?.schemas ?? {});
        expect(schemaNames).toContain('ErrorResponse');
        expect(schemaNames).toContain('SuccessResponse');
        expect(schemaNames).toContain('PushSubscription');
    });
});
