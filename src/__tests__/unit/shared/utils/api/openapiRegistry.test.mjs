import { generateOpenApiSpec } from '@/shared/utils/api/openapiRegistry.mjs';

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
        expect(spec.paths).toHaveProperty('/api/h1/live');
        expect(spec.paths).toHaveProperty('/api/notifications/subscribe');
    });

    test('/api/h1/live has GET with application/json response', () => {
        const live = spec.paths['/api/h1/live'].get;
        expect(live.responses['200'].content).toHaveProperty('application/json');
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
