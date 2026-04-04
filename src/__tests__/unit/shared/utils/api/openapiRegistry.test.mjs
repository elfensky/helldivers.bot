import { generateOpenApiSpec } from '@/shared/utils/api/openapi.registry.mjs';

describe('generateOpenApiSpec', () => {
    const spec = generateOpenApiSpec();

    test('returns object with openapi version 3.0.0', () => {
        expect(spec.openapi).toBe('3.0.0');
    });

    test('has info.title set to Helldivers 1 API', () => {
        expect(spec.info.title).toBe('Helldivers 1 API');
    });

    test('has paths for /api/h1/campaign, /api/h1/rebroadcast, and /api/h1/update', () => {
        expect(spec.paths).toHaveProperty('/api/h1/campaign');
        expect(spec.paths).toHaveProperty('/api/h1/rebroadcast');
        expect(spec.paths).toHaveProperty('/api/h1/update');
    });

    test('has component schemas for ErrorResponse and SuccessResponse', () => {
        const schemaNames = Object.keys(spec.components?.schemas ?? {});
        expect(schemaNames).toContain('ErrorResponse');
        expect(schemaNames).toContain('SuccessResponse');
    });
});
