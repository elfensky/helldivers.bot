import { generateOpenApiSpec } from '@/shared/utils/api/openapiRegistry.mjs';

describe('generateOpenApiSpec', () => {
    const spec = generateOpenApiSpec();

    test('returns object with openapi version 3.0.0', () => {
        expect(spec.openapi).toBe('3.0.0');
    });

    test('has info.title set to Helldivers 1 API', () => {
        expect(spec.info.title).toBe('Helldivers 1 API');
    });

    test('documents the public surface: /v1 reads + rebroadcast + deprecated campaign', () => {
        expect(spec.paths).toHaveProperty('/api/v1/h1/status');
        expect(spec.paths).toHaveProperty('/api/v1/h1/stats');
        expect(spec.paths).toHaveProperty('/api/v1/h1/season');
        expect(spec.paths).toHaveProperty('/api/v1/h1/map');
        expect(spec.paths).toHaveProperty('/api/h1/rebroadcast');
        expect(spec.paths).toHaveProperty('/api/h1/campaign');
    });

    test('does NOT document internal endpoints (live, update, notifications)', () => {
        expect(spec.paths).not.toHaveProperty('/api/h1/live');
        expect(spec.paths).not.toHaveProperty('/api/h1/update');
        expect(spec.paths).not.toHaveProperty('/api/notifications/subscribe');
    });

    test('/api/h1/campaign is marked deprecated', () => {
        expect(spec.paths['/api/h1/campaign'].get.deprecated).toBe(true);
    });

    test('/v1 reads expose key-gating (401) and rate limiting (429)', () => {
        for (const p of [
            '/api/v1/h1/status',
            '/api/v1/h1/stats',
            '/api/v1/h1/season',
            '/api/v1/h1/map',
        ]) {
            const get = spec.paths[p].get;
            expect(get.responses['401']).toBeDefined();
            expect(get.responses['429']).toBeDefined();
            expect(get.responses['200'].content).toHaveProperty('application/json');
        }
    });

    test('history reads (status, stats) document a 304', () => {
        expect(spec.paths['/api/v1/h1/status'].get.responses['304']).toBeDefined();
        expect(spec.paths['/api/v1/h1/stats'].get.responses['304']).toBeDefined();
    });

    test('rebroadcast declares all five actions and a 501 for the unimplemented ones', () => {
        const actions =
            spec.components.schemas.RebroadcastFormData.properties.action.enum;
        expect(actions).toEqual([
            'get_campaign_status',
            'get_snapshots',
            'get_available_entitlements',
            'get_leaderboards',
            'get_usernames',
        ]);
        expect(spec.paths['/api/h1/rebroadcast'].post.responses['501']).toBeDefined();
    });

    test('component schemas include the envelope + the /v1 item shapes (no PushSubscription)', () => {
        const schemaNames = Object.keys(spec.components?.schemas ?? {});
        expect(schemaNames).toContain('ErrorResponse');
        expect(schemaNames).toContain('SuccessResponse');
        expect(schemaNames).toContain('StatusItem');
        expect(schemaNames).toContain('StatsItem');
        expect(schemaNames).toContain('SeasonItem');
        expect(schemaNames).toContain('MapRegion');
        expect(schemaNames).not.toContain('PushSubscription');
    });
});
