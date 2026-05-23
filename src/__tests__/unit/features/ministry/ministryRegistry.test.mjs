import { describe, test, expect, beforeEach } from 'vitest';
import {
    createRegistry,
} from '@/features/ministry/ministryRegistry.mjs';

describe('createRegistry', () => {
    let registry;
    beforeEach(() => {
        registry = createRegistry();
    });

    test('register adds an entry; pickEligible can find it', () => {
        registry.register('a', {
            text: 'Hello',
            category: 'heading',
            scope: 'global',
            onHijack: () => {},
            onFlicker: () => {},
        });
        const eligible = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: false },
        );
        expect(eligible?.id).toBe('a');
    });

    test('unregister removes the entry', () => {
        registry.register('a', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.unregister('a');
        const eligible = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: false },
        );
        expect(eligible).toBeNull();
    });

    test('global descriptors are eligible everywhere; archives only on /archives*', () => {
        registry.register('g', {
            text: 'G', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.register('a', {
            text: 'A', category: 'body', scope: 'archives',
            onHijack: () => {}, onFlicker: () => {},
        });
        // On home: only 'g' eligible.
        const onHome = [];
        registry.forEachEligible({ pathname: '/' }, (id) => onHome.push(id));
        expect(onHome).toEqual(['g']);

        // On /archives: both eligible.
        const onArchives = [];
        registry.forEachEligible({ pathname: '/archives' }, (id) => onArchives.push(id));
        expect(onArchives.sort()).toEqual(['a', 'g']);

        // On /archives/42: still both eligible (startsWith match).
        const onArchives42 = [];
        registry.forEachEligible({ pathname: '/archives/42' }, (id) => onArchives42.push(id));
        expect(onArchives42.sort()).toEqual(['a', 'g']);
    });

    test('setIdle controls whether requireIdle filter accepts the entry', () => {
        registry.register('a', {
            text: 'X', category: 'heading', scope: 'global',
            onHijack: () => {}, onFlicker: () => {},
        });
        registry.setIdle('a', false);
        const pickedNonIdle = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: true },
        );
        expect(pickedNonIdle).toBeNull();

        registry.setIdle('a', true);
        const pickedIdle = registry.pickEligible(
            { rng: () => 0, pathname: '/', requireIdle: true },
        );
        expect(pickedIdle?.id).toBe('a');
    });

    test('pickEligible returns null when registry is empty', () => {
        expect(
            registry.pickEligible({ rng: () => 0, pathname: '/', requireIdle: false }),
        ).toBeNull();
    });
});
