/**
 * Module-level registry for Ministry Interference descriptors.
 *
 * Lives outside React state — registering/unregistering a Hijackable
 * never triggers a React re-render of the provider or its consumers.
 * The provider holds one of these in a useRef and shares the API via
 * stable context callbacks.
 *
 * Each descriptor:
 *   {
 *     text: string,
 *     altText?: string,
 *     category: 'heading' | 'value' | 'body' | 'footer',
 *     scope: 'global' | 'archives',
 *     onHijack: (altText: string) => void,
 *     onFlicker: (charIndex: number, durationMs: number) => void,
 *     isIdle: boolean (default true),
 *   }
 */

function isScopeEligible(scope, pathname) {
    if (scope === 'global') return true;
    if (scope === 'archives') return pathname.startsWith('/archives');
    return false;
}

export function createRegistry() {
    const entries = new Map();

    function register(id, descriptor) {
        entries.set(id, { ...descriptor, isIdle: true });
    }

    function unregister(id) {
        entries.delete(id);
    }

    function setIdle(id, isIdle) {
        const entry = entries.get(id);
        if (entry) entry.isIdle = isIdle;
    }

    function forEachEligible({ pathname, requireIdle = false }, fn) {
        for (const [id, entry] of entries) {
            if (!isScopeEligible(entry.scope, pathname)) continue;
            if (requireIdle && !entry.isIdle) continue;
            fn(id, entry);
        }
    }

    function pickEligible({ rng, pathname, requireIdle = false }) {
        const eligible = [];
        forEachEligible({ pathname, requireIdle }, (id, entry) =>
            eligible.push({ id, entry }),
        );
        if (eligible.length === 0) return null;
        const idx = Math.floor(rng() * eligible.length);
        return eligible[Math.min(idx, eligible.length - 1)];
    }

    function size() {
        return entries.size;
    }

    return { register, unregister, setIdle, forEachEligible, pickEligible, size };
}
