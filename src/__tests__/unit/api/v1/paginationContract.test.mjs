import { describe, expect, test } from 'vitest';
import {
    projectLatest,
    projectHistory,
} from '@/app/api/v1/h1/status/statusProjection.mjs';
import { projectStats } from '@/app/api/v1/h1/stats/statsProjection.mjs';
import { generateOpenApiSpec } from '@/shared/utils/api/openapiRegistry.mjs';

/**
 * The v1 wire contract is promised stable in /docs/api, but the per-endpoint
 * projection tests only pin fields the author remembered to assert. These cover
 * the two things those tests structurally cannot:
 *
 *  1. the `page` envelope's *behavioural* meaning, not just its shape — a
 *     response that echoes `limit: 1` beside three items validates perfectly
 *     against the schema while contradicting itself;
 *  2. that the OpenAPI document the docs page publishes still describes the
 *     fields the projections actually emit.
 */

const statusRows = [0, 1, 2].map((enemy) => ({
    enemy,
    points: 100,
    points_max: 200,
    players: 10,
    time: 1700000000,
    bucket: 1700000000,
}));

const historyRows = Array.from({ length: 6 }, (_, i) => ({
    enemy: 0,
    points: 100 + i,
    time: 1700000000,
    bucket: 1700000000 + i * 900,
}));

const statsRows = Array.from({ length: 6 }, (_, i) => ({
    enemy: 0,
    bucket: 1700000000 + i * 900,
    players: 88,
    missions: 100,
    successful_missions: 70,
    kills: 1234n,
    deaths: 5n,
    shots: 99n,
    hits: 88n,
}));

describe('v1 pagination contract', () => {
    // Paginated modes must never return more than the caller asked for. This is the
    // invariant that would have caught `limit` being echoed but not applied.
    test.each([1, 2, 5, 100])(
        'projectHistory returns at most `limit` items (%i)',
        (limit) => {
            const out = projectHistory(historyRows, { 0: 200 }, {}, 42, limit);
            expect(out.items.length).toBeLessThanOrEqual(out.page.limit);
            expect(out.page.limit).toBe(limit);
        },
    );

    test.each([1, 2, 5, 100])(
        'projectStats returns at most `limit` items (%i)',
        (limit) => {
            const out = projectStats(statsRows, 42, limit, 900);
            expect(out.items.length).toBeLessThanOrEqual(out.page.limit);
            expect(out.page.limit).toBe(limit);
        },
    );

    test('a truncated page always advertises a cursor to continue from', () => {
        const out = projectHistory(historyRows, { 0: 200 }, {}, 42, 2);
        expect(out.items).toHaveLength(2);
        expect(out.page.nextCursor).not.toBeNull();
    });

    // `mode=latest` is deliberately unpaginated: it returns one row per faction
    // (at most three) and `nextCursor` is hardcoded null, so `limit` cannot mean
    // "first page of". Applying it would silently drop factions, and dropping the
    // echoed field would delete a documented required key — so the response is
    // left alone and the OpenAPI description carries the caveat instead.
    test('projectLatest is unpaginated and never advertises a next page', () => {
        for (const limit of [1, 2, 100]) {
            const out = projectLatest(statusRows, 42, limit, undefined);
            expect(out.mode).toBe('latest');
            expect(out.items).toHaveLength(3);
            expect(out.items.length).toBeLessThanOrEqual(3);
            expect(out.page.nextCursor).toBeNull();
        }
    });

    test('the published limit/cursor/order docs say they are history-only', () => {
        const spec = generateOpenApiSpec();
        const params = spec.paths['/api/v1/h1/status'].get.parameters ?? [];
        const byName = Object.fromEntries(params.map((p) => [p.name, p]));

        expect(byName.limit.description).toMatch(/unpaginated|latest/i);
        expect(byName.cursor.description).toMatch(/history|latest/i);
        expect(byName.order.description).toMatch(/history|latest/i);
    });
});

describe('v1 response schemas still describe what the projections emit', () => {
    /** Resolves a `#/components/schemas/X` pointer against the document. */
    const deref = (spec, node) =>
        node?.$ref ?
            spec.components.schemas[node.$ref.replace('#/components/schemas/', '')]
        :   node;

    /** Walks allOf/$ref far enough to reach the `data` object's properties. */
    function dataProps(spec, path) {
        const schema = deref(
            spec,
            spec.paths[path].get.responses['200'].content['application/json'].schema,
        );
        const resolved = schema.allOf ? Object.assign({}, ...schema.allOf) : schema;
        return deref(spec, resolved.properties.data).properties;
    }

    /** Property names documented for the elements of an array-typed field. */
    const itemKeys = (spec, props, field) =>
        new Set(Object.keys(deref(spec, props[field].items).properties));

    test('status latest items match the documented item properties', () => {
        const spec = generateOpenApiSpec();
        const documented = itemKeys(spec, dataProps(spec, '/api/v1/h1/status'), 'items');
        const emitted = Object.keys(
            projectLatest(statusRows, 42, 100, undefined).items[0],
        );

        expect(emitted.length).toBeGreaterThan(0);
        for (const key of emitted) expect([...documented]).toContain(key);
    });

    test('stats items match the documented item properties', () => {
        const spec = generateOpenApiSpec();
        const documented = itemKeys(spec, dataProps(spec, '/api/v1/h1/stats'), 'items');
        const emitted = Object.keys(projectStats(statsRows, 42, 100, 900).items[0]);

        expect(emitted.length).toBeGreaterThan(0);
        for (const key of emitted) expect([...documented]).toContain(key);
    });

    test('every map front is individually optional, not blanket-partial', () => {
        // .partial() made all four optional at once, so a contract test could not
        // distinguish "narrowed by ?enemy=" from "dropped by a regression".
        const spec = generateOpenApiSpec();
        const props = dataProps(spec, '/api/v1/h1/map');
        const fronts = props.fronts;

        expect(Object.keys(fronts.properties).sort()).toEqual([
            'bugs',
            'cyborgs',
            'illuminate',
            'superEarth',
        ]);
        expect(fronts.required ?? []).toEqual([]);
    });
});
